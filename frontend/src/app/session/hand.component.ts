import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal, viewChildren } from '@angular/core';

import { Card, CARDS, SessionState } from '../api/contract';
import { CardFaceComponent, cardName } from './cards';
import { SessionService } from './session.service';

/**
 * Main « Ta carte » (`poker-card`, `poker-card-selected`) pour un votant, ou « Tu observes » pour un observateur.
 * Barre d'outils de 10 boutons bascule à focus itinérant : un seul arrêt de tabulation, flèches gauche / droite
 * pour passer d'une carte à l'autre, Entrée ou Espace pour choisir. Cliquer une carte envoie `vote`, recliquer la
 * carte choisie retire le vote. L'état « choisi » vient de l'instantané (mon `vote`), sans mise à jour optimiste.
 * Tour révélé, ou arrivée pendant la révélation : main grisée, sans effet.
 */
@Component({
  selector: 'app-hand',
  imports: [CardFaceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (me(); as me) {
      @if (me.role === 'VOTER') {
        <div class="hand" [class.hand-locked]="!open()">
          @if (open() && myVote() === null) {
            <p class="hand-hint">Choisis ta carte</p>
          }
          <div
            class="hand-cards"
            role="toolbar"
            aria-label="Ta carte"
            [attr.aria-disabled]="open() ? null : 'true'"
            (keydown)="onKeydown($event)"
          >
            @for (card of cards; track card; let i = $index) {
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
      } @else {
        <div class="hand hand-observer">
          <p class="hand-hint">Tu observes</p>
        </div>
      }
    }
  `,
})
export class HandComponent {
  private readonly session = inject(SessionService);
  private readonly buttons = viewChildren('cardButton', { read: ElementRef<HTMLButtonElement> });

  /** Dernier instantané, `null` avant le premier. */
  readonly state = input<SessionState | null>(null);

  protected readonly cards = CARDS;
  protected readonly name = cardName;
  /** Carte qui a reçu le focus en dernier, `null` tant que la main ne l'a jamais eu. */
  protected readonly focused = signal<number | null>(null);

  protected readonly me = computed(() => {
    const state = this.state();
    return state?.participants.find((p) => p.participantId === state.selfParticipantId) ?? null;
  });
  protected readonly myVote = computed(() => this.me()?.vote ?? null);
  /**
   * Main active : tour caché et vote permis pour ce tour. Sinon elle est grisée (`aria-disabled`) mais garde le
   * focus, pour qu'une révélation ne le fasse pas sauter ; ses clics sont sans effet.
   */
  protected readonly open = computed(
    () => this.state()?.round.status === 'HIDDEN' && this.me()?.canVoteThisRound === true,
  );
  /** Seul arrêt de tabulation : la dernière carte visitée, sinon la carte choisie, sinon la première. */
  protected readonly activeIndex = computed(() => {
    const focused = this.focused();
    if (focused !== null) return focused;
    const vote = this.myVote();
    return vote === null ? 0 : CARDS.indexOf(vote);
  });

  protected choose(card: Card): void {
    if (!this.open()) return;
    this.session.vote(card === this.myVote() ? null : card);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const index = this.buttons().findIndex((b) => b.nativeElement === event.target);
    if (index < 0) return;
    switch (event.key) {
      case 'ArrowRight':
        this.move(event, Math.min(index + 1, CARDS.length - 1));
        break;
      case 'ArrowLeft':
        this.move(event, Math.max(index - 1, 0));
        break;
      case 'Home':
        this.move(event, 0);
        break;
      case 'End':
        this.move(event, CARDS.length - 1);
        break;
      case 'Enter':
      case ' ':
        // Géré ici (et non par le clic natif) pour un seul envoi, quel que soit le navigateur ; une touche
        // maintenue (répétition) n'envoie rien de plus.
        event.preventDefault();
        if (!event.repeat) this.choose(CARDS[index]);
        break;
    }
  }

  private move(event: KeyboardEvent, index: number): void {
    event.preventDefault();
    this.focused.set(index);
    this.buttons()[index]?.nativeElement.focus();
  }
}
