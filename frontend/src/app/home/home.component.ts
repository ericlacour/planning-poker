import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { createSessionRequest } from '../api/contract';
import { SessionApi, SessionApiError } from '../api/session-api';
import { EntryFormComponent, EntryFormValue } from '../entry-form/entry-form.component';
import { BrowserStorage } from '../storage/browser-storage';

export const INVALID_PSEUDO_MESSAGE = "Ce pseudo n'est pas valide.";
export const NETWORK_MESSAGE = 'Impossible de joindre le serveur.';

/** Accueil : créer une session (FR-1). */
@Component({
  selector: 'app-home',
  imports: [EntryFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="entry-screen">
      <app-entry-form
        submitLabel="Créer une session"
        [initialPseudo]="initialPseudo"
        [busy]="busy()"
        [pseudoError]="pseudoError()"
        [submitError]="submitError()"
        (submitted)="create($event)"
      />
    </main>
  `,
})
export class HomeComponent {
  private readonly api = inject(SessionApi);
  private readonly storage = inject(BrowserStorage);
  private readonly router = inject(Router);

  protected readonly initialPseudo = this.storage.readPseudo() ?? '';
  protected readonly busy = signal(false);
  protected readonly pseudoError = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);

  protected async create({ pseudo, role }: EntryFormValue): Promise<void> {
    this.busy.set(true);
    this.pseudoError.set(null);
    this.submitError.set(null);
    let sessionId: string;
    try {
      const response = await this.api.createSession(createSessionRequest(pseudo, role));
      sessionId = response.sessionId;
      this.storage.saveToken(sessionId, response.participantToken);
      this.storage.savePseudo(pseudo.trim());
    } catch (e) {
      if (e instanceof SessionApiError && e.kind === 'invalidPseudo') {
        this.pseudoError.set(INVALID_PSEUDO_MESSAGE);
      } else {
        this.submitError.set(NETWORK_MESSAGE);
      }
      this.busy.set(false);
      return;
    }
    // La session existe : un échec de navigation n'est pas une erreur réseau, le formulaire redevient actif.
    const navigated = await this.router.navigate(['/s', sessionId]).catch(() => false);
    if (!navigated) {
      this.busy.set(false);
    }
  }
}
