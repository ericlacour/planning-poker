import { describe, expect, it } from 'vitest';

import observer from '../../../../contract/examples/create-session-request/observer.json';
import voter from '../../../../contract/examples/create-session-request/voter.json';
import created from '../../../../contract/examples/create-session-response/created.json';
import invalidPseudo from '../../../../contract/examples/problem/bad-request-invalid-pseudo.json';
import malformedBody from '../../../../contract/examples/problem/bad-request-malformed-body.json';
import { createSessionRequest, parseCreateSessionResponse, parseProblem, Role } from './contract';

/** Les exemples du contrat font l'aller-retour à travers les types écrits à la main, sans perte ni ajout. */
describe('contract round trip', () => {
  it.each([voter, observer])('create-session-request %j', (example) => {
    const request = createSessionRequest(example.pseudo, example.role as Role);
    expect(JSON.parse(JSON.stringify(request))).toEqual(example);
  });

  it('create-session-response/created', () => {
    expect(JSON.parse(JSON.stringify(parseCreateSessionResponse(created)))).toEqual(created);
  });

  it.each([invalidPseudo, malformedBody])('problem %j', (example) => {
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

describe('parseProblem', () => {
  it('returns null for something that is not a problem', () => {
    expect(parseProblem('<html>')).toBeNull();
    expect(parseProblem({ status: 502 })).toBeNull();
  });

  it('ignores an unknown code', () => {
    expect(parseProblem({ ...invalidPseudo, code: 'OTHER' })?.code).toBeUndefined();
  });
});
