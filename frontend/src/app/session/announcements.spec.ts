import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import { SessionState } from '../api/contract';
import {
  arrivalAnnouncement,
  COUNTER_WINDOW_MS,
  CounterAnnouncer,
  joinSentences,
} from './announcements';

const state = hiddenRound as SessionState;
const [alice, bob] = state.participants;
const sofia = {
  ...bob,
  participantId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  pseudo: 'Sofia',
  joinOrder: 6,
};
const yann = {
  ...bob,
  participantId: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
  pseudo: 'Yann',
  joinOrder: 7,
};
const withParticipants = (
  participants: SessionState['participants'],
  self = state.selfParticipantId,
) => ({
  ...state,
  selfParticipantId: self,
  participants,
});

describe('arrivalAnnouncement', () => {
  it('announces a participant absent from the previous snapshot', () => {
    expect(arrivalAnnouncement(state, withParticipants([...state.participants, sofia]))).toBe(
      'Sofia a rejoint la session',
    );
  });

  it('joins several arrivals of the same snapshot, in table order', () => {
    expect(arrivalAnnouncement(state, withParticipants([...state.participants, sofia, yann]))).toBe(
      'Sofia a rejoint la session. Yann a rejoint la session',
    );
  });

  it('never for the first snapshot, nor for me, nor for someone already there', () => {
    expect(arrivalAnnouncement(null, state)).toBeNull();
    expect(
      arrivalAnnouncement(
        withParticipants([bob], sofia.participantId),
        withParticipants([bob, sofia], sofia.participantId),
      ),
    ).toBeNull();
    expect(arrivalAnnouncement(state, { ...state, version: 8 })).toBeNull();
    expect(
      arrivalAnnouncement(withParticipants([alice, bob]), withParticipants([alice])),
    ).toBeNull();
  });
});

describe('joinSentences', () => {
  it('adds a period between sentences, unless one is already there', () => {
    expect(joinSentences([])).toBe('');
    expect(joinSentences(['Nouveau tour'])).toBe('Nouveau tour');
    expect(joinSentences(['Nouveau tour', '0 vote sur 4'])).toBe('Nouveau tour. 0 vote sur 4');
    expect(joinSentences(['Votes révélés. Consensus !', 'Sofia a rejoint la session'])).toBe(
      'Votes révélés. Consensus ! Sofia a rejoint la session',
    );
  });
});

describe('CounterAnnouncer', () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }));
  afterEach(() => vi.useRealTimers());

  function announcer() {
    const deferred: { text: string; at: number }[] = [];
    const timers = {
      now: () => Date.now(),
      setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms),
      clearTimeout: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    const counter = new CounterAnnouncer((text) => deferred.push({ text, at: Date.now() }), timers);
    return { counter, deferred };
  }

  it('close votes: the first at once, then only the value at the end of the 5 s window', () => {
    const { counter, deferred } = announcer();
    expect(counter.update('1 vote sur 4')).toBe('1 vote sur 4');
    vi.advanceTimersByTime(1_000);
    expect(counter.update('2 votes sur 4')).toBeNull();
    vi.advanceTimersByTime(1_000);
    expect(counter.update('3 votes sur 4')).toBeNull();
    vi.advanceTimersByTime(COUNTER_WINDOW_MS - 2_001);
    expect(deferred).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(deferred).toEqual([{ text: '3 votes sur 4', at: 5_000 }]);
    vi.advanceTimersByTime(60_000);
    expect(deferred).toHaveLength(1);
  });

  it('the deferred announcement opens a new window', () => {
    const { counter, deferred } = announcer();
    counter.update('1 vote sur 4');
    vi.advanceTimersByTime(1_000);
    counter.update('2 votes sur 4');
    vi.advanceTimersByTime(4_000);
    expect(deferred.map((d) => d.text)).toEqual(['2 votes sur 4']);
    vi.advanceTimersByTime(1_000);
    expect(counter.update('3 votes sur 4')).toBeNull();
    vi.advanceTimersByTime(4_000);
    expect(deferred).toEqual([
      { text: '2 votes sur 4', at: 5_000 },
      { text: '3 votes sur 4', at: 10_000 },
    ]);
  });

  it('outside the window, announces at once', () => {
    const { counter, deferred } = announcer();
    counter.update('1 vote sur 4');
    vi.advanceTimersByTime(COUNTER_WINDOW_MS);
    expect(counter.update('2 votes sur 4')).toBe('2 votes sur 4');
    expect(deferred).toEqual([]);
  });

  it('reset (reveal, new round) forgets the window: the first count of the next round is announced at once', () => {
    const { counter, deferred } = announcer();
    expect(counter.update('1 vote sur 4')).toBe('1 vote sur 4');
    vi.advanceTimersByTime(1_000);
    counter.update('2 votes sur 4');
    counter.reset();
    vi.advanceTimersByTime(1_000);
    expect(counter.update('1 vote sur 4')).toBe('1 vote sur 4');
    vi.advanceTimersByTime(60_000);
    expect(deferred).toEqual([]);
  });

  it('cancel drops the deferred announcement (destruction)', () => {
    const { counter, deferred } = announcer();
    counter.update('1 vote sur 4');
    vi.advanceTimersByTime(1_000);
    counter.update('2 votes sur 4');
    counter.cancel();
    vi.advanceTimersByTime(60_000);
    expect(deferred).toEqual([]);
  });

  it('no deferred announcement when the value came back to the one already announced', () => {
    const { counter, deferred } = announcer();
    counter.update('1 vote sur 4');
    vi.advanceTimersByTime(1_000);
    counter.update('2 votes sur 4');
    counter.update('1 vote sur 4');
    vi.advanceTimersByTime(60_000);
    expect(deferred).toEqual([]);
  });
});
