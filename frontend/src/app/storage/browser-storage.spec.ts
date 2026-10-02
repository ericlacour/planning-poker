import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { BrowserStorage, LOCAL_STORAGE } from './browser-storage';

function storageWith(backing: () => Storage | null): BrowserStorage {
  TestBed.configureTestingModule({ providers: [{ provide: LOCAL_STORAGE, useValue: backing }] });
  return TestBed.inject(BrowserStorage);
}

/** Stockage minimal en mémoire. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
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

describe('BrowserStorage', () => {
  it('stores the token under pp.token.{sessionId} and the pseudo under pp.pseudo', () => {
    const backing = memoryStorage();
    const storage = storageWith(() => backing);
    storage.saveToken('k3Jx9QvT2mLpZ8wR4nYb7A', 'Xb4Rt9LmQ2vN7cZp1HsK0w');
    storage.savePseudo('Eric');

    expect(backing.getItem('pp.token.k3Jx9QvT2mLpZ8wR4nYb7A')).toBe('Xb4Rt9LmQ2vN7cZp1HsK0w');
    expect(backing.getItem('pp.pseudo')).toBe('Eric');
    expect(storage.readToken('k3Jx9QvT2mLpZ8wR4nYb7A')).toBe('Xb4Rt9LmQ2vN7cZp1HsK0w');
    expect(storage.readPseudo()).toBe('Eric');
  });

  it('removes the token of one session only', () => {
    const backing = memoryStorage();
    const storage = storageWith(() => backing);
    storage.saveToken('a', 'token-a');
    storage.saveToken('b', 'token-b');
    storage.removeToken('a');
    expect(storage.readToken('a')).toBeNull();
    expect(storage.readToken('b')).toBe('token-b');
  });

  it('returns null when nothing is stored', () => {
    expect(storageWith(() => memoryStorage()).readPseudo()).toBeNull();
  });

  it('never throws when the storage is unavailable', () => {
    const storage = storageWith(() => null);
    expect(storage.readPseudo()).toBeNull();
    expect(() => storage.savePseudo('Eric')).not.toThrow();
    expect(() => storage.removeToken('id')).not.toThrow();
  });

  it('keeps the token in memory when the storage is unavailable, so that joining still works', () => {
    const storage = storageWith(() => null);
    storage.saveToken('k3Jx9QvT2mLpZ8wR4nYb7A', 'Xb4Rt9LmQ2vN7cZp1HsK0w');
    storage.savePseudo('Eric');
    expect(storage.readToken('k3Jx9QvT2mLpZ8wR4nYb7A')).toBe('Xb4Rt9LmQ2vN7cZp1HsK0w');
    expect(storage.readPseudo()).toBe('Eric');
    storage.removeToken('k3Jx9QvT2mLpZ8wR4nYb7A');
    expect(storage.readToken('k3Jx9QvT2mLpZ8wR4nYb7A')).toBeNull();
  });

  it('keeps the token in memory when every write throws', () => {
    const throwing = new Proxy({} as Storage, {
      get: () => () => {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    const storage = storageWith(() => throwing);
    storage.saveToken('id', 'token');
    expect(storage.readToken('id')).toBe('token');
  });

  it('never throws when every access throws', () => {
    const throwing = new Proxy({} as Storage, {
      get: () => () => {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    const storage = storageWith(() => throwing);
    expect(storage.readPseudo()).toBeNull();
    expect(() => storage.saveToken('id', 'token')).not.toThrow();
    expect(() => storage.removeToken('id')).not.toThrow();
  });
});
