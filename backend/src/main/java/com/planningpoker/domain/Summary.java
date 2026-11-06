package com.planningpoker.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Synthèse d'un tour révélé (FR-14, {@code session-state.json#/$defs/summary}), calculée ici seulement : le front
 * l'affiche sans rien recalculer. Seules les cartes numériques et les tailles comptent ({@code ?} et {@code coffee}
 * exclues) ; sans vote de cette sorte, tout est nul et il n'y a pas de consensus. Les tailles n'ont pas de moyenne.
 * La proposition suit la règle de la session ({@link EstimationRule}) ; un niveau est un pas entre deux cartes
 * classées du jeu de la session.
 *
 * @param average       moyenne arrondie au dixième ({@code HALF_UP} : 5,25 donne 5,3), échelle 1 ; nulle pour des
 *                      tailles
 * @param mostVoted     valeurs les plus votées, toutes celles à égalité, dans l'ordre du jeu
 * @param consensus     vrai si au moins deux votes numériques, tous identiques
 * @param proposal      carte proposée par la règle de la session ; nulle avec {@link EstimationRule#NONE}, sans vote
 *                      classé, ou quand l'écart est trop grand
 * @param spreadTooWide vrai, quelle que soit la règle, quand le minimum et le maximum sont à plus de
 *                      {@value #MAX_SPREAD_LEVELS} niveaux : ceux qui les ont votés expliquent leur vote ; la médiane
 *                      n'est alors pas proposée
 */
public record Summary(BigDecimal average, MostVoted mostVoted, Card min, Card max, boolean consensus, Card proposal,
        boolean spreadTooWide) {

    /**
     * Écart maximal, en niveaux du jeu, entre le minimum et le maximum ; au-delà, l'écart est trop grand (et la
     * médiane n'est pas proposée).
     */
    public static final int MAX_SPREAD_LEVELS = 3;

    /** Aucun vote numérique. */
    public static final Summary EMPTY = new Summary(null, null, null, null, false, null, false);

    /** @param count nombre de votes de chacune de ces valeurs */
    public record MostVoted(List<Card> values, int count) {
        public MostVoted {
            values = List.copyOf(values);
        }
    }

    /**
     * Synthèse sans proposition ({@link EstimationRule#NONE}), sur le jeu complet de la famille des votes (les
     * tailles si l'un d'eux en est une, Fibonacci sinon).
     */
    public static Summary of(Collection<Card> votes) {
        DeckType type = votes.stream().anyMatch(Card::isSize) ? DeckType.TSHIRT : DeckType.FIBONACCI;
        return of(votes, new Deck(type, type.cards()), EstimationRule.NONE);
    }

    /**
     * @param deck jeu de la session, qui contient tous les votes : il définit les niveaux
     * @param rule règle de proposition de la session
     */
    public static Summary of(Collection<Card> votes, Deck deck, EstimationRule rule) {
        Objects.requireNonNull(votes, "votes");
        Objects.requireNonNull(deck, "deck");
        Objects.requireNonNull(rule, "rule");
        List<Card> ranked = votes.stream().filter(Card::isRanked).toList();
        if (ranked.isEmpty()) {
            return EMPTY;
        }
        BigDecimal average = averageOf(ranked);

        Map<Card, Integer> counts = new EnumMap<>(Card.class);
        ranked.forEach(card -> counts.merge(card, 1, Integer::sum));
        int top = counts.values().stream().mapToInt(Integer::intValue).max().orElseThrow();
        List<Card> tied = counts.entrySet().stream().filter(e -> e.getValue() == top).map(Map.Entry::getKey)
                .toList();

        // L'ordre de déclaration de Card est l'ordre du jeu : il situe le minimum et le maximum, tailles comprises.
        Card min = ranked.stream().min(Comparator.naturalOrder()).orElseThrow();
        Card max = ranked.stream().max(Comparator.naturalOrder()).orElseThrow();
        boolean consensus = ranked.size() >= 2 && counts.size() == 1;
        List<Card> sorted = ranked.stream().sorted().toList();
        List<Card> levels = deck.cards().stream().filter(Card::isRanked).toList();
        boolean spreadTooWide = levelOf(levels, max) - levelOf(levels, min) > MAX_SPREAD_LEVELS;
        Card proposal = proposalOf(sorted, levels, rule, spreadTooWide);
        return new Summary(average, new MostVoted(tied, top), min, max, consensus, proposal, spreadTooWide);
    }

    /**
     * Carte proposée pour des votes classés triés (au moins un) ; nulle avec {@link EstimationRule#NONE}, et pour la
     * médiane quand l'écart est trop grand.
     *
     * @param levels cartes classées du jeu de la session, dans l'ordre
     */
    private static Card proposalOf(List<Card> sorted, List<Card> levels, EstimationRule rule,
            boolean spreadTooWide) {
        Card min = sorted.getFirst();
        Card max = sorted.getLast();
        if (rule == EstimationRule.NONE) {
            return null;
        }
        if (min == max) {
            return min;
        }
        return switch (rule) {
            case MAX -> max;
            // Pour un nombre pair de votes, la carte supérieure des deux du milieu.
            case MEDIAN -> spreadTooWide ? null : sorted.get(sorted.size() / 2);
            case BELOW_MAX -> levels.get(levelOf(levels, max) - 1);
            case NONE -> null;
        };
    }

    private static int levelOf(List<Card> levels, Card card) {
        int level = levels.indexOf(card);
        if (level < 0) {
            throw new IllegalArgumentException("vote outside of the deck: " + card.value());
        }
        return level;
    }

    /** Moyenne au dixième des cartes numériques ; nulle pour des tailles, qui n'ont pas de valeur. */
    private static BigDecimal averageOf(List<Card> ranked) {
        List<BigDecimal> values = ranked.stream().flatMap(card -> card.numericValue().stream()).toList();
        if (values.isEmpty()) {
            return null;
        }
        BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(values.size()), 1, RoundingMode.HALF_UP);
    }
}
