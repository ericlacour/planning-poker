import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ParticipantState, SessionState } from '../api/contract';

/** Une place de la table, vue par moi. */
export interface Seat {
  readonly participant: ParticipantState;
  readonly isSelf: boolean;
}

/**
 * Places dans l'ordre du serveur (votants puis observateurs, chacun par ordre d'arrivée), ma place remontée en
 * tête de son groupe. Aucun autre tri n'est fait côté front.
 */
export function seatsOf(state: SessionState): Seat[] {
  const seats = state.participants.map((participant) => ({
    participant,
    isSelf: participant.participantId === state.selfParticipantId,
  }));
  const mine = seats.findIndex((seat) => seat.isSelf);
  if (mine < 0) return seats;
  const self = seats[mine];
  const groupStart = seats.findIndex((seat) => seat.participant.role === self.participant.role);
  seats.splice(mine, 1);
  seats.splice(groupStart, 0, self);
  return seats;
}

/** Nombre de places vides montrées en attendant le premier instantané. */
export const PENDING_SEATS = 3;

/**
 * Table des participants (`seat-card-empty`, `presence-dot`) : pseudo, pastille de présence, et carte vide en
 * pointillés pour un votant ou mention « observe » pour un observateur. Avant le premier instantané, des places
 * vides en attente, sans pseudo.
 */
@Component({
  selector: 'app-participant-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (seats(); as seats) {
      <ul class="seats" aria-label="Participants">
        @for (seat of seats; track seat.participant.participantId) {
          <li class="seat" [class.seat-self]="seat.isSelf" [class.offline]="!seat.participant.connected">
            @if (seat.participant.role === 'VOTER') {
              <span class="seat-card seat-card-empty" aria-hidden="true"></span>
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
  protected readonly pending = Array.from({ length: PENDING_SEATS }, (_, i) => i);
}
