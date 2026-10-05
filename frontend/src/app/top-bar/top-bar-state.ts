import { Injectable, signal } from '@angular/core';

import { SessionService } from '../session/session.service';

/** Ce que la page courante affiche dans la barre du haut (toujours affichée par `App`). */
@Injectable({ providedIn: 'root' })
export class TopBarState {
  /** Lien de session à partager : « Copier le lien » apparaît dans la barre du haut quand il est défini. */
  readonly shareUrl = signal<string | null>(null);
  /**
   * Connexion de la session affichée (fournie par l'écran Session, pas à la racine) : le menu du participant y lit mon
   * pseudo et mon rôle, et y envoie `changeRole`. Nulle hors de l'écran Session.
   */
  readonly session = signal<SessionService | null>(null);
}
