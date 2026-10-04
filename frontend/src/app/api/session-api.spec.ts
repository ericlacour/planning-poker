import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import created from '../../../../contract/examples/create-session-response/created.json';
import invalidPseudo from '../../../../contract/examples/problem/bad-request-invalid-pseudo.json';
import malformedBody from '../../../../contract/examples/problem/bad-request-malformed-body.json';
import pseudoTaken from '../../../../contract/examples/problem/pseudo-taken.json';
import payloadTooLarge from '../../../../contract/examples/problem/payload-too-large.json';
import sessionFull from '../../../../contract/examples/problem/session-full.json';
import sessionLimitReached from '../../../../contract/examples/problem/session-limit-reached.json';
import tooManyRequests from '../../../../contract/examples/problem/too-many-requests.json';
import sessionNotFound from '../../../../contract/examples/problem/session-not-found.json';
import joined from '../../../../contract/examples/join-session-response/joined.json';
import { APP_CONFIG } from '../config/app-config';
import { FETCH, REQUEST_TIMEOUT_MS, SessionApi, SessionApiError } from './session-api';

function api(fetchFn: typeof fetch): SessionApi {
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_CONFIG, useValue: { apiBaseUrl: 'https://api.example' } },
      { provide: FETCH, useValue: fetchFn },
    ],
  });
  return TestBed.inject(SessionApi);
}

const json = (body: unknown, status: number, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': type } });

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'resolved';
  } catch (e) {
    return e instanceof SessionApiError ? e.kind : 'other';
  }
}

describe('SessionApi.createSession', () => {
  it('posts the request as JSON to apiBaseUrl and returns the response', async () => {
    const fetchFn = vi.fn(async () => json(created, 201));
    const response = await api(fetchFn as unknown as typeof fetch).createSession({ pseudo: 'Alice', role: 'VOTER' });

    expect(response).toEqual(created);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example/api/sessions');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ pseudo: 'Alice', role: 'VOTER' });
  });

  it('maps 400 INVALID_PSEUDO to invalidPseudo', async () => {
    const fetchFn = async () => json(invalidPseudo, 400, 'application/problem+json');
    expect(await kindOf(api(fetchFn as typeof fetch).createSession({ pseudo: ' ', role: 'VOTER' }))).toBe(
      'invalidPseudo',
    );
  });

  it.each([
    ['503 SESSION_LIMIT_REACHED', async () => problem(sessionLimitReached, 503), 'sessionLimitReached'],
    ['429 TOO_MANY_REQUESTS', async () => problem(tooManyRequests, 429), 'tooManyRequests'],
    ['a 429 without the contract code', async () => problem({ ...tooManyRequests, code: undefined }, 429), 'network'],
    ['a 503 with another code', async () => problem({ ...sessionLimitReached, code: 'SESSION_FULL' }, 503), 'network'],
    ['a 413', async () => problem(payloadTooLarge, 413), 'network'],
  ])('maps %s', async (_, fetchFn, kind) => {
    expect(await kindOf(api(fetchFn as typeof fetch).createSession({ pseudo: 'Alice', role: 'VOTER' }))).toBe(kind);
  });

  it.each([
    ['a fetch failure', async () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 503 from the host', async () => new Response('Service Unavailable', { status: 503 })],
    ['a 500', async () => json({}, 500)],
    ['a malformed-body 400', async () => json(malformedBody, 400, 'application/problem+json')],
    ['a 201 that breaks the contract', async () => json({ sessionId: 'x' }, 201)],
    ['a 201 that is not JSON', async () => new Response('<html>', { status: 201 })],
  ])('maps %s to network', async (_, fetchFn) => {
    expect(await kindOf(api(fetchFn as typeof fetch).createSession({ pseudo: 'Alice', role: 'VOTER' }))).toBe(
      'network',
    );
  });

  it('maps a fetch that never answers to network after REQUEST_TIMEOUT_MS', async () => {
    vi.useFakeTimers();
    try {
      const fetchFn = (_: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
      const result = kindOf(api(fetchFn as typeof fetch).createSession({ pseudo: 'Alice', role: 'VOTER' }));
      let settled = false;
      void result.then(() => (settled = true));
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await result).toBe('network');
    } finally {
      vi.useRealTimers();
    }
  });
});

const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const problem = (body: unknown, status: number) => json(body, status, 'application/problem+json');

describe('SessionApi.checkSession', () => {
  it('sends GET /api/sessions/{id} and resolves on 204', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    await expect(api(fetchFn as unknown as typeof fetch).checkSession(SESSION_ID)).resolves.toBeUndefined();
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.example/api/sessions/${SESSION_ID}`);
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it.each(['..', 'a/b', 'abc', 'k3Jx9QvT2mLpZ8wR4nYb7', 'k3Jx9QvT2mLpZ8wR4nYb7AB', 'k3Jx9QvT2mLpZ8wR4nYb.A', ''])(
    'maps a malformed id %j to notFound without calling the server',
    async (sessionId) => {
      const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
      const client = api(fetchFn as unknown as typeof fetch);
      expect(await kindOf(client.checkSession(sessionId))).toBe('notFound');
      expect(await kindOf(client.joinSession(sessionId, { pseudo: 'Bob', role: 'VOTER' }))).toBe('notFound');
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it('maps 404 SESSION_NOT_FOUND to notFound', async () => {
    const fetchFn = async () => problem(sessionNotFound, 404);
    expect(await kindOf(api(fetchFn as typeof fetch).checkSession(SESSION_ID))).toBe('notFound');
  });

  it.each([
    ['a fetch failure', async () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 503 from the host', async () => new Response('Service Unavailable', { status: 503 })],
    ['a 404 that is not the contract problem', async () => new Response('Not Found', { status: 404 })],
    ['a 200', async () => json({}, 200)],
  ])('maps %s to network', async (_, fetchFn) => {
    expect(await kindOf(api(fetchFn as typeof fetch).checkSession(SESSION_ID))).toBe('network');
  });
});

describe('SessionApi.joinSession', () => {
  it('posts the request to /api/sessions/{id}/participants and returns the response', async () => {
    const fetchFn = vi.fn(async () => json(joined, 200));
    const response = await api(fetchFn as unknown as typeof fetch).joinSession(SESSION_ID, {
      pseudo: '  Bob ',
      role: 'VOTER',
    });
    expect(response).toEqual(joined);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.example/api/sessions/${SESSION_ID}/participants`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ pseudo: '  Bob ', role: 'VOTER' });
  });

  it.each([
    ['409 PSEUDO_TAKEN', async () => problem(pseudoTaken, 409), 'pseudoTaken'],
    ['409 SESSION_FULL', async () => problem(sessionFull, 409), 'sessionFull'],
    ['a 413', async () => problem(payloadTooLarge, 413), 'network'],
    ['a 503 SESSION_LIMIT_REACHED on join', async () => problem(sessionLimitReached, 503), 'network'],
    ['404 SESSION_NOT_FOUND', async () => problem(sessionNotFound, 404), 'notFound'],
    ['400 INVALID_PSEUDO', async () => problem(invalidPseudo, 400), 'invalidPseudo'],
    ['a malformed-body 400', async () => problem(malformedBody, 400), 'network'],
    ['a 409 without the contract code', async () => problem({ ...pseudoTaken, code: undefined }, 409), 'network'],
    ['a fetch failure', async () => Promise.reject(new TypeError('Failed to fetch')), 'network'],
    ['a 502', async () => new Response('Bad Gateway', { status: 502 }), 'network'],
    ['a 200 that breaks the contract', async () => json({ participantId: 'x' }, 200), 'network'],
  ])('maps %s', async (_, fetchFn, kind) => {
    expect(await kindOf(api(fetchFn as typeof fetch).joinSession(SESSION_ID, { pseudo: 'Bob', role: 'VOTER' }))).toBe(
      kind,
    );
  });
});
