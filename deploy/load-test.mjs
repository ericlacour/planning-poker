#!/usr/bin/env node
// Test de charge du webservice (story 1.5) : N sessions de M participants connectés en WebSocket pendant D minutes.
//
//   node deploy/load-test.mjs --url https://planning-poker-api.onrender.com --minutes 10
//
// Options : --url (obligatoire, URL http(s) du webservice), --sessions 5, --participants 13, --minutes 10,
// --churn-seconds 10 (période de départ / retour d'un participant par session), --origin (en-tête Origin envoyé à
// l'ouverture du WebSocket, à mettre dans ALLOWED_ORIGINS ; aucun par défaut), --timeout-ms 10000 (au-delà, une diffusion compte comme non reçue).
//
// Chaque session a M − 1 participants connectés en permanence et un participant « mobile » qui quitte puis
// rejoint la table (fermeture puis réouverture de sa connexion : PRESENCE) toutes les --churn-seconds. Les
// arrivées initiales par REST (JOIN) sont mesurées aussi. Pour chaque mutation, le script mesure le délai entre
// la mutation (envoi de la requête, du hello ou de la fermeture) et la réception de l'instantané correspondant
// par chaque participant connecté. Il envoie `heartbeat` toutes les 5 s sur chaque connexion. Les latences sont
// aussi détaillées par type de mutation : JOIN (arrivée par REST), PRESENCE+ (connexion ou retour), PRESENCE- (départ).
//
// Sortie 1 si une diffusion dépasse 1 s (6 s pour un départ, PRESENCE-), n'arrive pas, ou si une connexion
// permanente tombe ; 0 sinon. Le seuil des départs suit la décision d'équipe du 2026-10-03 (FR-16) : derrière
// Render, la fermeture d'une connexion met environ 5 s à atteindre le webservice.
// Utilise le WebSocket natif de Node 24 ; aucune dépendance.

const HEARTBEAT_MS = 5_000;
const LIMIT_MS = 1_000;
const LIMIT_BY_KIND_MS = { 'PRESENCE-': 6_000 };
const limitOf = (kind) => LIMIT_BY_KIND_MS[kind] ?? LIMIT_MS;

function parseArgs(argv) {
  const options = {
    url: null,
    sessions: 5,
    participants: 13,
    minutes: 10,
    churnSeconds: 10,
    origin: null,
    timeoutMs: 10_000,
  };
  for (let i = 0; i < argv.length; i += 2) {
    const [key, value] = [argv[i], argv[i + 1]];
    if (value === undefined) throw new Error(`valeur manquante pour ${key}`);
    switch (key) {
      case '--url':
        options.url = value.replace(/\/+$/, '');
        break;
      case '--origin':
        options.origin = value;
        break;
      case '--sessions':
      case '--participants':
      case '--minutes':
      case '--churn-seconds':
      case '--timeout-ms': {
        const number = Number(value);
        if (!(number > 0)) throw new Error(`${key} doit être un nombre positif`);
        const name = key.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase());
        options[name] = number;
        break;
      }
      default:
        throw new Error(`option inconnue : ${key}`);
    }
  }
  if (!options.url || !/^https?:\/\/[^/]+$/.test(options.url)) {
    throw new Error('--url est obligatoire : origine http(s) du webservice, sans chemin');
  }
  if (options.participants < 2) throw new Error('--participants doit valoir au moins 2');
  return options;
}

const now = () => performance.now();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Mutations en attente de diffusion : chacune attend un instantané précis chez chaque destinataire. */
class Expectations {
  constructor(timeoutMs) {
    this.timeoutMs = timeoutMs;
    this.pending = new Set();
    this.latencies = [];
    this.latenciesByKind = new Map();
    this.missed = [];
  }

  /** Attend que chaque pair de `recipients` reçoive un instantané qui satisfait `match`. */
  expect(label, recipients, match, t0) {
    const expectation = { label, waiting: new Set(recipients), match, t0 };
    if (expectation.waiting.size === 0) return Promise.resolve();
    this.pending.add(expectation);
    return new Promise((resolve) => {
      expectation.resolve = resolve;
      expectation.timer = setTimeout(() => {
        for (const peer of expectation.waiting) this.missed.push(`${label} → ${peer.label}`);
        this.pending.delete(expectation);
        resolve();
      }, this.timeoutMs);
    });
  }

  received(peer, state, at) {
    for (const expectation of this.pending) {
      if (expectation.waiting.has(peer) && expectation.match(state)) {
        expectation.waiting.delete(peer);
        const latency = at - expectation.t0;
        this.latencies.push(latency);
        const kind = expectation.label.split(' ')[0];
        if (!this.latenciesByKind.has(kind)) this.latenciesByKind.set(kind, []);
        this.latenciesByKind.get(kind).push(latency);
        if (expectation.waiting.size === 0) {
          clearTimeout(expectation.timer);
          this.pending.delete(expectation);
          expectation.resolve();
        }
      }
    }
  }
}

class Peer {
  constructor(run, session, label, participantId, token) {
    Object.assign(this, { run, session, label, participantId, token });
    this.socket = null;
    this.closing = false;
    this.ticks = 0;
  }

  get open() {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /** Ouvre la connexion et envoie `hello` ; résout au premier instantané. */
  connect() {
    const { options, expectations, drops } = this.run;
    const url = `${options.url.replace(/^http/, 'ws')}/ws/sessions/${this.session.id}`;
    const init = options.origin ? { headers: { Origin: options.origin } } : undefined;
    this.closing = false;
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url, init);
      this.socket = socket;
      let first = true;
      socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'hello', participantToken: this.token })));
      socket.addEventListener('message', (event) => {
        const at = now();
        const message = JSON.parse(event.data);
        if (message.type === 'tick') {
          this.ticks++;
          this.run.ticks++;
        } else if (message.type === 'sessionState') {
          this.state = message;
          expectations.received(this, message, at);
          if (first) {
            first = false;
            resolve(message);
          }
        }
      });
      socket.addEventListener('close', (event) => {
        if (first) reject(new Error(`${this.label} : fermeture ${event.code} avant l'instantané`));
        if (!this.closing) drops.push(`${this.label} : fermeture inattendue ${event.code}`);
      });
      socket.addEventListener('error', () => {
        if (first) reject(new Error(`${this.label} : connexion impossible`));
      });
    });
  }

  close() {
    this.closing = true;
    this.socket?.close(1000);
  }
}

async function post(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${new URL(url).pathname.replace(/[^/]{22}/, '{id}')} : HTTP ${response.status}`);
  return response.json();
}

const seatOf = (state, participantId) => state.participants.find((p) => p.participantId === participantId);

/** Crée une session et y fait entrer ses participants un à un, en mesurant la diffusion de chaque arrivée. */
async function setUpSession(run, index) {
  const { options, expectations } = run;
  const name = (k) => `S${index + 1}P${k + 1}`;
  const created = await post(`${options.url}/api/sessions`, { pseudo: name(0), role: 'VOTER' });
  const session = { id: created.sessionId, peers: [] };
  const creator = new Peer(run, session, name(0), created.participantId, created.participantToken);
  session.peers.push(creator);
  await creator.connect();
  for (let k = 1; k < options.participants; k++) {
    const role = k % 4 === 3 ? 'OBSERVER' : 'VOTER';
    // Attente posée avant la requête : l'instantané JOIN peut arriver avant la réponse REST.
    const known = new Set(session.peers.map((p) => p.participantId));
    const t0 = now();
    const join = expectations.expect(
      `JOIN ${name(k)}`,
      session.peers.filter((p) => p.open),
      (s) => s.lastChange.action === 'JOIN' && !known.has(s.lastChange.byParticipantId),
      t0,
    );
    const joined = await post(`${options.url}/api/sessions/${session.id}/participants`, { pseudo: name(k), role });
    const peer = new Peer(run, session, name(k), joined.participantId, joined.participantToken);
    await join;
    const t1 = now();
    const presence = expectations.expect(
      `PRESENCE+ ${peer.label}`,
      session.peers.filter((p) => p.open),
      (s) => s.lastChange.action === 'PRESENCE' && seatOf(s, peer.participantId)?.connected === true,
      t1,
    );
    session.peers.push(peer);
    await peer.connect();
    await presence;
  }
  return session;
}

/** Le dernier participant de la session quitte la table puis revient, en boucle, jusqu'à `deadline`. */
async function churn(run, session, deadline, offsetMs) {
  const { options, expectations } = run;
  const mobile = session.peers[session.peers.length - 1];
  const others = () => session.peers.filter((p) => p !== mobile && p.open);
  await sleep(offsetMs);
  while (now() + options.churnSeconds * 1000 < deadline) {
    await sleep(options.churnSeconds * 1000);
    const leaving = expectations.expect(
      `PRESENCE- ${mobile.label}`,
      others(),
      (s) => s.lastChange.action === 'PRESENCE' && seatOf(s, mobile.participantId)?.connected === false,
      now(),
    );
    mobile.close();
    await leaving;
    await sleep(options.churnSeconds * 1000);
    const t0 = now();
    const back = expectations.expect(
      `PRESENCE+ ${mobile.label}`,
      others(),
      (s) => s.lastChange.action === 'PRESENCE' && seatOf(s, mobile.participantId)?.connected === true,
      t0,
    );
    await mobile.connect();
    await back;
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

/** « p50 … ms, p95 … ms, p99 … ms, max … ms » d'une liste de latences. */
function describe(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b);
  return (
    `p50 ${percentile(sorted, 50).toFixed(1)} ms, p95 ${percentile(sorted, 95).toFixed(1)} ms, ` +
    `p99 ${percentile(sorted, 99).toFixed(1)} ms, max ${(sorted.at(-1) ?? 0).toFixed(1)} ms`
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const run = { options, expectations: new Expectations(options.timeoutMs), drops: [], ticks: 0 };
  const started = now();
  console.log(
    `Charge : ${options.sessions} sessions × ${options.participants} participants, ${options.minutes} min, ` +
      `départ / retour toutes les ${options.churnSeconds} s, contre ${options.url}`,
  );

  const sessions = await Promise.all(Array.from({ length: options.sessions }, (_, i) => setUpSession(run, i)));
  const connections = sessions.reduce((n, s) => n + s.peers.filter((p) => p.open).length, 0);
  console.log(`${connections} connexions ouvertes en ${Math.round(now() - started)} ms`);

  const heartbeat = setInterval(() => {
    for (const session of sessions) {
      for (const peer of session.peers) if (peer.open) peer.socket.send('{"type":"heartbeat"}');
    }
  }, HEARTBEAT_MS);

  const deadline = started + options.minutes * 60_000;
  const step = (options.churnSeconds * 1000) / options.sessions;
  await Promise.all(sessions.map((session, i) => churn(run, session, deadline, i * step)));
  await sleep(Math.max(0, deadline - now()));
  clearInterval(heartbeat);
  const ticksPerConnection = run.ticks / Math.max(1, connections);
  for (const session of sessions) for (const peer of session.peers) peer.close();

  const latencies = run.expectations.latencies;
  console.log(`Diffusions mesurées : ${latencies.length} ; latence ${describe(latencies)}`);
  const failures = [];
  for (const kind of ['JOIN', 'PRESENCE+', 'PRESENCE-']) {
    const ofKind = run.expectations.latenciesByKind.get(kind) ?? [];
    const limit = limitOf(kind);
    const late = ofKind.filter((latency) => latency > limit).length;
    console.log(`  ${kind.padEnd(9)} : ${ofKind.length} ; ${describe(ofKind)} ; au-delà de ${limit / 1000} s : ${late}`);
    if (late) {
      failures.push(`${late} diffusions ${kind} au-delà de ${limit / 1000} s (max ${Math.max(...ofKind).toFixed(1)} ms)`);
    }
  }
  console.log(`tick reçus : ${run.ticks} (≈ ${ticksPerConnection.toFixed(1)} par connexion)`);
  if (run.expectations.missed.length) {
    failures.push(`${run.expectations.missed.length} diffusions non reçues, par exemple ${run.expectations.missed[0]}`);
  }
  if (run.drops.length) failures.push(`${run.drops.length} connexions tombées, par exemple ${run.drops[0]}`);
  if (failures.length) {
    for (const failure of failures) console.error(`ÉCHEC : ${failure}`);
    process.exit(1);
  }
  console.log('OK : aucune diffusion au-delà de son seuil (1 s, 6 s pour un départ), aucune connexion tombée.');
  process.exit(0);
}

main().catch((error) => {
  console.error(`ÉCHEC : ${error.message}`);
  process.exit(1);
});
