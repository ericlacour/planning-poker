/**
 * Types du contrat (`contract/schemas`) écrits à la main (AD-6), et lecture stricte des réponses : aucun champ
 * hors contrat ne circule.
 */

/** `role.json` */
export type Role = 'VOTER' | 'OBSERVER';

/** `create-session-request.json` : le pseudo est brut, le webservice le normalise. */
export interface CreateSessionRequest {
  readonly pseudo: string;
  readonly role: Role;
}

/** `create-session-response.json`. `participantToken` est SECRET : jamais dans une URL ni un journal. */
export interface CreateSessionResponse {
  readonly sessionId: string;
  readonly participantId: string;
  readonly participantToken: string;
}

/** `join-session-request.json` : le pseudo est brut, le webservice le normalise. */
export interface JoinSessionRequest {
  readonly pseudo: string;
  readonly role: Role;
}

/** `join-session-response.json`. `participantToken` est SECRET : jamais dans une URL ni un journal. */
export interface JoinSessionResponse {
  readonly participantId: string;
  readonly participantToken: string;
}

/** `problem.json#/properties/code` */
export type ProblemCode =
  | 'PSEUDO_TAKEN'
  | 'INVALID_PSEUDO'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_FULL'
  | 'SESSION_LIMIT_REACHED'
  | 'TOO_MANY_REQUESTS';

/** `problem.json` (RFC 9457). Le texte affiché vient du front, d'après `code`. */
export interface Problem {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly code?: ProblemCode;
}

const BASE64URL_128_BITS = /^[A-Za-z0-9_-]{22}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROBLEM_CODES: readonly ProblemCode[] = [
  'PSEUDO_TAKEN',
  'INVALID_PSEUDO',
  'SESSION_NOT_FOUND',
  'SESSION_FULL',
  'SESSION_LIMIT_REACHED',
  'TOO_MANY_REQUESTS',
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const matches = (value: unknown, pattern: RegExp): value is string =>
  typeof value === 'string' && pattern.test(value);

export function createSessionRequest(pseudo: string, role: Role): CreateSessionRequest {
  return { pseudo, role };
}

/** Lit une réponse de création, ou lève une erreur si elle ne respecte pas le contrat. */
export function parseCreateSessionResponse(json: unknown): CreateSessionResponse {
  if (
    !isObject(json) ||
    !matches(json['sessionId'], BASE64URL_128_BITS) ||
    !matches(json['participantId'], UUID) ||
    !matches(json['participantToken'], BASE64URL_128_BITS)
  ) {
    throw new Error('create-session-response: unexpected shape');
  }
  return {
    sessionId: json['sessionId'],
    participantId: json['participantId'],
    participantToken: json['participantToken'],
  };
}

export function joinSessionRequest(pseudo: string, role: Role): JoinSessionRequest {
  return { pseudo, role };
}

/** Lit une réponse d'entrée dans une session, ou lève une erreur si elle ne respecte pas le contrat. */
export function parseJoinSessionResponse(json: unknown): JoinSessionResponse {
  if (
    !isObject(json) ||
    !matches(json['participantId'], UUID) ||
    !matches(json['participantToken'], BASE64URL_128_BITS)
  ) {
    throw new Error('join-session-response: unexpected shape');
  }
  return {
    participantId: json['participantId'],
    participantToken: json['participantToken'],
  };
}

/** Lit un `problem+json`, ou renvoie `null` s'il ne respecte pas le contrat. */
export function parseProblem(json: unknown): Problem | null {
  if (
    !isObject(json) ||
    typeof json['type'] !== 'string' ||
    typeof json['title'] !== 'string' ||
    typeof json['status'] !== 'number'
  ) {
    return null;
  }
  const code = json['code'];
  return {
    type: json['type'],
    title: json['title'],
    status: json['status'],
    ...(typeof json['detail'] === 'string' ? { detail: json['detail'] } : {}),
    ...(typeof json['instance'] === 'string' ? { instance: json['instance'] } : {}),
    ...(PROBLEM_CODES.includes(code as ProblemCode) ? { code: code as ProblemCode } : {}),
  };
}

// --- WebSocket (`asyncapi.yaml`) ---

/** `card.json` : seul le front affiche `coffee` en ☕. */
export type Card = '0' | '1' | '2' | '3' | '5' | '8' | '13' | '21' | '?' | 'coffee';

/** `session-state.json#/properties/lastChange/properties/action` */
export type ChangeAction = 'JOIN' | 'LEAVE' | 'VOTE' | 'REVEAL' | 'HIDE' | 'CLEAR' | 'ROLE' | 'PRESENCE';

/** `session-state.json#/$defs/participant` */
export interface ParticipantState {
  readonly participantId: string;
  readonly pseudo: string;
  readonly role: Role;
  readonly connected: boolean;
  readonly joinOrder: number;
  readonly hasVoted: boolean;
  readonly vote: Card | null;
  readonly canVoteThisRound: boolean;
}

/** `session-state.json#/$defs/summary` : synthèse d'un tour révélé, calculée par le webservice seul. */
export interface Summary {
  readonly average: number | null;
  readonly mostVoted: { readonly values: readonly Card[]; readonly count: number } | null;
  readonly min: Card | null;
  readonly max: Card | null;
  readonly consensus: boolean;
}

/** `session-state.json` : instantané complet pour ce destinataire ; le client le remplace sans fusionner. */
export interface SessionState {
  readonly type: 'sessionState';
  readonly sessionId: string;
  readonly version: number;
  readonly selfParticipantId: string;
  readonly round: { readonly roundId: string; readonly status: 'HIDDEN' | 'REVEALED' };
  /** Déjà triés par le serveur : votants, puis observateurs, chaque groupe par `joinOrder`. */
  readonly participants: readonly ParticipantState[];
  readonly progress: { readonly voted: number; readonly expected: number };
  readonly summary: Summary | null;
  readonly lastChange: { readonly action: ChangeAction; readonly byParticipantId: string | null };
}

/** `tick.json` */
export interface TickMessage {
  readonly type: 'tick';
}

/** `error.json#/properties/code` */
export type ErrorCode = 'ROUND_REVEALED' | 'NOT_A_VOTER' | 'INVALID_CARD' | 'INVALID_MESSAGE';

/** `error.json` */
export interface ErrorMessage {
  readonly type: 'error';
  readonly code: ErrorCode;
}

export type ServerMessage = SessionState | TickMessage | ErrorMessage;

/** `hello.json`. `participantToken` est SECRET. */
export interface HelloMessage {
  readonly type: 'hello';
  readonly participantToken: string;
}

/** `heartbeat.json` */
export interface HeartbeatMessage {
  readonly type: 'heartbeat';
}

/** `vote.json` : `card: null` retire le vote. */
export interface VoteMessage {
  readonly type: 'vote';
  readonly roundId: string;
  readonly card: Card | null;
}

export function voteMessage(roundId: string, card: Card | null): VoteMessage {
  return { type: 'vote', roundId, card };
}

/** `reveal.json` : révéler les votes du tour `roundId` (sans effet s'il est déjà révélé ou périmé). */
export interface RevealMessage {
  readonly type: 'reveal';
  readonly roundId: string;
}

export function revealMessage(roundId: string): RevealMessage {
  return { type: 'reveal', roundId };
}

/** `hide.json` : remettre en caché le tour révélé `roundId` pour revoter (sans effet s'il est déjà caché ou périmé). */
export interface HideMessage {
  readonly type: 'hide';
  readonly roundId: string;
}

export function hideMessage(roundId: string): HideMessage {
  return { type: 'hide', roundId };
}

/** `clear.json` : effacer les votes du tour `roundId` et ouvrir un nouveau tour (sans effet s'il est périmé). */
export interface ClearMessage {
  readonly type: 'clear';
  readonly roundId: string;
}

export function clearMessage(roundId: string): ClearMessage {
  return { type: 'clear', roundId };
}

/** `change-role.json` : passer votant ou observateur (sans effet pour le rôle déjà porté). */
export interface ChangeRoleMessage {
  readonly type: 'changeRole';
  readonly role: Role;
}

export function changeRoleMessage(role: Role): ChangeRoleMessage {
  return { type: 'changeRole', role };
}

export function helloMessage(participantToken: string): HelloMessage {
  return { type: 'hello', participantToken };
}

export function heartbeatMessage(): HeartbeatMessage {
  return { type: 'heartbeat' };
}

/** Le jeu, dans l'ordre de la main (`card.json`). */
export const CARDS: readonly Card[] = ['0', '1', '2', '3', '5', '8', '13', '21', '?', 'coffee'];
const NUMERIC_CARDS: readonly Card[] = ['0', '1', '2', '3', '5', '8', '13', '21'];
const ACTIONS: readonly ChangeAction[] = ['JOIN', 'LEAVE', 'VOTE', 'REVEAL', 'HIDE', 'CLEAR', 'ROLE', 'PRESENCE'];
const ERROR_CODES: readonly ErrorCode[] = ['ROUND_REVEALED', 'NOT_A_VOTER', 'INVALID_CARD', 'INVALID_MESSAGE'];
const ROLES: readonly Role[] = ['VOTER', 'OBSERVER'];

const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);

const isInteger = (value: unknown, min: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min;

const codePoints = (value: string) => [...value].length;

const isText = (value: unknown, min: number, max: number): value is string =>
  typeof value === 'string' && codePoints(value) >= min && codePoints(value) <= max;

const isOneOf = <T>(value: unknown, allowed: readonly T[]): value is T => allowed.includes(value as T);

const isNumericCardOrNull = (value: unknown) => value === null || isOneOf(value, NUMERIC_CARDS);

function isParticipant(value: unknown): value is ParticipantState {
  return (
    isObject(value) &&
    hasExactly(value, ['participantId', 'pseudo', 'role', 'connected', 'joinOrder', 'hasVoted', 'vote', 'canVoteThisRound']) &&
    matches(value['participantId'], UUID) &&
    isText(value['pseudo'], 1, 20) &&
    isOneOf(value['role'], ROLES) &&
    typeof value['connected'] === 'boolean' &&
    isInteger(value['joinOrder'], 1) &&
    typeof value['hasVoted'] === 'boolean' &&
    (value['vote'] === null || isOneOf(value['vote'], CARDS)) &&
    typeof value['canVoteThisRound'] === 'boolean'
  );
}

function isSummary(value: unknown): value is Summary {
  if (!isObject(value) || !hasExactly(value, ['average', 'mostVoted', 'min', 'max', 'consensus'])) return false;
  const mostVoted = value['mostVoted'];
  return (
    (value['average'] === null || typeof value['average'] === 'number') &&
    (mostVoted === null ||
      (isObject(mostVoted) &&
        hasExactly(mostVoted, ['values', 'count']) &&
        Array.isArray(mostVoted['values']) &&
        mostVoted['values'].length > 0 &&
        mostVoted['values'].every((v) => isOneOf(v, NUMERIC_CARDS)) &&
        isInteger(mostVoted['count'], 1))) &&
    isNumericCardOrNull(value['min']) &&
    isNumericCardOrNull(value['max']) &&
    typeof value['consensus'] === 'boolean'
  );
}

function isSessionState(json: Record<string, unknown>): boolean {
  const { round, participants, progress, lastChange, summary } = json;
  return (
    hasExactly(json, [
      'type', 'sessionId', 'version', 'selfParticipantId', 'round', 'participants', 'progress', 'summary', 'lastChange',
    ]) &&
    matches(json['sessionId'], BASE64URL_128_BITS) &&
    isInteger(json['version'], 1) &&
    matches(json['selfParticipantId'], UUID) &&
    isObject(round) &&
    hasExactly(round, ['roundId', 'status']) &&
    isText(round['roundId'], 1, 64) &&
    isOneOf(round['status'], ['HIDDEN', 'REVEALED']) &&
    Array.isArray(participants) &&
    participants.every(isParticipant) &&
    isObject(progress) &&
    hasExactly(progress, ['voted', 'expected']) &&
    isInteger(progress['voted'], 0) &&
    isInteger(progress['expected'], 0) &&
    (summary === null || isSummary(summary)) &&
    isObject(lastChange) &&
    hasExactly(lastChange, ['action', 'byParticipantId']) &&
    isOneOf(lastChange['action'], ACTIONS) &&
    (lastChange['byParticipantId'] === null || matches(lastChange['byParticipantId'], UUID))
  );
}

/** Lit un message du webservice, ou renvoie `null` s'il ne respecte pas le contrat (il est alors ignoré). */
export function parseServerMessage(json: unknown): ServerMessage | null {
  if (!isObject(json)) return null;
  switch (json['type']) {
    case 'sessionState':
      return isSessionState(json) ? (json as unknown as SessionState) : null;
    case 'tick':
      return hasExactly(json, ['type']) ? { type: 'tick' } : null;
    case 'error':
      return hasExactly(json, ['type', 'code']) && isOneOf(json['code'], ERROR_CODES)
        ? { type: 'error', code: json['code'] }
        : null;
    default:
      return null;
  }
}
