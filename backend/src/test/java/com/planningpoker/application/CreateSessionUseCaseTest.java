package com.planningpoker.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.Collection;
import java.util.Deque;
import java.util.List;
import java.util.Optional;
import java.util.SplittableRandom;
import java.util.concurrent.ConcurrentHashMap;
import java.util.random.RandomGenerator;

import org.junit.jupiter.api.Test;

import com.planningpoker.domain.IdGenerator;
import com.planningpoker.domain.InvalidPseudoException;
import com.planningpoker.domain.Role;
import com.planningpoker.domain.Session;

class CreateSessionUseCaseTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");

    /** Stockage de test qui note les appels. */
    static final class RecordingStore implements SessionStore {
        final ConcurrentHashMap<String, Session> sessions = new ConcurrentHashMap<>();
        final List<String> calls = new java.util.ArrayList<>();

        @Override
        public Optional<Session> find(String sessionId) {
            calls.add("find");
            return Optional.ofNullable(sessions.get(sessionId));
        }

        @Override
        public void save(Session session) {
            calls.add("save");
            sessions.put(session.id(), session);
        }

        @Override
        public void delete(String sessionId) {
            sessions.remove(sessionId);
        }

        @Override
        public Collection<Session> all() {
            return sessions.values();
        }
    }

    private final RecordingStore store = new RecordingStore();
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    private CreateSessionUseCase useCase(RandomGenerator random) {
        return new CreateSessionUseCase(store, new SessionLocks(), new IdGenerator(random), clock);
    }

    @Test
    void createsTheSessionWithItsCreator() {
        CreateSessionResult result = useCase(new SplittableRandom(1)).create("  Sofia ", Role.VOTER);

        assertThat(result.sessionId()).matches("^[A-Za-z0-9_-]{22}$");
        assertThat(result.participantToken()).matches("^[A-Za-z0-9_-]{22}$");
        Session session = store.sessions.get(result.sessionId());
        assertThat(session.createdAt()).isEqualTo(NOW);
        assertThat(session.participants()).singleElement().satisfies(p -> {
            assertThat(p.id()).isEqualTo(result.participantId());
            assertThat(p.pseudo().value()).isEqualTo("Sofia");
            assertThat(p.role()).isEqualTo(Role.VOTER);
            assertThat(p.token().matches(result.participantToken())).isTrue();
        });
        assertThat(store.calls).containsExactly("find", "save");
    }

    @Test
    void createsAnObserver() {
        CreateSessionResult result = useCase(new SplittableRandom(2)).create("Eric", Role.OBSERVER);
        assertThat(store.sessions.get(result.sessionId()).participants().getFirst().role()).isEqualTo(Role.OBSERVER);
    }

    @Test
    void rejectsAnInvalidPseudoWithoutWritingAnything() {
        assertThatThrownBy(() -> useCase(new SplittableRandom(3)).create("   ", Role.VOTER))
                .isInstanceOf(InvalidPseudoException.class);
        assertThat(store.calls).isEmpty();
    }

    @Test
    void drawsANewSessionIdOnACollision() {
        // Le générateur rejoue la même suite : le deuxième appel tombe sur l'identifiant de session du premier.
        Deque<SplittableRandom> seeds = new ArrayDeque<>(List.of(new SplittableRandom(7), new SplittableRandom(7)));
        CreateSessionResult first = useCase(seeds.pop()).create("Alice", Role.VOTER);
        CreateSessionResult second = useCase(seeds.pop()).create("Paul", Role.VOTER);

        assertThat(second.sessionId()).isNotEqualTo(first.sessionId());
        assertThat(store.sessions).hasSize(2);
        assertThat(store.sessions.get(first.sessionId()).participants().getFirst().pseudo().value())
                .isEqualTo("Alice");
    }

    @Test
    void theResultDoesNotPrintTheToken() {
        CreateSessionResult result = useCase(new SplittableRandom(4)).create("Alice", Role.VOTER);
        assertThat(result.toString()).doesNotContain(result.participantToken());
    }
}
