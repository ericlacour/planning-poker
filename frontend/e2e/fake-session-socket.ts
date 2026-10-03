import { Page, WebSocketRoute } from '@playwright/test';

import alone from '../../contract/examples/session-state/alone-after-create.json';

export const WS = 'ws://127.0.0.1:4310';

export interface FakeSocketServer {
  /** Messages reçus du front, dans l'ordre. */
  readonly received: unknown[];
  /** Connexions ouvertes par le front. */
  readonly routes: WebSocketRoute[];
}

/**
 * Faux webservice WebSocket (`/ws/sessions/{sessionId}`) : à chaque `hello`, `onHello` répond (instantané,
 * fermeture…). Aucune connexion ne sort vers un vrai serveur.
 */
export async function fakeSessionSocket(
  page: Page,
  sessionId: string,
  onHello: (ws: WebSocketRoute, token: string) => void,
): Promise<FakeSocketServer> {
  const server: FakeSocketServer = { received: [], routes: [] };
  await page.routeWebSocket(`${WS}/ws/sessions/${sessionId}`, (ws) => {
    server.routes.push(ws);
    ws.onMessage((message) => {
      const json = JSON.parse(String(message)) as { type: string; participantToken?: string };
      server.received.push(json);
      if (json.type === 'hello') onHello(ws, json.participantToken ?? '');
    });
  });
  return server;
}

/** Instantané « seul dans la session » (exemple du contrat), vu par `selfParticipantId`. */
export function aloneSnapshot(selfParticipantId: string, pseudo = 'Alice', role: 'VOTER' | 'OBSERVER' = 'VOTER') {
  return {
    ...alone,
    version: 2,
    selfParticipantId,
    participants: [
      { ...alone.participants[0], participantId: selfParticipantId, pseudo, role, canVoteThisRound: role === 'VOTER' },
    ],
    progress: { voted: 0, expected: role === 'VOTER' ? 1 : 0 },
    lastChange: { action: 'PRESENCE', byParticipantId: selfParticipantId },
  };
}
