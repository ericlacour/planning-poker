import { Injectable, InjectionToken, inject } from '@angular/core';

import { APP_CONFIG } from '../config/app-config';
import {
  CreateSessionRequest,
  CreateSessionResponse,
  JoinSessionRequest,
  JoinSessionResponse,
  ProblemCode,
  parseCreateSessionResponse,
  parseJoinSessionResponse,
  parseProblem,
} from './contract';

/** `fetch` du navigateur, remplaçable dans les tests. */
export const FETCH = new InjectionToken<typeof fetch>('FETCH', {
  providedIn: 'root',
  factory: () => (input, init) => fetch(input, init),
});

/** Durée maximale d'un appel avant de le considérer comme un échec réseau. */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * - `invalidPseudo` : 400 `INVALID_PSEUDO` ;
 * - `pseudoTaken` : 409 `PSEUDO_TAKEN` ;
 * - `sessionFull` : 409 `SESSION_FULL` ;
 * - `notFound` : 404 `SESSION_NOT_FOUND` ;
 * - `sessionLimitReached` : 503 `SESSION_LIMIT_REACHED` ;
 * - `tooManyRequests` : 429 `TOO_MANY_REQUESTS` ;
 * - `network` : échec réseau, délai dépassé, 5xx (sauf le 503 ci-dessus), 413, ou toute réponse inattendue.
 */
export type SessionApiErrorKind =
  | 'invalidPseudo'
  | 'pseudoTaken'
  | 'sessionFull'
  | 'notFound'
  | 'sessionLimitReached'
  | 'tooManyRequests'
  | 'network';

export class SessionApiError extends Error {
  constructor(readonly kind: SessionApiErrorKind) {
    super(kind);
    this.name = 'SessionApiError';
  }
}

/** Réponses d'erreur reconnues : statut et `code` du problème attendus ensemble. */
const KNOWN_PROBLEMS: readonly { status: number; code: ProblemCode; kind: SessionApiErrorKind }[] = [
  { status: 400, code: 'INVALID_PSEUDO', kind: 'invalidPseudo' },
  { status: 404, code: 'SESSION_NOT_FOUND', kind: 'notFound' },
  { status: 409, code: 'PSEUDO_TAKEN', kind: 'pseudoTaken' },
  { status: 409, code: 'SESSION_FULL', kind: 'sessionFull' },
  { status: 429, code: 'TOO_MANY_REQUESTS', kind: 'tooManyRequests' },
  { status: 503, code: 'SESSION_LIMIT_REACHED', kind: 'sessionLimitReached' },
];

/** Appels REST des sessions (contrat : openapi.yaml). */
@Injectable({ providedIn: 'root' })
export class SessionApi {
  private readonly baseUrl = inject(APP_CONFIG).apiBaseUrl;
  private readonly fetchFn = inject(FETCH);

  /** `POST /api/sessions` */
  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    const response = await this.send('/api/sessions', 'POST', request);
    if (response.status === 201) {
      return parseOrNetwork(response, parseCreateSessionResponse);
    }
    throw await errorOf(response, ['invalidPseudo', 'tooManyRequests', 'sessionLimitReached']);
  }

  /** `GET /api/sessions/{sessionId}` : résout si la session existe, sinon `notFound` ou `network`. */
  async checkSession(sessionId: string): Promise<void> {
    assertWellFormedId(sessionId);
    const response = await this.send(sessionPath(sessionId), 'GET');
    if (response.status === 204) {
      return;
    }
    throw await errorOf(response, ['notFound']);
  }

  /** `POST /api/sessions/{sessionId}/participants` */
  async joinSession(sessionId: string, request: JoinSessionRequest): Promise<JoinSessionResponse> {
    assertWellFormedId(sessionId);
    const response = await this.send(`${sessionPath(sessionId)}/participants`, 'POST', request);
    if (response.status === 200) {
      return parseOrNetwork(response, parseJoinSessionResponse);
    }
    throw await errorOf(response, ['invalidPseudo', 'notFound', 'pseudoTaken', 'sessionFull']);
  }

  private async send(path: string, method: 'GET' | 'POST', body?: unknown): Promise<Response> {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        ...(body === undefined
          ? {}
          : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        cache: 'no-store',
        signal: timeout.signal,
      });
    } catch {
      throw new SessionApiError('network');
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Un identifiant de session est toujours de 128 bits en base64url (22 caractères). */
const SESSION_ID = /^[A-Za-z0-9_-]{22}$/;

/** Un identifiant d'une autre forme est une session inconnue : on ne l'envoie pas au serveur. */
function assertWellFormedId(sessionId: string): void {
  if (!SESSION_ID.test(sessionId)) {
    throw new SessionApiError('notFound');
  }
}

const sessionPath = (sessionId: string) => `/api/sessions/${encodeURIComponent(sessionId)}`;

async function parseOrNetwork<T>(response: Response, parse: (json: unknown) => T): Promise<T> {
  try {
    return parse(await response.json());
  } catch {
    throw new SessionApiError('network');
  }
}

/** L'erreur typée d'une réponse inattendue : un problème attendu à cet appel, sinon `network`. */
async function errorOf(response: Response, expected: readonly SessionApiErrorKind[]): Promise<SessionApiError> {
  const candidates = KNOWN_PROBLEMS.filter((p) => p.status === response.status && expected.includes(p.kind));
  if (candidates.length > 0) {
    const code = (await readProblem(response))?.code;
    const match = candidates.find((p) => p.code === code);
    if (match) {
      return new SessionApiError(match.kind);
    }
  }
  return new SessionApiError('network');
}

async function readProblem(response: Response) {
  try {
    return parseProblem(await response.json());
  } catch {
    return null;
  }
}
