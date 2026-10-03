import { describe, expect, it } from 'vitest';

import { cardName, cardText, voteCounter } from './cards';

describe('cards', () => {
  it('shows coffee as a text ☕ and names the special cards', () => {
    expect(cardText('coffee')).toBe('☕︎');
    expect(cardText('13')).toBe('13');
    expect(cardName('5')).toBe('Carte 5');
    expect(cardName('?')).toBe('Carte je ne sais pas');
    expect(cardName('coffee')).toBe('Carte pause café');
  });

  it('counts the votes: singular for 0 and 1, « Aucun votant » without voters', () => {
    expect(voteCounter({ voted: 2, expected: 3 })).toBe('2 votes sur 3');
    expect(voteCounter({ voted: 1, expected: 3 })).toBe('1 vote sur 3');
    expect(voteCounter({ voted: 0, expected: 3 })).toBe('0 vote sur 3');
    expect(voteCounter({ voted: 0, expected: 0 })).toBe('Aucun votant');
  });
});
