package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class SessionPresenceTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");
    private static final UUID ALICE = UUID.randomUUID();
    private static final UUID BOB = UUID.randomUUID();

    private static Session session() {
        return Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", "round-1", ALICE, Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("alice"), NOW)
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob"));
    }

    private static boolean connected(Session session, UUID id) {
        return session.participant(id).orElseThrow().connected();
    }

    @Test
    void creationAndJoinAreJoinChangesByTheNewcomer() {
        Session created = Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", "round-1", ALICE, Pseudo.of("Alice"),
                Role.VOTER, ParticipantToken.of("alice"), NOW);
        assertThat(created.lastChange()).isEqualTo(LastChange.of(ChangeAction.JOIN, ALICE));
        assertThat(session().lastChange()).isEqualTo(LastChange.of(ChangeAction.JOIN, BOB));
        assertThat(connected(session(), BOB)).isFalse();
    }

    @Test
    void theFirstConnectionMakesTheParticipantConnected() {
        Session before = session();
        Session after = before.connect(BOB);
        assertThat(connected(after, BOB)).isTrue();
        assertThat(connected(after, ALICE)).isFalse();
        assertThat(after.version()).isEqualTo(before.version() + 1);
        assertThat(after.lastChange()).isEqualTo(LastChange.of(ChangeAction.PRESENCE, BOB));
    }

    @Test
    void aSecondTabChangesNothingObservable() {
        Session one = session().connect(BOB);
        Session two = one.connect(BOB);
        assertThat(two.version()).isEqualTo(one.version());
        assertThat(two.lastChange()).isEqualTo(one.lastChange());
        assertThat(two.participant(BOB).orElseThrow().connections()).isEqualTo(2);

        Session closedOne = two.disconnect(BOB);
        assertThat(connected(closedOne, BOB)).isTrue();
        assertThat(closedOne.version()).isEqualTo(one.version());
    }

    @Test
    void closingTheLastConnectionMakesTheParticipantDisconnected() {
        Session connected = session().connect(BOB).connect(ALICE);
        Session after = connected.disconnect(BOB);
        assertThat(connected(after, BOB)).isFalse();
        assertThat(after.version()).isEqualTo(connected.version() + 1);
        assertThat(after.lastChange()).isEqualTo(LastChange.of(ChangeAction.PRESENCE, BOB));
    }

    @Test
    void disconnectingWithoutConnectionOrUnknownParticipantChangesNothing() {
        Session session = session();
        assertThat(session.disconnect(BOB)).isSameAs(session);
        assertThat(session.disconnect(UUID.randomUUID())).isSameAs(session);
    }

    @Test
    void connectingAnUnknownParticipantIsRefused() {
        assertThatThrownBy(() -> session().connect(UUID.randomUUID())).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void findsTheParticipantByToken() {
        assertThat(session().participantWithToken("bob")).map(Participant::id).contains(BOB);
        assertThat(session().participantWithToken("nobody")).isEmpty();
        assertThat(session().participantWithToken(null)).isEmpty();
    }
}
