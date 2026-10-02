import { Injectable, InjectionToken, inject, signal } from '@angular/core';

import { APP_CONFIG } from '../config/app-config';

/**
 * - `checking` : première seconde, rien d'affiché pour éviter un flash ;
 * - `waking` : « Réveil du serveur… » ;
 * - `unavailable` : « Le serveur ne répond pas. » au bout de 3 min ;
 * - `ready` : `/api/health` a répondu 200.
 */
export type WakeState = 'checking' | 'waking' | 'unavailable' | 'ready';

/** Interroge une fois `/api/health` : vrai sur une réponse 200, faux sur toute autre réponse ou erreur. */
export type HealthProbe = () => Promise<boolean>;

export const WAKE_TIMINGS = {
  /** Délai avant d'afficher l'écran de réveil. */
  showAfterMs: 1_000,
  /** Intervalle entre deux interrogations. */
  pollEveryMs: 3_000,
  /** Durée maximale d'une interrogation. */
  requestTimeoutMs: 10_000,
  /** Au-delà, le serveur est déclaré indisponible (NFR-2). */
  giveUpAfterMs: 180_000,
} as const;

export const HEALTH_PROBE = new InjectionToken<HealthProbe>('HEALTH_PROBE', {
  providedIn: 'root',
  factory: () => {
    const url = `${inject(APP_CONFIG).apiBaseUrl}/api/health`;
    return async () => {
      try {
        const response = await fetch(url, {
          cache: 'no-store',
          signal: AbortSignal.timeout(WAKE_TIMINGS.requestTimeoutMs),
        });
        return response.status === 200;
      } catch {
        return false;
      }
    };
  },
});

/** Attend le réveil du webservice (NFR-2) : une erreur réseau ou un 5xx n'est jamais montré tel quel. */
@Injectable({ providedIn: 'root' })
export class ServerWakeService {
  private readonly probe = inject(HEALTH_PROBE);
  private readonly stateSignal = signal<WakeState>('checking');
  private cycle = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];

  readonly state = this.stateSignal.asReadonly();

  /** Démarre un cycle d'attente de 3 min ; « Réessayer » en relance un. */
  start(): void {
    const cycle = ++this.cycle;
    this.clearTimers();
    this.stateSignal.set('checking');
    this.later(WAKE_TIMINGS.showAfterMs, () => {
      if (this.stateSignal() === 'checking') this.stateSignal.set('waking');
    });
    this.later(WAKE_TIMINGS.giveUpAfterMs, () => this.finish(cycle, 'unavailable'));
    void this.poll(cycle);
  }

  private async poll(cycle: number): Promise<void> {
    const healthy = await this.probe();
    if (cycle !== this.cycle || this.stateSignal() === 'unavailable' || this.stateSignal() === 'ready') return;
    if (healthy) {
      this.finish(cycle, 'ready');
    } else {
      this.later(WAKE_TIMINGS.pollEveryMs, () => void this.poll(cycle));
    }
  }

  private finish(cycle: number, state: 'ready' | 'unavailable'): void {
    if (cycle !== this.cycle) return;
    this.clearTimers();
    this.cycle++;
    this.stateSignal.set(state);
  }

  private later(delayMs: number, action: () => void): void {
    this.timers.push(setTimeout(action, delayMs));
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
