import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import alone from '../../../../contract/examples/session-state/alone-after-create.json';
import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import { APP_CONFIG } from '../config/app-config';
import { LOCAL_STORAGE } from '../storage/browser-storage';
import { HEARTBEAT_INTERVAL_MS, SessionService, sessionSocketUrl, WEB_SOCKET_FACTORY } from './session.service';

const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const TOKEN = 'Xb4Rt9LmQ2vN7cZp1HsK0w';
const TOKEN_KEY = `pp.token.${SESSION_ID}`;

/** Faux WebSocket : retient ce que le client envoie, et laisse le test jouer le serveur. */
class FakeSocket {
  readyState = 0;
  readonly sent: unknown[] = [];
  closedWith: number | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(code: number): void {
    this.closedWith = code;
    this.readyState = 3;
  }

  serverOpens(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  serverSends(message: unknown): void {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) });
  }

  serverCloses(code: number): void {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

describe('SessionService', () => {
  let stored: Map<string, string>;
  let sockets: FakeSocket[];

  beforeEach(() => {
    stored = new Map([
      [TOKEN_KEY, TOKEN],
      ['pp.pseudo', 'Alice'],
    ]);
    sockets = [];
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
      removeItem: (key: string) => void stored.delete(key),
    } as unknown as Storage;
    TestBed.configureTestingModule({
      providers: [
        SessionService,
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'https://api.example' } },
        { provide: LOCAL_STORAGE, useValue: () => storage },
        {
          provide: WEB_SOCKET_FACTORY,
          useValue: (url: string) => {
            const socket = new FakeSocket(url);
            sockets.push(socket);
            return socket as unknown as WebSocket;
          },
        },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  function connected() {
    const service = TestBed.inject(SessionService);
    service.connect(SESSION_ID);
    const socket = sockets[0];
    socket.serverOpens();
    return { service, socket };
  }

  it('derives the WebSocket URL from apiBaseUrl', () => {
    expect(sessionSocketUrl('https://api.example', SESSION_ID)).toBe(`wss://api.example/ws/sessions/${SESSION_ID}`);
    expect(sessionSocketUrl('http://127.0.0.1:4310', SESSION_ID)).toBe(`ws://127.0.0.1:4310/ws/sessions/${SESSION_ID}`);
  });

  it('opens one socket on the session URL and sends hello with the stored token as soon as it opens', () => {
    const service = TestBed.inject(SessionService);
    service.connect(SESSION_ID);
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toBe(`wss://api.example/ws/sessions/${SESSION_ID}`);
    expect(sockets[0].url).not.toContain(TOKEN);
    expect(sockets[0].sent).toEqual([]);

    sockets[0].serverOpens();
    expect(sockets[0].sent).toEqual([{ type: 'hello', participantToken: TOKEN }]);
  });

  it('sends heartbeat every 5 s', () => {
    vi.useFakeTimers();
    const { socket } = connected();
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS - 1);
    expect(socket.sent).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(socket.sent).toEqual([{ type: 'hello', participantToken: TOKEN }, { type: 'heartbeat' }]);
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
    expect(socket.sent).toHaveLength(3);
  });

  it('has no state before the first snapshot, then exposes it as is', () => {
    const { service, socket } = connected();
    expect(service.state()).toBeNull();
    socket.serverSends(alone);
    expect(service.state()).toEqual(alone);
  });

  it('replaces its state without merging', () => {
    const { service, socket } = connected();
    socket.serverSends(hiddenRound);
    socket.serverSends({ ...alone, version: 8 });
    expect(service.state()?.participants).toHaveLength(1);
    expect(service.state()?.version).toBe(8);
  });

  it('sends vote with the current roundId, without changing its state', () => {
    const { service, socket } = connected();
    socket.serverSends(hiddenRound);
    service.vote('8');
    service.vote(null);
    expect(socket.sent.slice(1)).toEqual([
      { type: 'vote', roundId: hiddenRound.round.roundId, card: '8' },
      { type: 'vote', roundId: hiddenRound.round.roundId, card: null },
    ]);
    expect(service.state()).toEqual(hiddenRound);
  });

  it('sends no vote before the first snapshot nor once the socket is closed', () => {
    const { service, socket } = connected();
    service.vote('8');
    socket.serverSends(hiddenRound);
    socket.serverCloses(1006);
    service.vote('8');
    expect(socket.sent).toEqual([{ type: 'hello', participantToken: TOKEN }]);
  });

  it('ignores a lower version on the same connection', () => {
    const { service, socket } = connected();
    socket.serverSends({ ...hiddenRound, version: 5 });
    socket.serverSends({ ...alone, version: 4 });
    expect(service.state()?.version).toBe(5);
    expect(service.state()?.participants).toHaveLength(5);
  });

  it('ignores tick, error and messages outside the contract', () => {
    const { service, socket } = connected();
    socket.serverSends(alone);
    socket.serverSends({ type: 'tick' });
    socket.serverSends({ type: 'error', code: 'INVALID_MESSAGE' });
    socket.serverSends('{');
    socket.serverSends({ ...hiddenRound, version: 99, extra: true });
    expect(service.state()).toEqual(alone);
  });

  it('on 4404, ends with « notFound », clears the token and stops the heartbeat', () => {
    vi.useFakeTimers();
    const { service, socket } = connected();
    socket.serverCloses(4404);
    expect(service.end()).toBe('notFound');
    expect(stored.has(TOKEN_KEY)).toBe(false);
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 2);
    expect(socket.sent).toHaveLength(1);
  });

  it('on 4401, ends with « unknownToken » and clears the token but keeps the pseudo', () => {
    const { service, socket } = connected();
    socket.serverCloses(4401);
    expect(service.end()).toBe('unknownToken');
    expect(stored.has(TOKEN_KEY)).toBe(false);
    expect(stored.get('pp.pseudo')).toBe('Alice');
  });

  it('on any other close, keeps the last table and the token, without reconnecting', () => {
    const { service, socket } = connected();
    socket.serverSends(alone);
    socket.serverCloses(1006);
    expect(service.end()).toBeNull();
    expect(service.state()).toEqual(alone);
    expect(stored.get(TOKEN_KEY)).toBe(TOKEN);
    expect(sockets).toHaveLength(1);
  });

  it('without a stored token, opens nothing and ends with « unknownToken »', () => {
    stored.delete(TOKEN_KEY);
    const service = TestBed.inject(SessionService);
    service.connect(SESSION_ID);
    expect(sockets).toHaveLength(0);
    expect(service.end()).toBe('unknownToken');
  });

  it('closes its socket when disconnected or destroyed', () => {
    const { service, socket } = connected();
    service.disconnect();
    expect(socket.closedWith).toBe(1000);

    service.connect(SESSION_ID);
    sockets[1].serverOpens();
    TestBed.resetTestingModule();
    expect(sockets[1].closedWith).toBe(1000);
  });

  it('a fresh connect starts from an empty state', () => {
    const { service, socket } = connected();
    socket.serverSends({ ...hiddenRound, version: 9 });
    service.connect(SESSION_ID);
    expect(service.state()).toBeNull();
    sockets[1].serverOpens();
    sockets[1].serverSends({ ...alone, version: 3 });
    expect(service.state()?.version).toBe(3);
    // L'ancienne connexion ne touche plus à l'état.
    socket.serverSends({ ...hiddenRound, version: 10 });
    expect(service.state()?.version).toBe(3);
  });
});
