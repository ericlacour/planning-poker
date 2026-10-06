import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { ChangeAction, SessionState } from '../api/contract';
import { voteCounter } from './cards';
import { ResultLineComponent, ResultPanelComponent } from './result';
import { SessionService } from './session.service';

/** Durée pendant laquelle les boutons restent inactifs après un changement d'état venu d'un autre (FR-17). */
export const CROSS_CLICK_GUARD_MS = 1_000;

/** Changements d'état du tour qui bloquent les boutons quand ils viennent d'un autre participant. */
const GUARDED_ACTIONS: readonly ChangeAction[] = ['REVEAL', 'HIDE', 'CLEAR'];

/** Vrai si cet instantané doit bloquer les boutons : révéler, masquer ou effacer fait par un autre que moi. */
export function blocksActions(state: SessionState): boolean {
  return (
    GUARDED_ACTIONS.includes(state.lastChange.action) &&
    state.lastChange.byParticipantId !== state.selfParticipantId
  );
}

/**
 * Barre d'action (`action-bar`, `button-primary`, `button-secondary`). Tour caché : le compteur « N votes sur M »
 * tiré de `progress` (ou « Aucun votant »), « Effacer les votes » et « Révéler les votes ». Tour révélé : le panneau
 * de résultat à la place du compteur, « Masquer » (revoter sur le même tour) et « Nouveau tour ». Chaque bouton envoie
 * son intention avec le `roundId` courant, sans confirmation. Sur téléphone (< 600 px), le panneau intégré laisse
 * la place au résultat condensé, posé juste au-dessus de la barre (la feuille de style choisit l'un ou l'autre).
 * Après un REVEAL, HIDE ou CLEAR fait par un autre, les boutons restent inactifs pendant 1 s, pour qu'un clic parti
 * trop tôt ne tombe pas sur le nouveau bouton. Connexion perdue : boutons inactifs jusqu'à son rétablissement.
 * Les deux boutons (secondaire, principal) restent les mêmes éléments d'un tour à l'autre et ne sont jamais
 * `disabled` : inactifs, ils portent `aria-disabled="true"` et leur clic est sans effet, si bien qu'un bouton qui a
 * le focus le garde quand un autre révèle ou efface.
 */
@Component({
  selector: 'app-action-bar',
  imports: [ResultLineComponent, ResultPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (revealed()) {
      <app-result-line class="result-line-dock" [summary]="state().summary" />
    }
    <div class="action-bar" [class.action-bar-revealed]="revealed()">
      @if (revealed()) {
        <app-result-panel [summary]="state().summary" />
      } @else {
        <span class="vote-counter">{{ counter() }}</span>
      }
      <div class="action-buttons">
        <!-- Deux boutons stables : seuls libellé et action changent, pour que le focus survive à une révélation. -->
        <button
          type="button"
          class="btn btn-secondary"
          [attr.aria-disabled]="inactive() ? 'true' : null"
          (click)="secondary()"
        >
          {{ revealed() ? 'Masquer' : 'Effacer les votes' }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          [attr.aria-disabled]="inactive() ? 'true' : null"
          (click)="primary()"
        >
          {{ revealed() ? 'Nouveau tour' : 'Révéler les votes' }}
        </button>
      </div>
    </div>
  `,
})
export class ActionBarComponent {
  protected readonly session = inject(SessionService);

  readonly state = input.required<SessionState>();

  protected readonly counter = computed(() => voteCounter(this.state().progress));
  protected readonly revealed = computed(() => this.state().round.status === 'REVEALED');
  /** Boutons inactifs pendant 1 s après un changement d'état fait par un autre. */
  protected readonly guarded = signal(false);
  /** Boutons inactifs : garde de 1 s, ou connexion pas (encore) rétablie. */
  protected readonly inactive = computed(
    () => this.guarded() || this.session.connection() !== 'open',
  );

  /** Bouton secondaire : « Masquer » en tour révélé, « Effacer les votes » en tour caché. */
  protected secondary(): void {
    if (this.inactive()) return;
    if (this.revealed()) this.session.hide();
    else this.session.clear();
  }

  /** Bouton principal : « Nouveau tour » en tour révélé, « Révéler les votes » en tour caché. */
  protected primary(): void {
    if (this.inactive()) return;
    if (this.revealed()) this.session.clear();
    else this.session.reveal();
  }

  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastSeen: SessionState | null = null;

  constructor() {
    effect(() => {
      const state = this.state();
      const previous = this.lastSeen;
      this.lastSeen = state;
      // Seul un changement nouveau bloque : ni le premier instantané, ni un instantané renvoyé à la reconnexion.
      if (!previous || state.version <= previous.version || !blocksActions(state)) return;
      clearTimeout(this.timer);
      this.guarded.set(true);
      this.timer = setTimeout(() => this.guarded.set(false), CROSS_CLICK_GUARD_MS);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }
}
