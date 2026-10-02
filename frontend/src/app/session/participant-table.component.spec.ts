import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import alone from '../../../../contract/examples/session-state/alone-after-create.json';
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
});
