import { DestroyRef, Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';

import { heartbeatMessage, helloMessage, parseServerMessage, SessionState } from '../api/contract';
import { APP_CONFIG } from '../config/app-config';
import { BrowserStorage } from '../storage/browser-storage';

/** Ouverture d'un WebSocket, remplaçable dans les tests. */
export const WEB_SOCKET_FACTORY = new InjectionToken<(url: string) => WebSocket>('WEB_SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (url) => new WebSocket(url),
});

/** `WebSocket.readyState`, sans dépendre d'un `WebSocket` global (tests). */
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

/** Le client envoie `heartbeat` toutes les 5 s (AD-8). */
export const HEARTBEAT_INTERVAL_MS = 5_000;

/** Fermetures qui renvoient ailleurs (asyncapi.yaml, `x-close-codes`) ; le jeton est alors effacé. */
export const CLOSE_SESSION_NOT_FOUND = 4404;
export const CLOSE_UNKNOWN_TOKEN = 4401;

/**
 * - `notFound` : fermeture `4404`, écran « Session introuvable » ;
 * - `unknownToken` : fermeture `4401` (ou aucun jeton rangé), écran Rejoindre.
 */
export type SessionEnd = 'notFound' | 'unknownToken';

/** URL du canal de session, déduite de `apiBaseUrl` : `http` → `ws`, `https` → `wss`. */
export function sessionSocketUrl(apiBaseUrl: string, sessionId: string): string {
  return `${apiBaseUrl.replace(/^http/, 'ws')}/ws/sessions/${encodeURIComponent(sessionId)}`;
}

/**
 * Seul propriétaire du WebSocket de session (AD-2). Il envoie `hello` dès l'ouverture puis `heartbeat` toutes les
 * 5 s, et expose le dernier instantané en lecture seule : il le remplace sans fusionner et ignore une `version`
 * inférieure sur la même connexion. Aucun calcul métier. Pas de reconnexion automatique (story 2.2) : une coupure
 * autre que 4401/4404 laisse la dernière table affichée.
 *
 * Fourni par la page du lien de session, il vit et meurt avec elle.
 */
@Injectable()
export class SessionService {
  private readonly config = inject(APP_CONFIG);
  private readonly storage = inject(BrowserStorage);
  private readonly openSocket = inject(WEB_SOCKET_FACTORY);

  private readonly stateSignal = signal<SessionState | null>(null);
  private readonly endSignal = signal<SessionEnd | null>(null);
  private socket: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | undefined;

  /** Dernier instantané reçu, `null` avant le premier. */
  readonly state: Signal<SessionState | null> = this.stateSignal.asReadonly();
  /** Fin de la session pour ce navigateur, `null` tant qu'elle se poursuit. */
  readonly end: Signal<SessionEnd | null> = this.endSignal.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.disconnect());
  }

  /** Ouvre la connexion à la session avec le jeton rangé (`pp.token.{sessionId}`). */
  connect(sessionId: string): void {
    this.disconnect();
    this.stateSignal.set(null);
    this.endSignal.set(null);
    const token = this.storage.readToken(sessionId);
    if (!token) {
      this.endSignal.set('unknownToken');
      return;
    }
    const socket = this.openSocket(sessionSocketUrl(this.config.apiBaseUrl, sessionId));
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      socket.send(JSON.stringify(helloMessage(token)));
      this.heartbeat = setInterval(() => {
        if (socket.readyState === OPEN) socket.send(JSON.stringify(heartbeatMessage()));
      }, HEARTBEAT_INTERVAL_MS);
    };
    socket.onmessage = (event: MessageEvent) => {
      if (this.socket === socket) this.receive(event.data);
    };
    socket.onclose = (event: CloseEvent) => {
      if (this.socket !== socket) return;
      this.stopHeartbeat();
      this.socket = null;
      if (event.code === CLOSE_SESSION_NOT_FOUND || event.code === CLOSE_UNKNOWN_TOKEN) {
        this.storage.removeToken(sessionId);
        this.endSignal.set(event.code === CLOSE_SESSION_NOT_FOUND ? 'notFound' : 'unknownToken');
      }
    };
  }

  /** Ferme la connexion sans rien changer à l'état affiché. */
  disconnect(): void {
    this.stopHeartbeat();
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState !== CLOSED && socket.readyState !== CLOSING) {
      socket.close(1000);
    }
  }

  private receive(data: unknown): void {
    if (typeof data !== 'string') return;
    let json: unknown;
    try {
      json = JSON.parse(data);
    } catch {
      return;
    }
    const message = parseServerMessage(json);
    if (message?.type !== 'sessionState') return;
    const current = this.stateSignal();
    if (current && message.version < current.version) return;
    this.stateSignal.set(message);
  }

  private stopHeartbeat(): void {
    clearInterval(this.heartbeat);
    this.heartbeat = undefined;
  }
}
