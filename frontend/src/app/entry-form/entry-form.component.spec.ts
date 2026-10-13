import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { EntryFormComponent, EntryFormValue } from './entry-form.component';

describe('EntryFormComponent', () => {
  let fixture: ComponentFixture<EntryFormComponent>;
  let element: HTMLElement;
  let submitted: EntryFormValue[];

  const input = () => element.querySelector<HTMLInputElement>('#entry-pseudo')!;
  const submit = () => element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const radios = () => [...element.querySelectorAll<HTMLButtonElement>('[role="radio"]')];

  function type(value: string) {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function set(name: string, value: unknown) {
    fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(EntryFormComponent);
    fixture.componentRef.setInput('submitLabel', 'Créer une session');
    fixture.detectChanges();
    element = fixture.nativeElement;
    submitted = [];
    fixture.componentInstance.submitted.subscribe((value) => submitted.push(value));
  });

  it('shows the exact labels, with « Je vote » selected in an accessible radio group', () => {
    expect(element.querySelector('label[for="entry-pseudo"]')?.textContent).toBe('Ton pseudo');
    expect(element.querySelector('#entry-role-label')?.textContent).toBe('Ton rôle');
    expect(element.querySelector('[role="radiogroup"]')?.getAttribute('aria-labelledby')).toBe('entry-role-label');
    expect(radios().map((r) => r.textContent?.trim())).toEqual(['Je vote', "J'observe"]);
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(submit().textContent?.trim()).toBe('Créer une session');
    expect(input().maxLength).toBe(20);
  });

  it('keeps the button inactive while the pseudo is empty or blank', () => {
    expect(submit().disabled).toBe(true);
    type('   ');
    expect(submit().disabled).toBe(true);
    type(' Sofia ');
    expect(submit().disabled).toBe(false);
  });

  it('submits the pseudo and the chosen role, with Enter too', () => {
    type('Eric');
    radios()[1].click();
    fixture.detectChanges();
    expect(radios().map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true']);

    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(submitted).toEqual([{ pseudo: 'Eric', role: 'OBSERVER' }]);
  });

  it('does not submit a blank pseudo', () => {
    type('  ');
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(submitted).toEqual([]);
  });

  it('moves the role with the arrow keys', () => {
    radios()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(radios()[1].getAttribute('aria-checked')).toBe('true');
    expect(radios()[1].tabIndex).toBe(0);
    expect(radios()[0].tabIndex).toBe(-1);
    expect(document.activeElement).toBe(radios()[1]);
  });

  it('prefills the pseudo', () => {
    set('initialPseudo', 'Eric');
    expect(input().value).toBe('Eric');
    expect(submit().disabled).toBe(false);
  });

  it('shows « Connexion… » while busy, button inactive, field still readable', () => {
    type('Eric');
    set('busy', true);
    expect(submit().textContent?.trim()).toBe('Connexion…');
    expect(submit().disabled).toBe(true);
    expect(input().disabled).toBe(false);
    expect(input().readOnly).toBe(true);
    expect(input().value).toBe('Eric');
  });

  it('shows a pseudo error under the field without clearing the input', () => {
    type('Eric');
    set('pseudoError', "Ce pseudo n'est pas valide.");
    const error = element.querySelector('#entry-pseudo-error');
    expect(error?.textContent?.trim()).toBe("Ce pseudo n'est pas valide.");
    expect(error?.getAttribute('role')).toBe('alert');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().getAttribute('aria-describedby')).toBe('entry-pseudo-error');
    expect(element.querySelector('.field')?.classList).toContain('field-error');
    expect(input().value).toBe('Eric');
  });

  it('shows a submit error under the button, with an icon', () => {
    set('submitError', 'Impossible de joindre le serveur.');
    const error = element.querySelector('.submit-error');
    expect(error?.textContent?.trim()).toBe('Impossible de joindre le serveur.');
    expect(error?.querySelector('svg')).not.toBeNull();
    expect(submit().nextElementSibling).toBe(error);
  });

  it('shows no notice by default', () => {
    expect(element.querySelector('.entry-notice')).toBeNull();
    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it('shows a neutral notice above the field, as a status', () => {
    set('notice', 'Ta place a été reprise depuis un autre appareil.');
    const notice = element.querySelector('.entry-notice');
    expect(notice?.textContent?.trim()).toBe('Ta place a été reprise depuis un autre appareil.');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.classList).not.toContain('error-msg');
    expect(notice?.querySelector('svg')).toBeNull();
    expect(notice!.compareDocumentPosition(input()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input().getAttribute('aria-invalid')).toBeNull();
  });

  describe('deck choice (session creation)', () => {
    const deckRadios = () => [...element.querySelectorAll<HTMLButtonElement>('.deck-group [role="radio"]')];
    const chips = () => [...element.querySelectorAll<HTMLButtonElement>('.deck-chip')];
    const chipTexts = () => chips().map((c) => c.textContent?.trim());
    const submitForm = () => element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));

    beforeEach(() => set('withDeck', true));

    it('is absent unless the form creates a session', () => {
      fixture = TestBed.createComponent(EntryFormComponent);
      fixture.componentRef.setInput('submitLabel', 'Rejoindre');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.deck-group')).toBeNull();
      fixture.componentInstance.submitted.subscribe((value) => submitted.push(value));
      const pseudo = fixture.nativeElement.querySelector('#entry-pseudo') as HTMLInputElement;
      pseudo.value = 'Eric';
      pseudo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
      expect(submitted).toEqual([{ pseudo: 'Eric', role: 'VOTER' }]);
    });

    it('offers Fibonacci, with every card kept at the start', () => {
      expect(deckRadios().map((r) => r.textContent?.trim())).toEqual(['Fibonacci', 'Tailles de tee-shirt']);
      expect(deckRadios().map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
      expect(chipTexts()).toEqual(['0', '0,5', '1', '2', '3', '5', '8', '13', '21', '?', '☕︎']);
      expect(chips().every((c) => c.getAttribute('aria-pressed') === 'true')).toBe(true);
      expect(chips().map((c) => c.getAttribute('aria-label')).slice(-3)).toEqual([
        'Carte 21', 'Carte je ne sais pas', 'Carte pause café',
      ]);
    });

    it('submits the whole Fibonacci suite by default', () => {
      type('Eric');
      submitForm();
      expect(submitted).toEqual([
        {
          pseudo: 'Eric',
          role: 'VOTER',
          deck: { type: 'FIBONACCI', cards: ['0', '0.5', '1', '2', '3', '5', '8', '13', '21', '?', 'coffee'] },
        },
      ]);
    });

    it('removes and brings back cards, keeping the order of the suite', () => {
      type('Eric');
      chips()[0].click(); // 0
      chips()[10].click(); // ☕
      fixture.detectChanges();
      expect(chips()[0].getAttribute('aria-pressed')).toBe('false');
      chips()[10].click();
      fixture.detectChanges();
      submitForm();
      expect(submitted[0].deck).toEqual({ type: 'FIBONACCI', cards: ['0.5', '1', '2', '3', '5', '8', '13', '21', '?', 'coffee'] });
    });

    it('switches to T-shirt sizes, each family keeping its own choice', () => {
      type('Eric');
      chips()[2].click(); // 1
      deckRadios()[1].click();
      fixture.detectChanges();
      expect(deckRadios().map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true']);
      expect(chipTexts()).toEqual(['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL']);
      chips()[0].click(); // XXS
      chips()[6].click(); // XXL
      fixture.detectChanges();
      submitForm();
      expect(submitted[0].deck).toEqual({ type: 'TSHIRT', cards: ['XS', 'S', 'M', 'L', 'XL'] });

      deckRadios()[0].click();
      fixture.detectChanges();
      expect(chips()[2].getAttribute('aria-pressed')).toBe('false'); // 1 reste retiré
    });

    it('moves the family with the arrow keys', () => {
      deckRadios()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();
      expect(deckRadios().map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    });

    it('refuses fewer than two cards: hint in error, button inactive', () => {
      type('Eric');
      deckRadios()[1].click();
      fixture.detectChanges();
      for (const index of [0, 1, 2, 3, 4]) chips()[index].click();
      fixture.detectChanges();
      expect(submit().disabled).toBe(false); // 2 cartes : XL, XXL
      chips()[5].click();
      fixture.detectChanges();
      expect(submit().disabled).toBe(true);
      expect(element.querySelector('.deck-hint')?.textContent?.trim()).toBe('Garde au moins 2 cartes.');
      expect(element.querySelector('.deck-hint')?.getAttribute('role')).toBe('alert');
      submitForm();
      expect(submitted).toEqual([]);
      chips()[5].click();
      fixture.detectChanges();
      expect(submit().disabled).toBe(false);
    });

    it('states that the choice is final and locks the chips while busy', () => {
      expect(element.querySelector('.deck-hint')?.textContent).toContain('définitif pour la session');
      set('busy', true);
      expect(chips().every((c) => c.disabled)).toBe(true);
      expect(deckRadios().every((r) => r.disabled)).toBe(true);
    });
  });
});
