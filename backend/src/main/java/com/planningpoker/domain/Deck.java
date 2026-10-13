package com.planningpoker.domain;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Jeu de cartes d'une session, choisi à la création et figé ensuite : une famille ({@link DeckType}) et les cartes
 * retenues parmi les siennes, toujours dans l'ordre de la famille, quel que soit l'ordre demandé.
 *
 * @param cards au moins {@value #MIN_CARDS} cartes distinctes, toutes de la famille
 */
public record Deck(DeckType type, List<Card> cards) {

    public static final int MIN_CARDS = 2;

    public Deck {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(cards, "cards");
        Set<Card> requested = new HashSet<>(cards);
        if (requested.size() != cards.size()) {
            throw new InvalidDeckException("duplicate card");
        }
        if (!type.cards().containsAll(requested)) {
            throw new InvalidDeckException("card outside of " + type);
        }
        if (requested.size() < MIN_CARDS) {
            throw new InvalidDeckException("at least " + MIN_CARDS + " cards required");
        }
        cards = type.cards().stream().filter(requested::contains).toList();
    }

    /** Le jeu proposé par défaut : toute la suite de Fibonacci. */
    public static Deck standard() {
        return new Deck(DeckType.FIBONACCI, DeckType.FIBONACCI.cards());
    }

    /**
     * Le jeu demandé par un client.
     *
     * @throws InvalidDeckException si la famille ou une carte est inconnue, ou si le jeu est invalide
     */
    public static Deck of(String type, List<String> values) {
        if (type == null || values == null) {
            throw new InvalidDeckException("missing field");
        }
        DeckType deckType;
        try {
            deckType = DeckType.valueOf(type);
        } catch (IllegalArgumentException e) {
            throw new InvalidDeckException("unknown deck type");
        }
        List<Card> cards = values.stream()
                .map(value -> value == null ? null : Card.of(value).orElse(null))
                .toList();
        if (cards.contains(null)) {
            throw new InvalidDeckException("unknown card");
        }
        return new Deck(deckType, cards);
    }

    public boolean contains(Card card) {
        return cards.contains(card);
    }
}
