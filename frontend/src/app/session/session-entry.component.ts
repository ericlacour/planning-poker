import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { joinSessionRequest } from '../api/contract';
import { SessionApi, SessionApiError } from '../api/session-api';
import { EntryFormComponent, EntryFormValue } from '../entry-form/entry-form.component';
import { INVALID_PSEUDO_MESSAGE, NETWORK_MESSAGE, PSEUDO_TAKEN_MESSAGE } from '../entry-form/entry-messages';
import { BrowserStorage } from '../storage/browser-storage';
import { SessionPageComponent } from './session-page.component';
import { SessionService } from './session.service';


/**
 * - `checking` : vérification de la session en cours ;
 * - `notFound` : « Session introuvable » ;
 * - `unreachable` : échec réseau de la vérification, « Réessayer » ;
 * - `join` : écran Rejoindre ;
 * - `session` : page de session (WebSocket ouvert par {@link SessionService}).
 */
export type SessionEntryState = 'checking' | 'notFound' | 'unreachable' | 'join' | 'session';

/**
 * Ouverture d'un lien de session `/s/{sessionId}` (FR-2, FR-3) : vérifie d'abord la session, puis aiguille vers
 * « Session introuvable », l'écran Rejoindre, ou la page de session si un jeton est déjà rangé. Une fermeture
 * `4404` du WebSocket ramène à « Session introuvable », une fermeture `4401` à l'écran Rejoindre prérempli.
 */
@Component({
  selector: 'app-session-entry',
  imports: [EntryFormComponent, SessionPageComponent],
  providers: [SessionService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('checking') {
        <main class="state-screen" aria-busy="true"></main>
      }
      @case ('notFound') {
        <main class="state-screen session-not-found" role="alert">
          <svg class="state-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 5.5v5.5" />
            <circle cx="10" cy="14.2" r=".6" fill="currentColor" />
          </svg>
          <h1 class="state-error">Cette session n'existe plus.</h1>
          <p class="lead">Elle a peut-être expiré, ou le serveur a redémarré.</p>
          <button type="button" class="btn btn-primary" (click)="goHome()">Créer une session</button>
        </main>
      }
      @case ('unreachable') {
        <main class="state-screen session-unreachable" role="alert">
          <svg class="state-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 5.5v5.5" />
            <circle cx="10" cy="14.2" r=".6" fill="currentColor" />
          </svg>
          <h1 class="state-error">Impossible de joindre le serveur.</h1>
          <button type="button" class="btn btn-primary" (click)="check()">Réessayer</button>
        </main>
      }
      @case ('join') {
        <main class="entry-screen">
          <app-entry-form
            submitLabel="Rejoindre"
            [initialPseudo]="initialPseudo()"
            [busy]="busy()"
            [pseudoError]="pseudoError()"
            [submitError]="submitError()"
            (submitted)="join($event)"
          />
        </main>
      }
      @case ('session') {
        <app-session-page />
      }
    }
  `,
})
export class SessionEntryComponent implements OnInit {
  private readonly api = inject(SessionApi);
  private readonly storage = inject(BrowserStorage);
  private readonly router = inject(Router);
  private readonly sessionId = inject(ActivatedRoute).snapshot.paramMap.get('sessionId') ?? '';

  protected readonly state = signal<SessionEntryState>('checking');
  private readonly session = inject(SessionService);

  protected readonly initialPseudo = signal(this.storage.readPseudo() ?? '');
  protected readonly busy = signal(false);
  protected readonly pseudoError = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);

  constructor() {
    // Le jeton est déjà effacé par le service.
    effect(() => {
      const end = this.session.end();
      if (!end) return;
      untracked(() => {
        if (end === 'notFound') {
          this.state.set('notFound');
        } else {
          this.initialPseudo.set(this.storage.readPseudo() ?? '');
          this.state.set('join');
        }
      });
    });
  }

  ngOnInit(): void {
    void this.check();
  }

  /** `GET /api/sessions/{id}` puis aiguillage. */
  protected async check(): Promise<void> {
    this.state.set('checking');
    try {
      await this.api.checkSession(this.sessionId);
    } catch (e) {
      if (e instanceof SessionApiError && e.kind === 'notFound') {
        this.showNotFound();
      } else {
        this.state.set('unreachable');
      }
      return;
    }
    this.state.set(this.storage.readToken(this.sessionId) ? 'session' : 'join');
  }

  protected async join({ pseudo, role }: EntryFormValue): Promise<void> {
    this.busy.set(true);
    this.pseudoError.set(null);
    this.submitError.set(null);
    try {
      const response = await this.api.joinSession(this.sessionId, joinSessionRequest(pseudo, role));
      this.storage.saveToken(this.sessionId, response.participantToken);
      this.storage.savePseudo(pseudo.trim());
      this.state.set('session');
    } catch (e) {
      const kind = e instanceof SessionApiError ? e.kind : 'network';
      if (kind === 'notFound') {
        this.showNotFound();
      } else if (kind === 'pseudoTaken') {
        this.pseudoError.set(PSEUDO_TAKEN_MESSAGE);
      } else if (kind === 'invalidPseudo') {
        this.pseudoError.set(INVALID_PSEUDO_MESSAGE);
      } else {
        this.submitError.set(NETWORK_MESSAGE);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected goHome(): void {
    void this.router.navigate(['/']);
  }

  private showNotFound(): void {
    this.storage.removeToken(this.sessionId);
    this.state.set('notFound');
  }
}
