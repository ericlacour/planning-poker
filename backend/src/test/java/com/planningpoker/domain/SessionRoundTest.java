package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

/** Règles {@code reveal} et {@code clear} (FR-11, FR-12, FR-15, FR-17) et leur reflet dans l'instantané. */
class SessionRoundTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");
    private static final String ROUND = "round-1";
    private static final String NEXT = "round-2";
    private static final UUID ALICE = UUID.fromString("3f6c2a1e-8b4d-4c7a-9e2f-1d5b6a7c8e90");
    private static final UUID BOB = UUID.fromString("7d2e9f4a-1c3b-4e5d-8a6f-2b9c0d1e3f45");
    private static final UUID CHLOE = UUID.fromString("0c8b5d3e-6f2a-4b1c-9d7e-5a4f3b2c1d06");
    private static final UUID EMMA = UUID.fromString("5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e");
    private static final UUID FARID = UUID.fromString("1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d");

    /** Alice, Bob et Chloé votent, Emma observe. */
    private static Session table() {
        return Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", ROUND, ALICE, Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("alice"), NOW)
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob"), NOW, 30)
                .join(CHLOE, Pseudo.of("Chloé"), Role.VOTER, ParticipantToken.of("chloe"), NOW, 30)
                .join(EMMA, Pseudo.of("Emma"), Role.OBSERVER, ParticipantToken.of("emma"), NOW, 30);
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

    // --- reveal ---

    @Test
    void revealingShowsEveryVoteAndTheSummaryToEveryone() {
        Session before = table().vote(ALICE, ROUND, "3").vote(BOB, ROUND, "5").vote(CHLOE, ROUND, "8");
        Session after = before.reveal(ALICE, ROUND);

        assertThat(after.roundStatus()).isEqualTo(RoundStatus.REVEALED);
        assertThat(after.version()).isEqualTo(before.version() + 1);
        assertThat(after.lastChange()).isEqualTo(LastChange.of(ChangeAction.REVEAL, ALICE));
        assertThat(after.roundId()).isEqualTo(ROUND);

        for (UUID recipient : new UUID[] { ALICE, BOB, EMMA }) {
            SessionSnapshot snapshot = SessionSnapshot.forRecipient(after, recipient);
            assertThat(snapshot.round()).isEqualTo(new SessionSnapshot.Round(ROUND, RoundStatus.REVEALED));
            assertThat(seat(snapshot, ALICE).vote()).isEqualTo("3");
            assertThat(seat(snapshot, BOB).vote()).isEqualTo("5");
            assertThat(seat(snapshot, CHLOE).vote()).isEqualTo("8");
            assertThat(snapshot.summary()).isEqualTo(new Summary(new BigDecimal("5.3"),
                    new Summary.MostVoted(List.of(Card.THREE, Card.FIVE, Card.EIGHT), 1), Card.THREE, Card.EIGHT,
                    false));
        }
    }

    @Test
    void aHiddenRoundHasNoSummary() {
        Session session = table().vote(ALICE, ROUND, "3");
        assertThat(session.summary()).isEmpty();
        assertThat(SessionSnapshot.forRecipient(session, ALICE).summary()).isNull();
    }

    @Test
    void revealingAnAlreadyRevealedRoundChangesNothing() {
        Session revealed = table().vote(ALICE, ROUND, "3").reveal(ALICE, ROUND);
        assertThat(revealed.reveal(BOB, ROUND)).isSameAs(revealed);
    }

    @Test
    void aStaleRevealChangesNothing() {
        Session session = table().vote(ALICE, ROUND, "3");
        assertThat(session.reveal(ALICE, "round-0")).isSameAs(session);
    }

    @Test
    void anObserverMayRevealEvenWithoutAnyVote() {
        Session revealed = table().reveal(EMMA, ROUND);
        assertThat(revealed.roundStatus()).isEqualTo(RoundStatus.REVEALED);
        assertThat(revealed.lastChange()).isEqualTo(LastChange.of(ChangeAction.REVEAL, EMMA));
        SessionSnapshot snapshot = SessionSnapshot.forRecipient(revealed, ALICE);
        assertThat(snapshot.participants()).allSatisfy(s -> assertThat(s.vote()).isNull());
        assertThat(snapshot.summary()).isEqualTo(Summary.EMPTY);
    }

    @Test
    void aVoteOnARevealedRoundIsRejected() {
        Session revealed = table().vote(ALICE, ROUND, "3").reveal(BOB, ROUND);
        assertThat(rejection(() -> revealed.vote(BOB, ROUND, "5")))
                .isEqualTo(VoteRejectedException.Reason.ROUND_REVEALED);
    }

    @Test
    void anUnknownAuthorIsAProgrammingError() {
        assertThatThrownBy(() -> table().reveal(UUID.randomUUID(), ROUND))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> table().clear(UUID.randomUUID(), ROUND, NEXT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // --- clear ---

    @Test
    void clearingARevealedRoundStartsANewHiddenRoundWithoutVotes() {
        Session revealed = table().vote(ALICE, ROUND, "3").vote(BOB, ROUND, "5").reveal(ALICE, ROUND);
        Session cleared = revealed.clear(BOB, ROUND, NEXT);

        assertThat(cleared.roundStatus()).isEqualTo(RoundStatus.HIDDEN);
        assertThat(cleared.roundId()).isEqualTo(NEXT);
        assertThat(cleared.votes()).isEmpty();
        assertThat(cleared.version()).isEqualTo(revealed.version() + 1);
        assertThat(cleared.lastChange()).isEqualTo(LastChange.of(ChangeAction.CLEAR, BOB));
        SessionSnapshot snapshot = SessionSnapshot.forRecipient(cleared, ALICE);
        assertThat(snapshot.summary()).isNull();
        assertThat(snapshot.progress()).isEqualTo(new SessionSnapshot.Progress(0, 3));
        assertThat(snapshot.participants()).allSatisfy(s -> {
            assertThat(s.hasVoted()).isFalse();
            assertThat(s.vote()).isNull();
        });
    }

    @Test
    void clearingAHiddenRoundWorksEvenWithoutAnyVote() {
        Session hidden = table();
        Session cleared = hidden.clear(EMMA, ROUND, NEXT);
        assertThat(cleared.roundId()).isEqualTo(NEXT);
        assertThat(cleared.version()).isEqualTo(hidden.version() + 1);
        assertThat(cleared.lastChange()).isEqualTo(LastChange.of(ChangeAction.CLEAR, EMMA));

        Session voted = table().vote(ALICE, ROUND, "8").clear(ALICE, ROUND, NEXT);
        assertThat(voted.votes()).isEmpty();
        assertThat(voted.roundStatus()).isEqualTo(RoundStatus.HIDDEN);
    }

    @Test
    void twoClearsFromTheSameRoundMakeOneNewRound() {
        Session session = table().vote(ALICE, ROUND, "8").reveal(ALICE, ROUND);
        Session first = session.clear(ALICE, ROUND, NEXT);
        Session second = first.clear(BOB, ROUND, "round-3");

        assertThat(second).isSameAs(first);
        assertThat(second.version()).isEqualTo(session.version() + 1);
        assertThat(second.roundId()).isEqualTo(NEXT);
    }

    @Test
    void aStaleRevealAfterAClearChangesNothing() {
        Session cleared = table().clear(ALICE, ROUND, NEXT);
        assertThat(cleared.reveal(BOB, ROUND)).isSameAs(cleared);
    }

    @Test
    void votingWorksAgainInTheNewRound() {
        Session cleared = table().vote(ALICE, ROUND, "8").reveal(ALICE, ROUND).clear(ALICE, ROUND, NEXT);
        assertThat(cleared.vote(ALICE, ROUND, "5")).isSameAs(cleared);
        assertThat(cleared.vote(ALICE, NEXT, "5").voteOf(ALICE)).contains(Card.FIVE);
    }

    @Test
    void theNewRoundIdMustDiffer() {
        assertThatThrownBy(() -> table().clear(ALICE, ROUND, ROUND)).isInstanceOf(IllegalArgumentException.class);
    }

    // --- arrivée tardive ---

    @Test
    void aVoterJoiningDuringARevealedRoundVotesFromTheNextRound() {
        Session revealed = table().vote(ALICE, ROUND, "8").reveal(ALICE, ROUND);
        Session joined = revealed.join(FARID, Pseudo.of("Farid"), Role.VOTER,
                ParticipantToken.of("farid"), NOW, 30);

        SessionSnapshot snapshot = SessionSnapshot.forRecipient(joined, FARID);
        assertThat(seat(snapshot, FARID).canVoteThisRound()).isFalse();
        assertThat(seat(snapshot, ALICE).canVoteThisRound()).isTrue();
        assertThat(seat(snapshot, ALICE).vote()).isEqualTo("8");
        assertThat(snapshot.progress()).isEqualTo(new SessionSnapshot.Progress(1, 4));
        assertThat(rejection(() -> joined.vote(FARID, ROUND, "5")))
                .isEqualTo(VoteRejectedException.Reason.ROUND_REVEALED);

        Session next = joined.clear(EMMA, ROUND, NEXT);
        assertThat(seat(SessionSnapshot.forRecipient(next, FARID), FARID).canVoteThisRound()).isTrue();
        assertThat(next.vote(FARID, NEXT, "5").voteOf(FARID)).contains(Card.FIVE);
    }

    @Test
    void aVoterJoiningDuringAHiddenRoundVotesAtOnce() {
        Session joined = table().join(FARID, Pseudo.of("Farid"), Role.VOTER, ParticipantToken.of("farid"), NOW, 30);
        assertThat(seat(SessionSnapshot.forRecipient(joined, FARID), FARID).canVoteThisRound()).isTrue();
        assertThat(joined.lateArrivals()).isEmpty();
    }

    @Test
    void presenceKeepsTheLateArrivals() {
        Session joined = table().reveal(ALICE, ROUND)
                .join(FARID, Pseudo.of("Farid"), Role.VOTER, ParticipantToken.of("farid"), NOW, 30)
                .connect(FARID, "farid-1", NOW).disconnect(FARID, "farid-1", NOW);
        assertThat(seat(SessionSnapshot.forRecipient(joined, FARID), FARID).canVoteThisRound()).isFalse();
    }
}
