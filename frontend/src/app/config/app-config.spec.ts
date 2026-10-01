import { describe, expect, it } from 'vitest';

import { loadAppConfig } from './app-config';

const respond = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('loadAppConfig', () => {
  it('reads apiBaseUrl and drops a trailing slash', async () => {
    await expect(loadAppConfig(respond({ apiBaseUrl: 'https://api.example/' }))).resolves.toEqual({
      apiBaseUrl: 'https://api.example',
    });
  });

  it('rejects a missing or relative apiBaseUrl', async () => {
    await expect(loadAppConfig(respond({}))).rejects.toThrow('apiBaseUrl');
    await expect(loadAppConfig(respond({ apiBaseUrl: '/api' }))).rejects.toThrow('apiBaseUrl');
  });

  it('rejects an unreadable config.json', async () => {
    await expect(loadAppConfig(respond({}, 404))).rejects.toThrow('HTTP 404');
  });
});
