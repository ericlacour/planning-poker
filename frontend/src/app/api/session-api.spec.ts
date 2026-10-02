import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import created from '../../../../contract/examples/create-session-response/created.json';
import invalidPseudo from '../../../../contract/examples/problem/bad-request-invalid-pseudo.json';
import malformedBody from '../../../../contract/examples/problem/bad-request-malformed-body.json';
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
