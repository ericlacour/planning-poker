package com.planningpoker.domain;

import java.util.List;

/** Famille de jeux proposée à la création d'une session, avec toutes ses cartes dans l'ordre du jeu. */
public enum DeckType {
    /** Suite de Fibonacci, avec {@code ?} et la pause café. */
    FIBONACCI(List.of(Card.ZERO, Card.HALF, Card.ONE, Card.THREE, Card.FIVE, Card.EIGHT, Card.THIRTEEN,
            Card.TWENTY_ONE, Card.UNKNOWN, Card.COFFEE)),
    /** Tailles de tee-shirt. */
    TSHIRT(List.of(Card.XXS, Card.XS, Card.S, Card.M, Card.L, Card.XL, Card.XXL));

    private final List<Card> cards;

    DeckType(List<Card> cards) {
        this.cards = cards;
    }

    /** Toutes les cartes de la famille, dans l'ordre du jeu. */
    public List<Card> cards() {
        return cards;
    }
}
