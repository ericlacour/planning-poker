package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

/** Jeu de cartes d'une session : famille, cartes retenues, ordre canonique. */
class DeckTest {

    private static Deck of(String type, String... cards) {
        return Deck.of(type, Arrays.asList(cards));
    }

    @Test
    void theStandardDeckIsTheWholeFibonacciSuite() {
        assertThat(Deck.standard().type()).isEqualTo(DeckType.FIBONACCI);
        assertThat(Deck.standard().cards().stream().map(Card::value))
                .containsExactly("0", "0.5", "1", "3", "5", "8", "13", "21", "?", "coffee");
    }

    @Test
    void theTshirtFamilyListsEverySize() {
        assertThat(DeckType.TSHIRT.cards().stream().map(Card::value))
                .containsExactly("XXS", "XS", "S", "M", "L", "XL", "XXL");
    }

    @Test
    void aSubsetKeepsTheOrderOfTheFamilyWhateverTheOrderRequested() {
        Deck deck = of("FIBONACCI", "coffee", "8", "1", "?");
        assertThat(deck.cards()).containsExactly(Card.ONE, Card.EIGHT, Card.UNKNOWN, Card.COFFEE);
        assertThat(of("TSHIRT", "XL", "S").cards()).containsExactly(Card.S, Card.XL);
    }

    @Test
    void aDeckContainsOnlyItsCards() {
        Deck deck = of("FIBONACCI", "1", "3");
        assertThat(deck.contains(Card.ONE)).isTrue();
        assertThat(deck.contains(Card.FIVE)).isFalse();
        assertThat(deck.contains(Card.M)).isFalse();
    }

    @Test
    void theDeckCardsAreImmutable() {
        Deck deck = of("TSHIRT", "S", "M");
        assertThatThrownBy(() -> deck.cards().add(Card.L)).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void refusesAnUnknownFamilyOrCard() {
        assertThatThrownBy(() -> of("EMOJI", "S", "M")).isInstanceOf(InvalidDeckException.class);
        assertThatThrownBy(() -> of("fibonacci", "1", "3")).isInstanceOf(InvalidDeckException.class);
        assertThatThrownBy(() -> of("FIBONACCI", "1", "7")).isInstanceOf(InvalidDeckException.class);
        assertThatThrownBy(() -> Deck.of("TSHIRT", Arrays.asList("S", null))).isInstanceOf(InvalidDeckException.class);
    }

    @Test
    void refusesACardOfAnotherFamily() {
        assertThatThrownBy(() -> of("FIBONACCI", "1", "M")).isInstanceOf(InvalidDeckException.class);
        assertThatThrownBy(() -> of("TSHIRT", "S", "5")).isInstanceOf(InvalidDeckException.class);
    }

    @Test
    void refusesACardTheFamilyDoesNotOffer() {
        // Le « 2 » existe dans le contrat mais n'est dans aucune famille.
        assertThatThrownBy(() -> of("FIBONACCI", "1", "2")).isInstanceOf(InvalidDeckException.class);
    }

    @Test
    void refusesDuplicatesAndFewerThanTwoCards() {
        assertThatThrownBy(() -> of("TSHIRT", "S", "S", "M")).isInstanceOf(InvalidDeckException.class);
        assertThatThrownBy(() -> of("TSHIRT", "S")).isInstanceOf(InvalidDeckException.class);
        assertThatThrownBy(() -> Deck.of("TSHIRT", List.of())).isInstanceOf(InvalidDeckException.class);
        assertThatThrownBy(() -> Deck.of(null, List.of("S", "M"))).isInstanceOf(InvalidDeckException.class);
        assertThatThrownBy(() -> Deck.of("TSHIRT", null)).isInstanceOf(InvalidDeckException.class);
    }

    @Test
    void twoCardsAreEnough() {
        assertThat(of("FIBONACCI", "?", "coffee").cards()).hasSize(2);
    }
}
