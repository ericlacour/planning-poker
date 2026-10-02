import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { CopyLinkComponent } from '../share/copy-link';
import { TopBarState } from '../top-bar/top-bar-state';

/** Lien de session partagé : `origine/s/{sessionId}`. */
export function sessionLink(origin: string, sessionId: string): string {
  return `${origin}/s/${encodeURIComponent(sessionId)}`;
}

/**
 * Page de session provisoire (story 1.3) : état « Session vide », avec le lien en clair et « Copier le lien ».
 * La story 1.5 la remplace par la table des participants.
 */
@Component({
  selector: 'app-session-page',
  imports: [CopyLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="session-page">
      <section class="session-table" aria-label="Table des participants">
        <div class="invite">
          <p class="invite-text">Partage le lien pour inviter ton équipe</p>
          <p class="invite-url">{{ link }}</p>
          <app-copy-link [url]="link" variant="primary" />
        </div>
      </section>
    </main>
  `,
})
export class SessionPageComponent {
  protected readonly link = sessionLink(
    location.origin,
    inject(ActivatedRoute).snapshot.paramMap.get('sessionId') ?? '',
  );

  constructor() {
    const topBar = inject(TopBarState);
    topBar.shareUrl.set(this.link);
    inject(DestroyRef).onDestroy(() => topBar.shareUrl.set(null));
  }
}
