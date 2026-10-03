package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;

/** Synthèse d'un tour révélé (FR-14) : cartes numériques seules, moyenne au dixième en {@code HALF_UP}. */
class SummaryTest {

    private static Summary of(String... cards) {
        return Summary.of(Arrays.stream(cards).map(c -> Card.of(c).orElseThrow()).toList());
    }

    @Test
    void theAverageIsRoundedHalfUpToOneDecimal() {
        // La carte 6 n'est pas dans le jeu : 5,25 (21 / 4) s'obtient avec 3, 5, 5, 8.
        assertThat(of("3", "5", "5", "8").average()).isEqualTo(new BigDecimal("5.3"));
        // 2,25 (9 / 4) → 2,3 ; 1/3 → 0,3 ; 2/3 → 0,7 ; 44/7 = 6,285… → 6,3.
        assertThat(of("1", "2", "3", "3").average()).isEqualTo(new BigDecimal("2.3"));
        assertThat(of("0", "0", "1").average()).isEqualTo(new BigDecimal("0.3"));
        assertThat(of("0", "1", "1").average()).isEqualTo(new BigDecimal("0.7"));
        assertThat(of("3", "5", "8", "5", "5", "5", "13").average()).isEqualTo(new BigDecimal("6.3"));
    }

    @Test
    void aTieListsEveryValueInDeckOrder() {
        Summary summary = of("8", "5", "8", "5", "?");
        assertThat(summary.mostVoted()).isEqualTo(new Summary.MostVoted(List.of(Card.FIVE, Card.EIGHT), 2));
        assertThat(summary.min()).isEqualTo(Card.FIVE);
        assertThat(summary.max()).isEqualTo(Card.EIGHT);
        assertThat(summary.average()).isEqualTo(new BigDecimal("6.5"));
        assertThat(summary.consensus()).isFalse();
    }

    @Test
    void aSingleVote() {
        Summary summary = of("8");
        assertThat(summary.average()).isEqualByComparingTo("8");
        assertThat(summary.mostVoted()).isEqualTo(new Summary.MostVoted(List.of(Card.EIGHT), 1));
        assertThat(summary.min()).isEqualTo(Card.EIGHT);
        assertThat(summary.max()).isEqualTo(Card.EIGHT);
        assertThat(summary.consensus()).isFalse();
    }

    @Test
    void consensusIgnoresCoffeeAndQuestionMark() {
        Summary summary = of("3", "3", "coffee", "?");
        assertThat(summary.consensus()).isTrue();
        assertThat(summary.average()).isEqualByComparingTo("3");
        assertThat(summary.mostVoted()).isEqualTo(new Summary.MostVoted(List.of(Card.THREE), 2));
        assertThat(summary.min()).isEqualTo(Card.THREE);
        assertThat(summary.max()).isEqualTo(Card.THREE);
    }

    @Test
    void withoutANumericVoteEverythingIsNull() {
        assertThat(of("?", "coffee")).isEqualTo(new Summary(null, null, null, null, false));
        assertThat(of("?")).isEqualTo(Summary.EMPTY);
        assertThat(of()).isEqualTo(Summary.EMPTY);
    }

    @Test
    void zeroIsANumericCard() {
        Summary summary = of("0", "21");
        assertThat(summary.min()).isEqualTo(Card.ZERO);
        assertThat(summary.max()).isEqualTo(Card.TWENTY_ONE);
        assertThat(summary.average()).isEqualTo(new BigDecimal("10.5"));
        assertThat(of("0", "0").consensus()).isTrue();
    }

    @Test
    void minAndMaxCompareNumericallyNotAsText() {
        Summary summary = of("13", "2", "21", "3");
        assertThat(summary.min()).isEqualTo(Card.TWO);
        assertThat(summary.max()).isEqualTo(Card.TWENTY_ONE);
    }

    @Test
    void cardsKnowWhetherTheyAreNumeric() {
        assertThat(Card.UNKNOWN.isNumeric()).isFalse();
        assertThat(Card.COFFEE.isNumeric()).isFalse();
        assertThat(Card.THIRTEEN.numericValue()).hasValue(13);
    }
}
