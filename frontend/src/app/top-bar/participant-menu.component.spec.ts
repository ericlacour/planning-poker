import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import { SessionState } from '../api/contract';
import { ConnectionStatus, SessionService } from '../session/session.service';
import { LOCAL_STORAGE } from '../storage/browser-storage';
import { ParticipantMenuComponent } from './participant-menu.component';
import { TopBarState } from './top-bar-state';

const EMMA = '5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e';

describe('ParticipantMenuComponent', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  function render(state: SessionState | null, connection: ConnectionStatus = 'open', stored: string | null = null) {
    const backing = new Map<string, string>(stored === null ? [] : [['pp.theme', stored]]);
    const localStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
    } as Storage;
    TestBed.configureTestingModule({ providers: [{ provide: LOCAL_STORAGE, useValue: () => localStorage }] });
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
    return { element, session, fixture, trigger, items, open, key, backing };
  }

  it('shows nothing before the first snapshot, nor outside the session screen', () => {
    const { trigger } = render(null);
    expect(trigger()).toBeNull();
    TestBed.inject(TopBarState).session.set(null);
    expect(TestBed.createComponent(ParticipantMenuComponent).nativeElement.textContent).toBe('');
  });

  it('shows my pseudo, closed, then my role and the theme, each with the current choice checked', async () => {
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
    expect(items().map((i) => i.textContent?.trim())).toEqual([
      '✓ Je vote',
      "J'observe",
      '✓ Automatique',
      'Clair',
      'Sombre',
    ]);
    expect(items().map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false', 'true', 'false', 'false']);
    expect(document.activeElement).toBe(items()[0]);

    // Un seul menu, deux groupes séparés : « Ton rôle » puis « Thème ».
    const menu = document.querySelectorAll('[role="menu"]');
    expect(menu).toHaveLength(1);
    const children = [...menu[0].children];
    expect(children.map((c) => c.getAttribute('role'))).toEqual(['group', 'separator', 'group']);
    expect(children.map((c) => c.getAttribute('aria-label'))).toEqual(['Ton rôle', null, 'Thème']);
    expect(children[0].querySelectorAll('[role="menuitemradio"]')).toHaveLength(2);
    expect(children[2].querySelectorAll('[role="menuitemradio"]')).toHaveLength(3);
  });

  it('checks the stored theme, and treats a corrupted value as « Automatique »', async () => {
    const first = render(hiddenRound as SessionState, 'open', 'dark');
    await first.open();
    expect(first.items().map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false', 'true']);
    first.fixture.destroy();
    TestBed.resetTestingModule();

    const second = render(hiddenRound as SessionState, 'open', 'bleu');
    await second.open();
    expect(second.items()[2].getAttribute('aria-checked')).toBe('true');
  });

  it('choosing a theme applies it at once, stores it, closes the menu, and sends nothing on the socket (UX-DR2)', async () => {
    const { session, trigger, items, open, fixture, backing } = render(hiddenRound as SessionState);
    await open();
    items()[4].click();
    fixture.detectChanges();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(backing.get('pp.theme')).toBe('dark');
    expect(items()).toHaveLength(0);
    expect(document.activeElement).toBe(trigger());
    expect(session.changeRole).not.toHaveBeenCalled();

    // À la réouverture, « Sombre » est coché ; « Automatique » retire data-theme.
    await open();
    expect(items().map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false', 'true']);
    expect(document.activeElement).toBe(items()[0]);
    items()[2].click();
    fixture.detectChanges();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(backing.get('pp.theme')).toBe('auto');
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
    expect(items().map((i) => i.getAttribute('aria-disabled'))).toEqual(['true', 'true', null, null, null]);
    items()[1].click();
    fixture.detectChanges();
    expect(session.changeRole).not.toHaveBeenCalled();
    expect(items()).toHaveLength(5);

    // Les thèmes restent actifs hors connexion.
    items()[3].click();
    fixture.detectChanges();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(items()).toHaveLength(0);
  });

  it('choosing my current role sends nothing', async () => {
    const { session, items, open, fixture } = render({ ...(hiddenRound as SessionState), selfParticipantId: EMMA });
    await open();
    expect(items().map((i) => i.getAttribute('aria-checked'))).toEqual(['false', 'true', 'true', 'false', 'false']);
    expect(document.activeElement).toBe(items()[1]);
    items()[1].click();
    fixture.detectChanges();
    expect(session.changeRole).not.toHaveBeenCalled();
  });

  it('arrows move across the five choices from one group to the other, Home / End, Escape closes', async () => {
    const { trigger, items, open, key } = render(hiddenRound as SessionState);
    await open();
    key(items()[0], 'ArrowDown');
    expect(document.activeElement).toBe(items()[1]);
    key(items()[1], 'ArrowDown');
    expect(document.activeElement).toBe(items()[2]);
    key(items()[2], 'End');
    expect(document.activeElement).toBe(items()[4]);
    key(items()[4], 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
    key(items()[0], 'ArrowUp');
    expect(document.activeElement).toBe(items()[4]);
    key(items()[4], 'Home');
    expect(document.activeElement).toBe(items()[0]);
    key(items()[0], 'Escape');
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
