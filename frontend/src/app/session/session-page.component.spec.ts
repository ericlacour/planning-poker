import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import alone from '../../../../contract/examples/session-state/alone-after-create.json';
import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import { SessionState } from '../api/contract';
import { TopBarState } from '../top-bar/top-bar-state';
import { SessionPageComponent, sessionLink } from './session-page.component';
import { SessionService } from './session.service';

const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';

describe('SessionPageComponent', () => {
  function render() {
    const state = signal<SessionState | null>(null);
    const session = { state, connect: vi.fn(), disconnect: vi.fn(), vote: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: session },
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

  it('with others: the table and the action bar with its counter, without invitation nor button', () => {
    const { element, show } = render();
    show(hiddenRound);
    expect(element.querySelectorAll('.seat')).toHaveLength(5);
    expect(element.querySelector('.invite')).toBeNull();
    expect(element.querySelector('.action-bar .vote-counter')?.textContent).toBe('3 votes sur 4');
    expect(element.querySelector('.btn-primary')).toBeNull();
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

  it('puts « Copier le lien » in the top bar while it is displayed', () => {
    const { fixture } = render();
    const topBar = TestBed.inject(TopBarState);
    expect(topBar.shareUrl()).toBe(`${location.origin}/s/${SESSION_ID}`);
    fixture.destroy();
    expect(topBar.shareUrl()).toBeNull();
  });
});
