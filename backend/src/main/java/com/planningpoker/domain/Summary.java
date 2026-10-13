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
 *
 * @param average   moyenne arrondie au dixième ({@code HALF_UP} : 5,25 donne 5,3), échelle 1 ; nulle pour des tailles
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
        return new Summary(average, new MostVoted(tied, top), min, max, consensus);
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
