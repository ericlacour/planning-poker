import { describe, expect, it } from 'vitest';

import invalidCard from '../../../../contract/examples/error/invalid-card.json';
import invalidMessage from '../../../../contract/examples/error/invalid-message.json';
import notAVoter from '../../../../contract/examples/error/not-a-voter.json';
import roundRevealed from '../../../../contract/examples/error/round-revealed.json';
import heartbeat from '../../../../contract/examples/heartbeat/heartbeat.json';
import hello from '../../../../contract/examples/hello/hello.json';
import alone from '../../../../contract/examples/session-state/alone-after-create.json';
import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import newRoundAfterSweep from '../../../../contract/examples/session-state/new-round-after-sweep.json';
import revealedConsensus from '../../../../contract/examples/session-state/revealed-consensus.json';
import revealedNoNumeric from '../../../../contract/examples/session-state/revealed-no-numeric-vote.json';
import revealedObserver from '../../../../contract/examples/session-state/revealed-seen-by-observer.json';
import revealedTie from '../../../../contract/examples/session-state/revealed-tie.json';
import tick from '../../../../contract/examples/tick/tick.json';
import { heartbeatMessage, helloMessage, parseServerMessage } from './contract';

const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value));

/** Les exemples WebSocket du contrat font l'aller-retour à travers les types écrits à la main (AD-6). */
describe('WebSocket contract round trip', () => {
  it.each([
    ['alone-after-create', alone],
    ['hidden-round', hiddenRound],
  ])('session-state/%s', (_, example) => {
    expect(roundTrip(parseServerMessage(example))).toEqual(example);
  });

  it('the other session-state examples are accepted too', () => {
    for (const example of [newRoundAfterSweep, revealedConsensus, revealedNoNumeric, revealedObserver, revealedTie]) {
      expect(parseServerMessage(example)).toEqual(example);
    }
  });

  it('hello', () => {
    expect(roundTrip(helloMessage(hello.participantToken))).toEqual(hello);
  });

  it('heartbeat', () => {
    expect(roundTrip(heartbeatMessage())).toEqual(heartbeat);
  });

  it('tick', () => {
    expect(roundTrip(parseServerMessage(tick))).toEqual(tick);
  });

  it.each([invalidCard, invalidMessage, notAVoter, roundRevealed])('error %j', (example) => {
    expect(roundTrip(parseServerMessage(example))).toEqual(example);
  });
});

describe('parseServerMessage', () => {
  it('rejects messages outside the contract', () => {
    expect(parseServerMessage(null)).toBeNull();
    expect(parseServerMessage({ type: 'nope' })).toBeNull();
    expect(parseServerMessage({ type: 'tick', extra: 1 })).toBeNull();
    expect(parseServerMessage({ type: 'error', code: 'OTHER' })).toBeNull();
    expect(parseServerMessage({ ...alone, extra: 1 })).toBeNull();
    expect(parseServerMessage({ ...alone, version: 0 })).toBeNull();
    expect(parseServerMessage({ ...alone, sessionId: 'short' })).toBeNull();
    const [seat] = alone.participants;
    expect(parseServerMessage({ ...alone, participants: [{ ...seat, participantToken: 'x' }] })).toBeNull();
    expect(parseServerMessage({ ...alone, participants: [{ ...seat, vote: '4' }] })).toBeNull();
    expect(parseServerMessage({ ...alone, participants: [{ ...seat, pseudo: '' }] })).toBeNull();
    expect(parseServerMessage({ ...alone, lastChange: { action: 'PRESENCE' } })).toBeNull();
  });
});
