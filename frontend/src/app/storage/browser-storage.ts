import { Injectable, InjectionToken, inject } from '@angular/core';

/**
 * Accès au `localStorage`, `null` s'il est indisponible (navigation privée, stockage bloqué) : l'application
 * fonctionne alors sans préremplissage.
 */
export const LOCAL_STORAGE = new InjectionToken<() => Storage | null>('LOCAL_STORAGE', {
  providedIn: 'root',
  factory: () => () => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  },
});

const PSEUDO_KEY = 'pp.pseudo';
const tokenKey = (sessionId: string) => `pp.token.${sessionId}`;

/**
 * Jeton par session (`pp.token.{sessionId}`) et dernier pseudo (`pp.pseudo`). Aucune méthode ne lève. Quand le
 * `localStorage` est indisponible ou refuse l'écriture, les valeurs sont gardées en mémoire pour la durée de la
 * page : le jeton obtenu en rejoignant reste ainsi utilisable par la connexion de session.
 */
@Injectable({ providedIn: 'root' })
export class BrowserStorage {
  private readonly storage = inject(LOCAL_STORAGE);
  private readonly fallback = new Map<string, string>();

  readPseudo(): string | null {
    return this.read(PSEUDO_KEY);
  }

  savePseudo(pseudo: string): void {
    this.write(PSEUDO_KEY, pseudo);
  }

  readToken(sessionId: string): string | null {
    return this.read(tokenKey(sessionId));
  }

  saveToken(sessionId: string, token: string): void {
    this.write(tokenKey(sessionId), token);
  }

  /** Efface le jeton d'une session disparue. */
  removeToken(sessionId: string): void {
    this.fallback.delete(tokenKey(sessionId));
    try {
      this.storage()?.removeItem(tokenKey(sessionId));
    } catch {
      // Stockage refusé : rien à effacer.
    }
  }

  private read(key: string): string | null {
    try {
      const stored = this.storage()?.getItem(key) ?? null;
      if (stored !== null) return stored;
    } catch {
      // Stockage refusé : repli en mémoire.
    }
    return this.fallback.get(key) ?? null;
  }

  private write(key: string, value: string): void {
    try {
      const storage = this.storage();
      if (storage) {
        storage.setItem(key, value);
        this.fallback.delete(key);
        return;
      }
    } catch {
      // Stockage plein ou refusé : repli en mémoire.
    }
    this.fallback.set(key, value);
  }
}
