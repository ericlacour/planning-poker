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

/** `problem.json#/properties/code` */
export type ProblemCode = 'PSEUDO_TAKEN' | 'INVALID_PSEUDO' | 'SESSION_NOT_FOUND';

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
const PROBLEM_CODES: readonly ProblemCode[] = ['PSEUDO_TAKEN', 'INVALID_PSEUDO', 'SESSION_NOT_FOUND'];

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
