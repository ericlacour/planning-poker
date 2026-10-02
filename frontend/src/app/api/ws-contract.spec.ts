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
import clear from '../../../../contract/examples/clear/clear.json';
import reveal from '../../../../contract/examples/reveal/reveal.json';
import tick from '../../../../contract/examples/tick/tick.json';
import chooseCard from '../../../../contract/examples/vote/choose-card.json';
import coffee from '../../../../contract/examples/vote/coffee.json';
import withdraw from '../../../../contract/examples/vote/withdraw.json';
import {
  Card,
  clearMessage,
  heartbeatMessage,
  helloMessage,
  parseServerMessage,
  revealMessage,
  voteMessage,
} from './contract';

const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value));

/** Les exemples WebSocket du contrat font l'aller-retour à travers les types écrits à la main (AD-6). */
describe('WebSocket contract round trip', () => {
  it.each([
    ['alone-after-create', alone],
    ['hidden-round', hiddenRound],
    ['new-round-after-sweep', newRoundAfterSweep],
    ['revealed-consensus', revealedConsensus],
    ['revealed-no-numeric-vote', revealedNoNumeric],
    ['revealed-seen-by-observer', revealedObserver],
    ['revealed-tie', revealedTie],
  ])('session-state/%s', (_, example) => {
    expect(roundTrip(parseServerMessage(example))).toEqual(example);
  });

  it('an average written 3.0 by the server reads as the number 3 (numeric comparison)', () => {
    const json = JSON.stringify(revealedConsensus).replace('"average":3,', '"average":3.0,');
    expect(json).toContain('"average":3.0,');
    const parsed = parseServerMessage(JSON.parse(json));
    expect(parsed).toEqual(revealedConsensus);
    expect(parsed?.type === 'sessionState' && parsed.summary?.average).toBe(3);
  });

  it('reveal', () => {
    expect(roundTrip(revealMessage(reveal.roundId))).toEqual(reveal);
  });

  it('clear', () => {
    expect(roundTrip(clearMessage(clear.roundId))).toEqual(clear);
  });

  it('hello', () => {
    expect(roundTrip(helloMessage(hello.participantToken))).toEqual(hello);
  });

  it('heartbeat', () => {
    expect(roundTrip(heartbeatMessage())).toEqual(heartbeat);
  });

  it.each([
    ['choose-card', chooseCard],
    ['coffee', coffee],
    ['withdraw', withdraw],
  ])('vote/%s', (_, example) => {
    expect(roundTrip(voteMessage(example.roundId, example.card as Card | null))).toEqual(example);
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
