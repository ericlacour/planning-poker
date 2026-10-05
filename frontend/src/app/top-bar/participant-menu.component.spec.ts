import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import { SessionState } from '../api/contract';
import { ConnectionStatus, SessionService } from '../session/session.service';
import { ParticipantMenuComponent } from './participant-menu.component';
import { TopBarState } from './top-bar-state';

const EMMA = '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e';

describe('ParticipantMenuComponent', () => {
  function render(state: SessionState | null, connection: ConnectionStatus = 'open') {
    const session = {
      state: signal<SessionState | null>(state),
      connection: signal<ConnectionStatus>(connection),
      changeRole: vi.fn(),
    };
    TestBed.inject(TopBarState).session.set(session as unknown as SessionService);
    const fixture = TestBed.createComponent(ParticipantMenuComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const trigger = () => element.querySelector<HTMLButtonElement>('.participant-menu-trigger');
    const items = () => [...element.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
    const open = async () => {
      trigger()!.click();
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const key = (target: HTMLElement, name: string) => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
      fixture.detectChanges();
    };
    return { element, session, fixture, trigger, items, open, key };
  }

  it('shows nothing before the first snapshot, nor outside the session screen', () => {
    const { trigger } = render(null);
    expect(trigger()).toBeNull();
    TestBed.inject(TopBarState).session.set(null);
    expect(TestBed.createComponent(ParticipantMenuComponent).nativeElement.textContent).toBe('');
  });

  it('shows my pseudo, closed, then « Je vote » / « J\'observe » with my current role checked', async () => {
    // Vu par Alice, votante.
    const { trigger, items, open } = render(hiddenRound as SessionState);
    expect(trigger()?.textContent?.trim()).toBe('Alice');
    expect(trigger()?.getAttribute('aria-label')).toBe('Menu du participant : Alice');
    expect(trigger()?.getAttribute('aria-expanded')).toBe('false');
    expect(trigger()?.hasAttribute('aria-controls')).toBe(false);
    expect(items()).toHaveLength(0);

    await open();
    expect(trigger()?.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(trigger()!.getAttribute('aria-controls')!)?.getAttribute('role')).toBe('menu');
    expect(items().map((i) => i.textContent?.trim())).toEqual(['✓ Je vote', "J'observe"]);
    expect(items().map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(document.activeElement).toBe(items()[0]);
  });

  it('choosing the other role sends changeRole, closes the menu and gives the focus back (FR5)', async () => {
    const { session, trigger, items, open, fixture } = render(hiddenRound as SessionState);
    await open();
    items()[1].click();
    fixture.detectChanges();
    expect(session.changeRole).toHaveBeenCalledExactlyOnceWith('OBSERVER');
    expect(items()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger());
  });

  it('offline, the choices are greyed out and choosing one sends nothing', async () => {
    const { session, items, open, fixture } = render(hiddenRound as SessionState, 'lost');
    await open();
    expect(items().map((i) => i.getAttribute('aria-disabled'))).toEqual(['true', 'true']);
    items()[1].click();
    fixture.detectChanges();
    expect(session.changeRole).not.toHaveBeenCalled();
    expect(items()).toHaveLength(2);
  });

  it('choosing my current role sends nothing', async () => {
    const { session, items, open, fixture } = render({ ...(hiddenRound as SessionState), selfParticipantId: EMMA });
    await open();
    expect(items().map((i) => i.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    items()[1].click();
    fixture.detectChanges();
    expect(session.changeRole).not.toHaveBeenCalled();
  });

  it('arrows move between the choices, Escape closes and gives the focus back', async () => {
    const { trigger, items, open, key } = render(hiddenRound as SessionState);
    await open();
    key(items()[0], 'ArrowDown');
    expect(document.activeElement).toBe(items()[1]);
    key(items()[1], 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    key(items()[0], 'ArrowUp');
    expect(document.activeElement).toBe(items()[1]);
    key(items()[1], 'Escape');
    expect(items()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger());
  });

  it('a click outside closes the menu', async () => {
    const { items, open, fixture } = render(hiddenRound as SessionState);
    await open();
    document.body.click();
    fixture.detectChanges();
    expect(items()).toHaveLength(0);
  });
});
