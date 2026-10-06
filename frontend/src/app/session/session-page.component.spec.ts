import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import alone from '../../../../contract/examples/session-state/alone-after-create.json';
import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import revealedTie from '../../../../contract/examples/session-state/revealed-tie.json';
import { SessionState } from '../api/contract';
import { TopBarState } from '../top-bar/top-bar-state';
import { REVEAL_FLIP_MS, SessionPageComponent, sessionLink } from './session-page.component';
import { ConnectionStatus, SessionService } from './session.service';

const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';

describe('SessionPageComponent', () => {
  function render() {
    const state = signal<SessionState | null>(null);
    const session = {
      state,
      connection: signal<ConnectionStatus>('open'),
      reconnecting: signal(false),
      connect: vi.fn(),
      disconnect: vi.fn(),
      vote: vi.fn(),
      reveal: vi.fn(),
      clear: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: session },
        { provide: LOCALE_ID, useValue: 'fr' },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ sessionId: SESSION_ID }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(SessionPageComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const show = (value: unknown) => {
      state.set(value as SessionState);
      fixture.detectChanges();
    };
    return { fixture, element, session, show };
  }

  it('builds the link as origin + /s/ + sessionId', () => {
    expect(sessionLink('https://pp.example', SESSION_ID)).toBe(`https://pp.example/s/${SESSION_ID}`);
  });

  it('connects to the session of the link, and disconnects when it goes away', () => {
    const { fixture, session } = render();
    expect(session.connect).toHaveBeenCalledWith(SESSION_ID);
    fixture.destroy();
    expect(session.disconnect).toHaveBeenCalled();
  });

  it('waits with empty seats and no invitation nor full-screen hourglass before the first snapshot', () => {
    const { element } = render();
    expect(element.querySelectorAll('.seat-pending').length).toBeGreaterThan(0);
    expect(element.querySelector('.invite')).toBeNull();
    expect(element.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('alone in the session: invitation, link in clear and « Copier le lien » as primary button', () => {
    const { element, show } = render();
    show(alone);
    const link = `${location.origin}/s/${SESSION_ID}`;
    expect(element.querySelectorAll('.seat')).toHaveLength(1);
    expect(element.querySelector('.seat-me')?.textContent).toBe('(toi)');
    expect(element.querySelector('.invite-text')?.textContent).toBe('Partage le lien pour inviter ton équipe');
    expect(element.querySelector('.invite-url')?.textContent).toBe(link);
    const button = element.querySelector('.invite button');
    expect(button?.textContent?.trim()).toBe('Copier le lien');
    expect(button?.classList).toContain('btn-primary');
  });

  it('with others: the table and the action bar with its counter and buttons, without invitation', () => {
    const { element, show } = render();
    show(hiddenRound);
    expect(element.querySelectorAll('.seat')).toHaveLength(5);
    expect(element.querySelector('.invite')).toBeNull();
    expect(element.querySelector('.action-bar .vote-counter')?.textContent).toBe('3 votes sur 4');
    expect(element.querySelector('.action-bar .btn-primary')?.textContent?.trim()).toBe('Révéler les votes');
  });

  it('marks the page « session-revealed » while the round is revealed (phone drawer folds away)', () => {
    const { element, show } = render();
    show(hiddenRound);
    expect(element.classList).not.toContain('session-revealed');
    show(revealedTie);
    expect(element.classList).toContain('session-revealed');
    show({ ...hiddenRound, version: 20 });
    expect(element.classList).not.toContain('session-revealed');
  });

  it('wraps the table in its own scrolling zone, before the action bar and the hand', () => {
    const { element, show } = render();
    show(hiddenRound);
    const main = element.querySelector('main.session-page');
    // Sous la région du bandeau « Reconnexion… » (vide hors reconnexion), la zone de la table.
    expect(main?.firstElementChild?.classList).toContain('status-region');
    expect(main?.children[1]?.classList).toContain('session-scroll');
    expect(element.querySelector('.session-scroll > .session-table')).not.toBeNull();
    expect(element.lastElementChild?.classList).toContain('hand-dock');
  });

  it('announces a reveal then a new round in a polite live region, whoever made them', () => {
    const { element, show } = render();
    const live = () => element.querySelector('[aria-live="polite"]');
    const hidden = { ...revealedTie, round: { ...revealedTie.round, status: 'HIDDEN' }, summary: null, version: 8 };
    show(hidden);
    expect(live()).not.toBeNull();
    expect(live()?.textContent?.trim()).toBe('');
    show(revealedTie);
    expect(live()?.textContent?.trim()).toBe(
      'Votes révélés. Moyenne 6,5. Plus votée 5 et 8, 2 votes chacune. Min 5, max 8.',
    );
    const newRound = {
      ...hidden,
      version: 10,
      round: { roundId: 'Vn4pX9tA', status: 'HIDDEN' },
      lastChange: { action: 'CLEAR', byParticipantId: hiddenRound.selfParticipantId },
    };
    show(newRound);
    expect(live()?.textContent?.trim()).toBe('Nouveau tour');
    const firstNode = live()?.firstElementChild;
    // Un second « Nouveau tour » est rendu dans un nouvel élément, pour être annoncé de nouveau.
    show({ ...newRound, version: 11, round: { roundId: 'Zz9pX9tA', status: 'HIDDEN' } });
    expect(live()?.textContent?.trim()).toBe('Nouveau tour');
    expect(live()?.firstElementChild).not.toBe(firstNode);
  });

  it('announces nothing for the first snapshot nor for a vote', () => {
    const { element, show } = render();
    show(revealedTie);
    show({ ...revealedTie, version: 10, lastChange: { action: 'PRESENCE', byParticipantId: null } });
    expect(element.querySelector('[aria-live="polite"]')?.textContent?.trim()).toBe('');
  });

  it('alone in the session: no action bar, but my hand', () => {
    const { element, show } = render();
    show(alone);
    expect(element.querySelector('.action-bar')).toBeNull();
    expect(element.querySelector('[role="toolbar"][aria-label="Ta carte"]')).not.toBeNull();
  });

  it('only observers besides voters-less me: the action bar says « Aucun votant »', () => {
    const { element, show } = render();
    const observer = { ...hiddenRound.participants[4] };
    show({
      ...hiddenRound,
      selfParticipantId: observer.participantId,
      participants: [observer, { ...observer, participantId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', pseudo: 'Farid', joinOrder: 6 }],
      progress: { voted: 0, expected: 0 },
    });
    expect(element.querySelector('.vote-counter')?.textContent).toBe('Aucun votant');
    expect(element.textContent).toContain('Tu observes');
  });

  it('before the first snapshot: neither action bar nor hand', () => {
    const { element } = render();
    expect(element.querySelector('.action-bar')).toBeNull();
    expect(element.querySelector('.hand')).toBeNull();
  });

  it('puts « Copier le lien » and its connection (participant menu) in the top bar while it is displayed', () => {
    const { fixture, session } = render();
    const topBar = TestBed.inject(TopBarState);
    expect(topBar.shareUrl()).toBe(`${location.origin}/s/${SESSION_ID}`);
    expect(topBar.session()).toBe(session);
    fixture.destroy();
    expect(topBar.shareUrl()).toBeNull();
    expect(topBar.session()).toBeNull();
  });

  it('shows the amber « Reconnexion… » banner while reconnecting, above the table that stays visible', () => {
    const { fixture, element, session, show } = render();
    show({ ...hiddenRound, selfParticipantId: hiddenRound.participants[0].participantId });
    const region = element.querySelector('main')?.firstElementChild;
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.textContent?.trim()).toBe('');
    expect(element.querySelector('.status-banner')).toBeNull();

    session.reconnecting.set(true);
    fixture.detectChanges();
    const banner = element.querySelector('.status-banner');
    expect(banner?.textContent?.trim()).toBe('Reconnexion…');
    // Même région qu'avant : elle n'est pas recréée, seul son contenu change.
    expect(element.querySelector('main')?.firstElementChild).toBe(region);
    expect(banner?.parentElement).toBe(region);
    expect(element.querySelectorAll('.seat')).toHaveLength(hiddenRound.participants.length);

    session.reconnecting.set(false);
    fixture.detectChanges();
    expect(element.querySelector('.status-banner')).toBeNull();
    expect(element.querySelector('main')?.firstElementChild).toBe(region);
  });

  describe('reveal flip', () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    /** `prefers-reduced-motion` simulé. */
    const motion = (reduced: boolean) =>
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced && query === '(prefers-reduced-motion: reduce)' }));
    const hidden = { ...revealedTie, round: { ...revealedTie.round, status: 'HIDDEN' }, summary: null, version: 8 };
    const hiddenAgain = { ...hidden, version: 10, lastChange: { action: 'HIDE', byParticipantId: revealedTie.selfParticipantId } };
    const flipping = (element: HTMLElement) => element.classList.contains('session-flipping');

    function revealAfterHidden(reduced = false) {
      vi.useFakeTimers();
      motion(reduced);
      const page = render();
      page.show(hidden);
      page.show(revealedTie);
      return page;
    }

    it('flips for 400 ms when a hidden round is revealed, the state (faces, announcement) being up to date at once', () => {
      const { fixture, element } = revealAfterHidden();
      expect(flipping(element)).toBe(true);
      expect(element.querySelectorAll('.seat-card-flip')).toHaveLength(4);
      expect(element.querySelector('.seat-card-flip')?.getAttribute('aria-label')).toBe('Carte 8');
      expect(element.querySelector('[aria-live="polite"]')?.textContent).toContain('Votes révélés.');
      expect(element.querySelector('.result-panel')).not.toBeNull();
      vi.advanceTimersByTime(REVEAL_FLIP_MS - 1);
      fixture.detectChanges();
      expect(flipping(element)).toBe(true);
      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(flipping(element)).toBe(false);
    });

    it('does not flip under prefers-reduced-motion', () => {
      const { element } = revealAfterHidden(true);
      expect(flipping(element)).toBe(false);
      expect(element.querySelector('.result-panel')).not.toBeNull();
    });

    it('does not flip when arriving in a revealed round, nor on a later revealed snapshot', () => {
      vi.useFakeTimers();
      motion(false);
      const { element, show } = render();
      show(revealedTie);
      expect(flipping(element)).toBe(false);
      show({ ...revealedTie, version: 10, lastChange: { action: 'PRESENCE', byParticipantId: null } });
      expect(flipping(element)).toBe(false);
    });

    it('a hidden snapshot during the flip stops it at once, leaving nothing hidden', () => {
      const { fixture, element, show } = revealAfterHidden();
      vi.advanceTimersByTime(100);
      show(hiddenAgain);
      expect(flipping(element)).toBe(false);
      expect(element.querySelector('.result-panel')).toBeNull();
      expect(element.querySelectorAll('.seat-card-back').length).toBeGreaterThan(0);
      vi.advanceTimersByTime(REVEAL_FLIP_MS);
      fixture.detectChanges();
      expect(flipping(element)).toBe(false);
    });

    it('flips again when the round is revealed after a « Masquer »', () => {
      const { fixture, element, show } = revealAfterHidden();
      vi.advanceTimersByTime(REVEAL_FLIP_MS);
      fixture.detectChanges();
      show(hiddenAgain);
      show({ ...revealedTie, version: 11 });
      expect(flipping(element)).toBe(true);
      vi.advanceTimersByTime(REVEAL_FLIP_MS);
      fixture.detectChanges();
      expect(flipping(element)).toBe(false);
    });

    it('does not move the focus (a card of my hand keeps it through the flip)', () => {
      vi.useFakeTimers();
      motion(false);
      const { fixture, element, show } = render();
      document.body.appendChild(element);
      show(hidden);
      const card = element.querySelector<HTMLButtonElement>('.hand .poker-card');
      card?.focus();
      const focused = document.activeElement;
      expect(focused).toBe(card);
      show(revealedTie);
      vi.advanceTimersByTime(REVEAL_FLIP_MS);
      fixture.detectChanges();
      expect(document.activeElement).toBe(focused);
      element.remove();
    });

    it('stops the flip timer when the page goes away', () => {
      const { fixture } = revealAfterHidden();
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      fixture.destroy();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
