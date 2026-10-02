import { Injectable, InjectionToken, inject } from '@angular/core';

import { APP_CONFIG } from '../config/app-config';
import { CreateSessionRequest, CreateSessionResponse, parseCreateSessionResponse, parseProblem } from './contract';

/** `fetch` du navigateur, remplaçable dans les tests. */
export const FETCH = new InjectionToken<typeof fetch>('FETCH', {
  providedIn: 'root',
  factory: () => (input, init) => fetch(input, init),
});

/** Durée maximale d'un appel avant de le considérer comme un échec réseau. */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * - `invalidPseudo` : 400 `INVALID_PSEUDO` ;
 * - `network` : échec réseau, délai dépassé, 5xx, ou toute réponse inattendue.
 */
export type SessionApiErrorKind = 'invalidPseudo' | 'network';

export class SessionApiError extends Error {
  constructor(readonly kind: SessionApiErrorKind) {
    super(kind);
    this.name = 'SessionApiError';
  }
}

/** Appels REST des sessions (contrat : openapi.yaml). */
@Injectable({ providedIn: 'root' })
export class SessionApi {
  private readonly baseUrl = inject(APP_CONFIG).apiBaseUrl;
  private readonly fetchFn = inject(FETCH);

  /** `POST /api/sessions` */
  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    let response: Response;
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
    try {
      response = await this.fetchFn(`${this.baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        cache: 'no-store',
        signal: timeout.signal,
      });
    } catch {
      throw new SessionApiError('network');
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 201) {
      try {
        return parseCreateSessionResponse(await response.json());
      } catch {
        throw new SessionApiError('network');
      }
    }
    if (response.status === 400 && (await readProblem(response))?.code === 'INVALID_PSEUDO') {
      throw new SessionApiError('invalidPseudo');
    }
    throw new SessionApiError('network');
  }
}

async function readProblem(response: Response) {
  try {
    return parseProblem(await response.json());
  } catch {
    return null;
  }
}
