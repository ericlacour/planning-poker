package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/** Synthèse d'un tour révélé (FR-14) : cartes numériques seules, moyenne au dixième en {@code HALF_UP}. */
class SummaryTest {

    private static Summary of(String... cards) {
        return Summary.of(Arrays.stream(cards).map(c -> Card.of(c).orElseThrow()).toList());
    }

    private static Summary of(EstimationRule rule, String... cards) {
        return of(Deck.standard(), rule, cards);
    }

    private static Summary of(Deck deck, EstimationRule rule, String... cards) {
        return Summary.of(Arrays.stream(cards).map(c -> Card.of(c).orElseThrow()).toList(), deck, rule);
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
        assertThat(of("?", "coffee")).isEqualTo(new Summary(null, null, null, null, false, null, false));
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
        assertThat(Card.THIRTEEN.numericValue()).hasValue(new java.math.BigDecimal(13));
    }

    @Test
    void halfAPointCountsInTheAverageAndComesBeforeOne() {
        Summary summary = of("0.5", "1", "1");
        assertThat(summary.average()).isEqualTo(new BigDecimal("0.8"));
        assertThat(summary.min()).isEqualTo(Card.HALF);
        assertThat(summary.max()).isEqualTo(Card.ONE);
        assertThat(of("0", "0.5").mostVoted().values()).containsExactly(Card.ZERO, Card.HALF);
    }

    @Test
    void sizesHaveNoAverageButAMostVotedAMinAMaxAndAConsensus() {
        Summary summary = of("XL", "S", "XL", "M");
        assertThat(summary.average()).isNull();
        assertThat(summary.mostVoted()).isEqualTo(new Summary.MostVoted(List.of(Card.XL), 2));
        assertThat(summary.min()).isEqualTo(Card.S);
        assertThat(summary.max()).isEqualTo(Card.XL);
        assertThat(summary.consensus()).isFalse();
        assertThat(of("M", "M").consensus()).isTrue();
    }

    @Test
    void sizesTieInSizeOrder() {
        assertThat(of("XXL", "XXS", "XXL", "XXS").mostVoted().values()).containsExactly(Card.XXS, Card.XXL);
    }

    // Proposition d'estimation : matrice de la spec (jeu Fibonacci complet, sauf mention contraire).

    @Test
    void theHighestProposesTheMaximumVote() {
        assertProposal(of(EstimationRule.MAX, "3", "5", "8"), Card.EIGHT);
    }

    @Test
    void theMedianOfAnEvenCountIsTheUpperOfTheTwoMiddleVotes() {
        assertProposal(of(EstimationRule.MEDIAN, "3", "5", "5", "8"), Card.FIVE);
        assertProposal(of(EstimationRule.MEDIAN, "3", "5"), Card.FIVE);
        assertProposal(of(EstimationRule.MEDIAN, "8", "3", "?", "5", "coffee"), Card.FIVE);
    }

    @Test
    void theMedianOfAnOddCountIsTheMiddleVote() {
        assertProposal(of(EstimationRule.MEDIAN, "2", "3", "3", "5", "5"), Card.THREE);
    }

    @Test
    void theMedianWithinThreeLevelsIsProposed() {
        assertProposal(of(EstimationRule.MEDIAN, "2", "8"), Card.EIGHT);
    }

    @Test
    void theMedianBeyondThreeLevelsProposesNothingAndSaysTheSpreadIsTooWide() {
        Summary summary = of(EstimationRule.MEDIAN, "2", "13");
        assertThat(summary.proposal()).isNull();
        assertThat(summary.spreadTooWide()).isTrue();
        assertThat(summary.min()).isEqualTo(Card.TWO);
        assertThat(summary.max()).isEqualTo(Card.THIRTEEN);
    }

    @Test
    void levelsAreCountedInTheSessionDeck() {
        // Sans le 3 ni le 5, de 2 à 13 il n'y a plus que 2 niveaux.
        Deck deck = new Deck(DeckType.FIBONACCI, List.of(Card.ONE, Card.TWO, Card.EIGHT, Card.THIRTEEN, Card.UNKNOWN));
        assertProposal(of(deck, EstimationRule.MEDIAN, "2", "13"), Card.THIRTEEN);
        // Avec 1, 2, 3, 5, 8 : de 2 à 8, 3 niveaux.
        Deck small = new Deck(DeckType.FIBONACCI, List.of(Card.ONE, Card.TWO, Card.THREE, Card.FIVE, Card.EIGHT));
        assertProposal(of(small, EstimationRule.MEDIAN, "2", "8"), Card.EIGHT);
        assertThat(of(small, EstimationRule.MEDIAN, "1", "8").spreadTooWide()).isTrue();
    }

    @Test
    void justBelowTheMaximumIsTheDeckCardEvenIfNobodyVotedIt() {
        assertProposal(of(EstimationRule.BELOW_MAX, "3", "3", "13"), Card.EIGHT);
        assertProposal(of(EstimationRule.BELOW_MAX, "0", "0.5"), Card.ZERO);
        Deck deck = new Deck(DeckType.FIBONACCI, List.of(Card.ONE, Card.THREE, Card.EIGHT, Card.COFFEE));
        assertProposal(of(deck, EstimationRule.BELOW_MAX, "1", "8"), Card.THREE);
    }

    @ParameterizedTest
    @EnumSource(value = EstimationRule.class, names = { "MAX", "MEDIAN", "BELOW_MAX" })
    void identicalVotesProposeThatValue(EstimationRule rule) {
        assertProposal(of(rule, "5"), Card.FIVE);
        assertProposal(of(rule, "5", "5"), Card.FIVE);
        assertProposal(of(rule, "0", "0", "?"), Card.ZERO);
    }

    @Test
    void theRuleNoneProposesNothing() {
        Summary summary = of(EstimationRule.NONE, "3", "8");
        assertThat(summary.proposal()).isNull();
        assertThat(summary.spreadTooWide()).isFalse();
        assertThat(of(EstimationRule.NONE, "5", "5").proposal()).isNull();
        assertThat(of("3", "8").proposal()).isNull();
    }

    @ParameterizedTest
    @EnumSource(EstimationRule.class)
    void withoutARankedVoteNothingIsProposed(EstimationRule rule) {
        assertThat(of(rule, "?", "coffee")).isEqualTo(Summary.EMPTY);
        assertThat(of(rule)).isEqualTo(Summary.EMPTY);
    }

    @Test
    void sizesFollowTheRulesInTheirOwnOrder() {
        Deck sizes = new Deck(DeckType.TSHIRT, DeckType.TSHIRT.cards());
        assertProposal(of(sizes, EstimationRule.MEDIAN, "S", "M", "M", "XL"), Card.M);
        assertProposal(of(sizes, EstimationRule.MAX, "S", "M", "M", "XL"), Card.XL);
        assertProposal(of(sizes, EstimationRule.BELOW_MAX, "S", "XL"), Card.L);
        assertThat(of(sizes, EstimationRule.MEDIAN, "XXS", "L").spreadTooWide()).isTrue();
    }

    @ParameterizedTest
    @EnumSource(EstimationRule.class)
    void everyRuleSaysTheSpreadIsTooWideBeyondThreeLevels(EstimationRule rule) {
        assertThat(of(rule, "2", "13").spreadTooWide()).as("2 à 13, 4 niveaux").isTrue();
        assertThat(of(rule, "0", "21").spreadTooWide()).isTrue();
        assertThat(of(rule, "2", "8").spreadTooWide()).as("2 à 8, 3 niveaux").isFalse();
        assertThat(of(rule, "2", "?", "coffee").spreadTooWide()).isFalse();
    }

    @Test
    void aSpreadTooWideKeepsTheProposalOfTheOtherRules() {
        assertThat(of(EstimationRule.MAX, "2", "3", "13").proposal()).isEqualTo(Card.THIRTEEN);
        assertThat(of(EstimationRule.BELOW_MAX, "2", "3", "13").proposal()).isEqualTo(Card.EIGHT);
        assertThat(of(EstimationRule.MEDIAN, "2", "3", "13").proposal()).isNull();
        assertThat(of(EstimationRule.NONE, "2", "3", "13").proposal()).isNull();
    }

    private static void assertProposal(Summary summary, Card expected) {
        assertThat(summary.proposal()).isEqualTo(expected);
        assertThat(summary.spreadTooWide()).isFalse();
    }
}
