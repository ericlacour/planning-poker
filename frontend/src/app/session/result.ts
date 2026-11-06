import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';

import { Card, EstimationRule, SessionState, Summary } from '../api/contract';
import { cardText } from './cards';
import { seatsOf } from './participant-table.component';

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

/** « Léa, Paul et Max » : des noms joints par des virgules, le dernier par « et ». */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

/**
 * « Léa (2) et Max (13) » : les pseudos de ceux dont le vote est égal au min ou au max de la synthèse, chacun avec
 * son vote, dans l'ordre de la table ; `null` si l'écart n'est pas trop grand. Le min et le max viennent du
 * webservice : rien n'est recalculé.
 */
export function spreadVoters(state: SessionState): string | null {
  const summary = state.summary;
  if (!summary?.spreadTooWide || summary.min === null || summary.max === null) return null;
  const extremes: readonly Card[] = [summary.min, summary.max];
  const names = seatsOf(state)
    .map((seat) => seat.participant)
    .filter((p) => p.vote !== null && extremes.includes(p.vote))
    .map((p) => `${p.pseudo} (${cardText(p.vote!)})`);
  return names.length === 0 ? null : joinNames(names);
}

/**
 * « Écart trop grand : Léa (2) et Max (13) expliquent leur vote, puis revotez » ; sans les pseudos (inconnus),
 * « Écart trop grand : ceux qui ont voté le min et le max expliquent leur vote, puis revotez ».
 */
export function spreadMessage(voters: string | null): string {
  return `Écart trop grand : ${voters ?? 'ceux qui ont voté le min et le max'} expliquent leur vote, puis revotez`;
}

/** Nom de la règle de la session, accolé à la proposition : `médiane`, `la plus grande`, `sous le max`. */
const RULE_NAMES: Readonly<Record<EstimationRule, string | null>> = {
  NONE: null,
  MAX: 'la plus grande',
  MEDIAN: 'médiane',
  BELOW_MAX: 'sous le max',
};

/** « Proposition (médiane) » ; « Proposition » seul si la règle n'est pas connue. */
export function proposalLabel(rule: EstimationRule | null): string {
  const name = rule === null ? null : RULE_NAMES[rule];
  return name === null ? 'Proposition' : `Proposition (${name})`;
}

/**
 * Annonce d'une révélation pour la région `aria-live` : « Votes révélés. Moyenne 5,9. Plus votée 5, 6 votes.
 * Min 3, max 13. », avec « Consensus ! » s'il y a consensus, puis « Proposition (médiane) 8. » s'il y a une
 * proposition (avec le nom de la règle de la session), ou
 * « Écart trop grand : … puis revotez. » ; sans vote qui compte, « Votes révélés. Pas de résultat chiffré. ».
 * Des tailles n'ont pas de moyenne : l'annonce la saute.
 */
export function revealAnnouncement(
  summary: Summary | null,
  locale: string,
  voters: string | null = null,
  rule: EstimationRule | null = null,
): string {
  if (!summary || !hasResult(summary)) return 'Votes révélés. Pas de résultat chiffré.';
  const mostVoted = summary.mostVoted!;
  const tie = mostVoted.values.length > 1;
  return [
    'Votes révélés.',
    ...(summary.average === null ? [] : [`Moyenne ${formatAverage(summary.average, locale)}.`]),
    `Plus votée ${joinValues(mostVoted.values)}, ${votesCount(mostVoted.count, tie)}.`,
    `Min ${cardText(summary.min!)}, max ${cardText(summary.max!)}.`,
    ...(summary.consensus ? ['Consensus !'] : []),
    ...(summary.proposal === null ? [] : [`${proposalLabel(rule)} ${cardText(summary.proposal)}.`]),
    ...(summary.spreadTooWide ? [`${spreadMessage(voters)}.`] : []),
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
    return revealAnnouncement(next.summary, locale, spreadVoters(next), next.estimationRule);
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
 * Moyenne au format français (absente pour des tailles), badge « Consensus ! », « Plus votée », « Min », « Max »,
 * puis « Proposition (médiane) » (avec le nom de la règle de la session) si elle en donne une, ou « Écart trop
 * grand : … » quand la médiane n'est pas proposée ; sans vote qui compte, « Pas de résultat chiffré ».
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
        @if (n.proposal !== null) {
          <div class="result-stat result-proposal">
            <span class="result-label">{{ n.proposalLabel }}</span>{{ ' ' }}<span class="result-value">{{
              n.proposal
            }}</span>
          </div>
        }
        @if (n.spread !== null) {
          <p class="result-spread">{{ n.spread }}</p>
        }
      } @else {
        <p class="result-none">Pas de résultat chiffré</p>
      }
    </div>
  `,
})
export class ResultPanelComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly summary = input.required<Summary | null>();
  /** « Léa (2) et Max (13) » : qui explique son vote quand l'écart est trop grand ({@link spreadVoters}). */
  readonly spreadVoters = input<string | null>(null);
  /** Règle de la session, nommée à côté de la proposition : « Proposition (médiane) ». */
  readonly estimationRule = input<EstimationRule | null>(null);

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
      ...proposalOf(summary, this.spreadVoters()),
      proposalLabel: proposalLabel(this.estimationRule()),
    };
  });
}

/** Proposition et message d'écart trop grand, tels que reçus. */
function proposalOf(summary: Summary, voters: string | null): { proposal: string | null; spread: string | null } {
  return {
    proposal: summary.proposal === null ? null : cardText(summary.proposal),
    spread: summary.spreadTooWide ? spreadMessage(voters) : null,
  };
}

/**
 * Résultat condensé du téléphone (`result-panel` < 600 px) : « Moy. 5,9 · Plus votée 5 (6) · Min 3 · Max 13 »,
 * puis « · Proposition 8 » s'il y en a une, badge « Consensus ! » à côté de la moyenne ; « Écart trop grand : … »
 * en dessous quand la médiane n'est pas proposée. Affichage pur de la synthèse reçue. Si la ligne déborde, elle passe
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
            @if (n.proposal !== null) {
              <span class="result-line-item result-line-proposal">Proposition {{ n.proposal }}</span>
            }
          </span>
        </p>
        @if (n.spread !== null) {
          <p class="result-line-spread">{{ n.spread }}</p>
        }
      } @else {
        <p class="result-none">Pas de résultat chiffré</p>
      }
    </div>
  `,
})
export class ResultLineComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly summary = input.required<Summary | null>();
  /** « Léa (2) et Max (13) » : qui explique son vote quand l'écart est trop grand ({@link spreadVoters}). */
  readonly spreadVoters = input<string | null>(null);

  protected readonly numbers = computed(() => {
    const summary = this.summary();
    if (!summary || !hasResult(summary)) return null;
    return {
      average: summary.average === null ? null : formatAverage(summary.average, this.locale),
      consensus: summary.consensus,
      mostVoted: compactMostVoted(summary.mostVoted!),
      min: cardText(summary.min!),
      max: cardText(summary.max!),
      ...proposalOf(summary, this.spreadVoters()),
    };
  });
}
