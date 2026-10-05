import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import revealedTie from '../../../../contract/examples/session-state/revealed-tie.json';
import { ChangeAction, SessionState } from '../api/contract';
import { ActionBarComponent, blocksActions, CROSS_CLICK_GUARD_MS } from './action-bar.component';
import { ConnectionStatus, SessionService } from './session.service';

const ALICE = '3f6c2a1e-8b4d-4c7a-9e2f-1d5b6a7c8e90';
const BOB = '7d2e9f4a-1c3b-4e5d-8a6f-2b9c0d1e3f45';

/** Instantané vu par Alice, avec un dernier changement donné. */
const withChange = (example: unknown, action: ChangeAction, by: string | null, version = 20): SessionState => ({
  ...(example as SessionState),
  version,
  lastChange: { action, byParticipantId: by },
});

describe('ActionBarComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function render(state: SessionState) {
    const session = { reveal: vi.fn(), hide: vi.fn(), clear: vi.fn(), connection: signal<ConnectionStatus>('open') };
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: session },
        { provide: LOCALE_ID, useValue: 'fr' },
      ],
    });
    const fixture = TestBed.createComponent(ActionBarComponent);
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const buttons = () => [...element.querySelectorAll<HTMLButtonElement>('.action-buttons button')];
    const labels = () => buttons().map((b) => b.textContent?.trim());
    const show = (next: SessionState) => {
      fixture.componentRef.setInput('state', next);
      fixture.detectChanges();
    };
    const tick = (ms: number) => {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
    };
    const setConnection = (status: ConnectionStatus) => {
      session.connection.set(status);
      fixture.detectChanges();
    };
    return { element, session, buttons, labels, show, tick, setConnection };
  }

  it('hidden round: counter, « Effacer les votes » (secondary) and « Révéler les votes » (primary)', () => {
    const { element, buttons, labels } = render(hiddenRound as SessionState);
    expect(element.querySelector('.vote-counter')?.textContent).toBe('3 votes sur 4');
    expect(labels()).toEqual(['Effacer les votes', 'Révéler les votes']);
    expect(buttons()[0].classList).toContain('btn-secondary');
    expect(buttons()[1].classList).toContain('btn-primary');
    expect(buttons().every((b) => !b.disabled)).toBe(true);
    expect(element.querySelector('.result-panel')).toBeNull();
    expect(element.querySelector('.result-line')).toBeNull();
  });

  it('« Révéler les votes » sends reveal, « Effacer les votes » sends clear, without confirmation', () => {
    const { session, buttons } = render(hiddenRound as SessionState);
    buttons()[1].click();
    expect(session.reveal).toHaveBeenCalledTimes(1);
    buttons()[0].click();
    expect(session.clear).toHaveBeenCalledTimes(1);
  });

  it('revealed round: the result instead of the counter, « Masquer » (secondary) and « Nouveau tour » (primary)', () => {
    const { element, session, buttons, labels } = render(withChange(revealedTie, 'REVEAL', ALICE));
    expect(element.querySelector('.vote-counter')).toBeNull();
    expect(element.querySelector('.result-average .result-value')?.textContent).toBe('6,5');
    // Résultat condensé du téléphone, juste avant la barre (la feuille de style montre l'un ou l'autre).
    expect(element.querySelector('app-result-line .result-line-value')?.textContent).toBe('6,5');
    expect(element.querySelector('app-result-line')?.nextElementSibling?.classList).toContain('action-bar');
    expect(labels()).toEqual(['Masquer', 'Nouveau tour']);
    expect(buttons()[0].classList).toContain('btn-secondary');
    expect(buttons()[0].disabled).toBe(false);
    expect(buttons()[1].classList).toContain('btn-primary');
    expect(buttons()[1].disabled).toBe(false);
    buttons()[1].click();
    expect(session.clear).toHaveBeenCalledTimes(1);
    expect(session.reveal).not.toHaveBeenCalled();
    expect(session.hide).not.toHaveBeenCalled();
  });

  it('« Masquer » sends hide, without confirmation', () => {
    const { session, buttons } = render(withChange(revealedTie, 'REVEAL', ALICE));
    buttons()[0].click();
    expect(session.hide).toHaveBeenCalledTimes(1);
    expect(session.clear).not.toHaveBeenCalled();
  });

  it('« Masquer » stays inactive for 1 s after a REVEAL by someone else', () => {
    const { session, buttons, show, tick } = render(withChange(hiddenRound, 'VOTE', BOB, 7));
    show(withChange(revealedTie, 'REVEAL', BOB, 8));
    const hide = () => buttons().find((b) => b.textContent?.trim() === 'Masquer')!;
    expect(hide().disabled).toBe(true);
    hide().click();
    expect(session.hide).not.toHaveBeenCalled();
    tick(CROSS_CLICK_GUARD_MS);
    expect(hide().disabled).toBe(false);
    hide().click();
    expect(session.hide).toHaveBeenCalledTimes(1);
  });

  it('a HIDE by someone else brings back the hidden round, with every button inactive for 1 s', () => {
    const { element, buttons, labels, show, tick } = render(withChange(revealedTie, 'REVEAL', ALICE, 8));
    show(withChange(hiddenRound, 'HIDE', BOB, 9));
    expect(labels()).toEqual(['Effacer les votes', 'Révéler les votes']);
    expect(element.querySelector('.vote-counter')?.textContent).toBe('3 votes sur 4');
    expect(element.querySelector('.result-panel')).toBeNull();
    expect(element.querySelector('app-result-line')).toBeNull();
    expect(buttons().every((b) => b.disabled)).toBe(true);
    tick(CROSS_CLICK_GUARD_MS);
    expect(buttons().every((b) => !b.disabled)).toBe(true);
  });

  it.each<ChangeAction>(['REVEAL', 'CLEAR', 'HIDE'])('a %s made by someone else disables the buttons for 1 s', (action) => {
    const { buttons, show, tick, session } = render(withChange(hiddenRound, 'VOTE', BOB, 7));
    const next = action === 'REVEAL' ? withChange(revealedTie, action, BOB) : withChange(hiddenRound, action, BOB);
    show(next);
    expect(buttons().every((b) => b.disabled)).toBe(true);
    buttons().forEach((b) => b.click());
    expect(session.clear).not.toHaveBeenCalled();
    expect(session.reveal).not.toHaveBeenCalled();
    expect(session.hide).not.toHaveBeenCalled();
    tick(CROSS_CLICK_GUARD_MS - 1);
    expect(buttons().some((b) => !b.disabled)).toBe(false);
    tick(1);
    expect(buttons().every((b) => !b.disabled)).toBe(true);
  });

  it('a CLEAR by the server (sweeper) blocks too', () => {
    const { buttons, show } = render(withChange(hiddenRound, 'VOTE', BOB, 7));
    show(withChange(hiddenRound, 'CLEAR', null));
    expect(buttons().every((b) => b.disabled)).toBe(true);
  });

  it('no block for my own REVEAL, nor for a VOTE or a JOIN by someone else', () => {
    const { buttons, show } = render(withChange(hiddenRound, 'VOTE', BOB, 7));
    expect(buttons().every((b) => !b.disabled)).toBe(true);
    show(withChange(hiddenRound, 'JOIN', BOB, 8));
    expect(buttons().every((b) => !b.disabled)).toBe(true);
    show(withChange(revealedTie, 'REVEAL', ALICE, 9));
    expect(buttons().find((b) => b.textContent?.trim() === 'Nouveau tour')?.disabled).toBe(false);
  });

  it('no block on the first snapshot, nor when the same version comes back (reconnection)', () => {
    const { buttons, show } = render(withChange(revealedTie, 'REVEAL', BOB, 9));
    const newRound = () => buttons().find((b) => b.textContent?.trim() === 'Nouveau tour');
    expect(newRound()?.disabled).toBe(false);
    show(withChange(revealedTie, 'REVEAL', BOB, 9));
    expect(newRound()?.disabled).toBe(false);
  });

  it('a second block restarts the second', () => {
    const { buttons, show, tick } = render(withChange(hiddenRound, 'VOTE', BOB, 7));
    show(withChange(revealedTie, 'REVEAL', BOB, 8));
    tick(600);
    show(withChange(hiddenRound, 'CLEAR', BOB, 9));
    tick(600);
    expect(buttons().every((b) => b.disabled)).toBe(true);
    tick(400);
    expect(buttons().every((b) => !b.disabled)).toBe(true);
  });

  it('blocksActions', () => {
    expect(blocksActions(withChange(hiddenRound, 'REVEAL', BOB))).toBe(true);
    expect(blocksActions(withChange(hiddenRound, 'HIDE', BOB))).toBe(true);
    expect(blocksActions(withChange(hiddenRound, 'CLEAR', null))).toBe(true);
    expect(blocksActions(withChange(hiddenRound, 'REVEAL', ALICE))).toBe(false);
    expect(blocksActions(withChange(hiddenRound, 'VOTE', BOB))).toBe(false);
    expect(blocksActions(withChange(hiddenRound, 'ROLE', BOB))).toBe(false);
  });

  it('a lost connection disables every button at once, until it is back', () => {
    const { session, buttons, setConnection } = render(hiddenRound as SessionState);
    setConnection('lost');
    expect(buttons().every((b) => b.disabled)).toBe(true);
    buttons()[1].click();
    expect(session.reveal).not.toHaveBeenCalled();
    setConnection('open');
    expect(buttons().every((b) => !b.disabled)).toBe(true);
  });

  it('a lost connection disables « Masquer » too', () => {
    const { session, buttons, setConnection } = render(withChange(revealedTie, 'REVEAL', ALICE));
    setConnection('lost');
    expect(buttons().every((b) => b.disabled)).toBe(true);
    buttons()[0].click();
    expect(session.hide).not.toHaveBeenCalled();
    setConnection('open');
    expect(buttons()[0].disabled).toBe(false);
  });
});
