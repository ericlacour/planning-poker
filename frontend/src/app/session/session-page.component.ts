import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { CopyLinkComponent } from '../share/copy-link';
import { TopBarState } from '../top-bar/top-bar-state';
import { ActionBarComponent } from './action-bar.component';
import { HandComponent } from './hand.component';
import { ParticipantTableComponent } from './participant-table.component';
import { SessionService } from './session.service';

/** Lien de session partagé : `origine/s/{sessionId}`. */
export function sessionLink(origin: string, sessionId: string): string {
  return `${origin}/s/${encodeURIComponent(sessionId)}`;
}

/**
 * Écran Session : ouvre la connexion de la session ({@link SessionService}) et montre la table des participants
 * en direct. Seul dans la session : « Partage le lien pour inviter ton équipe » et « Copier le lien » en bouton
 * principal, sans barre d'action. Avec d'autres : la barre d'action et son compteur. En bas, la main « Ta carte »
 * (votant) ou « Tu observes » (observateur).
 */
@Component({
  selector: 'app-session-page',
  imports: [ActionBarComponent, CopyLinkComponent, HandComponent, ParticipantTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="session-page">
      <section class="session-table" aria-label="Table des participants">
        <app-participant-table [state]="session.state()" />
        @if (alone()) {
          <div class="invite">
            <p class="invite-text">Partage le lien pour inviter ton équipe</p>
            <p class="invite-url">{{ link }}</p>
            <app-copy-link [url]="link" variant="primary" />
          </div>
        }
      </section>
      @if (session.state(); as state) {
        @if (!alone()) {
          <app-action-bar [state]="state" />
        }
      }
    </main>
    <app-hand class="hand-dock" [state]="session.state()" />
  `,
})
export class SessionPageComponent {
  protected readonly session = inject(SessionService);
  private readonly sessionId = inject(ActivatedRoute).snapshot.paramMap.get('sessionId') ?? '';
  protected readonly link = sessionLink(location.origin, this.sessionId);
  protected readonly alone = computed(() => this.session.state()?.participants.length === 1);

  constructor() {
    const topBar = inject(TopBarState);
    topBar.shareUrl.set(this.link);
    this.session.connect(this.sessionId);
    inject(DestroyRef).onDestroy(() => {
      topBar.shareUrl.set(null);
      this.session.disconnect();
    });
  }
}
