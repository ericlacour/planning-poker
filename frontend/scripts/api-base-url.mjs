// Lecture et contrôle de API_BASE_URL, partagés par write-config.mjs et inject-csp.mjs (AD-11).

export const DEV_API_BASE_URL = 'http://localhost:8080';

/**
 * Renvoie l'URL du webservice sans `/` final. Hors `--dev`, API_BASE_URL est obligatoire et en HTTPS.
 * @param {{ env?: Record<string, string | undefined>, dev?: boolean }} options
 */
export function readApiBaseUrl({ env = process.env, dev = false } = {}) {
  const raw = (env.API_BASE_URL ?? '').trim() || (dev ? DEV_API_BASE_URL : '');
  if (!raw) {
    throw new Error('API_BASE_URL est obligatoire (URL du webservice, par exemple https://planning-poker-api.onrender.com).');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`API_BASE_URL n'est pas une URL valide : ${raw}`);
  }
  const allowed = dev ? ['https:', 'http:'] : ['https:'];
  if (!allowed.includes(url.protocol) || url.pathname.replace(/\/+$/, '') !== '' || url.search || url.hash) {
    throw new Error(`API_BASE_URL doit être une origine ${dev ? 'http(s)' : 'https'} sans chemin : ${raw}`);
  }
  return url.origin;
}

/** CSP du front (AD-11) : tout vient du site lui-même, sauf les appels au webservice en HTTPS et WSS. */
export function contentSecurityPolicy(apiBaseUrl) {
  const ws = apiBaseUrl.replace(/^http/, 'ws');
  return `default-src 'self'; connect-src 'self' ${apiBaseUrl} ${ws}`;
}

export const isDev = (argv = process.argv) => argv.includes('--dev');
