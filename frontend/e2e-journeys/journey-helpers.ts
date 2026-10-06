import {
  test as base,
  Browser,
  BrowserContext,
  BrowserContextOptions,
  expect,
  Page,
  WebSocketRoute,
} from '@playwright/test';

export { expect };

/**
 * Outils communs aux parcours de bout en bout (story 3.6), joués contre le vrai webservice. Aucune interception
 * REST : seul {@link cuttableSocket} s'intercale sur le WebSocket, pour couper et rétablir la connexion.
 */

export const APP = 'http://127.0.0.1:4300';

export type Role = 'Je vote' | "J'observe";

/** Contextes ouverts par un parcours, fermés à la fin (`closeAll`). */
export class Contexts {
  private readonly opened: BrowserContext[] = [];

  constructor(private readonly browser: Browser) {}

  async open(options: BrowserContextOptions = {}): Promise<BrowserContext> {
    const context = await this.browser.newContext({ baseURL: APP, ...options });
    this.opened.push(context);
    return context;
  }

  async closeAll(): Promise<void> {
    await Promise.all(this.opened.map((context) => context.close().catch(() => undefined)));
  }
}

/** `test` des parcours : fournit `contexts`, dont les contextes sont fermés en fin de test. */
export const test = base.extend<{ contexts: Contexts }>({
  contexts: async ({ browser }, use) => {
    const contexts = new Contexts(browser);
    await use(contexts);
    await contexts.closeAll();
  },
});

/** Remplit le formulaire d'entrée (pseudo, rôle) et l'envoie avec `submit`. */
async function fillEntryForm(
  page: Page,
  pseudo: string,
  role: Role,
  submit: string,
): Promise<void> {
  await page.getByLabel('Ton pseudo').fill(pseudo);
  await page.getByRole('radio', { name: role, exact: true }).click();
  await expect(page.getByRole('radio', { name: role, exact: true })).toBeChecked();
  await page.getByRole('button', { name: submit, exact: true }).click();
}

/** Attend que ma place figure à la table, connectée au webservice. */
async function seated(page: Page, pseudo: string): Promise<void> {
  await expect(seat(page, pseudo)).toContainText('(toi)');
  await expect(seat(page, pseudo)).not.toContainText('déconnecté');
}

/** Crée une session depuis l'Accueil ; renvoie la page et l'identifiant lu dans l'URL. */
export async function create(
  context: BrowserContext,
  pseudo: string,
  role: Role,
): Promise<{ page: Page; sessionId: string }> {
  const page = await context.newPage();
  await page.goto('/');
  await fillEntryForm(page, pseudo, role, 'Créer une session');
  await expect(page).toHaveURL(/\/s\/[^/]+$/);
  await seated(page, pseudo);
  const sessionId = new URL(page.url()).pathname.split('/').pop()!;
  return { page, sessionId };
}

/** Ouvre le lien de session dans `context` et rejoint avec `pseudo` et `role` (écran Rejoindre). */
export async function join(
  context: BrowserContext,
  sessionUrl: string,
  pseudo: string,
  role: Role,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(sessionUrl);
  await fillEntryForm(page, pseudo, role, 'Rejoindre');
  await seated(page, pseudo);
  return page;
}

/** Place d'un participant à la table, désignée par son pseudo. */
export function seat(page: Page, pseudo: string) {
  return page
    .getByRole('list', { name: 'Participants' })
    .getByRole('listitem')
    .filter({ has: page.getByText(pseudo, { exact: true }) });
}

/** Ma main « Ta carte ». */
export function hand(page: Page) {
  return page.getByRole('toolbar', { name: 'Ta carte' });
}

/** Une carte de ma main : « Carte 5 »… */
export function card(page: Page, value: string) {
  return hand(page).getByRole('button', { name: `Carte ${value}`, exact: true });
}

/** Choisit une carte quand la main est active, et attend que l'instantané du webservice la montre choisie. */
export async function vote(page: Page, value: string, { tap = false } = {}): Promise<void> {
  await expect(hand(page)).not.toHaveAttribute('aria-disabled', 'true');
  if (tap) await card(page, value).tap();
  else await card(page, value).click();
  await expect(card(page, value)).toHaveAttribute('aria-pressed', 'true');
}

/** Bouton de la barre d'action : « Révéler les votes », « Nouveau tour »… */
export function action(page: Page, name: string) {
  return page.locator('.action-bar').getByRole('button', { name, exact: true });
}

/** Compteur « N votes sur M » de la barre d'action. */
export function counter(page: Page) {
  return page.locator('.action-bar .vote-counter');
}

/** Bandeau « Reconnexion… ». */
export function reconnecting(page: Page) {
  return page.getByRole('status').filter({ hasText: 'Reconnexion…' });
}

/**
 * Fermeture relayable : `WebSocket.close()` n'accepte que 1000 ou 3000–4999 ; tout autre code (1001, 1006…) ferait
 * échouer la fermeture, qui part alors sans code.
 */
function closing(
  code: number | undefined,
  reason: string | undefined,
): { code?: number; reason?: string } {
  const sendable = code === 1000 || (code !== undefined && code >= 3000 && code <= 4999);
  return sendable ? { code, reason } : {};
}

export interface CuttableSocket {
  /** Coupe les connexions ouvertes (des deux côtés) et ferme aussitôt toute nouvelle tentative. */
  cut(): Promise<void>;
  /** Laisse de nouveau passer les connexions vers le vrai webservice. */
  restore(): void;
}

/**
 * Mandataire WebSocket entre la page (ou toutes les pages d'un contexte) et le vrai webservice : hors coupure,
 * chaque connexion est relayée telle quelle (`connectToServer`) ; pendant une coupure, les connexions ouvertes sont
 * fermées des deux côtés et toute nouvelle tentative est refusée, comme un réseau tombé. À installer avant
 * d'ouvrir la session.
 */
export async function cuttableSocket(target: Page | BrowserContext): Promise<CuttableSocket> {
  let down = false;
  const live = new Set<{ page: WebSocketRoute; server: WebSocketRoute }>();
  await target.routeWebSocket(/\/ws\/sessions\//, (ws) => {
    if (down) {
      void ws.close({ code: 1011, reason: 'coupure' }).catch(() => undefined);
      return;
    }
    const pair = { page: ws, server: ws.connectToServer() };
    live.add(pair);
    // Fermetures relayées avec leur code : `4401` (place reprise) et `4404` doivent arriver tels quels.
    ws.onClose((code, reason) => {
      live.delete(pair);
      void pair.server.close(closing(code, reason)).catch(() => undefined);
    });
    pair.server.onClose((code, reason) => {
      live.delete(pair);
      void ws.close(closing(code, reason)).catch(() => undefined);
    });
  });
  return {
    async cut() {
      down = true;
      const pairs = [...live];
      live.clear();
      await Promise.all(
        pairs.flatMap(({ page, server }) => [
          server.close().catch(() => undefined),
          page.close({ code: 1011, reason: 'coupure' }).catch(() => undefined),
        ]),
      );
    },
    restore() {
      down = false;
    },
  };
}
