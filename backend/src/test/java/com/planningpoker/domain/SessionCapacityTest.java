package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

/** Plafond de participants par session (story 2.6) : seul un nouvel arrivant est refusé. */
class SessionCapacityTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");
    private static final Duration ABSENCE = Duration.ofMinutes(5);
    private static final int MAX = 3;
    private static final UUID ALICE = UUID.fromString("3f6c2a1e-8b4d-4c7a-9e2f-1d5b6a7c8e90");
    private static final UUID BOB = UUID.fromString("7d2e9f4a-1c3b-4e5d-8a6f-2b9c0d1e3f45");
    private static final UUID CHLOE = UUID.fromString("0c8b5d3e-6f2a-4b1c-9d7e-5a4f3b2c1d06");
    private static final UUID DAVID = UUID.fromString("1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d");

    /** Alice, Bob et Chloé : la session est pleine ; Alice et Chloé sont connectées, Bob ne l'est pas. */
    private static Session full() {
        return Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", "round-1", ALICE, Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("alice"), NOW)
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob"), NOW, MAX)
                .join(CHLOE, Pseudo.of("Chloé"), Role.VOTER, ParticipantToken.of("chloe"), NOW, MAX)
                .connect(ALICE, "alice-1", NOW)
                .connect(CHLOE, "chloe-1", NOW);
    }

    @Test
    void aNewcomerFillsTheLastSeat() {
        assertThat(full().participants()).hasSize(MAX);
    }

    @Test
    void aNewcomerBeyondTheCapIsRefusedAndNothingChanges() {
        Session session = full();
        assertThatThrownBy(() -> session.join(DAVID, Pseudo.of("David"), Role.VOTER, ParticipantToken.of("david"),
                NOW, MAX)).isInstanceOf(SessionFullException.class);
        assertThat(session.participants()).hasSize(MAX);
    }

    @Test
    void aTakenPseudoIsReportedBeforeTheFullSession() {
        Session session = full();
        assertThatThrownBy(() -> session.join(DAVID, Pseudo.of("alice"), Role.VOTER, ParticipantToken.of("david"),
                NOW, MAX)).isInstanceOf(PseudoTakenException.class);
    }

    @Test
    void aDisconnectedParticipantTakesOverHisPlaceInAFullSession() {
        Session session = full();
        Session taken = session.join(DAVID, Pseudo.of("BOB"), Role.OBSERVER, ParticipantToken.of("bob-new"), NOW,
                MAX);
        assertThat(taken.participants()).hasSize(MAX);
        assertThat(taken.participantWithToken("bob-new")).map(Participant::id).contains(BOB);
    }

    @Test
    void aRemovedParticipantNoLongerCounts() {
        Session removed = full().remove(BOB);
        Session joined = removed.join(DAVID, Pseudo.of("David"), Role.VOTER, ParticipantToken.of("david"), NOW, MAX);
        assertThat(joined.participants()).extracting(Participant::id).containsExactly(ALICE, CHLOE, DAVID);
        assertThat(joined.departed()).extracting(Participant::id).containsExactly(BOB);
    }

    @Test
    void aRemovedParticipantCannotComeBackToAFullSessionAndStaysDeparted() {
        Session session = full().remove(BOB)
                .join(DAVID, Pseudo.of("David"), Role.VOTER, ParticipantToken.of("david"), NOW, MAX);
        assertThatThrownBy(() -> session.rejoin(BOB, "bob-2", NOW.plus(ABSENCE), MAX))
                .isInstanceOf(SessionFullException.class);
        assertThat(session.departedWithToken("bob")).map(Participant::id).contains(BOB);
    }

    @Test
    void aRemovedParticipantComesBackWhenThereIsRoom() {
        Session back = full().remove(BOB).rejoin(BOB, "bob-2", NOW.plus(ABSENCE), MAX);
        assertThat(back.participants()).hasSize(MAX);
        assertThat(back.departed()).isEmpty();
    }
}
