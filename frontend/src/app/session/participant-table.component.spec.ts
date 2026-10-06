import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import alone from '../../../../contract/examples/session-state/alone-after-create.json';
import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import revealedObserver from '../../../../contract/examples/session-state/revealed-seen-by-observer.json';
import revealedTie from '../../../../contract/examples/session-state/revealed-tie.json';
import { ParticipantState, SessionState } from '../api/contract';
import { cardName } from './cards';
import { flipDelays, ParticipantTableComponent, PENDING_SEATS, seatsOf } from './participant-table.component';

const ALICE = '3f6c2a1e-8b4d-4c7a-9e2f-1d5b6a7c8e90';
const BOB = '7d2e9f4a-1c3b-4e5d-8a6f-2b9c0d1e3f45';
const CHLOE = '0c8b5d3e-6f2a-4b1c-9d7e-5a4f3b2c1d06';
const EMMA = '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e';
const FARID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const participant = (id: string, pseudo: string, role: 'VOTER' | 'OBSERVER', joinOrder: number, connected = true) =>
  ({
    participantId: id,
    pseudo,
    role,
    connected,
    joinOrder,
    hasVoted: false,
    vote: null,
    canVoteThisRound: role === 'VOTER',
  }) satisfies ParticipantState;

const stateFor = (self: string, participants: ParticipantState[]): SessionState =>
  ({
    ...(alone as SessionState),
    selfParticipantId: self,
    participants,
    progress: { voted: 0, expected: participants.filter((p) => p.role === 'VOTER').length },
  }) satisfies SessionState;

/** Ordre du serveur : votants Alice(1), Bob(2), Chloé(4) ; observateurs Emma(3), Farid(5). */
const table = (self: string) =>
  stateFor(self, [
    participant(ALICE, 'Alice', 'VOTER', 1),
    participant(BOB, 'Bob', 'VOTER', 2, false),
    participant(CHLOE, 'Chloé', 'VOTER', 4),
    participant(EMMA, 'Emma', 'OBSERVER', 3),
    participant(FARID, 'Farid', 'OBSERVER', 5),
  ]);

describe('seatsOf', () => {
  const pseudos = (self: string) => seatsOf(table(self)).map((s) => s.participant.pseudo);

  it('keeps the server order and moves my seat to the head of its group', () => {
    expect(pseudos(CHLOE)).toEqual(['Chloé', 'Alice', 'Bob', 'Emma', 'Farid']);
    expect(pseudos(FARID)).toEqual(['Alice', 'Bob', 'Chloé', 'Farid', 'Emma']);
    expect(pseudos(ALICE)).toEqual(['Alice', 'Bob', 'Chloé', 'Emma', 'Farid']);
    expect(seatsOf(table(FARID)).filter((s) => s.isSelf).map((s) => s.participant.pseudo)).toEqual(['Farid']);
  });
});

describe('flipDelays', () => {
  const revealed = (self: string, votes: Record<string, string | null>): SessionState => ({
    ...table(self),
    round: { roundId: 'Jd8sK2pQ', status: 'REVEALED' },
    participants: table(self).participants.map((p) => {
      const vote = (votes[p.participantId] ?? null) as ParticipantState['vote'];
      return { ...p, vote, hasVoted: vote !== null };
    }),
  });

  it('spreads the starts of the others\' faces from 0 to 200 ms in table order, without my card nor empty seats', () => {
    // Alice (moi) 5, Bob et Chloé ont voté.
    const delays = flipDelays(seatsOf(revealed(ALICE, { [ALICE]: '5', [BOB]: '8', [CHLOE]: '3' })));
    expect([...delays]).toEqual([
      [BOB, 0],
      [CHLOE, 200],
    ]);
  });

  it('a single other card starts at 0 ms', () => {
    expect([...flipDelays(seatsOf(revealed(ALICE, { [BOB]: '8' })))]).toEqual([[BOB, 0]]);
  });

  it('spreads evenly whatever the number of cards, the last one starting at 200 ms', () => {
    const delays = flipDelays(seatsOf(revealed(FARID, { [ALICE]: '1', [BOB]: '2', [CHLOE]: '3', [FARID]: '5' })));
    expect([...delays]).toEqual([
      [ALICE, 0],
      [BOB, 100],
      [CHLOE, 200],
    ]);
  });

  it('nothing to flip in a hidden round (backs and my own face)', () => {
    expect(flipDelays(seatsOf(hiddenRound as SessionState)).size).toBe(0);
  });
});

describe('ParticipantTableComponent', () => {
  function render(state: SessionState | null) {
    const fixture = TestBed.createComponent(ParticipantTableComponent);
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows empty pending seats without pseudo before the first snapshot', () => {
    const element = render(null);
    const seats = element.querySelectorAll('.seat');
    expect(seats).toHaveLength(PENDING_SEATS);
    expect(element.querySelector('.seats')?.getAttribute('aria-busy')).toBe('true');
    expect(element.textContent?.trim()).toBe('');
  });

  it('shows voters first, my seat at the head of the observers with « (toi) » and « observe »', () => {
    // 3 participants, moi observateur.
    const element = render(
      stateFor(EMMA, [
        participant(ALICE, 'Alice', 'VOTER', 1),
        participant(BOB, 'Bob', 'OBSERVER', 2),
        participant(EMMA, 'Emma', 'OBSERVER', 3),
      ]),
    );
    const seats = [...element.querySelectorAll<HTMLElement>('.seat')];
    expect(seats.map((s) => s.querySelector('.seat-pseudo')?.textContent)).toEqual(['Alice', 'Emma', 'Bob']);
    expect(seats[1].querySelector('.seat-me')?.textContent).toBe('(toi)');
    expect(element.querySelectorAll('.seat-me')).toHaveLength(1);
    expect(seats[0].querySelector('.seat-card-empty')).not.toBeNull();
    expect(seats[1].querySelector('.seat-card-observer')?.textContent).toBe('observe');
    expect(seats[2].querySelector('.seat-card-observer')?.textContent).toBe('observe');
    expect(seats[1].querySelector('.seat-card-empty')).toBeNull();
  });

  it('shows a disconnected participant with a grey dot, a muted pseudo and « déconnecté », its card unchanged', () => {
    const element = render(table(ALICE));
    const seats = [...element.querySelectorAll<HTMLElement>('.seat')];
    const dots = [...element.querySelectorAll('.presence-dot')];
    expect(dots.map((d) => d.classList.contains('presence-online'))).toEqual([true, false, true, true, true]);
    expect(dots[1].classList).toContain('presence-offline');
    expect(seats[1].classList).toContain('offline');
    expect(seats[1].querySelector('.seat-pseudo')?.textContent).toBe('Bob');
    expect(seats[1].querySelector('.seat-note')?.textContent).toBe('déconnecté');
    expect(seats[1].querySelector('.seat-card-empty')).not.toBeNull();
    expect(element.querySelectorAll('.seat.offline')).toHaveLength(1);
    expect(element.querySelectorAll('.seat-note')).toHaveLength(1);
  });

  it('a disconnected participant keeps its back during a hidden round and an observer is also « déconnecté »', () => {
    const state = hiddenRound as SessionState;
    const element = render({
      ...state,
      participants: state.participants.map((p) => (p.participantId === BOB || p.participantId === EMMA ? { ...p, connected: false } : p)),
    });
    const seats = [...element.querySelectorAll<HTMLElement>('.seat')];
    const bob = seats.find((s) => s.querySelector('.seat-pseudo')?.textContent === 'Bob');
    const emma = seats.find((s) => s.querySelector('.seat-pseudo')?.textContent === 'Emma');
    expect(bob?.querySelector('.seat-card-back')).not.toBeNull();
    expect(bob?.querySelector('.seat-note')?.textContent).toBe('déconnecté');
    expect(emma?.querySelector('.seat-card-observer')?.textContent).toBe('observe');
    expect(emma?.querySelector('.seat-note')?.textContent).toBe('déconnecté');
  });

  it('revealed round: a disconnected voter without vote shows the empty card and « déconnecté »', () => {
    const state = revealedTie as SessionState;
    const element = render({
      ...state,
      participants: state.participants.map((p) =>
        p.participantId === FARID ? { ...p, hasVoted: false, vote: null, connected: false } : p,
      ),
    });
    const farid = [...element.querySelectorAll<HTMLElement>('.seat')].find(
      (s) => s.querySelector('.seat-pseudo')?.textContent === 'Farid',
    );
    expect(farid?.querySelector('.seat-card-empty')).not.toBeNull();
    expect(farid?.querySelector('.seat-note')?.textContent).toBe('déconnecté');
    expect(element.textContent).not.toContain("n'a pas voté");
  });

  it('during a hidden round: my face with « visible par toi seul », a back for the others who voted, else empty', () => {
    // Vu par Alice (8) : Bob et David ont voté, Chloé non ; Emma observe.
    const element = render(hiddenRound as SessionState);
    const seats = [...element.querySelectorAll<HTMLElement>('.seat')];
    const mine = seats[0].querySelector('.seat-card-face');
    expect(mine?.getAttribute('aria-label')).toBe('Carte 8');
    expect(mine?.querySelector('.card-value')?.textContent).toBe('8');
    expect([...(mine?.querySelectorAll('.card-index') ?? [])].map((c) => c.textContent)).toEqual(['8', '8']);
    expect(seats[0].querySelector('.seat-note')?.textContent).toBe('visible par toi seul');
    expect(seats[1].querySelector('.seat-card-back.card-back')).not.toBeNull();
    expect(seats[2].querySelector('.seat-card-empty')).not.toBeNull();
    expect(seats[3].querySelector('.seat-card-back')).not.toBeNull();
    // David, déconnecté dans l'exemple, garde son dos et porte « déconnecté ».
    expect([...element.querySelectorAll('.seat-note')].map((n) => n.textContent)).toEqual([
      'visible par toi seul',
      'déconnecté',
    ]);
    expect(element.querySelectorAll('.seat-card-face')).toHaveLength(1);
  });

  it('seen by someone else, my vote is only a back', () => {
    const element = render({ ...(hiddenRound as SessionState), selfParticipantId: BOB });
    const seats = [...element.querySelectorAll<HTMLElement>('.seat')];
    // Ma place (Bob) en tête ; le vote d'Alice (8 dans l'exemple) n'est pour moi qu'un dos.
    expect(seats.map((s) => s.querySelector('.seat-pseudo')?.textContent)).toEqual(['Bob', 'Alice', 'Chloé', 'David', 'Emma']);
    expect([...element.querySelectorAll('.seat-note')].map((n) => n.textContent)).toEqual(['déconnecté']);
    expect(seats[3].querySelector('.seat-note')?.textContent).toBe('déconnecté');
    expect(seats[1].querySelector('.seat-card-back')).not.toBeNull();
    expect(seats[1].querySelector('.seat-card-face')).toBeNull();
    expect(element.querySelectorAll('.seat-card-face')).toHaveLength(0);
  });

  it('shows ☕ as text for coffee', () => {
    const state = hiddenRound as SessionState;
    const element = render({
      ...state,
      participants: state.participants.map((p) => (p.participantId === ALICE ? { ...p, vote: 'coffee' as const } : p)),
    });
    const face = element.querySelector('.seat-card-face');
    expect(face?.querySelector('.card-value')?.textContent).toBe('☕\uFE0E');
    expect(face?.getAttribute('aria-label')).toBe('Carte pause café');
  });

  it("revealed round: every face with its pseudo, « n'a pas voté » on a seat without vote", () => {
    const state = revealedTie as SessionState;
    const element = render({
      ...state,
      participants: state.participants.map((p) => (p.participantId === FARID ? { ...p, hasVoted: false, vote: null } : p)),
    });
    const seats = [...element.querySelectorAll<HTMLElement>('.seat')];
    expect(seats.map((s) => s.querySelector('.seat-pseudo')?.textContent)).toEqual(['Alice', 'Bob', 'Chloé', 'David', 'Farid', 'Emma']);
    expect(seats.slice(0, 4).map((s) => s.querySelector('.seat-card-face')?.getAttribute('aria-label'))).toEqual([
      'Carte 5', 'Carte 8', 'Carte 5', 'Carte 8',
    ]);
    expect(element.querySelectorAll('.seat-card-back')).toHaveLength(0);
    expect(seats[4].querySelector('.seat-card-empty')).not.toBeNull();
    expect(seats[4].querySelector('.seat-note')?.textContent).toBe("n'a pas voté");
    expect(element.textContent).not.toContain('visible par toi seul');
    expect(element.querySelectorAll('.seat-note')).toHaveLength(1);
  });

  it('revealed round: a voter who arrived meanwhile carries « votera au prochain tour »', () => {
    // Vu par Emma (observatrice) : Farid est arrivé pendant la révélation.
    const element = render(revealedObserver as SessionState);
    const seats = [...element.querySelectorAll<HTMLElement>('.seat')];
    const farid = seats.find((s) => s.querySelector('.seat-pseudo')?.textContent === 'Farid');
    expect(farid?.querySelector('.seat-note')?.textContent).toBe('votera au prochain tour');
    expect(farid?.querySelector('.seat-card-empty')).not.toBeNull();
    expect(element.textContent).not.toContain("n'a pas voté");
    expect(element.querySelectorAll('.seat-card-face')).toHaveLength(4);
  });

  it('revealed round: an observer who kept their vote shows its face with « observe » underneath (FR5)', () => {
    const revealed = revealedObserver as SessionState;
    const state: SessionState = {
      ...revealed,
      participants: revealed.participants.map((p) =>
        p.participantId === EMMA ? { ...p, role: 'OBSERVER', hasVoted: true, vote: '5', canVoteThisRound: false } : p,
      ),
    };
    const element = render(state);
    const emma = [...element.querySelectorAll<HTMLElement>('.seat')].find(
      (s) => s.querySelector('.seat-pseudo')?.textContent === 'Emma',
    );
    expect(emma?.querySelector('.seat-card-face')?.getAttribute('aria-label')).toBe(cardName('5'));
    expect(emma?.querySelector('.seat-card-observer')).toBeNull();
    expect(emma?.querySelector('.seat-note')?.textContent).toBe('observe');
  });

  it('revealed round: a disconnected observer who kept their vote is « déconnecté · observe »', () => {
    const revealed = revealedObserver as SessionState;
    const state: SessionState = {
      ...revealed,
      participants: revealed.participants.map((p) =>
        p.participantId === EMMA
          ? { ...p, role: 'OBSERVER', connected: false, hasVoted: true, vote: '5', canVoteThisRound: false }
          : p,
      ),
    };
    const element = render(state);
    const emma = [...element.querySelectorAll<HTMLElement>('.seat')].find(
      (s) => s.querySelector('.seat-pseudo')?.textContent === 'Emma',
    );
    expect(emma?.querySelector('.seat-card-face')?.getAttribute('aria-label')).toBe(cardName('5'));
    expect(emma?.querySelector('.seat-note')?.textContent).toBe('déconnecté · observe');
  });

  it('marks the faces of the others « seat-card-flip » with their delay, never my card', () => {
    const element = render(revealedTie as SessionState);
    const seats = [...element.querySelectorAll<HTMLElement>('.seat')];
    const face = (i: number) => seats[i].querySelector<HTMLElement>('.seat-card-face');
    expect(face(0)?.classList).not.toContain('seat-card-flip');
    expect(face(0)?.style.getPropertyValue('--flip-delay')).toBe('');
    const flipping = seats.slice(1, 5).map((_, i) => face(i + 1));
    expect(flipping.every((f) => f?.classList.contains('seat-card-flip'))).toBe(true);
    expect(flipping.map((f) => f?.style.getPropertyValue('--flip-delay'))).toEqual(['0ms', '67ms', '133ms', '200ms']);
  });
});
