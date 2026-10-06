import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { LOCAL_STORAGE } from '../storage/browser-storage';
import { ThemeService, applyTheme, parseTheme } from './theme';

/** Stockage minimal en mémoire. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const throwing = new Proxy({} as Storage, {
  get: () => () => {
    throw new DOMException('denied', 'SecurityError');
  },
});

function serviceWith(backing: Storage | null): ThemeService {
  TestBed.configureTestingModule({
    providers: [{ provide: LOCAL_STORAGE, useValue: () => backing }],
  });
  return TestBed.inject(ThemeService);
}

const dataTheme = () => document.documentElement.getAttribute('data-theme');

describe('theme', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  it('parseTheme keeps auto, light and dark, and treats anything else as auto', () => {
    expect(parseTheme('auto')).toBe('auto');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme(null)).toBe('auto');
    expect(parseTheme(undefined)).toBe('auto');
    expect(parseTheme('bleu')).toBe('auto');
    expect(parseTheme('DARK')).toBe('auto');
  });

  it('applyTheme sets data-theme for light and dark, and removes it for auto', () => {
    applyTheme(document, 'dark');
    expect(dataTheme()).toBe('dark');
    applyTheme(document, 'light');
    expect(dataTheme()).toBe('light');
    applyTheme(document, 'auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('starts on auto when pp.theme is missing, without touching the page', () => {
    const service = serviceWith(memoryStorage());
    expect(service.theme()).toBe('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('starts on the stored choice, and on auto when the stored value is corrupted', () => {
    expect(serviceWith(memoryStorage({ 'pp.theme': 'light' })).theme()).toBe('light');
    TestBed.resetTestingModule();
    expect(serviceWith(memoryStorage({ 'pp.theme': 'bleu' })).theme()).toBe('auto');
  });

  it('choose applies the theme at once and stores it under pp.theme', () => {
    const backing = memoryStorage();
    const service = serviceWith(backing);

    service.choose('light');
    expect(dataTheme()).toBe('light');
    expect(backing.getItem('pp.theme')).toBe('light');
    expect(service.theme()).toBe('light');

    service.choose('dark');
    expect(dataTheme()).toBe('dark');
    expect(backing.getItem('pp.theme')).toBe('dark');

    service.choose('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(backing.getItem('pp.theme')).toBe('auto');
    expect(service.theme()).toBe('auto');
  });

  it('with a blocked storage, the choice still applies for the page, without throwing', () => {
    const service = serviceWith(throwing);
    expect(service.theme()).toBe('auto');
    expect(() => service.choose('dark')).not.toThrow();
    expect(dataTheme()).toBe('dark');
    expect(service.theme()).toBe('dark');
  });
});
