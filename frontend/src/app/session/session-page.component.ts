import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { CopyLinkComponent } from '../share/copy-link';
import { TopBarState } from '../top-bar/top-bar-state';
import { ActionBarComponent } from './action-bar.component';
import { HandComponent } from './hand.component';
import { ParticipantTableComponent } from './participant-table.component';
import { announcementFor } from './result';
import { SessionService } from './session.service';

/** Durée totale du retournement des cartes à la révélation : départs étalés sur 200 ms, 200 ms par carte. */
export const REVEAL_FLIP_MS = 400;

/** Vrai si l'utilisateur demande moins de mouvement (`prefers-reduced-motion: reduce`). */
function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

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
 * Coupure de plus de 2 s : bandeau ambre « Reconnexion… » sous la barre du haut, la table restant visible.
 * Mise en page (`styles/session-layout.css`) : l'écran tient dans la hauteur de la fenêtre, seule la zone de la table
 * (`session-scroll`) défile ; sur téléphone, la main devient un tiroir qui se replie quand le tour est révélé.
 * Révélation (instantané `REVEALED` après un `HIDDEN`) : classe `session-flipping` pendant {@link REVEAL_FLIP_MS},
 * qui retourne les cartes des autres et cache la synthèse (`styles/reveal.css`) ; l'état, lui, est déjà à jour. Rien
 * sous `prefers-reduced-motion`, et tout `HIDDEN` coupe le retournement.
 */
@Component({
  selector: 'app-session-page',
  imports: [ActionBarComponent, CopyLinkComponent, HandComponent, ParticipantTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.session-revealed]': 'revealed()', '[class.session-flipping]': 'flipping()' },
  template: `
    <main class="session-page">
      <!-- Région toujours présente : seul son contenu change, pour que « Reconnexion… » soit annoncé. -->
      <div class="status-region" role="status">
        @if (session.reconnecting()) {
          <div class="status-banner">Reconnexion…</div>
        }
      </div>
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
  /** Retournement en cours : point unique qui anime la table et cache la synthèse, sans retarder l'état. */
  protected readonly flipping = signal(false);
  /**
   * Dernière annonce, rendue dans un nouvel élément à chaque fois (clé `id`) pour qu'une même phrase, comme deux
   * « Nouveau tour » de suite, soit annoncée de nouveau.
   */
  protected readonly announcements = signal<readonly { readonly id: number; readonly text: string }[]>([]);

  constructor() {
    const locale = inject(LOCALE_ID);
    let previous = this.session.state();
    let nextId = 0;
    let flipTimer: ReturnType<typeof setTimeout> | undefined;
    const stopFlip = () => {
      clearTimeout(flipTimer);
      flipTimer = undefined;
      this.flipping.set(false);
    };
    effect(() => {
      const state = this.session.state();
      if (state === previous) return;
      const text = state ? announcementFor(previous, state, locale) : null;
      const status = state?.round.status;
      if (status === 'HIDDEN') {
        stopFlip();
      } else if (status === 'REVEALED' && previous?.round.status === 'HIDDEN' && !prefersReducedMotion()) {
        stopFlip();
        this.flipping.set(true);
        flipTimer = setTimeout(stopFlip, REVEAL_FLIP_MS);
      }
      previous = state;
      if (text) this.announcements.set([{ id: nextId++, text }]);
    });

    const topBar = inject(TopBarState);
    topBar.shareUrl.set(this.link);
    topBar.session.set(this.session);
    this.session.connect(this.sessionId);
    inject(DestroyRef).onDestroy(() => {
      stopFlip();
      topBar.shareUrl.set(null);
      topBar.session.set(null);
      this.session.disconnect();
    });
  }
}
