import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';

import { Card, SessionState, Summary } from '../api/contract';
import { cardText } from './cards';

/** Moyenne au format de la langue de l'interface (`fr` : « 5,9 », « 6,5 », « 3 »). */
export function formatAverage(average: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(average);
}

/** « 5 », « 5 et 8 », « 3, 5 et 8 », « M et L » : les valeurs à égalité, dans l'ordre reçu (ordre du jeu). */
export function joinValues(values: readonly Card[]): string {
  const texts = values.map(cardText);
  if (texts.length <= 1) return texts.join('');
  return `${texts.slice(0, -1).join(', ')} et ${texts[texts.length - 1]}`;
}

/** « 1 vote », « 6 votes », et pour une égalité « 1 vote chacune », « 3 votes chacune ». */
export function votesCount(count: number, tie: boolean): string {
  return `${count} ${count > 1 ? 'votes' : 'vote'}${tie ? ' chacune' : ''}`;
}

/**
 * Vrai si la synthèse porte au moins un vote qui compte (chiffre ou taille). La moyenne, elle, manque pour des
 * tailles : elle est facultative.
 */
export function hasResult(summary: Summary): boolean {
  return summary.mostVoted !== null && summary.min !== null && summary.max !== null;
}

/**
 * Annonce d'une révélation pour la région `aria-live` : « Votes révélés. Moyenne 5,9. Plus votée 5, 6 votes.
 * Min 3, max 13. », avec « Consensus ! » à la fin s'il y a consensus, ou « Votes révélés. Pas de résultat chiffré. ».
 * Des tailles n'ont pas de moyenne : l'annonce la saute.
 */
export function revealAnnouncement(summary: Summary | null, locale: string): string {
  if (!summary || !hasResult(summary)) return 'Votes révélés. Pas de résultat chiffré.';
  const mostVoted = summary.mostVoted!;
  const tie = mostVoted.values.length > 1;
  return [
    'Votes révélés.',
    ...(summary.average === null ? [] : [`Moyenne ${formatAverage(summary.average, locale)}.`]),
    `Plus votée ${joinValues(mostVoted.values)}, ${votesCount(mostVoted.count, tie)}.`,
    `Min ${cardText(summary.min!)}, max ${cardText(summary.max!)}.`,
    ...(summary.consensus ? ['Consensus !'] : []),
  ].join(' ');
}

/**
 * « Plus votée » condensé du téléphone : « 5 (6) », « 5 et 8 (2) » ; le nombre de votes entre parenthèses, tel
 * que reçu.
 */
export function compactMostVoted(mostVoted: { readonly values: readonly Card[]; readonly count: number }): string {
  return `${joinValues(mostVoted.values)} (${mostVoted.count})`;
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
 * Annonces d'arrivée en passant de `previous` à `next` : « {pseudo} a rejoint la session » pour chaque
 * `participantId` absent de `previous`, autre que moi, dans l'ordre de l'instantané ; aucune pour le premier
 * instantané (`previous` à `null`).
 */
export function arrivalAnnouncements(previous: SessionState | null, next: SessionState): string[] {
  if (!previous) return [];
  const known = new Set(previous.participants.map((p) => p.participantId));
  return next.participants
    .filter((p) => p.participantId !== next.selfParticipantId && !known.has(p.participantId))
    .map((p) => `${p.pseudo} a rejoint la session`);
}

/**
 * Panneau de résultat (`result-panel`, `consensus-badge`) : affichage pur de la synthèse reçue, sans aucun calcul.
 * Moyenne au format français (absente pour des tailles), badge « Consensus ! », « Plus votée », « Min », « Max » ;
 * sans vote qui compte, « Pas de résultat chiffré ».
 */
@Component({
  selector: 'app-result-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="result-panel" role="group" aria-label="Résultat">
      @if (numbers(); as n) {
        @if (n.average !== null) {
          <div class="result-stat result-average">
            <span class="result-label">Moyenne</span>{{ ' ' }}<span class="result-value">{{ n.average }}</span>
          </div>
        }
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
    if (!summary || !hasResult(summary)) return null;
    const mostVoted = summary.mostVoted!;
    return {
      average: summary.average === null ? null : formatAverage(summary.average, this.locale),
      consensus: summary.consensus,
      mostVoted: joinValues(mostVoted.values),
      count: votesCount(mostVoted.count, mostVoted.values.length > 1),
      min: cardText(summary.min!),
      max: cardText(summary.max!),
    };
  });
}

/**
 * Résultat condensé du téléphone (`result-panel` < 600 px) : « Moy. 5,9 · Plus votée 5 (6) · Min 3 · Max 13 »,
 * badge « Consensus ! » à côté de la moyenne. Affichage pur de la synthèse reçue. Si la ligne déborde, elle passe
 * sur deux lignes : la moyenne et le badge, puis le reste (les séparateurs « · » en début de ligne sont rognés par
 * la feuille de style). Sans vote numérique : « Pas de résultat chiffré ».
 */
@Component({
  selector: 'app-result-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="result-line" role="group" aria-label="Résultat">
      @if (numbers(); as n) {
        <p class="result-line-items">
          @if (n.average !== null) {
            <span class="result-line-item result-line-average"
              >Moy.{{ ' ' }}<span class="result-line-value">{{ n.average }}</span></span
            >
          }
          @if (n.consensus) {
            <span class="result-line-item result-line-badge"><span class="consensus-badge">Consensus !</span></span>
          }
          <span class="result-line-rest">
            <span class="result-line-item result-line-most-voted">Plus votée {{ n.mostVoted }}</span>
            <span class="result-line-item result-line-min">Min {{ n.min }}</span>
            <span class="result-line-item result-line-max">Max {{ n.max }}</span>
          </span>
        </p>
      } @else {
        <p class="result-none">Pas de résultat chiffré</p>
      }
    </div>
  `,
})
export class ResultLineComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly summary = input.required<Summary | null>();

  protected readonly numbers = computed(() => {
    const summary = this.summary();
    if (!summary || !hasResult(summary)) return null;
    return {
      average: summary.average === null ? null : formatAverage(summary.average, this.locale),
      consensus: summary.consensus,
      mostVoted: compactMostVoted(summary.mostVoted!),
      min: cardText(summary.min!),
      max: cardText(summary.max!),
    };
  });
}
