import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import created from '../../../../contract/examples/create-session-response/created.json';
import { CreateSessionRequest } from '../api/contract';
import { SessionApi, SessionApiError } from '../api/session-api';
import { LOCAL_STORAGE } from '../storage/browser-storage';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let stored: Map<string, string>;

  function render(createSession: (request: CreateSessionRequest) => Promise<unknown>, storageAvailable = true) {
    stored = new Map();
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    } as unknown as Storage;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionApi, useValue: { createSession: vi.fn(createSession) } },
        { provide: LOCAL_STORAGE, useValue: () => (storageAvailable ? storage : null) },
      ],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    return { navigate, api: TestBed.inject(SessionApi) as unknown as { createSession: ReturnType<typeof vi.fn> } };
  }

  function mount() {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const input = element.querySelector<HTMLInputElement>('#entry-pseudo')!;
    const submit = element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const type = (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, element, input, submit, type };
  }

  afterEach(() => vi.restoreAllMocks());

  it('shows « Créer une session », inactive on an empty pseudo', () => {
    render(async () => created);
    const { submit } = mount();
    expect(submit.textContent?.trim()).toBe('Créer une session');
    expect(submit.disabled).toBe(true);
  });

  it('prefills the last pseudo', () => {
    render(async () => created);
    stored.set('pp.pseudo', 'Eric');
    expect(mount().input.value).toBe('Eric');
  });

  it('creates the session, stores the token and the pseudo, then opens /s/{id}', async () => {
    let resolve!: (value: unknown) => void;
    const { navigate, api } = render(() => new Promise((r) => (resolve = r)));
    const { fixture, submit, input, type } = mount();
    type('  Sofia ');
    submit.click();
    fixture.detectChanges();

    expect(submit.textContent?.trim()).toBe('Connexion…');
    expect(submit.disabled).toBe(true);
    expect(input.value).toBe('  Sofia ');
    expect(api.createSession).toHaveBeenCalledWith({ pseudo: '  Sofia ', role: 'VOTER' });

    resolve(created);
    await fixture.whenStable();
    expect(stored.get(`pp.token.${created.sessionId}`)).toBe(created.participantToken);
    expect(stored.get('pp.pseudo')).toBe('Sofia');
    expect(navigate).toHaveBeenCalledWith(['/s', created.sessionId]);
  });

  it('still creates the session when the storage is unavailable', async () => {
    const { navigate } = render(async () => created, false);
    const { fixture, input, submit, type } = mount();
    expect(input.value).toBe('');
    type('Sofia');
    submit.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/s', created.sessionId]);
  });

  it.each([
    ['resolves false', (navigate: ReturnType<typeof vi.fn>) => navigate.mockResolvedValue(false)],
    ['rejects', (navigate: ReturnType<typeof vi.fn>) => navigate.mockRejectedValue(new Error('nav'))],
  ])('when navigation %s, shows no network error and re-enables the form', async (_, stub) => {
    const { navigate, api } = render(async () => created);
    stub(navigate as unknown as ReturnType<typeof vi.fn>);
    const { fixture, element, submit, type } = mount();
    type('Sofia');
    submit.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.createSession).toHaveBeenCalledTimes(1);
    expect(stored.get(`pp.token.${created.sessionId}`)).toBe(created.participantToken);
    expect(element.querySelector('.submit-error')).toBeNull();
    expect(submit.disabled).toBe(false);
    expect(submit.textContent?.trim()).toBe('Créer une session');
  });

  it('shows « Impossible de joindre le serveur. » under the button and keeps the input', async () => {
    const { navigate } = render(async () => Promise.reject(new SessionApiError('network')));
    const { fixture, element, input, submit, type } = mount();
    type('Sofia');
    submit.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.submit-error')?.textContent?.trim()).toBe('Impossible de joindre le serveur.');
    expect(input.value).toBe('Sofia');
    expect(submit.disabled).toBe(false);
    expect(submit.textContent?.trim()).toBe('Créer une session');
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([
    ['sessionLimitReached', 'Trop de sessions sont ouvertes en ce moment. Réessaie plus tard.'],
    ['tooManyRequests', 'Trop de sessions créées depuis ton réseau. Patiente une minute.'],
  ] as const)('on %s, shows « %s » under the button, keeps the input and re-enables it', async (kind, message) => {
    const { navigate } = render(async () => Promise.reject(new SessionApiError(kind)));
    const { fixture, element, input, submit, type } = mount();
    type('Sofia');
    submit.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.submit-error')?.textContent?.trim()).toBe(message);
    expect(element.querySelector('#entry-pseudo-error')).toBeNull();
    expect(input.value).toBe('Sofia');
    expect(submit.disabled).toBe(false);
    expect(submit.textContent?.trim()).toBe('Créer une session');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows « Ce pseudo n\'est pas valide. » under the field on INVALID_PSEUDO', async () => {
    render(async () => Promise.reject(new SessionApiError('invalidPseudo')));
    const { fixture, element, submit, type } = mount();
    type('Sofia');
    submit.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelector('#entry-pseudo-error')?.textContent?.trim()).toBe("Ce pseudo n'est pas valide.");
    expect(element.querySelector('.submit-error')).toBeNull();
  });
});
