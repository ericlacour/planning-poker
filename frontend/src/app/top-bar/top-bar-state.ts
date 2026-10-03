import { Injectable, signal } from '@angular/core';

/** Ce que la page courante affiche dans la barre du haut (toujours affichée par `App`). */
@Injectable({ providedIn: 'root' })
export class TopBarState {
  /** Lien de session à partager : « Copier le lien » apparaît dans la barre du haut quand il est défini. */
  readonly shareUrl = signal<string | null>(null);
}
