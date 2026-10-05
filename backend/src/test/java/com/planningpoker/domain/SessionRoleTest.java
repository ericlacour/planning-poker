package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

/** Règle {@code changeRole} (FR5) et son reflet dans l'instantané. */
class SessionRoleTest {

    private static final Instant NOW = Instant.parse("2026-10-05T09:00:00Z");
    private static final String ROUND = "round-1";
    private static final String NEXT = "round-2";
    private static final UUID ALICE = UUID.fromString("3f6c2a1e-8b4d-4c7a-9e2f-1d5b6a7c8e90");
    private static final UUID BOB = UUID.fromString("7d2e9f4a-1c3b-4e5d-8a6f-2b9c0d1e3f45");
    private static final UUID EMMA = UUID.fromString("5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e");

    /** Alice et Bob votent, Emma observe. */
    private static Session table() {
        return Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", ROUND, ALICE, Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("alice"), NOW)
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob"), NOW, 30)
                .join(EMMA, Pseudo.of("Emma"), Role.OBSERVER, ParticipantToken.of("emma"), NOW, 30);
    }

    private static SessionSnapshot.Seat seat(Session session, UUID recipient, UUID participantId) {
        return SessionSnapshot.forRecipient(session, recipient).participants().stream()
                .filter(s -> s.participantId().equals(participantId)).findFirst().orElseThrow();
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
    void theSameRoleChangesNothing() {
        Session before = table().vote(ALICE, ROUND, "5");

        assertThat(before.changeRole(ALICE, Role.VOTER)).isSameAs(before);
        assertThat(before.changeRole(EMMA, Role.OBSERVER)).isSameAs(before);
    }

    @Test
    void aVoterBecomingObserverDuringAHiddenRoundLosesTheVote() {
        Session before = table().vote(ALICE, ROUND, "5").vote(BOB, ROUND, "3");
        Session after = before.changeRole(ALICE, Role.OBSERVER);

        assertThat(after.version()).isEqualTo(before.version() + 1);
        assertThat(after.lastChange()).isEqualTo(LastChange.of(ChangeAction.ROLE, ALICE));
        assertThat(after.participant(ALICE).orElseThrow().role()).isEqualTo(Role.OBSERVER);
        assertThat(after.voteOf(ALICE)).isEmpty();
        SessionSnapshot snapshot = SessionSnapshot.forRecipient(after, BOB);
        assertThat(seat(after, BOB, ALICE).hasVoted()).isFalse();
        assertThat(seat(after, ALICE, ALICE).vote()).isNull();
        assertThat(snapshot.progress()).isEqualTo(new SessionSnapshot.Progress(1, 1));
    }

    @Test
    void anObserverIsSeatedAfterTheVotersAndKeepsTheirArrivalOrder() {
        Session after = table().changeRole(ALICE, Role.OBSERVER);

        assertThat(SessionSnapshot.forRecipient(after, BOB).participants())
                .extracting(SessionSnapshot.Seat::participantId).containsExactly(BOB, ALICE, EMMA);
        assertThat(after.participant(ALICE).orElseThrow().joinOrder()).isEqualTo(Session.FIRST_JOIN_ORDER);
    }

    @Test
    void aVoterBecomingObserverDuringARevealedRoundKeepsTheVoteInTheSummary() {
        Session before = table().vote(ALICE, ROUND, "8").vote(BOB, ROUND, "3").reveal(BOB, ROUND);
        Session after = before.changeRole(ALICE, Role.OBSERVER);

        assertThat(after.participant(ALICE).orElseThrow().role()).isEqualTo(Role.OBSERVER);
        assertThat(after.voteOf(ALICE)).contains(Card.of("8").orElseThrow());
        assertThat(seat(after, EMMA, ALICE).vote()).isEqualTo("8");
        assertThat(after.summary().orElseThrow()).isEqualTo(before.summary().orElseThrow());
        assertThat(after.summary().orElseThrow().average()).isEqualByComparingTo(new BigDecimal("5.5"));
    }

    @Test
    void anObserverBecomingVoterDuringARevealedRoundVotesFromTheNextRound() {
        Session revealed = table().vote(ALICE, ROUND, "5").reveal(ALICE, ROUND);
        Session after = revealed.changeRole(EMMA, Role.VOTER);

        assertThat(after.participant(EMMA).orElseThrow().role()).isEqualTo(Role.VOTER);
        assertThat(seat(after, ALICE, EMMA).canVoteThisRound()).isFalse();
        assertThat(rejection(() -> after.vote(EMMA, ROUND, "3")))
                .isEqualTo(VoteRejectedException.Reason.ROUND_REVEALED);

        Session cleared = after.clear(ALICE, ROUND, NEXT);
        assertThat(seat(cleared, ALICE, EMMA).canVoteThisRound()).isTrue();
        assertThat(cleared.vote(EMMA, NEXT, "3").voteOf(EMMA)).contains(Card.of("3").orElseThrow());
    }

    @Test
    void aRoundTripDuringARevealedRoundKeepsTheVoteAndTheRightToVote() {
        Session revealed = table().vote(ALICE, ROUND, "3").reveal(ALICE, ROUND);
        Session after = revealed.changeRole(ALICE, Role.OBSERVER).changeRole(ALICE, Role.VOTER);

        assertThat(after.voteOf(ALICE)).contains(Card.of("3").orElseThrow());
        assertThat(seat(after, BOB, ALICE).canVoteThisRound()).isTrue();
        assertThat(after.version()).isEqualTo(revealed.version() + 2);
    }

    @Test
    void anObserverBecomingVoterDuringAHiddenRoundVotesAtOnce() {
        Session after = table().changeRole(EMMA, Role.VOTER);

        assertThat(seat(after, ALICE, EMMA).canVoteThisRound()).isTrue();
        assertThat(after.vote(EMMA, ROUND, "13").voteOf(EMMA)).contains(Card.of("13").orElseThrow());
        assertThat(SessionSnapshot.forRecipient(after, ALICE).progress())
                .isEqualTo(new SessionSnapshot.Progress(0, 3));
    }

    @Test
    void aLateVoterBecomingObserverIsNoLongerLate() {
        Session revealed = table().reveal(ALICE, ROUND).changeRole(EMMA, Role.VOTER);
        Session after = revealed.changeRole(EMMA, Role.OBSERVER);

        assertThat(after.lateArrivals()).doesNotContain(EMMA);
    }

    @Test
    void anUnknownParticipantIsRejected() {
        assertThatThrownBy(() -> table().changeRole(UUID.randomUUID(), Role.OBSERVER))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
