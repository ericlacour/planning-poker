// Injecte la CSP (balise <meta>) dans le index.html construit, à partir de API_BASE_URL (AD-11).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { contentSecurityPolicy, isDev, readApiBaseUrl } from './api-base-url.mjs';

const MARKER = /<meta charset="utf-8"\s*\/?>/i;

try {
  const csp = contentSecurityPolicy(readApiBaseUrl({ dev: isDev() }));
  const target = fileURLToPath(new URL('../dist/frontend/browser/index.html', import.meta.url));
  const html = readFileSync(target, 'utf8');
  if (html.includes('http-equiv="Content-Security-Policy"')) {
    throw new Error('index.html contient déjà une CSP');
  }
  const charset = html.match(MARKER);
  if (!charset) {
    throw new Error('balise <meta charset="utf-8"> introuvable dans index.html');
  }
  const end = charset.index + charset[0].length;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  writeFileSync(target, html.slice(0, end) + meta + html.slice(end));
  console.log(`index.html : CSP = ${csp}`);
} catch (e) {
  console.error(`inject-csp : ${e.message}`);
  process.exit(1);
}
