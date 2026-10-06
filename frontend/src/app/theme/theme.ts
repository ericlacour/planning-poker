import { DOCUMENT, Injectable, inject, signal } from '@angular/core';

import { BrowserStorage } from '../storage/browser-storage';

/** Thème choisi (UX-DR2) : `auto` suit `prefers-color-scheme`, `light` et `dark` l'emportent sur le système. */
export type Theme = 'auto' | 'light' | 'dark';

/** Valeur mémorisée sous `pp.theme` : absente ou inconnue, elle vaut `auto`. */
export function parseTheme(value: string | null | undefined): Theme {
  return value === 'light' || value === 'dark' ? value : 'auto';
}

/** `auto` retire `data-theme` de `<html>` ; `light` et `dark` le posent, ce qui force les jetons de `tokens.css`. */
export function applyTheme(doc: Document, theme: Theme): void {
  if (theme === 'auto') doc.documentElement.removeAttribute('data-theme');
  else doc.documentElement.setAttribute('data-theme', theme);
}

/**
 * Point unique du thème, préférence purement locale : hors de `SessionService`, jamais envoyée au serveur. Le thème
 * mémorisé est déjà appliqué au démarrage par `main.ts` ; `choose` l'applique sans rechargement et le mémorise sous
 * `pp.theme` (en mémoire pour la page si le stockage est indisponible).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(BrowserStorage);
  private readonly current = signal<Theme>(parseTheme(this.storage.readTheme()));

  readonly theme = this.current.asReadonly();

  choose(theme: Theme): void {
    applyTheme(this.document, theme);
    this.storage.saveTheme(theme);
    this.current.set(theme);
  }
}
