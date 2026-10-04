package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

/** Expiration d'une session au bout de sa durée de vie (FR-4, NFR-6), horloge fixe. */
class SessionExpiryTest {

    private static final Instant CREATED = Instant.parse("2026-10-02T09:00:00Z");
    private static final Duration LIFETIME = Duration.ofHours(24);
    private static final UUID ALICE = UUID.fromString("3f6c2a1e-8b4d-4c7a-9e2f-1d5b6a7c8e90");
    private static final UUID BOB = UUID.fromString("7d2e9f4a-1c3b-4e5d-8a6f-2b9c0d1e3f45");

    private static Session session() {
        return Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", "round-1", ALICE, Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("alice"), CREATED);
    }

    @Test
    void aSessionIsAliveAtTwentyThreeHoursFiftyNine() {
        assertThat(session().isExpired(CREATED.plus(Duration.ofHours(23).plusMinutes(59)), LIFETIME)).isFalse();
        assertThat(session().isExpired(CREATED.plus(LIFETIME).minusMillis(1), LIFETIME)).isFalse();
    }

    @Test
    void aSessionIsExpiredFromTwentyFourHours() {
        assertThat(session().isExpired(CREATED.plus(LIFETIME), LIFETIME)).isTrue();
        assertThat(session().isExpired(CREATED.plus(Duration.ofHours(25)), LIFETIME)).isTrue();
    }

    @Test
    void openConnectionsListsEveryConnectionOfEveryParticipant() {
        Session session = session()
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob"), CREATED, 30)
                .connect(ALICE, "alice-1", CREATED)
                .connect(ALICE, "alice-2", CREATED)
                .connect(BOB, "bob-1", CREATED);

        assertThat(session.openConnections()).containsExactlyInAnyOrder(
                new Session.OpenConnection(ALICE, "alice-1"),
                new Session.OpenConnection(ALICE, "alice-2"),
                new Session.OpenConnection(BOB, "bob-1"));
        assertThat(session().openConnections()).isEmpty();
    }
}
