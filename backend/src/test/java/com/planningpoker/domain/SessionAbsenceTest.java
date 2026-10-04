package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

/** Retrait après une longue absence et retour transparent (FR-7, FR-9, AD-7, AD-8). */
class SessionAbsenceTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");
    private static final Duration ABSENCE = Duration.ofMinutes(5);
    private static final String ROUND = "round-1";
    private static final UUID ALICE = UUID.fromString("3f6c2a1e-8b4d-4c7a-9e2f-1d5b6a7c8e90");
    private static final UUID BOB = UUID.fromString("7d2e9f4a-1c3b-4e5d-8a6f-2b9c0d1e3f45");
    private static final UUID CHLOE = UUID.fromString("0c8b5d3e-6f2a-4b1c-9d7e-5a4f3b2c1d06");

    /** Alice et Bob votent, tous deux connectés ; Bob a voté. */
    private static Session table() {
        return Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", ROUND, ALICE, Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("alice"), NOW)
                .join(BOB, Pseudo.of("bob"), Role.VOTER, ParticipantToken.of("bob"), NOW, 30)
                .connect(ALICE, "alice-1", NOW)
                .connect(BOB, "bob-1", NOW)
                .vote(BOB, ROUND, "5");
    }

    /** Bob ferme son dernier onglet à {@code NOW} puis est retiré cinq minutes plus tard. */
    private static Session bobRemoved() {
        Session session = table().disconnect(BOB, "bob-1", NOW);
        assertThat(session.absentParticipants(NOW.plus(ABSENCE), ABSENCE)).containsExactly(BOB);
        return session.remove(BOB);
    }

    @Test
    void aParticipantIsAbsentExactlyAtTheTimeoutAfterHisLastConnectionClosedNotBefore() {
        Session session = table().disconnect(BOB, "bob-1", NOW);
        assertThat(session.participant(BOB).orElseThrow().offlineSince()).isEqualTo(NOW);
        assertThat(session.absentParticipants(NOW.plus(ABSENCE).minusMillis(1), ABSENCE)).isEmpty();
        assertThat(session.absentParticipants(NOW.plus(ABSENCE), ABSENCE)).containsExactly(BOB);
    }

    @Test
    void aParticipantWhoNeverConnectedIsAbsentFromHisEntry() {
        Session session = Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", ROUND, ALICE, Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("alice"), NOW)
                .connect(ALICE, "alice-1", NOW)
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob"), NOW.plusSeconds(10), 30);
        assertThat(session.participant(BOB).orElseThrow().offlineSince()).isEqualTo(NOW.plusSeconds(10));
        assertThat(session.absentParticipants(NOW.plusSeconds(10).plus(ABSENCE).minusMillis(1), ABSENCE))
                .isEmpty();
        assertThat(session.absentParticipants(NOW.plusSeconds(10).plus(ABSENCE), ABSENCE)).containsExactly(BOB);
    }

    @Test
    void anOpenConnectionEvenSilentPreventsTheRemoval() {
        Session session = table();
        assertThat(session.participant(BOB).orElseThrow().offlineSince()).isNull();
        assertThat(session.absentParticipants(NOW.plus(Duration.ofMinutes(20)), ABSENCE)).isEmpty();
    }

    @Test
    void closingOneTabOfTwoDoesNotStartTheAbsence() {
        Session session = table().connect(BOB, "bob-2", NOW).disconnect(BOB, "bob-1", NOW);
        assertThat(session.participant(BOB).orElseThrow().offlineSince()).isNull();
        assertThat(session.absentParticipants(NOW.plus(ABSENCE), ABSENCE)).isEmpty();
    }

    @Test
    void theRemovalDeletesTheSeatAndTheVoteAndIsALeave() {
        Session before = table().disconnect(BOB, "bob-1", NOW);
        Session removed = before.remove(BOB);

        assertThat(removed.version()).isEqualTo(before.version() + 1);
        assertThat(removed.lastChange()).isEqualTo(LastChange.of(ChangeAction.LEAVE, BOB));
        assertThat(removed.participant(BOB)).isEmpty();
        assertThat(removed.voteOf(BOB)).isEmpty();
        assertThat(removed.departed()).extracting(Participant::id).containsExactly(BOB);

        SessionSnapshot snapshot = SessionSnapshot.forRecipient(removed, ALICE);
        assertThat(snapshot.participants()).extracting(SessionSnapshot.Seat::participantId).containsExactly(ALICE);
        assertThat(snapshot.progress()).isEqualTo(new SessionSnapshot.Progress(0, 1));
    }

    @Test
    void theRemovalAlsoDeletesTheLateArrivalMark() {
        Session session = table().reveal(ALICE, ROUND)
                .join(CHLOE, Pseudo.of("Chloé"), Role.VOTER, ParticipantToken.of("chloe"), NOW, 30);
        assertThat(session.lateArrivals()).contains(CHLOE);
        Session removed = session.remove(CHLOE);
        assertThat(removed.lateArrivals()).doesNotContain(CHLOE);
    }

    @Test
    void removingSomeoneNotAtTheTableChangesNothing() {
        Session removed = bobRemoved();
        assertThat(removed.remove(BOB)).isSameAs(removed);
        assertThat(removed.remove(UUID.randomUUID())).isSameAs(removed);
    }

    @Test
    void aRemovedParticipantFreesHisPseudoButKeepsHisToken() {
        Session removed = bobRemoved();
        assertThat(removed.participantWithToken("bob")).isEmpty();
        assertThat(removed.departedWithToken("bob")).map(Participant::id).contains(BOB);
        assertThat(removed.departedWithToken("alice")).isEmpty();
        assertThat(removed.departedWithToken(null)).isEmpty();

        Session taken = removed.join(CHLOE, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("chloe"), NOW, 30);
        assertThat(taken.participant(CHLOE)).isPresent();
    }

    @Test
    void comingBackPutsTheParticipantBackAtTheTableConnectedInASingleJoin() {
        Session removed = bobRemoved();
        Instant later = NOW.plus(Duration.ofMinutes(7));

        Session back = removed.rejoin(BOB, "bob-2", later, 30);

        assertThat(back.version()).isEqualTo(removed.version() + 1);
        assertThat(back.lastChange()).isEqualTo(LastChange.of(ChangeAction.JOIN, BOB));
        assertThat(back.departed()).isEmpty();
        assertThat(back.voteOf(BOB)).isEmpty();
        Participant bob = back.participant(BOB).orElseThrow();
        assertThat(bob.pseudo().value()).isEqualTo("bob");
        assertThat(bob.role()).isEqualTo(Role.VOTER);
        assertThat(bob.joinOrder()).isEqualTo(3);
        assertThat(bob.token().matches("bob")).isTrue();
        assertThat(bob.connected()).isTrue();
        assertThat(bob.connections()).containsEntry("bob-2", later);
        assertThat(bob.offlineSince()).isNull();
        assertThat(back.canVoteThisRound(bob)).isTrue();
    }

    @Test
    void comingBackDuringARevealedRoundIsALateArrivalUntilTheClear() {
        Session back = bobRemoved().reveal(ALICE, ROUND).rejoin(BOB, "bob-2", NOW.plus(ABSENCE), 30);
        Participant bob = back.participant(BOB).orElseThrow();
        assertThat(back.canVoteThisRound(bob)).isFalse();
        assertThat(SessionSnapshot.forRecipient(back, BOB).participants())
                .filteredOn(s -> s.participantId().equals(BOB))
                .singleElement()
                .satisfies(s -> assertThat(s.canVoteThisRound()).isFalse());

        Session cleared = back.clear(ALICE, ROUND, "round-2");
        assertThat(cleared.canVoteThisRound(cleared.participant(BOB).orElseThrow())).isTrue();
    }

    @Test
    void comingBackIsRefusedWhenThePseudoWasTakenIgnoringCase() {
        Session taken = bobRemoved().join(CHLOE, Pseudo.of("BOB"), Role.OBSERVER, ParticipantToken.of("chloe"),
                NOW, 30);
        assertThatThrownBy(() -> taken.rejoin(BOB, "bob-2", NOW.plus(ABSENCE), 30))
                .isInstanceOf(PseudoTakenException.class);
        assertThat(taken.departedWithToken("bob")).map(Participant::id).contains(BOB);
    }

    @Test
    void onlyARemovedParticipantCanComeBack() {
        assertThatThrownBy(() -> table().rejoin(BOB, "bob-2", NOW, 30)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void aParticipantCanBeRemovedAgainAndComeBackAgain() {
        Instant back = NOW.plus(ABSENCE);
        Session again = bobRemoved().rejoin(BOB, "bob-2", back, 30).disconnect(BOB, "bob-2", back);
        assertThat(again.absentParticipants(back.plus(ABSENCE).minusMillis(1), ABSENCE)).isEmpty();
        assertThat(again.absentParticipants(back.plus(ABSENCE), ABSENCE)).containsExactly(BOB);

        Session removedAgain = again.remove(BOB);
        assertThat(removedAgain.departed()).extracting(Participant::id).containsExactly(BOB);
        Session backAgain = removedAgain.rejoin(BOB, "bob-3", back.plus(ABSENCE), 30);
        assertThat(backAgain.participant(BOB).orElseThrow().joinOrder()).isEqualTo(4);
        assertThat(backAgain.departed()).isEmpty();
    }
}
