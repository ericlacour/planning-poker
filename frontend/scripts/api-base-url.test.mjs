import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contentSecurityPolicy, readApiBaseUrl } from './api-base-url.mjs';

test('API_BASE_URL est obligatoire hors --dev', () => {
  assert.throws(() => readApiBaseUrl({ env: {} }), /obligatoire/);
  assert.throws(() => readApiBaseUrl({ env: { API_BASE_URL: '  ' } }), /obligatoire/);
});

test('hors --dev, seule une origine HTTPS est acceptée', () => {
  assert.equal(readApiBaseUrl({ env: { API_BASE_URL: 'https://api.example/' } }), 'https://api.example');
  assert.throws(() => readApiBaseUrl({ env: { API_BASE_URL: 'http://api.example' } }), /https/);
  assert.throws(() => readApiBaseUrl({ env: { API_BASE_URL: 'https://api.example/api' } }), /sans chemin/);
  assert.throws(() => readApiBaseUrl({ env: { API_BASE_URL: 'pas une url' } }), /pas une URL valide/);
});

test('--dev prend http://localhost:8080 par défaut et accepte le HTTP', () => {
  assert.equal(readApiBaseUrl({ env: {}, dev: true }), 'http://localhost:8080');
  assert.equal(readApiBaseUrl({ env: { API_BASE_URL: 'http://127.0.0.1:4310' }, dev: true }), 'http://127.0.0.1:4310');
});

test('la CSP autorise le webservice en HTTPS et en WSS, et rien d\'autre', () => {
  assert.equal(
    contentSecurityPolicy('https://api.example'),
    "default-src 'self'; connect-src 'self' https://api.example wss://api.example",
  );
});
