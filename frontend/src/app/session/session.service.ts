import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';

import {
  Card,
  clearMessage,
  heartbeatMessage,
  helloMessage,
  parseServerMessage,
  revealMessage,
  SessionState,
  voteMessage,
} from '../api/contract';
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

/** Sans aucun message du serveur depuis 12 s, la connexion est perdue (AD-8). */
export const SILENCE_TIMEOUT_MS = 12_000;

/** Le bandeau « Reconnexion… » n'apparaît qu'après 2 s de coupure, pour ne pas clignoter (UX-DR14). */
export const BANNER_DELAY_MS = 2_000;

/** Attente avant chaque tentative de reconnexion : aussitôt, puis 1, 2, 4, 8 s, puis toutes les 10 s (AD-8). */
export const RECONNECT_DELAYS_MS: readonly number[] = [0, 1_000, 2_000, 4_000, 8_000, 10_000];

/** Fermetures qui renvoient ailleurs (asyncapi.yaml, `x-close-codes`) ; le jeton est alors effacé. */
export const CLOSE_SESSION_NOT_FOUND = 4404;
export const CLOSE_UNKNOWN_TOKEN = 4401;

/**
 * - `notFound` : fermeture `4404`, écran « Session introuvable » ;
 * - `unknownToken` : fermeture `4401` (ou aucun jeton rangé), écran Rejoindre.
 */
export type SessionEnd = 'notFound' | 'unknownToken';

/**
 * - `connecting` : première connexion, pas encore d'instantané ;
 * - `open` : instantané reçu sur la connexion courante, les intentions partent ;
 * - `lost` : connexion perdue, reconnexion en cours.
 */
export type ConnectionStatus = 'connecting' | 'open' | 'lost';

/** URL du canal de session, déduite de `apiBaseUrl` : `http` → `ws`, `https` → `wss`. */
export function sessionSocketUrl(apiBaseUrl: string, sessionId: string): string {
  return `${apiBaseUrl.replace(/^http/, 'ws')}/ws/sessions/${encodeURIComponent(sessionId)}`;
}

/**
 * Seul propriétaire du WebSocket de session (AD-2). Il envoie `hello` dès l'ouverture puis `heartbeat` toutes les
 * 5 s, et expose le dernier instantané en lecture seule : il le remplace sans fusionner et ignore une `version`
 * inférieure sur la même connexion. Aucun calcul métier.
 *
 * Reconnexion (story 2.2, AD-8) : une fermeture autre que `4401`/`4404`, ou aucun message du serveur depuis 12 s,
 * rend la connexion perdue. Il se reconnecte alors seul (aussitôt, puis 1, 2, 4, 8 s, puis toutes les 10 s, et
 * aussitôt sur `online` ou au retour au premier plan) en rejouant `hello`. La connexion n'est rétablie qu'au premier
 * `sessionState`, accepté quelle que soit sa `version`. Hors connexion rétablie, aucune intention ne part.
 *
 * Fourni par la page du lien de session, il vit et meurt avec elle.
 */
@Injectable()
export class SessionService {
  private readonly config = inject(APP_CONFIG);
  private readonly storage = inject(BrowserStorage);
  private readonly openSocket = inject(WEB_SOCKET_FACTORY);
  private readonly document = inject(DOCUMENT);

  private readonly stateSignal = signal<SessionState | null>(null);
  private readonly endSignal = signal<SessionEnd | null>(null);
  private readonly connectionSignal = signal<ConnectionStatus>('connecting');
  private readonly reconnectingSignal = signal(false);
  private sessionId: string | null = null;
  private socket: WebSocket | null = null;
  /**
   * Vrai tant que la connexion courante n'a reçu aucun instantané : le premier est accepté quelle que soit sa
   * `version` (AD-5).
   */
  private awaitingFirstState = false;
  /** Tentatives faites depuis la dernière connexion rétablie : choisit l'attente de la suivante. */
  private attempts = 0;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private silence: ReturnType<typeof setTimeout> | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private banner: ReturnType<typeof setTimeout> | undefined;

  /** Dernier instantané reçu, `null` avant le premier. */
  readonly state: Signal<SessionState | null> = this.stateSignal.asReadonly();
  /** Fin de la session pour ce navigateur, `null` tant qu'elle se poursuit. */
  readonly end: Signal<SessionEnd | null> = this.endSignal.asReadonly();
  /** État de la connexion : la main et les boutons ne sont actifs qu'à `open`. */
  readonly connection: Signal<ConnectionStatus> = this.connectionSignal.asReadonly();
  /** Vrai quand la coupure dure depuis plus de 2 s : bandeau « Reconnexion… ». */
  readonly reconnecting: Signal<boolean> = this.reconnectingSignal.asReadonly();

  constructor() {
    const view = this.document.defaultView;
    const retryNow = () => this.retryNow();
    const onVisibility = () => {
      if (this.document.visibilityState === 'visible') this.retryNow();
    };
    view?.addEventListener('online', retryNow);
    this.document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      view?.removeEventListener('online', retryNow);
      this.document.removeEventListener('visibilitychange', onVisibility);
      this.disconnect();
    });
  }

  /** Ouvre la connexion à la session avec le jeton rangé (`pp.token.{sessionId}`). */
  connect(sessionId: string): void {
    this.disconnect();
    this.sessionId = sessionId;
    this.stateSignal.set(null);
    this.endSignal.set(null);
    this.connectionSignal.set('connecting');
    this.attempts = 0;
    this.openAttempt();
  }

  /**
   * Intention `vote` pour le tour de l'instantané courant : choisir ou changer sa carte, ou la retirer (`null`).
   * Aucune mise à jour optimiste : le prochain instantané fait foi. Hors connexion rétablie, rien n'est envoyé.
   */
  vote(card: Card | null): void {
    this.sendForRound((roundId) => voteMessage(roundId, card));
  }

  /** Intention `reveal` pour le tour de l'instantané courant (« Révéler les votes »). */
  reveal(): void {
    this.sendForRound(revealMessage);
  }

  /** Intention `clear` pour le tour de l'instantané courant (« Nouveau tour », « Effacer les votes »). */
  clear(): void {
    this.sendForRound(clearMessage);
  }

  /** Ferme la connexion et arrête toute reconnexion, sans rien changer à l'état affiché. */
  disconnect(): void {
    this.sessionId = null;
    clearTimeout(this.retry);
    this.retry = undefined;
    this.stopBanner();
    this.closeSocket();
  }

  /** Envoie une intention liée au `roundId` courant ; seulement sur une connexion rétablie. */
  private sendForRound(message: (roundId: string) => object): void {
    const state = this.stateSignal();
    const socket = this.socket;
    if (!state || !socket || socket.readyState !== OPEN || this.connectionSignal() !== 'open') return;
    socket.send(JSON.stringify(message(state.round.roundId)));
  }

  /** Une tentative : relit le jeton, ouvre un socket et rejoue `hello` à son ouverture. */
  private openAttempt(): void {
    this.retry = undefined;
    const sessionId = this.sessionId;
    if (sessionId === null) return;
    const token = this.storage.readToken(sessionId);
    if (!token) {
      this.finish('unknownToken');
      return;
    }
    const socket = this.openSocket(sessionSocketUrl(this.config.apiBaseUrl, sessionId));
    this.socket = socket;
    this.awaitingFirstState = true;
    this.armSilence();
    socket.onopen = () => {
      if (this.socket !== socket) return;
      socket.send(JSON.stringify(helloMessage(token)));
      this.heartbeat = setInterval(() => {
        if (socket.readyState === OPEN) socket.send(JSON.stringify(heartbeatMessage()));
      }, HEARTBEAT_INTERVAL_MS);
    };
    socket.onmessage = (event: MessageEvent) => {
      if (this.socket !== socket) return;
      this.armSilence();
      this.receive(event.data);
    };
    socket.onclose = (event: CloseEvent) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.stopTimers();
      if (event.code === CLOSE_SESSION_NOT_FOUND) this.finish('notFound');
      else if (event.code === CLOSE_UNKNOWN_TOKEN) this.finish('unknownToken');
      else this.lose();
    };
  }

  /** Connexion perdue : la fermer si besoin, désactiver les actions, programmer la prochaine tentative. */
  private lose(): void {
    this.closeSocket();
    this.connectionSignal.set('lost');
    if (!this.reconnectingSignal() && this.banner === undefined) {
      this.banner = setTimeout(() => this.reconnectingSignal.set(true), BANNER_DELAY_MS);
    }
    const delay = RECONNECT_DELAYS_MS[Math.min(this.attempts, RECONNECT_DELAYS_MS.length - 1)];
    this.attempts++;
    this.retry = setTimeout(() => this.openAttempt(), delay);
  }

  /** `online` ou retour au premier plan : la tentative programmée part aussitôt. */
  private retryNow(): void {
    if (this.retry === undefined) return;
    clearTimeout(this.retry);
    this.openAttempt();
  }

  /** Fin `4404` ou `4401` : plus aucune tentative, jeton effacé, écran de fin. */
  private finish(end: SessionEnd): void {
    const sessionId = this.sessionId;
    this.disconnect();
    if (sessionId !== null) this.storage.removeToken(sessionId);
    this.endSignal.set(end);
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
    if (!this.awaitingFirstState && current && message.version < current.version) return;
    this.awaitingFirstState = false;
    this.stateSignal.set(message);
    if (this.connectionSignal() !== 'open') {
      this.connectionSignal.set('open');
      this.attempts = 0;
      this.stopBanner();
    }
  }

  /** Chien de garde : sans message du serveur pendant 12 s, la connexion est perdue. */
  private armSilence(): void {
    clearTimeout(this.silence);
    this.silence = setTimeout(() => this.lose(), SILENCE_TIMEOUT_MS);
  }

  private closeSocket(): void {
    this.stopTimers();
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState !== CLOSED && socket.readyState !== CLOSING) {
      socket.close(1000);
    }
  }

  private stopTimers(): void {
    clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    clearTimeout(this.silence);
    this.silence = undefined;
  }

  private stopBanner(): void {
    clearTimeout(this.banner);
    this.banner = undefined;
    this.reconnectingSignal.set(false);
  }
}
