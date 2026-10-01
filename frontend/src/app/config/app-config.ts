import { InjectionToken } from '@angular/core';

/** Configuration d'exécution lue dans `/config.json`, produit par l'environnement (AD-11). */
export interface AppConfig {
  /** URL du webservice, sans `/` final. L'URL du WebSocket en est déduite. */
  readonly apiBaseUrl: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

export async function loadAppConfig(fetchFn: typeof fetch = fetch): Promise<AppConfig> {
  const response = await fetchFn('/config.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`config.json: HTTP ${response.status}`);
  }
  const { apiBaseUrl } = (await response.json()) as Partial<AppConfig>;
  if (typeof apiBaseUrl !== 'string' || !/^https?:\/\/[^/]/.test(apiBaseUrl)) {
    throw new Error('config.json: apiBaseUrl must be an absolute http(s) URL');
  }
  return { apiBaseUrl: apiBaseUrl.replace(/\/+$/, '') };
}
