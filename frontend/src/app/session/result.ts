import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';

import { Card, SessionState, Summary } from '../api/contract';

/** Moyenne au format de la langue de l'interface (`fr` : « 5,9 », « 6,5 », « 3 »). */
export function formatAverage(average: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(average);
}

/** « 5 », « 5 et 8 », « 3, 5 et 8 » : les valeurs à égalité, dans l'ordre reçu (ordre du jeu). */
export function joinValues(values: readonly Card[]): string {
  if (values.length <= 1) return values.join('');
  return `${values.slice(0, -1).join(', ')} et ${values[values.length - 1]}`;
}

/** « 1 vote », « 6 votes », et pour une égalité « 1 vote chacune », « 3 votes chacune ». */
export function votesCount(count: number, tie: boolean): string {
  return `${count} ${count > 1 ? 'votes' : 'vote'}${tie ? ' chacune' : ''}`;
}

/** Vrai si la synthèse porte au moins un vote numérique. */
export function hasNumbers(summary: Summary): boolean {
  return summary.average !== null && summary.mostVoted !== null && summary.min !== null && summary.max !== null;
}

/**
 * Annonce d'une révélation pour la région `aria-live` : « Votes révélés. Moyenne 5,9. Plus votée 5, 6 votes.
 * Min 3, max 13. », avec « Consensus ! » à la fin s'il y a consensus, ou « Votes révélés. Pas de résultat chiffré. ».
 */
export function revealAnnouncement(summary: Summary | null, locale: string): string {
  if (!summary || !hasNumbers(summary)) return 'Votes révélés. Pas de résultat chiffré.';
  const mostVoted = summary.mostVoted!;
  const tie = mostVoted.values.length > 1;
  return [
    'Votes révélés.',
    `Moyenne ${formatAverage(summary.average!, locale)}.`,
    `Plus votée ${joinValues(mostVoted.values)}, ${votesCount(mostVoted.count, tie)}.`,
    `Min ${summary.min}, max ${summary.max}.`,
    ...(summary.consensus ? ['Consensus !'] : []),
  ].join(' ');
}

/** Annonce d'un effacement (nouveau tour). */
export const NEW_ROUND_ANNOUNCEMENT = 'Nouveau tour';

/**
 * Annonce à faire en passant de `previous` à `next` : une révélation (même tour, caché puis révélé) ou un nouveau
 * tour (`roundId` changé), quel qu'en soit l'auteur ; `null` sinon, et pour le premier instantané.
 */
export function announcementFor(previous: SessionState | null, next: SessionState, locale: string): string | null {
  if (!previous) return null;
  if (previous.round.roundId !== next.round.roundId) return NEW_ROUND_ANNOUNCEMENT;
  if (previous.round.status === 'HIDDEN' && next.round.status === 'REVEALED') {
    return revealAnnouncement(next.summary, locale);
  }
  return null;
}

/**
 * Panneau de résultat (`result-panel`, `consensus-badge`) : affichage pur de la synthèse reçue, sans aucun calcul.
 * Moyenne au format français, badge « Consensus ! », « Plus votée », « Min », « Max » ; sans vote numérique,
 * « Pas de résultat chiffré ».
 */
@Component({
  selector: 'app-result-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="result-panel" role="group" aria-label="Résultat">
      @if (numbers(); as n) {
        <div class="result-stat result-average">
          <span class="result-label">Moyenne</span>{{ ' ' }}<span class="result-value">{{ n.average }}</span>
        </div>
        @if (n.consensus) {
          <span class="consensus-badge">Consensus !</span>
        }
        <div class="result-stat result-most-voted">
          <span class="result-label">Plus votée</span>{{ ' ' }}<span class="result-value"
            >{{ n.mostVoted }}{{ ' ' }}<span class="result-count">· {{ n.count }}</span></span
          >
        </div>
        <div class="result-stat result-min">
          <span class="result-label">Min</span>{{ ' ' }}<span class="result-value">{{ n.min }}</span>
        </div>
        <div class="result-stat result-max">
          <span class="result-label">Max</span>{{ ' ' }}<span class="result-value">{{ n.max }}</span>
        </div>
      } @else {
        <p class="result-none">Pas de résultat chiffré</p>
      }
    </div>
  `,
})
export class ResultPanelComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly summary = input.required<Summary | null>();

  protected readonly numbers = computed(() => {
    const summary = this.summary();
    if (!summary || !hasNumbers(summary)) return null;
    const mostVoted = summary.mostVoted!;
    return {
      average: formatAverage(summary.average!, this.locale),
      consensus: summary.consensus,
      mostVoted: joinValues(mostVoted.values),
      count: votesCount(mostVoted.count, mostVoted.values.length > 1),
      min: summary.min,
      max: summary.max,
    };
  });
}
