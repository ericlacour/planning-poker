import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import alone from '../../../../contract/examples/session-state/alone-after-create.json';
import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import { APP_CONFIG } from '../config/app-config';
import { LOCAL_STORAGE } from '../storage/browser-storage';
import { HEALTH_PROBE } from '../wake/server-wake.service';
import {
  BANNER_DELAY_MS,
  HEARTBEAT_INTERVAL_MS,
  KEEP_AWAKE_INTERVAL_MS,
  SessionService,
  sessionSocketUrl,
  SILENCE_TIMEOUT_MS,
  WEB_SOCKET_FACTORY,
} from './session.service';

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
  let probe: ReturnType<typeof vi.fn<() => Promise<boolean>>>;

  beforeEach(() => {
    stored = new Map([
      [TOKEN_KEY, TOKEN],
      ['pp.pseudo', 'Alice'],
    ]);
    sockets = [];
    probe = vi.fn(async () => true);
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
        { provide: HEALTH_PROBE, useValue: probe },
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

  it('calls /api/health every 5 min while connected, even during a reconnection, and stops on disconnect', () => {
    vi.useFakeTimers();
    const { service, socket } = connected();
    vi.advanceTimersByTime(KEEP_AWAKE_INTERVAL_MS - 1);
    expect(probe).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(probe).toHaveBeenCalledTimes(1);
    socket.serverCloses(1006);
    vi.advanceTimersByTime(KEEP_AWAKE_INTERVAL_MS);
    expect(probe).toHaveBeenCalledTimes(2);
    service.disconnect();
    vi.advanceTimersByTime(KEEP_AWAKE_INTERVAL_MS * 2);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('stops calling /api/health once the session ends', () => {
    vi.useFakeTimers();
    const { socket } = connected();
    socket.serverCloses(4404);
    vi.advanceTimersByTime(KEEP_AWAKE_INTERVAL_MS * 2);
    expect(probe).not.toHaveBeenCalled();
  });

  it('keeps a single /api/health timer when connecting again', () => {
    vi.useFakeTimers();
    const { service } = connected();
    service.connect(SESSION_ID);
    vi.advanceTimersByTime(KEEP_AWAKE_INTERVAL_MS);
    expect(probe).toHaveBeenCalledTimes(1);
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

  it('sends reveal, hide and clear with the current roundId, without changing its state', () => {
    const { service, socket } = connected();
    socket.serverSends(hiddenRound);
    service.reveal();
    service.hide();
    service.clear();
    expect(socket.sent.slice(1)).toEqual([
      { type: 'reveal', roundId: hiddenRound.round.roundId },
      { type: 'hide', roundId: hiddenRound.round.roundId },
      { type: 'clear', roundId: hiddenRound.round.roundId },
    ]);
    expect(service.state()).toEqual(hiddenRound);
  });

  it('sends no reveal, hide nor clear before the first snapshot nor once the socket is closed', () => {
    const { service, socket } = connected();
    service.reveal();
    service.hide();
    service.clear();
    socket.serverSends(hiddenRound);
    socket.serverCloses(1006);
    service.reveal();
    service.hide();
    service.clear();
    expect(socket.sent).toEqual([{ type: 'hello', participantToken: TOKEN }]);
  });

  it('sends no vote before the first snapshot nor once the socket is closed', () => {
    const { service, socket } = connected();
    service.vote('8');
    socket.serverSends(hiddenRound);
    socket.serverCloses(1006);
    service.vote('8');
    expect(socket.sent).toEqual([{ type: 'hello', participantToken: TOKEN }]);
  });

  it('sends changeRole without changing its state, and nothing before the first snapshot nor once closed', () => {
    const { service, socket } = connected();
    service.changeRole('OBSERVER');
    socket.serverSends(hiddenRound);
    service.changeRole('OBSERVER');
    service.changeRole('VOTER');
    expect(socket.sent.slice(1)).toEqual([
      { type: 'changeRole', role: 'OBSERVER' },
      { type: 'changeRole', role: 'VOTER' },
    ]);
    expect(service.state()).toEqual(hiddenRound);
    socket.serverCloses(1006);
    service.changeRole('OBSERVER');
    expect(socket.sent).toHaveLength(3);
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

  it('on any other close, keeps the last table and the token, and reconnects at once', () => {
    vi.useFakeTimers();
    const { service, socket } = connected();
    socket.serverSends(alone);
    socket.serverCloses(1006);
    expect(service.end()).toBeNull();
    expect(service.state()).toEqual(alone);
    expect(service.connection()).toBe('lost');
    expect(stored.get(TOKEN_KEY)).toBe(TOKEN);
    vi.advanceTimersByTime(0);
    expect(sockets).toHaveLength(2);
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

  describe('reconnection (story 2.2)', () => {
    beforeEach(() => vi.useFakeTimers());

    /** Connexion rétablie : ouverte, instantané reçu. */
    function open(state: unknown = hiddenRound) {
      const result = connected();
      result.socket.serverSends(state);
      return result;
    }

    const last = () => sockets[sockets.length - 1];

    it('is connecting until the first snapshot, then open', () => {
      const service = TestBed.inject(SessionService);
      service.connect(SESSION_ID);
      expect(service.connection()).toBe('connecting');
      sockets[0].serverOpens();
      expect(service.connection()).toBe('connecting');
      sockets[0].serverSends(hiddenRound);
      expect(service.connection()).toBe('open');
    });

    it('retries at once, then after 1, 2, 4 and 8 s, then every 10 s', () => {
      const { socket } = open();
      socket.serverCloses(1001);
      const waits = [0, 1_000, 2_000, 4_000, 8_000, 10_000, 10_000];
      waits.forEach((wait, i) => {
        if (wait > 0) {
          vi.advanceTimersByTime(wait - 1);
          expect(sockets).toHaveLength(i + 1);
        }
        vi.advanceTimersByTime(wait > 0 ? 1 : 0);
        expect(sockets).toHaveLength(i + 2);
        last().serverCloses(1006);
      });
    });

    it('replays hello with the stored token on each attempt', () => {
      const { socket } = open();
      socket.serverCloses(4500);
      vi.advanceTimersByTime(0);
      last().serverOpens();
      expect(last().sent).toEqual([{ type: 'hello', participantToken: TOKEN }]);
    });

    it('a silence of 12 s loses the connection; any message restarts the countdown', () => {
      const { service, socket } = open();
      vi.advanceTimersByTime(SILENCE_TIMEOUT_MS - 1);
      socket.serverSends({ type: 'tick' });
      vi.advanceTimersByTime(SILENCE_TIMEOUT_MS - 1);
      expect(service.connection()).toBe('open');
      expect(socket.closedWith).toBeNull();
      vi.advanceTimersByTime(1);
      expect(service.connection()).toBe('lost');
      expect(socket.closedWith).toBe(1000);
      // Programmée depuis une minuterie, la tentative « immédiate » part 1 ms plus tard en temps simulé.
      vi.advanceTimersByTime(1);
      expect(sockets).toHaveLength(2);
    });

    it('the silence countdown starts with the socket, before it opens', () => {
      const service = TestBed.inject(SessionService);
      service.connect(SESSION_ID);
      vi.advanceTimersByTime(SILENCE_TIMEOUT_MS);
      expect(service.connection()).toBe('lost');
    });

    it('online and visibilitychange to visible retry at once, cancelling the scheduled attempt', () => {
      const { socket } = open();
      socket.serverCloses(1006);
      vi.advanceTimersByTime(0);
      last().serverCloses(1006); // prochaine tentative dans 1 s
      expect(sockets).toHaveLength(2);
      window.dispatchEvent(new Event('online'));
      expect(sockets).toHaveLength(3);
      vi.advanceTimersByTime(1_000);
      expect(sockets).toHaveLength(3);

      last().serverCloses(1006); // prochaine tentative dans 2 s
      document.dispatchEvent(new Event('visibilitychange'));
      expect(sockets).toHaveLength(4);
    });

    it('online while connected or while an attempt is in flight opens nothing more', () => {
      const { socket } = open();
      window.dispatchEvent(new Event('online'));
      expect(sockets).toHaveLength(1);
      socket.serverCloses(1006);
      vi.advanceTimersByTime(0);
      window.dispatchEvent(new Event('online'));
      expect(sockets).toHaveLength(2);
    });

    it('shows the banner only after 2 s of loss, and hides it on the first snapshot', () => {
      const { service, socket } = open();
      socket.serverCloses(1006);
      vi.advanceTimersByTime(BANNER_DELAY_MS - 1);
      expect(service.reconnecting()).toBe(false);
      vi.advanceTimersByTime(1);
      expect(service.reconnecting()).toBe(true);
      last().serverOpens();
      last().serverSends(hiddenRound);
      expect(service.reconnecting()).toBe(false);
      expect(service.connection()).toBe('open');
    });

    it('a short loss shows no banner', () => {
      const { service, socket } = open();
      socket.serverCloses(1006);
      vi.advanceTimersByTime(0);
      last().serverOpens();
      last().serverSends(hiddenRound);
      vi.advanceTimersByTime(BANNER_DELAY_MS * 2);
      expect(service.reconnecting()).toBe(false);
    });

    it('accepts the first snapshot of a new connection whatever its version, then ignores a lower one', () => {
      const { service, socket } = open({ ...hiddenRound, version: 9 });
      socket.serverCloses(1006);
      vi.advanceTimersByTime(0);
      last().serverOpens();
      last().serverSends({ ...alone, version: 3 });
      expect(service.state()?.version).toBe(3);
      last().serverSends({ ...hiddenRound, version: 2 });
      expect(service.state()?.version).toBe(3);
    });

    it('sends no intent while lost, nor once reopened before the first snapshot', () => {
      const { service, socket } = open();
      socket.serverCloses(1006);
      service.vote('8');
      vi.advanceTimersByTime(0);
      last().serverOpens();
      service.vote('8');
      service.reveal();
      expect(last().sent).toEqual([{ type: 'hello', participantToken: TOKEN }]);
      last().serverSends(hiddenRound);
      service.vote('8');
      expect(last().sent).toHaveLength(2);
    });

    it('4404 during a reconnection stops every attempt and timer', () => {
      const { service, socket } = open();
      socket.serverCloses(1001);
      vi.advanceTimersByTime(0);
      last().serverCloses(4404);
      expect(service.end()).toBe('notFound');
      expect(stored.has(TOKEN_KEY)).toBe(false);
      expect(service.reconnecting()).toBe(false);
      vi.advanceTimersByTime(60_000);
      expect(sockets).toHaveLength(2);
      expect(service.reconnecting()).toBe(false);
    });

    it('4401 during a reconnection ends with « unknownToken » and stops', () => {
      const { service, socket } = open();
      socket.serverCloses(1006);
      vi.advanceTimersByTime(0);
      last().serverCloses(4401);
      expect(service.end()).toBe('unknownToken');
      vi.advanceTimersByTime(60_000);
      expect(sockets).toHaveLength(2);
    });

    it('a token removed meanwhile ends with « unknownToken » at the next attempt', () => {
      const { service, socket } = open();
      stored.delete(TOKEN_KEY);
      socket.serverCloses(1006);
      vi.advanceTimersByTime(0);
      expect(sockets).toHaveLength(1);
      expect(service.end()).toBe('unknownToken');
    });

    it('stops reconnecting once disconnected or destroyed', () => {
      const { service, socket } = open();
      socket.serverCloses(1006);
      service.disconnect();
      vi.advanceTimersByTime(60_000);
      expect(sockets).toHaveLength(1);

      service.connect(SESSION_ID);
      sockets[1].serverCloses(1006);
      TestBed.resetTestingModule();
      vi.advanceTimersByTime(60_000);
      expect(sockets).toHaveLength(2);
    });

    it('visibilitychange to hidden does not retry before the scheduled delay', () => {
      const { socket } = open();
      socket.serverCloses(1006);
      vi.advanceTimersByTime(0);
      last().serverCloses(1006); // prochaine tentative dans 1 s
      const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      expect(sockets).toHaveLength(2);
      vi.advanceTimersByTime(1_000);
      expect(sockets).toHaveLength(3);
      visibility.mockRestore();
    });

    it('two quick failures then a return before 2 s never show the banner', () => {
      const { service, socket } = open();
      socket.serverCloses(1006);
      vi.advanceTimersByTime(0);
      last().serverCloses(1006);
      vi.advanceTimersByTime(1_000);
      last().serverOpens();
      last().serverSends(hiddenRound);
      expect(service.connection()).toBe('open');
      vi.advanceTimersByTime(BANNER_DELAY_MS * 3);
      expect(service.reconnecting()).toBe(false);
    });

    it('once destroyed, online and visibilitychange open nothing', () => {
      const { socket } = open();
      socket.serverCloses(1006);
      TestBed.resetTestingModule();
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(60_000);
      expect(sockets).toHaveLength(1);
    });
  });
});
