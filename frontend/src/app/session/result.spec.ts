import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import newRound from '../../../../contract/examples/session-state/new-round-after-sweep.json';
import revealedConsensus from '../../../../contract/examples/session-state/revealed-consensus.json';
import revealedNoNumeric from '../../../../contract/examples/session-state/revealed-no-numeric-vote.json';
import revealedObserver from '../../../../contract/examples/session-state/revealed-seen-by-observer.json';
import revealedTie from '../../../../contract/examples/session-state/revealed-tie.json';
import { SessionState, Summary } from '../api/contract';
import {
  announcementFor,
  compactMostVoted,
  formatAverage,
  joinValues,
  NEW_ROUND_ANNOUNCEMENT,
  ResultLineComponent,
  ResultPanelComponent,
  revealAnnouncement,
  votesCount,
} from './result';

const summaryOf = (example: unknown) => (example as SessionState).summary as Summary;

/** Synthèse de la maquette PC : 3, 5 × 6, 8 × 2, 13… moyenne 5,9. */
const mockup: Summary = { average: 5.9, mostVoted: { values: ['5'], count: 6 }, min: '3', max: '13', consensus: false };

describe('result formatting', () => {
  it('formats the average in French, without trailing zero', () => {
    expect(formatAverage(5.9, 'fr')).toBe('5,9');
    expect(formatAverage(6.5, 'fr')).toBe('6,5');
    expect(formatAverage(3, 'fr')).toBe('3');
    expect(formatAverage(10.5, 'fr')).toBe('10,5');
  });

  it('joins tied values with « et »', () => {
    expect(joinValues(['5'])).toBe('5');
    expect(joinValues(['5', '8'])).toBe('5 et 8');
    expect(joinValues(['3', '5', '8'])).toBe('3, 5 et 8');
  });

  it('agrees the vote count, with « chacune » for a tie', () => {
    expect(votesCount(1, false)).toBe('1 vote');
    expect(votesCount(6, false)).toBe('6 votes');
    expect(votesCount(1, true)).toBe('1 vote chacune');
    expect(votesCount(3, true)).toBe('3 votes chacune');
  });

  it('announces a reveal', () => {
    expect(revealAnnouncement(mockup, 'fr')).toBe('Votes révélés. Moyenne 5,9. Plus votée 5, 6 votes. Min 3, max 13.');
    expect(revealAnnouncement({ ...mockup, mostVoted: { values: ['5', '8'], count: 3 } }, 'fr')).toBe(
      'Votes révélés. Moyenne 5,9. Plus votée 5 et 8, 3 votes chacune. Min 3, max 13.',
    );
    expect(revealAnnouncement(summaryOf(revealedConsensus), 'fr')).toBe(
      'Votes révélés. Moyenne 3. Plus votée 3, 2 votes. Min 3, max 3. Consensus !',
    );
    expect(revealAnnouncement(summaryOf(revealedNoNumeric), 'fr')).toBe('Votes révélés. Pas de résultat chiffré.');
  });

  it('announces a reveal and a new round, whoever made them, and nothing else', () => {
    const hidden = { ...(revealedTie as SessionState), round: { ...revealedTie.round, status: 'HIDDEN' }, summary: null } as SessionState;
    expect(announcementFor(null, revealedTie as SessionState, 'fr')).toBeNull();
    expect(announcementFor(hidden, revealedTie as SessionState, 'fr')).toBe(
      'Votes révélés. Moyenne 6,5. Plus votée 5 et 8, 2 votes chacune. Min 5, max 8.',
    );
    expect(announcementFor(revealedTie as SessionState, newRound as SessionState, 'fr')).toBe(NEW_ROUND_ANNOUNCEMENT);
    expect(NEW_ROUND_ANNOUNCEMENT).toBe('Nouveau tour');
    // Un vote, une présence, un tour révélé qui reste révélé : rien.
    expect(announcementFor(hiddenRound as SessionState, { ...(hiddenRound as SessionState), version: 8 }, 'fr')).toBeNull();
    expect(announcementFor(revealedTie as SessionState, revealedObserver as SessionState, 'fr')).toBeNull();
  });
});

describe('ResultPanelComponent', () => {
  function render(summary: Summary | null) {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'fr' }] });
    const fixture = TestBed.createComponent(ResultPanelComponent);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const text = (selector: string) => element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
    return { element, text };
  }

  it('the revealed-tie example: « 6,5 », « 5 et 8 · 2 votes chacune », « Min 5 », « Max 8 », no badge', () => {
    const { element, text } = render(summaryOf(revealedTie));
    expect(text('.result-average')).toBe('Moyenne 6,5');
    expect(text('.result-average .result-value')).toBe('6,5');
    expect(text('.result-most-voted')).toBe('Plus votée 5 et 8 · 2 votes chacune');
    expect(text('.result-min')).toBe('Min 5');
    expect(text('.result-max')).toBe('Max 8');
    expect(element.querySelector('.consensus-badge')).toBeNull();
    expect(element.querySelector('.result-none')).toBeNull();
  });

  it('the mockup: « 5,9 », « Plus votée 5 · 6 votes », « Min 3 », « Max 13 »', () => {
    const { text } = render(mockup);
    expect(text('.result-average .result-value')).toBe('5,9');
    expect(text('.result-most-voted')).toBe('Plus votée 5 · 6 votes');
    expect(text('.result-min')).toBe('Min 3');
    expect(text('.result-max')).toBe('Max 13');
  });

  it('a single vote: « 1 vote »', () => {
    const { text } = render({ average: 8, mostVoted: { values: ['8'], count: 1 }, min: '8', max: '8', consensus: false });
    expect(text('.result-most-voted')).toBe('Plus votée 8 · 1 vote');
    expect(text('.result-average .result-value')).toBe('8');
  });

  it('consensus: the badge « Consensus ! », never ☕ in the numbers', () => {
    const { element, text } = render(summaryOf(revealedConsensus));
    expect(text('.consensus-badge')).toBe('Consensus !');
    expect(text('.result-average .result-value')).toBe('3');
    expect(element.textContent).not.toContain('☕');
    expect(element.textContent).not.toContain('coffee');
  });

  it('without a numeric vote: only « Pas de résultat chiffré »', () => {
    const { element, text } = render(summaryOf(revealedNoNumeric));
    expect(text('.result-panel')).toBe('Pas de résultat chiffré');
    expect(element.querySelector('.result-stat')).toBeNull();
    expect(element.querySelector('.consensus-badge')).toBeNull();
  });
});

describe('ResultLineComponent (phone)', () => {
  function render(summary: Summary | null) {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'fr' }] });
    const fixture = TestBed.createComponent(ResultLineComponent);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const text = (selector: string) => element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
    return { element, text };
  }

  it('writes the most voted value with its count in brackets', () => {
    expect(compactMostVoted({ values: ['5'], count: 6 })).toBe('5 (6)');
    expect(compactMostVoted({ values: ['5', '8'], count: 2 })).toBe('5 et 8 (2)');
  });

  it('the mockup: « Moy. 5,9 », « Plus votée 5 (6) », « Min 3 », « Max 13 », no badge', () => {
    const { element, text } = render(mockup);
    expect(text('.result-line-average')).toBe('Moy. 5,9');
    expect(text('.result-line-value')).toBe('5,9');
    expect(text('.result-line-most-voted')).toBe('Plus votée 5 (6)');
    expect(text('.result-line-min')).toBe('Min 3');
    expect(text('.result-line-max')).toBe('Max 13');
    expect(element.querySelector('.consensus-badge')).toBeNull();
  });

  it('a tie, and consensus with the badge next to the average', () => {
    expect(render(summaryOf(revealedTie)).text('.result-line-most-voted')).toBe('Plus votée 5 et 8 (2)');
    TestBed.resetTestingModule();
    const { element, text } = render(summaryOf(revealedConsensus));
    expect(text('.result-line-average + .result-line-badge .consensus-badge')).toBe('Consensus !');
    expect(element.textContent).not.toContain('☕');
  });

  it('without a numeric vote: only « Pas de résultat chiffré »', () => {
    const { element, text } = render(summaryOf(revealedNoNumeric));
    expect(text('.result-line')).toBe('Pas de résultat chiffré');
    expect(element.querySelector('.result-line-item')).toBeNull();
  });
});
