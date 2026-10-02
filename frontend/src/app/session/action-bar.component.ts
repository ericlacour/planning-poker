import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { SessionState } from '../api/contract';
import { voteCounter } from './cards';

/**
 * Barre d'action (`action-bar`) : le compteur « N votes sur M » tiré de `progress`, ou « Aucun votant ». Les
 * boutons « Révéler les votes » et « Effacer les votes » viennent avec la story 1.7.
 */
@Component({
  selector: 'app-action-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="action-bar">
      <span class="vote-counter">{{ counter() }}</span>
    </div>
  `,
})
export class ActionBarComponent {
  readonly state = input.required<SessionState>();
  protected readonly counter = computed(() => voteCounter(this.state().progress));
}
