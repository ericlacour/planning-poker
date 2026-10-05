import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import revealedObserver from '../../../../contract/examples/session-state/revealed-seen-by-observer.json';
import revealedTie from '../../../../contract/examples/session-state/revealed-tie.json';
import { Card, SessionState } from '../api/contract';
import { HandComponent } from './hand.component';
import { ConnectionStatus, SessionService } from './session.service';

const ALICE = '3f6c2a1e-8b4d-4c7a-9e2f-1d5b6a7c8e90';
const EMMA = '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e';

/** Instantané vu par Alice (votante), avec son vote. */
const withMyVote = (vote: Card | null): SessionState => {
  const state = hiddenRound as SessionState;
  return {
    ...state,
    participants: state.participants.map((p) => (p.participantId === ALICE ? { ...p, vote, hasVoted: vote !== null } : p)),
  };
};

describe('HandComponent', () => {
  function render(state: SessionState | null) {
    const session = { vote: vi.fn(), changeRole: vi.fn(), connection: signal<ConnectionStatus>('open') };
    TestBed.configureTestingModule({ providers: [{ provide: SessionService, useValue: session }] });
    const fixture = TestBed.createComponent(HandComponent);
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    document.body.appendChild(element);
    const cards = () => [...element.querySelectorAll<HTMLButtonElement>('.poker-card')];
    const show = (next: SessionState) => {
      fixture.componentRef.setInput('state', next);
      fixture.detectChanges();
    };
    const setConnection = (status: ConnectionStatus) => {
      session.connection.set(status);
      fixture.detectChanges();
    };
    return { element, session, cards, show, fixture, setConnection };
  }

  it('shows nothing before the first snapshot', () => {
    expect(render(null).element.textContent?.trim()).toBe('');
  });

  it('a voter without a vote: a toolbar « Ta carte » of 10 toggle cards, « Choisis ta carte », none pressed', () => {
    const { element, cards } = render(withMyVote(null));
    const toolbar = element.querySelector('[role="toolbar"]');
    expect(toolbar?.getAttribute('aria-label')).toBe('Ta carte');
    expect(cards()).toHaveLength(10);
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual([
      'Carte 0', 'Carte 1', 'Carte 2', 'Carte 3', 'Carte 5', 'Carte 8', 'Carte 13', 'Carte 21',
      'Carte je ne sais pas', 'Carte pause café',
    ]);
    expect(cards().map((c) => c.querySelector('.card-value')?.textContent)).toEqual([
      '0', '1', '2', '3', '5', '8', '13', '21', '?', '☕︎',
    ]);
    expect(cards().every((c) => c.querySelectorAll('.card-index').length === 2)).toBe(true);
    expect(element.querySelector('[aria-pressed="true"]')).toBeNull();
    expect(cards().every((c) => c.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(element.querySelector('.hand-hint')?.textContent).toBe('Choisis ta carte');
    // Un seul arrêt de tabulation.
    expect(cards().map((c) => c.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1, -1, -1, -1]);
  });

  it('a click sends the card, without optimistic update; the snapshot then presses it', () => {
    const { element, session, cards, show } = render(withMyVote(null));
    cards()[5].click();
    expect(session.vote).toHaveBeenCalledWith('8');
    expect(element.querySelector('[aria-pressed="true"]')).toBeNull();

    show(withMyVote('8'));
    expect(cards()[5].getAttribute('aria-pressed')).toBe('true');
    expect(cards()[5].classList).toContain('poker-card-selected');
    expect(element.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    expect(element.querySelector('.hand-hint')).toBeNull();
    expect(cards()[5].tabIndex).toBe(0);
  });

  it('clicking the chosen card withdraws the vote; another card replaces it', () => {
    const { session, cards } = render(withMyVote('8'));
    cards()[5].click();
    expect(session.vote).toHaveBeenLastCalledWith(null);
    cards()[4].click();
    expect(session.vote).toHaveBeenLastCalledWith('5');
  });

  it('keyboard: right arrow moves the focus to the next card, Enter or Space chooses it', () => {
    const { session, cards } = render(withMyVote(null));
    cards()[0].focus();
    cards()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(cards()[1]);
    cards()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(session.vote).toHaveBeenCalledWith('1');
    cards()[1].dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(session.vote).toHaveBeenCalledTimes(2);
  });

  it('keyboard: a held Enter or Space (auto-repeat) sends nothing more', () => {
    const { session, cards } = render(withMyVote(null));
    cards()[2].focus();
    cards()[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const repeated = [
      new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }),
      new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true, cancelable: true }),
    ];
    repeated.forEach((event) => cards()[2].dispatchEvent(event));
    expect(session.vote).toHaveBeenCalledTimes(1);
    expect(repeated.every((event) => event.defaultPrevented)).toBe(true);
  });

  it('keyboard: arrows stop at both ends and left arrow goes back', () => {
    const { cards, fixture } = render(withMyVote(null));
    cards()[0].focus();
    cards()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(cards()[0]);
    cards()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(cards()[9]);
    cards()[9].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(cards()[9]);
    cards()[9].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(cards()[8]);
    fixture.detectChanges();
    expect(cards().filter((c) => c.tabIndex === 0)).toEqual([cards()[8]]);
  });

  it('an observer has no hand but « Tu observes » and « Je veux voter »', () => {
    const { element } = render({ ...(hiddenRound as SessionState), selfParticipantId: EMMA });
    expect(element.querySelector('[role="toolbar"]')).toBeNull();
    expect(element.querySelectorAll('.poker-card')).toHaveLength(0);
    expect(element.querySelector('.hand-hint')?.textContent).toBe('Tu observes');
    expect(element.querySelector('button.link-button')?.textContent?.trim()).toBe('Je veux voter');
  });

  it('« Je veux voter » sends changeRole VOTER, and nothing while the connection is lost (FR5)', () => {
    const { element, session, setConnection } = render({ ...(hiddenRound as SessionState), selfParticipantId: EMMA });
    const link = () => element.querySelector<HTMLButtonElement>('button.link-button')!;
    link().click();
    expect(session.changeRole).toHaveBeenCalledExactlyOnceWith('VOTER');

    setConnection('lost');
    expect(link().getAttribute('aria-disabled')).toBe('true');
    link().click();
    expect(session.changeRole).toHaveBeenCalledTimes(1);
  });

  it('revealed round: the hand is greyed (aria-disabled), keeps my card pressed, and clicks do nothing', () => {
    const { element, session, cards } = render(revealedTie as SessionState);
    const toolbar = element.querySelector('[role="toolbar"]');
    expect(toolbar?.getAttribute('aria-disabled')).toBe('true');
    expect(cards().every((c) => c.getAttribute('aria-disabled') === 'true')).toBe(true);
    expect(cards().every((c) => !c.disabled)).toBe(true);
    expect(cards()[4].getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('.hand-hint')).toBeNull();
    cards()[5].click();
    cards()[4].click();
    cards()[4].focus();
    cards()[4].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(session.vote).not.toHaveBeenCalled();
  });

  it('the focus stays on its card when the round is revealed', () => {
    const { cards, show } = render(withMyVote('5'));
    cards()[4].focus();
    show(revealedTie as SessionState);
    expect(document.activeElement).toBe(cards()[4]);
  });

  it('a voter who arrived during the reveal has a greyed hand until the next round', () => {
    const state = revealedObserver as SessionState;
    const FARID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
    const { element, session, cards, show } = render({ ...state, selfParticipantId: FARID });
    expect(element.querySelector('[role="toolbar"]')?.getAttribute('aria-disabled')).toBe('true');
    cards()[5].click();
    expect(session.vote).not.toHaveBeenCalled();
    // Même un tour caché ne rouvre pas la main tant que canVoteThisRound est faux.
    show({ ...state, selfParticipantId: FARID, round: { ...state.round, status: 'HIDDEN' }, summary: null });
    cards()[5].click();
    expect(session.vote).not.toHaveBeenCalled();
  });

  it('a hidden round: neither aria-disabled on the toolbar nor on the cards', () => {
    const { element, cards } = render(withMyVote(null));
    expect(element.querySelector('[role="toolbar"]')?.hasAttribute('aria-disabled')).toBe(false);
    expect(cards().some((c) => c.hasAttribute('aria-disabled'))).toBe(false);
  });

  it('a lost connection greys the hand at once (aria-disabled), clicks send nothing, until it is back', () => {
    const { element, session, cards, setConnection } = render(withMyVote(null));
    setConnection('lost');
    expect(element.querySelector('.hand')?.classList).toContain('hand-locked');
    expect(element.querySelector('.hand-cards')?.getAttribute('aria-disabled')).toBe('true');
    expect(element.querySelector('.hand-hint')).toBeNull();
    cards()[3].click();
    expect(session.vote).not.toHaveBeenCalled();

    setConnection('open');
    expect(element.querySelector('.hand-cards')?.getAttribute('aria-disabled')).toBeNull();
    cards()[3].click();
    expect(session.vote).toHaveBeenCalledTimes(1);
  });
});
