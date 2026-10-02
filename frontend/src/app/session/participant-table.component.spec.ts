import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import alone from '../../../../contract/examples/session-state/alone-after-create.json';
import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import revealedObserver from '../../../../contract/examples/session-state/revealed-seen-by-observer.json';
import revealedTie from '../../../../contract/examples/session-state/revealed-tie.json';
import { ParticipantState, SessionState } from '../api/contract';
import { ParticipantTableComponent, PENDING_SEATS, seatsOf } from './participant-table.component';

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

  it('shows a green presence dot when connected and a grey one otherwise, without a « déconnecté » label', () => {
    const element = render(table(ALICE));
    const dots = [...element.querySelectorAll('.presence-dot')];
    expect(dots.map((d) => d.classList.contains('presence-online'))).toEqual([true, false, true, true, true]);
    expect(dots[1].classList).toContain('presence-offline');
    expect(element.textContent).not.toContain('déconnecté');
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
    expect(element.querySelectorAll('.seat-note')).toHaveLength(1);
    expect(element.querySelectorAll('.seat-card-face')).toHaveLength(1);
  });

  it('seen by someone else, my vote is only a back', () => {
    const element = render({ ...(hiddenRound as SessionState), selfParticipantId: BOB });
    const seats = [...element.querySelectorAll<HTMLElement>('.seat')];
    // Ma place (Bob) en tête ; le vote d'Alice (8 dans l'exemple) n'est pour moi qu'un dos.
    expect(seats.map((s) => s.querySelector('.seat-pseudo')?.textContent)).toEqual(['Bob', 'Alice', 'Chloé', 'David', 'Emma']);
    expect(element.querySelector('.seat-note')).toBeNull();
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
});
