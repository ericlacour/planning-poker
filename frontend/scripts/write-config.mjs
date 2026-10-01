// Écrit public/config.json à partir de API_BASE_URL (AD-11). `--dev` : http://localhost:8080 par défaut.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { isDev, readApiBaseUrl } from './api-base-url.mjs';

try {
  const apiBaseUrl = readApiBaseUrl({ dev: isDev() });
  const target = fileURLToPath(new URL('../public/config.json', import.meta.url));
  writeFileSync(target, `${JSON.stringify({ apiBaseUrl }, null, 2)}\n`);
  console.log(`config.json : apiBaseUrl = ${apiBaseUrl}`);
} catch (e) {
  console.error(`write-config : ${e.message}`);
  process.exit(1);
}
