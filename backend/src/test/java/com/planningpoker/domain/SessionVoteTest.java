package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Règle {@code vote} (FR-10) et son reflet dans l'instantané filtré. */
class SessionVoteTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");
    private static final String ROUND = "round-1";
    private static final UUID ALICE = UUID.fromString("3f6c2a1e-8b4d-4c7a-9e2f-1d5b6a7c8e90");
    private static final UUID BOB = UUID.fromString("7d2e9f4a-1c3b-4e5d-8a6f-2b9c0d1e3f45");
    private static final UUID CHLOE = UUID.fromString("0c8b5d3e-6f2a-4b1c-9d7e-5a4f3b2c1d06");
    private static final UUID EMMA = UUID.fromString("5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e");

    /** Alice, Bob et Chloé votent, Emma observe ; Alice et Bob sont connectés, Chloé non. */
    private static Session table() {
        return Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", ROUND, ALICE, Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("alice"), NOW)
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob"))
                .join(CHLOE, Pseudo.of("Chloé"), Role.VOTER, ParticipantToken.of("chloe"))
                .join(EMMA, Pseudo.of("Emma"), Role.OBSERVER, ParticipantToken.of("emma"))
                .connect(ALICE, "alice-1", NOW)
                .connect(BOB, "bob-1", NOW);
    }

    private static Session revealed(Session session) {
        return session.reveal(EMMA, ROUND);
    }

    private static SessionSnapshot.Seat seat(SessionSnapshot snapshot, UUID participantId) {
        return snapshot.participants().stream().filter(s -> s.participantId().equals(participantId)).findFirst()
                .orElseThrow();
    }

    private static VoteRejectedException.Reason rejection(Runnable action) {
        try {
            action.run();
        } catch (VoteRejectedException e) {
            return e.reason();
        }
        throw new AssertionError("vote should have been rejected");
    }

    @Test
    void choosingACardIncrementsTheVersionAndIsSeenOnlyByItsAuthor() {
        Session before = table();
        Session after = before.vote(ALICE, ROUND, "8");

        assertThat(after.version()).isEqualTo(before.version() + 1);
        assertThat(after.lastChange()).isEqualTo(LastChange.of(ChangeAction.VOTE, ALICE));
        assertThat(after.voteOf(ALICE)).contains(Card.EIGHT);

        SessionSnapshot forAlice = SessionSnapshot.forRecipient(after, ALICE);
        assertThat(seat(forAlice, ALICE).vote()).isEqualTo("8");
        assertThat(seat(forAlice, ALICE).hasVoted()).isTrue();
        assertThat(forAlice.progress()).isEqualTo(new SessionSnapshot.Progress(1, 3));

        for (UUID other : new UUID[] { BOB, EMMA }) {
            SessionSnapshot snapshot = SessionSnapshot.forRecipient(after, other);
            assertThat(seat(snapshot, ALICE).vote()).isNull();
            assertThat(seat(snapshot, ALICE).hasVoted()).isTrue();
            assertThat(snapshot.progress()).isEqualTo(new SessionSnapshot.Progress(1, 3));
        }
        assertThat(seat(forAlice, BOB).hasVoted()).isFalse();
    }

    @Test
    void changingTheCardKeepsTheProgress() {
        Session eight = table().vote(ALICE, ROUND, "8");
        Session five = eight.vote(ALICE, ROUND, "5");

        assertThat(five.version()).isEqualTo(eight.version() + 1);
        assertThat(five.lastChange()).isEqualTo(LastChange.of(ChangeAction.VOTE, ALICE));
        assertThat(seat(SessionSnapshot.forRecipient(five, ALICE), ALICE).vote()).isEqualTo("5");
        assertThat(SessionSnapshot.forRecipient(five, ALICE).progress().voted()).isEqualTo(1);
    }

    @Test
    void withdrawingRemovesTheVoteForEveryone() {
        Session five = table().vote(ALICE, ROUND, "5").vote(BOB, ROUND, "3");
        Session withdrawn = five.vote(ALICE, ROUND, null);

        assertThat(withdrawn.version()).isEqualTo(five.version() + 1);
        assertThat(withdrawn.lastChange()).isEqualTo(LastChange.of(ChangeAction.VOTE, ALICE));
        assertThat(withdrawn.voteOf(ALICE)).isEmpty();
        for (UUID recipient : new UUID[] { ALICE, BOB, EMMA }) {
            SessionSnapshot snapshot = SessionSnapshot.forRecipient(withdrawn, recipient);
            assertThat(seat(snapshot, ALICE).hasVoted()).isFalse();
            assertThat(seat(snapshot, ALICE).vote()).isNull();
            assertThat(snapshot.progress()).isEqualTo(new SessionSnapshot.Progress(1, 3));
        }
    }

    @Test
    void anAlreadySatisfiedIntentChangesNothing() {
        Session five = table().vote(ALICE, ROUND, "5");
        assertThat(five.vote(ALICE, ROUND, "5")).isSameAs(five);
        assertThat(five.vote(BOB, ROUND, null)).isSameAs(five);
    }

    @Test
    void coffeeIsAcceptedAndCounted() {
        Session session = table().vote(BOB, ROUND, "coffee");
        assertThat(session.voteOf(BOB)).contains(Card.COFFEE);
        SessionSnapshot forBob = SessionSnapshot.forRecipient(session, BOB);
        assertThat(seat(forBob, BOB).vote()).isEqualTo("coffee");
        assertThat(forBob.progress().voted()).isEqualTo(1);
    }

    @Test
    void everyCardOfTheDeckIsAccepted() {
        for (String card : new String[] { "0", "1", "2", "3", "5", "8", "13", "21", "?", "coffee" }) {
            assertThat(table().vote(ALICE, ROUND, card).voteOf(ALICE).map(Card::value)).contains(card);
        }
    }

    @Test
    void aStaleRoundIdIsSilentlyIgnored() {
        Session session = table();
        assertThat(session.vote(ALICE, "round-0", "8")).isSameAs(session);
    }

    @Test
    void anObserverCannotVote() {
        Session session = table();
        assertThat(rejection(() -> session.vote(EMMA, ROUND, "8")))
                .isEqualTo(VoteRejectedException.Reason.NOT_A_VOTER);
    }

    @Test
    void aRevealedRoundIsLocked() {
        Session session = revealed(table().vote(ALICE, ROUND, "8"));
        assertThat(rejection(() -> session.vote(ALICE, ROUND, "5")))
                .isEqualTo(VoteRejectedException.Reason.ROUND_REVEALED);
        assertThat(rejection(() -> session.vote(ALICE, ROUND, null)))
                .isEqualTo(VoteRejectedException.Reason.ROUND_REVEALED);
        assertThat(session.voteOf(ALICE)).contains(Card.EIGHT);
    }

    @ParameterizedTest
    @ValueSource(strings = { "4", "☕", "", "COFFEE", " 8", "08" })
    void aCardOutsideTheDeckIsRejected(String card) {
        Session session = table();
        assertThat(rejection(() -> session.vote(ALICE, ROUND, card)))
                .isEqualTo(VoteRejectedException.Reason.INVALID_CARD);
    }

    @Test
    void checksComeInTheContractOrder() {
        Session session = table();
        // Périmé d'abord, même pour un observateur avec une carte inconnue.
        assertThat(session.vote(EMMA, "round-0", "4")).isSameAs(session);
        // Puis observateur avant carte inconnue.
        assertThat(rejection(() -> session.vote(EMMA, ROUND, "4")))
                .isEqualTo(VoteRejectedException.Reason.NOT_A_VOTER);
        // Puis tour révélé avant carte inconnue.
        assertThat(rejection(() -> revealed(session).vote(ALICE, ROUND, "4")))
                .isEqualTo(VoteRejectedException.Reason.ROUND_REVEALED);
        assertThat(rejection(() -> revealed(session).vote(EMMA, ROUND, "4")))
                .isEqualTo(VoteRejectedException.Reason.NOT_A_VOTER);
    }

    @Test
    void anUnknownParticipantIsAProgrammingError() {
        assertThatThrownBy(() -> table().vote(UUID.randomUUID(), ROUND, "8"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void progressCountsDisconnectedVoters() {
        // 3 votants dont Chloé déconnectée ; 2 ont voté.
        Session session = table().vote(ALICE, ROUND, "8").vote(CHLOE, ROUND, "?");
        assertThat(SessionSnapshot.forRecipient(session, EMMA).progress())
                .isEqualTo(new SessionSnapshot.Progress(2, 3));
    }

    @Test
    void joiningKeepsTheVotes() {
        UUID farid = UUID.fromString("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");
        Session voted = table().vote(ALICE, ROUND, "8");
        Session joined = voted.join(farid, Pseudo.of("Farid"), Role.VOTER, ParticipantToken.of("farid"));

        assertThat(joined.voteOf(ALICE)).contains(Card.EIGHT);
        assertThat(joined.roundStatus()).isEqualTo(voted.roundStatus());
        assertThat(SessionSnapshot.forRecipient(joined, ALICE).progress())
                .isEqualTo(new SessionSnapshot.Progress(1, 4));
    }

    @Test
    void presenceChangesKeepTheVotes() {
        Session session = table().vote(BOB, ROUND, "13").disconnect(BOB, "bob-1").connect(BOB, "bob-2", NOW);
        assertThat(session.voteOf(BOB)).contains(Card.THIRTEEN);
    }

    @Test
    void aRevealedRoundShowsEveryVote() {
        Session session = revealed(table().vote(ALICE, ROUND, "8").vote(BOB, ROUND, "5"));
        SessionSnapshot forEmma = SessionSnapshot.forRecipient(session, EMMA);
        assertThat(forEmma.round().status()).isEqualTo(RoundStatus.REVEALED);
        assertThat(seat(forEmma, ALICE).vote()).isEqualTo("8");
        assertThat(seat(forEmma, BOB).vote()).isEqualTo("5");
        assertThat(seat(forEmma, CHLOE).vote()).isNull();
    }
}
