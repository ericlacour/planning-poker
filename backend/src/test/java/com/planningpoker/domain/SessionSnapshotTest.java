package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class SessionSnapshotTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");
    private static final UUID ALICE = UUID.fromString("3f6c2a1e-8b4d-4c7a-9e2f-1d5b6a7c8e90");
    private static final UUID BOB = UUID.fromString("7d2e9f4a-1c3b-4e5d-8a6f-2b9c0d1e3f45");
    private static final UUID EMMA = UUID.fromString("5b6c7d8e-9f0a-4b1c-8d2e-3f4a5b6c7d8e");

    /** Emma (observatrice) crée, Bob puis Alice (votants) rejoignent. */
    private static Session observerFirst() {
        return Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", "round-1", EMMA, Pseudo.of("Emma"), Role.OBSERVER,
                ParticipantToken.of("emma"), NOW)
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob"), NOW, 30)
                .join(ALICE, Pseudo.of("Alice"), Role.VOTER, ParticipantToken.of("alice"), NOW, 30);
    }

    @Test
    void votersComeFirstThenObserversEachByJoinOrder() {
        SessionSnapshot snapshot = SessionSnapshot.forRecipient(observerFirst(), BOB);
        assertThat(snapshot.participants()).extracting(SessionSnapshot.Seat::participantId)
                .containsExactly(BOB, ALICE, EMMA);
        assertThat(snapshot.participants()).extracting(SessionSnapshot.Seat::joinOrder).containsExactly(2, 3, 1);
    }

    @Test
    void theSpecOrderingExample() {
        // votants Bob(2), Alice(1), observatrice Emma(3) → Alice, Bob, Emma
        Session session = Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", "round-1", ALICE, Pseudo.of("Alice"),
                Role.VOTER, ParticipantToken.of("alice"), NOW)
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob"), NOW, 30)
                .join(EMMA, Pseudo.of("Emma"), Role.OBSERVER, ParticipantToken.of("emma"), NOW, 30);
        assertThat(SessionSnapshot.forRecipient(session, EMMA).participants())
                .extracting(s -> s.pseudo().value()).containsExactly("Alice", "Bob", "Emma");
    }

    @Test
    void describesAHiddenRoundWithoutVotes() {
        Session session = observerFirst().connect(BOB, "bob-1", NOW);
        SessionSnapshot snapshot = SessionSnapshot.forRecipient(session, BOB);

        assertThat(snapshot.sessionId()).isEqualTo("k3Jx9QvT2mLpZ8wR4nYb7A");
        assertThat(snapshot.version()).isEqualTo(session.version());
        assertThat(snapshot.selfParticipantId()).isEqualTo(BOB);
        assertThat(snapshot.round()).isEqualTo(new SessionSnapshot.Round("round-1", RoundStatus.HIDDEN));
        assertThat(snapshot.progress()).isEqualTo(new SessionSnapshot.Progress(0, 2));
        assertThat(snapshot.lastChange()).isEqualTo(LastChange.of(ChangeAction.PRESENCE, BOB));
        assertThat(snapshot.participants()).allSatisfy(seat -> {
            assertThat(seat.hasVoted()).isFalse();
            assertThat(seat.vote()).isNull();
            assertThat(seat.canVoteThisRound()).isEqualTo(seat.role() == Role.VOTER);
        });
        assertThat(snapshot.participants()).extracting(SessionSnapshot.Seat::connected)
                .containsExactly(true, false, false);
    }

    @Test
    void expectedCountsDisconnectedVotersToo() {
        assertThat(SessionSnapshot.forRecipient(observerFirst(), EMMA).progress().expected()).isEqualTo(2);
    }

    @Test
    void isFilteredForItsRecipientAndCarriesNoToken() {
        Session session = observerFirst();
        SessionSnapshot forAlice = SessionSnapshot.forRecipient(session, ALICE);
        SessionSnapshot forEmma = SessionSnapshot.forRecipient(session, EMMA);
        assertThat(forAlice.selfParticipantId()).isEqualTo(ALICE);
        assertThat(forEmma.selfParticipantId()).isEqualTo(EMMA);
        assertThat(forAlice.toString()).doesNotContain("alice", "bob", "emma",
                ParticipantToken.of("alice").fingerprint());
        assertThat(SessionSnapshot.Seat.class.getRecordComponents())
                .noneMatch(c -> c.getType() == ParticipantToken.class);
    }

    @Test
    void rejectsARecipientOutsideTheSession() {
        assertThatThrownBy(() -> SessionSnapshot.forRecipient(observerFirst(), UUID.randomUUID()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
