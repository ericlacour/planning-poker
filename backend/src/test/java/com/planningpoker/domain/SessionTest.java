package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

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
        assertThat(session.nextJoinOrder()).isEqualTo(2);
        assertThat(session.participants()).singleElement().satisfies(p -> {
            assertThat(p.id()).isEqualTo(creatorId);
            assertThat(p.pseudo().value()).isEqualTo("Eric");
            assertThat(p.role()).isEqualTo(Role.OBSERVER);
            assertThat(p.joinOrder()).isEqualTo(1);
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

    private static Session sessionCreatedBy(String pseudo) {
        return Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", "round-1", UUID.randomUUID(), Pseudo.of(pseudo), Role.VOTER,
                ParticipantToken.of("creator-secret"), NOW);
    }

    @Test
    void joiningAddsAParticipantAfterTheCreator() {
        Session created = sessionCreatedBy("Sofia");
        UUID bobId = UUID.randomUUID();

        Session joined = created.join(bobId, Pseudo.of("  Bob "), Role.OBSERVER, ParticipantToken.of("bob-secret"));

        assertThat(joined).isNotSameAs(created);
        assertThat(created.participants()).hasSize(1);
        assertThat(joined.version()).isEqualTo(2);
        assertThat(joined.nextJoinOrder()).isEqualTo(3);
        assertThat(joined.id()).isEqualTo(created.id());
        assertThat(joined.roundId()).isEqualTo(created.roundId());
        assertThat(joined.createdAt()).isEqualTo(created.createdAt());
        assertThat(joined.participants()).hasSize(2).last().satisfies(p -> {
            assertThat(p.id()).isEqualTo(bobId);
            assertThat(p.pseudo().value()).isEqualTo("Bob");
            assertThat(p.role()).isEqualTo(Role.OBSERVER);
            assertThat(p.joinOrder()).isEqualTo(2);
            assertThat(p.token().matches("bob-secret")).isTrue();
        });
    }

    @Test
    void successiveArrivalsGetIncreasingJoinOrdersAndVersions() {
        Session session = sessionCreatedBy("Sofia");
        for (String pseudo : new String[] { "Bob", "Karim", "Paul" }) {
            session = session.join(UUID.randomUUID(), Pseudo.of(pseudo), Role.VOTER, ParticipantToken.of(pseudo));
        }
        assertThat(session.participants()).extracting(Participant::joinOrder).containsExactly(1, 2, 3, 4);
        assertThat(session.version()).isEqualTo(4);
        assertThat(session.nextJoinOrder()).isEqualTo(5);
    }

    @ParameterizedTest
    @ValueSource(strings = { "Sofia", " sofia  ", "SOFIA", "\u2003sOfIa\t" })
    void aPseudoAlreadyPresentIgnoringCaseAndSpacesIsTaken(String pseudo) {
        Session created = sessionCreatedBy("Sofia");
        assertThatThrownBy(() -> created.join(UUID.randomUUID(), Pseudo.of(pseudo), Role.VOTER,
                ParticipantToken.of("x"))).isInstanceOf(PseudoTakenException.class);
    }

    @Test
    void uniquenessComparesNormalizedPseudos() {
        Session created = sessionCreatedBy("\u00c9lodie");
        assertThatThrownBy(() -> created.join(UUID.randomUUID(), Pseudo.of("E\u0301lodie"), Role.VOTER,
                ParticipantToken.of("x"))).isInstanceOf(PseudoTakenException.class);
        assertThatThrownBy(() -> created.join(UUID.randomUUID(), Pseudo.of("\u00e9LODIE"), Role.VOTER,
                ParticipantToken.of("x"))).isInstanceOf(PseudoTakenException.class);
    }

    @Test
    void aTakenPseudoAmongLaterArrivalsIsAlsoRejected() {
        Session session = sessionCreatedBy("Sofia").join(UUID.randomUUID(), Pseudo.of("Bob"), Role.OBSERVER,
                ParticipantToken.of("b"));
        Session finalSession = session;
        assertThatThrownBy(() -> finalSession.join(UUID.randomUUID(), Pseudo.of("bob"), Role.VOTER,
                ParticipantToken.of("x"))).isInstanceOf(PseudoTakenException.class);
    }
}
