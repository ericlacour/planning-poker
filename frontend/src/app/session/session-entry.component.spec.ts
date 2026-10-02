import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import joined from '../../../../contract/examples/join-session-response/joined.json';
import { JoinSessionRequest } from '../api/contract';
import { SessionApi, SessionApiError } from '../api/session-api';
import { LOCAL_STORAGE } from '../storage/browser-storage';
import { SessionEntryComponent } from './session-entry.component';

const SESSION_ID = 'k3Jx9QvT2mLpZ8wR4nYb7A';
const TOKEN_KEY = `pp.token.${SESSION_ID}`;

type Check = () => Promise<void>;
type Join = (sessionId: string, request: JoinSessionRequest) => Promise<unknown>;

const fail = (kind: SessionApiError['kind']) => () => Promise.reject(new SessionApiError(kind));

describe('SessionEntryComponent', () => {
  let stored: Map<string, string>;

  function render(checkSession: Check, joinSession: Join = async () => joined) {
    stored = new Map();
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
      removeItem: (key: string) => void stored.delete(key),
    } as unknown as Storage;
    const api = { checkSession: vi.fn(checkSession), joinSession: vi.fn(joinSession) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionApi, useValue: api },
        { provide: LOCAL_STORAGE, useValue: () => storage },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ sessionId: SESSION_ID }) } },
        },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    return { api, navigate };
  }

  async function mount() {
    const fixture = TestBed.createComponent(SessionEntryComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const settle = async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const input = () => element.querySelector<HTMLInputElement>('#entry-pseudo')!;
    const submit = () => element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const type = (value: string) => {
      input().value = value;
      input().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, element, settle, input, submit, type };
  }

  afterEach(() => vi.restoreAllMocks());

  it('checks the session first, with the id of the link', async () => {
    const { api } = render(async () => undefined);
    await mount();
    expect(api.checkSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it('shows nothing but an empty state while checking', async () => {
    render(() => new Promise(() => undefined));
    const fixture = TestBed.createComponent(SessionEntryComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('main.state-screen')?.getAttribute('aria-busy')).toBe('true');
    expect(element.textContent?.trim()).toBe('');
  });

  describe('dead link (404)', () => {
    it('shows « Session introuvable » and clears the stored token', async () => {
      render(fail('notFound'));
      stored.set(TOKEN_KEY, 'old-token');
      stored.set('pp.token.other', 'other-token');
      const { element } = await mount();

      expect(element.querySelector('h1')?.textContent?.trim()).toBe("Cette session n'existe plus.");
      expect(element.querySelector('.lead')?.textContent?.trim()).toBe(
        'Elle a peut-être expiré, ou le serveur a redémarré.',
      );
      const buttons = element.querySelectorAll('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0].textContent?.trim()).toBe('Créer une session');
      expect(stored.has(TOKEN_KEY)).toBe(false);
      expect(stored.get('pp.token.other')).toBe('other-token');
    });

    it('« Créer une session » leads to the home page', async () => {
      const { navigate } = render(fail('notFound'));
      const { element } = await mount();
      element.querySelector<HTMLButtonElement>('button')!.click();
      expect(navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('server unreachable on the first check', () => {
    it('shows « Impossible de joindre le serveur. » and « Réessayer » retries the check', async () => {
      let answer: Check = fail('network');
      const { api } = render(() => answer());
      const { element, settle } = await mount();

      expect(element.querySelector('h1')?.textContent?.trim()).toBe('Impossible de joindre le serveur.');
      const retry = element.querySelector<HTMLButtonElement>('button')!;
      expect(retry.textContent?.trim()).toBe('Réessayer');

      answer = async () => undefined;
      retry.click();
      await settle();
      expect(api.checkSession).toHaveBeenCalledTimes(2);
      expect(element.querySelector('button[type="submit"]')?.textContent?.trim()).toBe('Rejoindre');
    });

    it('keeps the stored token', async () => {
      render(fail('network'));
      stored.set(TOKEN_KEY, 'token');
      await mount();
      expect(stored.get(TOKEN_KEY)).toBe('token');
    });
  });

  it('opens the session page directly when a token is already stored', async () => {
    const { api } = render(async () => undefined);
    stored.set(TOKEN_KEY, 'token');
    const { element } = await mount();
    expect(element.querySelector('app-session-page')).not.toBeNull();
    expect(element.querySelector('.invite-text')?.textContent).toBe('Partage le lien pour inviter ton équipe');
    expect(element.querySelector('form')).toBeNull();
    expect(api.joinSession).not.toHaveBeenCalled();
  });

  describe('Join screen', () => {
    it('shows the entry form with « Rejoindre », « Je vote » selected and the last pseudo prefilled', async () => {
      render(async () => undefined);
      stored.set('pp.pseudo', 'Sofia');
      const { element, input, submit } = await mount();

      expect(submit().textContent?.trim()).toBe('Rejoindre');
      expect(submit().disabled).toBe(false);
      expect(input().value).toBe('Sofia');
      expect(element.querySelector('[role="radio"][aria-checked="true"]')?.textContent?.trim()).toBe('Je vote');
    });

    it('keeps « Rejoindre » inactive on an empty pseudo', async () => {
      render(async () => undefined);
      const { submit } = await mount();
      expect(submit().disabled).toBe(true);
    });

    it('joins, stores the token and the pseudo, then shows the session page without reloading', async () => {
      let resolve!: (value: unknown) => void;
      const { api, navigate } = render(
        async () => undefined,
        () => new Promise((r) => (resolve = r)),
      );
      const { element, settle, submit, input, type, fixture } = await mount();
      type('  Bob ');
      submit().click();
      fixture.detectChanges();

      expect(submit().textContent?.trim()).toBe('Connexion…');
      expect(submit().disabled).toBe(true);
      expect(input().value).toBe('  Bob ');
      expect(api.joinSession).toHaveBeenCalledWith(SESSION_ID, { pseudo: '  Bob ', role: 'VOTER' });

      resolve(joined);
      await settle();
      expect(stored.get(TOKEN_KEY)).toBe(joined.participantToken);
      expect(stored.get('pp.pseudo')).toBe('Bob');
      expect(element.querySelector('app-session-page')).not.toBeNull();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('joins as an observer', async () => {
      const { api } = render(async () => undefined);
      const { element, settle, submit, type } = await mount();
      type('Eric');
      element.querySelectorAll<HTMLButtonElement>('[role="radio"]')[1].click();
      submit().click();
      await settle();
      expect(api.joinSession).toHaveBeenCalledWith(SESSION_ID, { pseudo: 'Eric', role: 'OBSERVER' });
    });

    it('shows « Ce pseudo est déjà pris dans cette session. » under the field on 409 and keeps the input', async () => {
      render(async () => undefined, fail('pseudoTaken'));
      const { element, settle, submit, input, type } = await mount();
      type('SOFIA');
      submit().click();
      await settle();

      expect(element.querySelector('#entry-pseudo-error')?.textContent?.trim()).toBe(
        'Ce pseudo est déjà pris dans cette session.',
      );
      expect(element.querySelector('.submit-error')).toBeNull();
      expect(input().value).toBe('SOFIA');
      expect(input().getAttribute('aria-invalid')).toBe('true');
      expect(submit().disabled).toBe(false);
      expect(submit().textContent?.trim()).toBe('Rejoindre');
      expect(stored.has(TOKEN_KEY)).toBe(false);
    });

    it('shows « Impossible de joindre le serveur. » under the button on a network failure', async () => {
      render(async () => undefined, fail('network'));
      const { element, settle, submit, input, type } = await mount();
      type('Bob');
      submit().click();
      await settle();

      expect(element.querySelector('.submit-error')?.textContent?.trim()).toBe('Impossible de joindre le serveur.');
      expect(element.querySelector('#entry-pseudo-error')).toBeNull();
      expect(input().value).toBe('Bob');
      expect(submit().disabled).toBe(false);
    });

    it('treats an unexpected error as a network failure', async () => {
      render(async () => undefined, () => Promise.reject(new Error('boom')));
      const { element, settle, submit, type } = await mount();
      type('Bob');
      submit().click();
      await settle();
      expect(element.querySelector('.submit-error')?.textContent?.trim()).toBe('Impossible de joindre le serveur.');
    });

    it('shows « Session introuvable » when the session disappeared before joining', async () => {
      render(async () => undefined, fail('notFound'));
      const { element, settle, submit, type } = await mount();
      type('Bob');
      submit().click();
      await settle();
      expect(element.querySelector('h1')?.textContent?.trim()).toBe("Cette session n'existe plus.");
      expect(element.querySelector('form')).toBeNull();
    });

    it('shows « Ce pseudo n\'est pas valide. » on INVALID_PSEUDO', async () => {
      render(async () => undefined, fail('invalidPseudo'));
      const { element, settle, submit, type } = await mount();
      type('Bob');
      submit().click();
      await settle();
      expect(element.querySelector('#entry-pseudo-error')?.textContent?.trim()).toBe("Ce pseudo n'est pas valide.");
    });
  });
});
