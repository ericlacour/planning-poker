package com.planningpoker.domain;

import java.util.Arrays;
import java.util.Optional;

/** Une carte du jeu ({@code card.json}). Seul le front affiche {@code coffee} en ☕. */
public enum Card {
    ZERO("0"),
    ONE("1"),
    TWO("2"),
    THREE("3"),
    FIVE("5"),
    EIGHT("8"),
    THIRTEEN("13"),
    TWENTY_ONE("21"),
    UNKNOWN("?"),
    COFFEE("coffee");

    private final String value;

    Card(String value) {
        this.value = value;
    }

    /** Valeur échangée dans le contrat. */
    public String value() {
        return value;
    }

    /** La carte de cette valeur, si elle fait partie du jeu (comparaison exacte). */
    public static Optional<Card> of(String value) {
        return Arrays.stream(values()).filter(c -> c.value.equals(value)).findFirst();
    }
}
