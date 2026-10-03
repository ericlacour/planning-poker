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
 * l'affiche sans rien recalculer. Seules les cartes numériques comptent ({@code ?} et {@code coffee} exclues) ; sans
 * vote numérique, tout est nul et il n'y a pas de consensus.
 *
 * @param average   moyenne arrondie au dixième ({@code HALF_UP} : 5,25 donne 5,3), échelle 1
 * @param mostVoted valeurs les plus votées, toutes celles à égalité, dans l'ordre du jeu
 * @param consensus vrai si au moins deux votes numériques, tous identiques
 */
public record Summary(BigDecimal average, MostVoted mostVoted, Card min, Card max, boolean consensus) {

    /** Aucun vote numérique. */
    public static final Summary EMPTY = new Summary(null, null, null, null, false);

    /** @param count nombre de votes de chacune de ces valeurs */
    public record MostVoted(List<Card> values, int count) {
        public MostVoted {
            values = List.copyOf(values);
        }
    }

    public static Summary of(Collection<Card> votes) {
        Objects.requireNonNull(votes, "votes");
        List<Card> numeric = votes.stream().filter(Card::isNumeric).toList();
        if (numeric.isEmpty()) {
            return EMPTY;
        }
        BigDecimal sum = numeric.stream()
                .map(card -> BigDecimal.valueOf(card.numericValue().getAsInt()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal average = sum.divide(BigDecimal.valueOf(numeric.size()), 1, RoundingMode.HALF_UP);

        Map<Card, Integer> counts = new EnumMap<>(Card.class);
        numeric.forEach(card -> counts.merge(card, 1, Integer::sum));
        int top = counts.values().stream().mapToInt(Integer::intValue).max().orElseThrow();
        List<Card> tied = counts.entrySet().stream().filter(e -> e.getValue() == top).map(Map.Entry::getKey)
                .toList();

        Comparator<Card> byValue = Comparator.comparingInt(card -> card.numericValue().getAsInt());
        Card min = numeric.stream().min(byValue).orElseThrow();
        Card max = numeric.stream().max(byValue).orElseThrow();
        boolean consensus = numeric.size() >= 2 && counts.size() == 1;
        return new Summary(average, new MostVoted(tied, top), min, max, consensus);
    }
}
