package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class SessionPresenceTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");
    private static final Duration TIMEOUT = Duration.ofSeconds(15);
    private static final UUID ALICE = UUID.randomUUID();
    private static final UUID BOB = UUID.randomUUID();

    private static Session session() {
        return Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", "round-1", ALICE, Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("alice"), NOW)
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob"), NOW, 30);
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
        Session after = before.connect(BOB, "bob-1", NOW);
        assertThat(connected(after, BOB)).isTrue();
        assertThat(connected(after, ALICE)).isFalse();
        assertThat(after.version()).isEqualTo(before.version() + 1);
        assertThat(after.lastChange()).isEqualTo(LastChange.of(ChangeAction.PRESENCE, BOB));
    }

    @Test
    void aSecondTabChangesNothingObservable() {
        Session one = session().connect(BOB, "bob-1", NOW);
        Session two = one.connect(BOB, "bob-2", NOW);
        assertThat(two.version()).isEqualTo(one.version());
        assertThat(two.lastChange()).isEqualTo(one.lastChange());
        assertThat(two.participants()).filteredOn(p -> p.id().equals(BOB)).hasSize(1);
        assertThat(two.participant(BOB).orElseThrow().connections()).containsOnlyKeys("bob-1", "bob-2");
    }

    @Test
    void closingOneTabOfTwoKeepsTheParticipantConnected() {
        Session two = session().connect(BOB, "bob-1", NOW).connect(BOB, "bob-2", NOW);
        Session closedOne = two.disconnect(BOB, "bob-1", NOW);
        assertThat(connected(closedOne, BOB)).isTrue();
        assertThat(closedOne.version()).isEqualTo(two.version());
        assertThat(closedOne.lastChange()).isEqualTo(two.lastChange());
    }

    @Test
    void closingTheLastConnectionMakesTheParticipantDisconnected() {
        Session connected = session().connect(BOB, "bob-1", NOW).connect(ALICE, "alice-1", NOW);
        Session after = connected.disconnect(BOB, "bob-1", NOW);
        assertThat(connected(after, BOB)).isFalse();
        assertThat(after.version()).isEqualTo(connected.version() + 1);
        assertThat(after.lastChange()).isEqualTo(LastChange.of(ChangeAction.PRESENCE, BOB));
    }

    @Test
    void closingAConnectionTwiceChangesNothingTheSecondTime() {
        Session closed = session().connect(BOB, "bob-1", NOW).disconnect(BOB, "bob-1", NOW);
        assertThat(closed.disconnect(BOB, "bob-1", NOW)).isSameAs(closed);
    }

    @Test
    void disconnectingWithoutConnectionOrUnknownParticipantChangesNothing() {
        Session session = session().connect(BOB, "bob-1", NOW);
        assertThat(session.disconnect(BOB, "other", NOW)).isSameAs(session);
        assertThat(session.disconnect(ALICE, "bob-1", NOW)).isSameAs(session);
        assertThat(session.disconnect(UUID.randomUUID(), "bob-1", NOW)).isSameAs(session);
    }

    @Test
    void connectingAnUnknownParticipantIsRefused() {
        assertThatThrownBy(() -> session().connect(UUID.randomUUID(), "c1", NOW))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void activityIsAHiddenChange() {
        Session connected = session().connect(BOB, "bob-1", NOW);
        Session touched = connected.touch("bob-1", NOW.plusSeconds(5));
        assertThat(touched).isNotSameAs(connected);
        assertThat(touched.version()).isEqualTo(connected.version());
        assertThat(touched.lastChange()).isEqualTo(connected.lastChange());
        assertThat(touched.participant(BOB).orElseThrow().connections()).containsEntry("bob-1", NOW.plusSeconds(5));
    }

    @Test
    void activityOfAnUnknownConnectionIsIgnored() {
        Session closed = session().connect(BOB, "bob-1", NOW).disconnect(BOB, "bob-1", NOW);
        assertThat(closed.touch("bob-1", NOW)).isSameAs(closed);
    }

    @Test
    void aConnectionSilentForTheTimeoutOrMoreIsSilent() {
        Session session = session().connect(BOB, "bob-1", NOW);
        assertThat(session.silentConnections(NOW.plus(TIMEOUT).minusMillis(1), TIMEOUT)).isEmpty();
        assertThat(session.silentConnections(NOW.plus(TIMEOUT), TIMEOUT))
                .containsExactly(new Session.OpenConnection(BOB, "bob-1"));
    }

    @Test
    void activityKeepsAConnectionAlive() {
        Session session = session().connect(BOB, "bob-1", NOW);
        for (int seconds = 5; seconds <= 60; seconds += 5) {
            session = session.touch("bob-1", NOW.plusSeconds(seconds));
            assertThat(session.silentConnections(NOW.plusSeconds(seconds + 4), TIMEOUT)).isEmpty();
        }
    }

    @Test
    void onlyTheSilentTabIsSilent() {
        Session session = session().connect(BOB, "bob-1", NOW).connect(BOB, "bob-2", NOW)
                .touch("bob-2", NOW.plusSeconds(10));
        assertThat(session.silentConnections(NOW.plus(TIMEOUT), TIMEOUT))
                .containsExactly(new Session.OpenConnection(BOB, "bob-1"));
    }

    @Test
    void findsTheParticipantByToken() {
        assertThat(session().participantWithToken("bob")).map(Participant::id).contains(BOB);
        assertThat(session().participantWithToken("nobody")).isEmpty();
        assertThat(session().participantWithToken(null)).isEmpty();
    }
}
