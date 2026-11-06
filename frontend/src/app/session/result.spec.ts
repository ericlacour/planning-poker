import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import hiddenRound from '../../../../contract/examples/session-state/hidden-round.json';
import newRound from '../../../../contract/examples/session-state/new-round-after-sweep.json';
import revealedConsensus from '../../../../contract/examples/session-state/revealed-consensus.json';
import revealedNoNumeric from '../../../../contract/examples/session-state/revealed-no-numeric-vote.json';
import revealedObserver from '../../../../contract/examples/session-state/revealed-seen-by-observer.json';
import revealedTie from '../../../../contract/examples/session-state/revealed-tie.json';
import revealedTshirt from '../../../../contract/examples/session-state/revealed-tshirt-tie.json';
import revealedMedian from '../../../../contract/examples/session-state/revealed-median.json';
import revealedSpread from '../../../../contract/examples/session-state/revealed-spread-too-wide.json';
import { EstimationRule, SessionState, Summary } from '../api/contract';
import {
  announcementFor,
  arrivalAnnouncements,
  compactMostVoted,
  formatAverage,
  joinValues,
  NEW_ROUND_ANNOUNCEMENT,
  proposalLabel,
  ResultLineComponent,
  ResultPanelComponent,
  revealAnnouncement,
  spreadMessage,
  spreadVoters,
  votesCount,
} from './result';

const summaryOf = (example: unknown) => (example as SessionState).summary as Summary;

/** Synthèse de la maquette PC : 3, 5 × 6, 8 × 2, 13… moyenne 5,9. */
const mockup: Summary = {
  average: 5.9,
  mostVoted: { values: ['5'], count: 6 },
  min: '3',
  max: '13',
  consensus: false,
  proposal: null,
  spreadTooWide: false,
};

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
    expect(revealAnnouncement(summaryOf(revealedConsensus), 'fr', null, 'MEDIAN')).toBe(
      'Votes révélés. Moyenne 3. Plus votée 3, 2 votes. Min 3, max 3. Consensus ! Proposition (médiane) 3.',
    );
    expect(revealAnnouncement(summaryOf(revealedNoNumeric), 'fr')).toBe('Votes révélés. Pas de résultat chiffré.');
  });

  it('announces a reveal of sizes without any average', () => {
    expect(revealAnnouncement(summaryOf(revealedTshirt), 'fr', null, 'BELOW_MAX')).toBe(
      'Votes révélés. Plus votée M et L, 2 votes chacune. Min M, max L. Proposition (sous le max) M.',
    );
  });

  it('announces the proposal of the session, and nothing with the rule « Aucune »', () => {
    expect(revealAnnouncement(summaryOf(revealedMedian), 'fr', null, 'MEDIAN')).toBe(
      'Votes révélés. Moyenne 5,3. Plus votée 5, 2 votes. Min 3, max 8. Proposition (médiane) 5.',
    );
    // Règle inconnue : « Proposition » seul.
    expect(revealAnnouncement(summaryOf(revealedMedian), 'fr')).toContain(' Proposition 5.');
    expect(revealAnnouncement(summaryOf(revealedObserver), 'fr')).not.toContain('Proposition');
    expect(revealAnnouncement(summaryOf(revealedObserver), 'fr')).not.toContain('Écart');
  });

  it('names who voted the min and the max when the spread is too wide, in table order', () => {
    const state = revealedSpread as SessionState;
    expect(spreadVoters(state)).toBe('Léa (2) et Max (13)');
    expect(spreadMessage(spreadVoters(state))).toBe(
      'Écart trop grand : Léa (2) et Max (13) expliquent leur vote, puis revotez',
    );
    const hidden = { ...state, round: { ...state.round, status: 'HIDDEN' }, summary: null } as SessionState;
    expect(announcementFor(hidden, state, 'fr')).toBe(
      'Votes révélés. Moyenne 6,3. Plus votée 5, 2 votes. Min 2, max 13. ' +
        'Écart trop grand : Léa (2) et Max (13) expliquent leur vote, puis revotez.',
    );
    // Avec « La plus grande », la proposition est gardée, puis l'invitation à expliquer son vote.
    const withMax = { ...state, estimationRule: 'MAX', summary: { ...state.summary!, proposal: '13' } } as SessionState;
    expect(announcementFor({ ...hidden, estimationRule: 'MAX' } as SessionState, withMax, 'fr')).toBe(
      'Votes révélés. Moyenne 6,3. Plus votée 5, 2 votes. Min 2, max 13. Proposition (la plus grande) 13. ' +
        'Écart trop grand : Léa (2) et Max (13) expliquent leur vote, puis revotez.',
    );
    // Plusieurs votes égaux au min : tous nommés, dans l'ordre de la table.
    const [lea, max, nina, omar] = state.participants;
    const twice = { ...state, participants: [lea, max, { ...nina, vote: '2' }, omar] } as SessionState;
    expect(spreadVoters(twice)).toBe('Léa (2), Max (13) et Nina (2)');
    // Ma place remonte en tête de la table.
    expect(spreadVoters({ ...twice, selfParticipantId: nina.participantId })).toBe('Nina (2), Léa (2) et Max (13)');
    // Pas d'écart trop grand : personne.
    expect(spreadVoters(revealedMedian as SessionState)).toBeNull();
    expect(spreadVoters(hidden)).toBeNull();
    expect(spreadMessage(null)).toBe(
      'Écart trop grand : ceux qui ont voté le min et le max expliquent leur vote, puis revotez',
    );
  });

  it('announces a reveal and a new round, whoever made them, and nothing else', () => {
    const hidden = { ...(revealedTie as SessionState), round: { ...revealedTie.round, status: 'HIDDEN' }, summary: null } as SessionState;
    expect(announcementFor(null, revealedTie as SessionState, 'fr')).toBeNull();
    expect(announcementFor(hidden, revealedTie as SessionState, 'fr')).toBe(
      'Votes révélés. Moyenne 6,5. Plus votée 5 et 8, 2 votes chacune. Min 5, max 8. Proposition (la plus grande) 8.',
    );
    expect(announcementFor(revealedTie as SessionState, newRound as SessionState, 'fr')).toBe(NEW_ROUND_ANNOUNCEMENT);
    expect(NEW_ROUND_ANNOUNCEMENT).toBe('Nouveau tour');
    // Un vote, une présence, un tour révélé qui reste révélé : rien.
    expect(announcementFor(hiddenRound as SessionState, { ...(hiddenRound as SessionState), version: 8 }, 'fr')).toBeNull();
    expect(announcementFor(revealedTie as SessionState, revealedObserver as SessionState, 'fr')).toBeNull();
    // Masquer (même tour, revenu caché) : rien, la table suffit.
    expect(
      announcementFor(
        revealedTie as SessionState,
        { ...hidden, version: revealedTie.version + 1, lastChange: { action: 'HIDE', byParticipantId: revealedTie.participants[1].participantId } },
        'fr',
      ),
    ).toBeNull();
  });

  it('announces each new participant other than me, never on the first snapshot', () => {
    const state = hiddenRound as SessionState;
    const [alice, bob, chloe] = state.participants;
    const before = { ...state, participants: [alice, bob] };
    const sofia = { ...chloe, participantId: 'aa0b5d3e-6f2a-4b1c-9d7e-5a4f3b2c1d06', pseudo: 'Sofia' };
    expect(arrivalAnnouncements(null, state)).toEqual([]);
    expect(arrivalAnnouncements(before, { ...before, participants: [alice, bob, sofia] })).toEqual([
      'Sofia a rejoint la session',
    ]);
    expect(arrivalAnnouncements(before, { ...before, participants: [alice, bob, chloe, sofia] })).toEqual([
      'Chloé a rejoint la session',
      'Sofia a rejoint la session',
    ]);
    // Moi : jamais annoncé.
    expect(arrivalAnnouncements({ ...state, participants: [bob] }, { ...state, participants: [alice, bob] })).toEqual([]);
    // Un départ, un vote : rien.
    expect(arrivalAnnouncements(state, { ...state, participants: [alice, bob] })).toEqual([]);
    expect(arrivalAnnouncements(state, { ...state, version: 8 })).toEqual([]);
  });
});

describe('ResultPanelComponent', () => {
  function render(summary: Summary | null, spreadVoters: string | null = null, rule: EstimationRule | null = null) {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'fr' }] });
    const fixture = TestBed.createComponent(ResultPanelComponent);
    fixture.componentRef.setInput('summary', summary);
    fixture.componentRef.setInput('spreadVoters', spreadVoters);
    fixture.componentRef.setInput('estimationRule', rule);
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

  it('sizes: no « Moyenne », a tie of sizes with « chacune »', () => {
    const { element, text } = render(summaryOf(revealedTshirt));
    expect(element.querySelector('.result-average')).toBeNull();
    expect(text('.result-most-voted')).toBe('Plus votée M et L · 2 votes chacune');
    expect(text('.result-min')).toBe('Min M');
    expect(text('.result-max')).toBe('Max L');
    expect(element.querySelector('.result-none')).toBeNull();
  });

  it('the half point reads « 0,5 » in the numbers', () => {
    const half: Summary = {
      ...mockup,
      average: 0.8,
      mostVoted: { values: ['0.5', '1'], count: 1 },
      min: '0.5',
      max: '1',
      proposal: '1',
    };
    const { text } = render(half);
    expect(text('.result-most-voted')).toBe('Plus votée 0,5 et 1 · 1 vote chacune');
    expect(text('.result-min')).toBe('Min 0,5');
  });

  it('the mockup: « 5,9 », « Plus votée 5 · 6 votes », « Min 3 », « Max 13 »', () => {
    const { text } = render(mockup);
    expect(text('.result-average .result-value')).toBe('5,9');
    expect(text('.result-most-voted')).toBe('Plus votée 5 · 6 votes');
    expect(text('.result-min')).toBe('Min 3');
    expect(text('.result-max')).toBe('Max 13');
  });

  it('a single vote: « 1 vote »', () => {
    const { text } = render({ ...mockup, average: 8, mostVoted: { values: ['8'], count: 1 }, min: '8', max: '8' });
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

  it('the proposal of the session, named after its rule: « Proposition (médiane) 5 » after the max', () => {
    const { element, text } = render(summaryOf(revealedMedian), null, 'MEDIAN');
    expect(text('.result-proposal')).toBe('Proposition (médiane) 5');
    expect(element.querySelector('.result-max + .result-proposal')).not.toBeNull();
    expect(element.querySelector('.result-spread')).toBeNull();
  });

  it('names each rule next to the proposal', () => {
    expect(proposalLabel('MAX')).toBe('Proposition (la plus grande)');
    expect(proposalLabel('MEDIAN')).toBe('Proposition (médiane)');
    expect(proposalLabel('BELOW_MAX')).toBe('Proposition (sous le max)');
    expect(proposalLabel(null)).toBe('Proposition');
    const { text } = render(summaryOf(revealedTie), null, 'MAX');
    expect(text('.result-proposal')).toBe('Proposition (la plus grande) 8');
    TestBed.resetTestingModule();
    expect(render(summaryOf(revealedTshirt), null, 'BELOW_MAX').text('.result-proposal')).toBe(
      'Proposition (sous le max) M',
    );
  });

  it('no proposal with the rule « Aucune »: neither « Proposition » nor « Écart trop grand »', () => {
    const { element } = render(summaryOf(revealedObserver));
    expect(element.querySelector('.result-proposal')).toBeNull();
    expect(element.querySelector('.result-spread')).toBeNull();
    expect(element.textContent).not.toContain('Proposition');
  });

  it('a spread too wide: no proposal, the voters of the min and the max explain their vote', () => {
    const { element, text } = render(summaryOf(revealedSpread), 'Léa (2) et Max (13)');
    expect(element.querySelector('.result-proposal')).toBeNull();
    expect(text('.result-spread')).toBe('Écart trop grand : Léa (2) et Max (13) expliquent leur vote, puis revotez');
    expect(text('.result-min')).toBe('Min 2');
    expect(text('.result-max')).toBe('Max 13');
  });

  it('a spread too wide with another rule: the proposal and the voters of the min and the max', () => {
    const spreadMax: Summary = { ...summaryOf(revealedSpread)!, proposal: '13' };
    const { text } = render(spreadMax, 'Léa (2) et Max (13)', 'MAX');
    expect(text('.result-proposal')).toBe('Proposition (la plus grande) 13');
    expect(text('.result-spread')).toBe('Écart trop grand : Léa (2) et Max (13) expliquent leur vote, puis revotez');
    TestBed.resetTestingModule();
    const { element, text: noneText } = render(summaryOf(revealedSpread), 'Léa (2) et Max (13)', 'NONE');
    expect(element.querySelector('.result-proposal')).toBeNull();
    expect(noneText('.result-spread')).toBe('Écart trop grand : Léa (2) et Max (13) expliquent leur vote, puis revotez');
  });

  it('without a numeric vote: only « Pas de résultat chiffré »', () => {
    const { element, text } = render(summaryOf(revealedNoNumeric));
    expect(text('.result-panel')).toBe('Pas de résultat chiffré');
    expect(element.querySelector('.result-stat')).toBeNull();
    expect(element.querySelector('.consensus-badge')).toBeNull();
  });
});

describe('ResultLineComponent (phone)', () => {
  function render(summary: Summary | null, spreadVoters: string | null = null) {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'fr' }] });
    const fixture = TestBed.createComponent(ResultLineComponent);
    fixture.componentRef.setInput('summary', summary);
    fixture.componentRef.setInput('spreadVoters', spreadVoters);
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

  it('sizes: no average, but the most voted, min and max', () => {
    const { element, text } = render(summaryOf(revealedTshirt));
    expect(element.querySelector('.result-line-average')).toBeNull();
    expect(text('.result-line-most-voted')).toBe('Plus votée M et L (2)');
    expect(text('.result-line-min')).toBe('Min M');
    expect(text('.result-line-max')).toBe('Max L');
  });

  it('the proposal after the max: « · Proposition 5 »', () => {
    const { element, text } = render(summaryOf(revealedMedian));
    expect(text('.result-line-proposal')).toBe('Proposition 5');
    expect(element.querySelector('.result-line-max + .result-line-proposal')).not.toBeNull();
    expect(element.querySelector('.result-line-spread')).toBeNull();
  });

  it('no proposal with the rule « Aucune »', () => {
    const { element } = render(summaryOf(revealedObserver));
    expect(element.querySelector('.result-line-proposal')).toBeNull();
    expect(element.querySelector('.result-line-spread')).toBeNull();
  });

  it('a spread too wide: the message under the line', () => {
    const { element, text } = render(summaryOf(revealedSpread), 'Léa (2) et Max (13)');
    expect(element.querySelector('.result-line-proposal')).toBeNull();
    expect(text('.result-line-spread')).toBe(
      'Écart trop grand : Léa (2) et Max (13) expliquent leur vote, puis revotez',
    );
  });

  it('a spread too wide with another rule: the proposal on the line, the message under it', () => {
    const spreadBelowMax: Summary = { ...summaryOf(revealedSpread)!, proposal: '8' };
    const { text } = render(spreadBelowMax, 'Léa (2) et Max (13)');
    expect(text('.result-line-proposal')).toBe('Proposition 8');
    expect(text('.result-line-spread')).toBe(
      'Écart trop grand : Léa (2) et Max (13) expliquent leur vote, puis revotez',
    );
  });

  it('without a numeric vote: only « Pas de résultat chiffré »', () => {
    const { element, text } = render(summaryOf(revealedNoNumeric));
    expect(text('.result-line')).toBe('Pas de résultat chiffré');
    expect(element.querySelector('.result-line-item')).toBeNull();
  });
});
