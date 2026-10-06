import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Card, ParticipantState, SessionState } from '../api/contract';
import { CardFaceComponent, cardName } from './cards';

/** Une place de la table, vue par moi. */
export interface Seat {
  readonly participant: ParticipantState;
  readonly isSelf: boolean;
  /**
   * Carte de la place : `empty` (pas de vote), `back` (a voté, valeur cachée) ou la face visible. Pendant un tour
   * caché, seule ma place montre sa face (`vote` n'est rempli que pour moi).
   */
  readonly card: 'empty' | 'back' | { readonly face: Card };
  /**
   * Mention sous la place : « déconnecté » (prioritaire, quel que soit le rôle ; « déconnecté · observe » pour un
   * observateur qui garde son vote), « visible par toi seul » (ma face pendant un tour caché), « votera au prochain
   * tour » (votant arrivé pendant un tour révélé), « n'a pas voté » (tour révélé, sans vote), « observe »
   * (observateur qui garde son vote d'un tour révélé), ou rien. Une seule ligne par place : l'état du vote reste
   * lisible par la carte.
   */
  readonly note: string | null;
}

/** Mention d'une place, d'après l'instantané seul (`connected`, `canVoteThisRound`, `vote`, statut du tour). */
function noteOf(participant: ParticipantState, isSelf: boolean, hidden: boolean, card: Seat['card']): string | null {
  const observesWithCard = participant.role !== 'VOTER' && card !== 'empty';
  if (!participant.connected) return observesWithCard ? 'déconnecté · observe' : 'déconnecté';
  if (participant.role !== 'VOTER') return observesWithCard ? 'observe' : null;
  if (!participant.canVoteThisRound) return 'votera au prochain tour';
  if (card === 'empty') return hidden ? null : "n'a pas voté";
  if (card !== 'back' && hidden && isSelf) return 'visible par toi seul';
  return null;
}

/**
 * Places dans l'ordre du serveur (votants puis observateurs, chacun par ordre d'arrivée), ma place remontée en
 * tête de son groupe. Aucun autre tri n'est fait côté front.
 */
export function seatsOf(state: SessionState): Seat[] {
  const hidden = state.round.status === 'HIDDEN';
  const seats: Seat[] = state.participants.map((participant) => {
    const isSelf = participant.participantId === state.selfParticipantId;
    const visible = participant.vote !== null && (!hidden || isSelf);
    const card: Seat['card'] = visible
      ? { face: participant.vote as Card }
      : hidden && participant.hasVoted
        ? 'back'
        : 'empty';
    return { participant, isSelf, card, note: noteOf(participant, isSelf, hidden, card) };
  });
  const mine = seats.findIndex((seat) => seat.isSelf);
  if (mine < 0) return seats;
  const self = seats[mine];
  const groupStart = seats.findIndex((seat) => seat.participant.role === self.participant.role);
  seats.splice(mine, 1);
  seats.splice(groupStart, 0, self);
  return seats;
}

/** Étalement des départs du retournement : la première carte part à 0 ms, la dernière à 200 ms. */
export const FLIP_SPREAD_MS = 200;

/**
 * Délai de départ du retournement (ms) de chaque face des autres places, dans l'ordre de la table, étalés
 * régulièrement de 0 à {@link FLIP_SPREAD_MS} : chaque carte se retourne en 200 ms. La fenêtre du retournement dure
 * toujours 400 ms (la synthèse attend `REVEAL_FLIP_MS`) ; la dernière carte finit à 400 ms dès que deux cartes au
 * moins se retournent (une carte seule finit à 200 ms). Ma face (déjà visible pendant le tour caché) et les places sans face n'en ont pas.
 */
export function flipDelays(seats: readonly Seat[]): ReadonlyMap<string, number> {
  const flipping = seats.filter((seat) => !seat.isSelf && typeof seat.card === 'object');
  const step = flipping.length > 1 ? FLIP_SPREAD_MS / (flipping.length - 1) : 0;
  return new Map(flipping.map((seat, i) => [seat.participant.participantId, Math.round(i * step)]));
}

/** Nombre de places vides montrées en attendant le premier instantané. */
export const PENDING_SEATS = 3;

/**
 * Table des participants (`seat-card-empty`, `seat-card-back`, `seat-card-face`, `presence-dot`) : pseudo,
 * pastille de présence (grise, pseudo atténué et mention « déconnecté » pour un participant déconnecté), et pour
 * un votant une carte vide en pointillés (nommée « n'a pas voté » pour les lecteurs d'écran en tour caché), un dos
 * à croisillons s'il a voté, ou la face de ma carte avec « visible par toi seul ». Tour révélé : toutes les faces,
 * « n'a pas voté » sur une place sans vote, « votera au prochain tour » pour un votant arrivé pendant la révélation. Un observateur a la mention
 * « observe » à la place de la carte ; s'il garde le vote d'un tour révélé, sa face s'affiche avec « observe »
 * dessous (« déconnecté · observe » hors connexion). Avant le premier instantané, des places vides en attente, sans
 * pseudo. Les faces des autres portent `seat-card-flip` et leur délai `--flip-delay` ({@link flipDelays}) : la
 * feuille `reveal.css` les retourne quand l'écran Session est en `session-flipping`.
 */
@Component({
  selector: 'app-participant-table',
  imports: [CardFaceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (seats(); as seats) {
      <ul class="seats" aria-label="Participants">
        @for (seat of seats; track seat.participant.participantId) {
          <li class="seat" [class.seat-self]="seat.isSelf" [class.offline]="!seat.participant.connected">
            @if (showsCard(seat)) {
              @switch (seat.card) {
                @case ('empty') {
                  @if (hidden()) {
                    <span class="seat-card seat-card-empty" role="img" aria-label="n'a pas voté"></span>
                  } @else {
                    <span class="seat-card seat-card-empty" aria-hidden="true"></span>
                  }
                }
                @case ('back') {
                  <span class="seat-card seat-card-back card-back" role="img" aria-label="a voté"></span>
                }
                @default {
                  <span
                    class="seat-card seat-card-face"
                    [class.seat-card-flip]="delays().has(seat.participant.participantId)"
                    [style.--flip-delay.ms]="delays().get(seat.participant.participantId)"
                    role="img"
                    [appCardFace]="faceOf(seat)"
                    [attr.aria-label]="cardName(faceOf(seat))"
                  ></span>
                }
              }
            } @else {
              <span class="seat-card seat-card-observer">observe</span>
            }
            <span class="seat-who">
              <span
                class="presence-dot"
                [class.presence-online]="seat.participant.connected"
                [class.presence-offline]="!seat.participant.connected"
                aria-hidden="true"
              ></span>
              <span class="seat-pseudo">{{ seat.participant.pseudo }}</span>
              @if (seat.isSelf) {
                {{ ' ' }}<span class="seat-me">(toi)</span>
              }
            </span>
            @if (seat.note; as note) {
              <span class="seat-note">{{ note }}</span>
            }
          </li>
        }
      </ul>
    } @else {
      <ul class="seats" aria-label="Participants" aria-busy="true">
        @for (i of pending; track i) {
          <li class="seat seat-pending">
            <span class="seat-card seat-card-empty" aria-hidden="true"></span>
            <span class="seat-who"></span>
          </li>
        }
      </ul>
    }
  `,
})
export class ParticipantTableComponent {
  /** Dernier instantané, `null` avant le premier. */
  readonly state = input<SessionState | null>(null);

  protected readonly seats = computed(() => {
    const state = this.state();
    return state ? seatsOf(state) : null;
  });
  /** Tour caché : une carte vide est nommée « n'a pas voté » (en tour révélé, la mention visible suffit). */
  protected readonly hidden = computed(() => this.state()?.round.status === 'HIDDEN');
  /** Départs du retournement des faces des autres ; l'animation ne joue que sous `.session-flipping`. */
  protected readonly delays = computed(() => flipDelays(this.seats() ?? []));
  protected readonly pending = Array.from({ length: PENDING_SEATS }, (_, i) => i);

  /**
   * Un votant a toujours une carte ; un observateur n'en a une que s'il garde le vote d'un tour révélé, posé avant de
   * passer observateur (FR5). Sinon, la mention « observe » occupe l'emplacement de la carte.
   */
  protected showsCard(seat: Seat): boolean {
    return seat.participant.role === 'VOTER' || seat.card !== 'empty';
  }

  protected faceOf(seat: Seat): Card {
    return typeof seat.card === 'object' ? seat.card.face : '0';
  }

  protected readonly cardName = cardName;
}
