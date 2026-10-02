import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { CopyLinkComponent } from '../share/copy-link';
import { TopBarState } from '../top-bar/top-bar-state';
import { ActionBarComponent } from './action-bar.component';
import { HandComponent } from './hand.component';
import { ParticipantTableComponent } from './participant-table.component';
import { announcementFor } from './result';
import { SessionService } from './session.service';

/** Lien de session partagé : `origine/s/{sessionId}`. */
export function sessionLink(origin: string, sessionId: string): string {
  return `${origin}/s/${encodeURIComponent(sessionId)}`;
}

/**
 * Écran Session : ouvre la connexion de la session ({@link SessionService}) et montre la table des participants
 * en direct. Seul dans la session : « Partage le lien pour inviter ton équipe » et « Copier le lien » en bouton
 * principal, sans barre d'action. Avec d'autres : la barre d'action (compteur ou résultat, et ses boutons). En bas,
 * la main « Ta carte » (votant) ou « Tu observes » (observateur). Une région `aria-live="polite"` annonce chaque
 * révélation (« Votes révélés. Moyenne … ») et chaque nouveau tour (« Nouveau tour »), quel qu'en soit l'auteur.
 * Mise en page (`styles/session-layout.css`) : l'écran tient dans la hauteur de la fenêtre, seule la zone de la table
 * (`session-scroll`) défile ; sur téléphone, la main devient un tiroir qui se replie quand le tour est révélé.
 */
@Component({
  selector: 'app-session-page',
  imports: [ActionBarComponent, CopyLinkComponent, HandComponent, ParticipantTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.session-revealed]': 'revealed()' },
  template: `
    <main class="session-page">
      <div class="session-scroll">
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
      </div>
      @if (session.state(); as state) {
        @if (!alone()) {
          <app-action-bar [state]="state" />
        }
      }
      <div class="visually-hidden" aria-live="polite">
        @for (a of announcements(); track a.id) {
          <p>{{ a.text }}</p>
        }
      </div>
    </main>
    <app-hand class="hand-dock" [state]="session.state()" />
  `,
})
export class SessionPageComponent {
  protected readonly session = inject(SessionService);
  private readonly sessionId = inject(ActivatedRoute).snapshot.paramMap.get('sessionId') ?? '';
  protected readonly link = sessionLink(location.origin, this.sessionId);
  protected readonly alone = computed(() => this.session.state()?.participants.length === 1);
  /** Tour révélé : classe `session-revealed` sur l'hôte, qui replie le tiroir de la main sur téléphone. */
  protected readonly revealed = computed(() => this.session.state()?.round.status === 'REVEALED');
  /**
   * Dernière annonce, rendue dans un nouvel élément à chaque fois (clé `id`) pour qu'une même phrase, comme deux
   * « Nouveau tour » de suite, soit annoncée de nouveau.
   */
  protected readonly announcements = signal<readonly { readonly id: number; readonly text: string }[]>([]);

  constructor() {
    const locale = inject(LOCALE_ID);
    let previous = this.session.state();
    let nextId = 0;
    effect(() => {
      const state = this.session.state();
      if (state === previous) return;
      const text = state ? announcementFor(previous, state, locale) : null;
      previous = state;
      if (text) this.announcements.set([{ id: nextId++, text }]);
    });

    const topBar = inject(TopBarState);
    topBar.shareUrl.set(this.link);
    this.session.connect(this.sessionId);
    inject(DestroyRef).onDestroy(() => {
      topBar.shareUrl.set(null);
      this.session.disconnect();
    });
  }
}
