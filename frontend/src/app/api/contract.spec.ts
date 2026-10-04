import { describe, expect, it } from 'vitest';

import observer from '../../../../contract/examples/create-session-request/observer.json';
import voter from '../../../../contract/examples/create-session-request/voter.json';
import created from '../../../../contract/examples/create-session-response/created.json';
import invalidPseudo from '../../../../contract/examples/problem/bad-request-invalid-pseudo.json';
import malformedBody from '../../../../contract/examples/problem/bad-request-malformed-body.json';
import pseudoTaken from '../../../../contract/examples/problem/pseudo-taken.json';
import payloadTooLarge from '../../../../contract/examples/problem/payload-too-large.json';
import sessionFull from '../../../../contract/examples/problem/session-full.json';
import sessionLimitReached from '../../../../contract/examples/problem/session-limit-reached.json';
import tooManyRequests from '../../../../contract/examples/problem/too-many-requests.json';
import sessionNotFound from '../../../../contract/examples/problem/session-not-found.json';
import joinVoter from '../../../../contract/examples/join-session-request/voter.json';
import joined from '../../../../contract/examples/join-session-response/joined.json';
import {
  createSessionRequest,
  joinSessionRequest,
  parseCreateSessionResponse,
  parseJoinSessionResponse,
  parseProblem,
  Role,
} from './contract';

/** Les exemples du contrat font l'aller-retour à travers les types écrits à la main, sans perte ni ajout. */
describe('contract round trip', () => {
  it.each([voter, observer])('create-session-request %j', (example) => {
    const request = createSessionRequest(example.pseudo, example.role as Role);
    expect(JSON.parse(JSON.stringify(request))).toEqual(example);
  });

  it('create-session-response/created', () => {
    expect(JSON.parse(JSON.stringify(parseCreateSessionResponse(created)))).toEqual(created);
  });

  it('join-session-request/voter', () => {
    const request = joinSessionRequest(joinVoter.pseudo, joinVoter.role as Role);
    expect(JSON.parse(JSON.stringify(request))).toEqual(joinVoter);
  });

  it('join-session-response/joined', () => {
    expect(JSON.parse(JSON.stringify(parseJoinSessionResponse(joined)))).toEqual(joined);
  });

  it.each([
    invalidPseudo,
    malformedBody,
    pseudoTaken,
    sessionNotFound,
    sessionFull,
    payloadTooLarge,
    tooManyRequests,
    sessionLimitReached,
  ])('problem %j', (example) => {
    expect(JSON.parse(JSON.stringify(parseProblem(example)))).toEqual(example);
  });
});

describe('parseCreateSessionResponse', () => {
  it('drops nothing but rejects a response that breaks the contract', () => {
    expect(() => parseCreateSessionResponse({ ...created, sessionId: 'short' })).toThrow();
    expect(() => parseCreateSessionResponse({ ...created, participantId: 'not-a-uuid' })).toThrow();
    expect(() => parseCreateSessionResponse(null)).toThrow();
  });

  it('keeps only the contract fields', () => {
    expect(Object.keys(parseCreateSessionResponse({ ...created, extra: 1 }))).toEqual([
      'sessionId',
      'participantId',
      'participantToken',
    ]);
  });
});

describe('parseJoinSessionResponse', () => {
  it('rejects a response that breaks the contract', () => {
    expect(() => parseJoinSessionResponse({ ...joined, participantToken: 'short' })).toThrow();
    expect(() => parseJoinSessionResponse({ ...joined, participantId: 'not-a-uuid' })).toThrow();
    expect(() => parseJoinSessionResponse({ participantId: joined.participantId })).toThrow();
    expect(() => parseJoinSessionResponse([])).toThrow();
  });

  it('keeps only the contract fields', () => {
    expect(Object.keys(parseJoinSessionResponse({ ...joined, sessionId: 'x' }))).toEqual([
      'participantId',
      'participantToken',
    ]);
  });
});

describe('parseProblem', () => {
  it('returns null for something that is not a problem', () => {
    expect(parseProblem('<html>')).toBeNull();
    expect(parseProblem({ status: 502 })).toBeNull();
  });

  it('ignores an unknown code', () => {
    expect(parseProblem({ ...invalidPseudo, code: 'OTHER' })?.code).toBeUndefined();
  });
});
