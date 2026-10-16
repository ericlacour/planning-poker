import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal, viewChildren } from '@angular/core';

import { Card, Role, SessionState } from '../api/contract';
import { CardFaceComponent, cardName } from './cards';
import { SessionService } from './session.service';

const ROLES: readonly { readonly value: Role; readonly label: string }[] = [
  { value: 'VOTER', label: 'Je vote' },
  { value: 'OBSERVER', label: "J'observe" },
];

/**
 * Main « Ta carte » (`poker-card`, `poker-card-selected`), affichée quel que soit mon rôle, et en bas à gauche la
 * bascule « Je vote » / « J'observe » (`hand-role`, groupe « Ton rôle » de deux boutons bascule, mon rôle actuel
 * enfoncé). Choisir l'autre rôle envoie `changeRole` (FR5) ; choisir le rôle actuel ne fait rien ; hors connexion, la
 * bascule est grisée (`aria-disabled`) et sans effet. Observateur : les cartes restent visibles mais grisées.
 * Barre d'outils d'autant de boutons bascule que de cartes du jeu de la session (2 à 11) à focus itinérant : un seul arrêt de tabulation, flèches gauche / droite
 * pour passer d'une carte à l'autre, Entrée ou Espace pour choisir. Cliquer une carte envoie `vote`, recliquer la
 * carte choisie retire le vote. L'état « choisi » vient de l'instantané (mon `vote`), sans mise à jour optimiste.
 * Tour révélé, ou arrivée pendant la révélation : main grisée, sans effet. L'hôte est un repère (`region`
 * « Ta main »), la main étant hors de `<main>`.
 */
@Component({
  selector: 'app-hand',
  imports: [CardFaceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'region', 'aria-label': 'Ta main' },
  template: `
    @if (me(); as me) {
      <div class="hand" [class.hand-locked]="!open()">
        <div class="hand-main">
          @if (open() && myVote() === null) {
            <p class="hand-hint">Choisis ta carte</p>
          }
          <div
            class="hand-cards"
            role="toolbar"
            aria-label="Ta carte"
            [style.--hand-columns]="columns()"
            [attr.aria-disabled]="open() ? null : 'true'"
            (keydown)="onKeydown($event)"
          >
            @for (card of cards(); track card; let i = $index) {
              <button
                #cardButton
                type="button"
                class="poker-card"
                [class.poker-card-selected]="card === myVote()"
                [appCardFace]="card"
                [attr.aria-label]="name(card)"
                [attr.aria-pressed]="card === myVote()"
                [tabIndex]="i === activeIndex() ? 0 : -1"
                [attr.aria-disabled]="open() ? null : 'true'"
                (focus)="focused.set(i)"
                (click)="choose(card)"
              ></button>
            }
          </div>
        </div>
        <div class="hand-role" role="group" aria-label="Ton rôle">
          @for (option of roles; track option.value) {
            <button
              type="button"
              class="role"
              [attr.aria-pressed]="me.role === option.value"
              [attr.aria-disabled]="connected() ? null : 'true'"
              (click)="chooseRole(option.value)"
            >
              {{ option.label }}
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class HandComponent {
  private readonly session = inject(SessionService);
  private readonly buttons = viewChildren('cardButton', { read: ElementRef<HTMLButtonElement> });

  /** Dernier instantané, `null` avant le premier. */
  readonly state = input<SessionState | null>(null);

  protected readonly name = cardName;
  protected readonly roles = ROLES;
  /** Carte qui a reçu le focus en dernier, `null` tant que la main ne l'a jamais eu. */
  protected readonly focused = signal<number | null>(null);

  protected readonly me = computed(() => {
    const state = this.state();
    return state?.participants.find((p) => p.participantId === state.selfParticipantId) ?? null;
  });
  /** Les cartes du jeu de la session, dans l'ordre de la main ; aucune avant le premier instantané. */
  protected readonly cards = computed<readonly Card[]>(() => this.state()?.deck.cards ?? []);
  /** Colonnes du tiroir du téléphone : une seule rangée jusqu'à 5 cartes, sinon deux rangées. */
  protected readonly columns = computed(() => {
    const count = this.cards().length;
    return count <= 5 ? Math.max(count, 1) : Math.ceil(count / 2);
  });
  protected readonly myVote = computed(() => this.me()?.vote ?? null);
  /**
   * Main active : connexion rétablie, tour caché et vote permis pour ce tour. Sinon elle est grisée
   * (`aria-disabled`) mais garde le focus, pour qu'une révélation ou une coupure ne le fasse pas sauter ; ses clics
   * sont sans effet.
   */
  protected readonly open = computed(
    () =>
      this.session.connection() === 'open' &&
      this.state()?.round.status === 'HIDDEN' &&
      this.me()?.canVoteThisRound === true,
  );
  /** Connexion rétablie : hors connexion, la bascule de rôle est grisée (`aria-disabled`) et sans effet. */
  protected readonly connected = computed(() => this.session.connection() === 'open');
  /** Seul arrêt de tabulation : la dernière carte visitée, sinon la carte choisie, sinon la première. */
  protected readonly activeIndex = computed(() => {
    const focused = this.focused();
    if (focused !== null) return focused;
    const vote = this.myVote();
    return vote === null ? 0 : Math.max(this.cards().indexOf(vote), 0);
  });

  protected choose(card: Card): void {
    if (!this.open()) return;
    this.session.vote(card === this.myVote() ? null : card);
  }

  protected chooseRole(role: Role): void {
    if (this.connected() && role !== this.me()?.role) this.session.changeRole(role);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const index = this.buttons().findIndex((b) => b.nativeElement === event.target);
    if (index < 0) return;
    switch (event.key) {
      case 'ArrowRight':
        this.move(event, Math.min(index + 1, this.cards().length - 1));
        break;
      case 'ArrowLeft':
        this.move(event, Math.max(index - 1, 0));
        break;
      case 'Home':
        this.move(event, 0);
        break;
      case 'End':
        this.move(event, this.cards().length - 1);
        break;
      case 'Enter':
      case ' ':
        // Géré ici (et non par le clic natif) pour un seul envoi, quel que soit le navigateur ; une touche
        // maintenue (répétition) n'envoie rien de plus.
        event.preventDefault();
        if (!event.repeat) this.choose(this.cards()[index]);
        break;
    }
  }

  private move(event: KeyboardEvent, index: number): void {
    event.preventDefault();
    this.focused.set(index);
    this.buttons()[index]?.nativeElement.focus();
  }
}
