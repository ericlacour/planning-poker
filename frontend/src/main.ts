import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { APP_CONFIG, loadAppConfig } from './app/config/app-config';
import { THEME_KEY } from './app/storage/browser-storage';
import { applyTheme, parseTheme } from './app/theme/theme';

// Thème mémorisé appliqué avant tout (y compris l'écran de réveil et l'écran d'erreur) : pas de flash au chargement.
applyTheme(document, parseTheme(storedTheme()));

loadAppConfig()
  .then((config) =>
    bootstrapApplication(App, {
      providers: [...appConfig.providers, { provide: APP_CONFIG, useValue: config }],
    }),
  )
  .catch((err) => {
    console.error(err);
    showUnavailable();
  });

/** Sans config.json, Angular ne démarre pas : on affiche quand même l'écran « Le serveur ne répond pas. ». */
function showUnavailable(): void {
  const main = document.createElement('main');
  main.className = 'state-screen';
  main.setAttribute('role', 'alert');
  const title = document.createElement('h1');
  title.className = 'state-error';
  title.textContent = 'Le serveur ne répond pas.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn btn-primary';
  retry.textContent = 'Réessayer';
  retry.addEventListener('click', () => location.reload());
  main.append(title, retry);
  document.querySelector('app-root')?.replaceChildren(main);
}

/** `pp.theme`, ou `null` si le stockage est indisponible : le thème vaut alors `auto`. */
function storedTheme(): string | null {
  try {
    return globalThis.localStorage?.getItem(THEME_KEY) ?? null;
  } catch {
    return null;
  }
}
