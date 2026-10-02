package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class SessionTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");

    @Test
    void aNewSessionHasItsCreatorAsOnlyParticipant() {
        UUID creatorId = UUID.randomUUID();
        Session session = Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", "round-1", creatorId, Pseudo.of("Eric"),
                Role.OBSERVER, ParticipantToken.of("secret"), NOW);

        assertThat(session.id()).isEqualTo("k3Jx9QvT2mLpZ8wR4nYb7A");
        assertThat(session.roundId()).isEqualTo("round-1");
        assertThat(session.version()).isEqualTo(1);
        assertThat(session.createdAt()).isEqualTo(NOW);
        assertThat(session.nextJoinOrder()).isEqualTo(1);
        assertThat(session.participants()).singleElement().satisfies(p -> {
            assertThat(p.id()).isEqualTo(creatorId);
            assertThat(p.pseudo().value()).isEqualTo("Eric");
            assertThat(p.role()).isEqualTo(Role.OBSERVER);
            assertThat(p.joinOrder()).isZero();
            assertThat(p.token().matches("secret")).isTrue();
        });
    }

    @Test
    void theTokenIsKeptAsAFingerprintOnly() {
        ParticipantToken token = ParticipantToken.of("Xb4Rt9LmQ2vN7cZp1HsK0w");
        assertThat(token.fingerprint()).doesNotContain("Xb4Rt9LmQ2vN7cZp1HsK0w");
        assertThat(token.toString()).doesNotContain(token.fingerprint());
        assertThat(token.matches("Xb4Rt9LmQ2vN7cZp1HsK0w")).isTrue();
        assertThat(token.matches("Xb4Rt9LmQ2vN7cZp1HsK0x")).isFalse();
        assertThat(token.matches(null)).isFalse();
    }
}
