package com.planningpoker.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.SplittableRandom;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.Test;

import com.planningpoker.adapter.out.memory.InMemorySessionStore;
import com.planningpoker.domain.IdGenerator;
import com.planningpoker.domain.InvalidPseudoException;
import com.planningpoker.domain.Participant;
import com.planningpoker.domain.PseudoTakenException;
import com.planningpoker.domain.Role;
import com.planningpoker.domain.Session;

class JoinSessionUseCaseTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");

    private final CreateSessionUseCaseTest.RecordingStore store = new CreateSessionUseCaseTest.RecordingStore();
    private final SessionLocks locks = new SessionLocks();
    private final IdGenerator ids = new IdGenerator(new SplittableRandom(11));
    private final CreateSessionUseCase create = new CreateSessionUseCase(store, locks, ids,
            Clock.fixed(NOW, ZoneOffset.UTC));
    private final JoinSessionUseCase join = new JoinSessionUseCase(store, locks, ids);
    private final CheckSessionUseCase check = new CheckSessionUseCase(store);

    private String sessionOf(String creator) {
        String sessionId = create.create(creator, Role.VOTER).sessionId();
        store.calls.clear();
        return sessionId;
    }

    @Test
    void joinsAnExistingSession() {
        String sessionId = sessionOf("Sofia");

        JoinSessionResult result = join.join(sessionId, "  Bob ", Role.VOTER);

        assertThat(result.participantToken()).matches("^[A-Za-z0-9_-]{22}$");
        Session session = store.sessions.get(sessionId);
        assertThat(session.version()).isEqualTo(2);
        assertThat(session.participants()).hasSize(2).last().satisfies(p -> {
            assertThat(p.id()).isEqualTo(result.participantId());
            assertThat(p.pseudo().value()).isEqualTo("Bob");
            assertThat(p.joinOrder()).isEqualTo(2);
            assertThat(p.token().matches(result.participantToken())).isTrue();
        });
        assertThat(store.calls).containsExactly("find", "save");
        assertThat(result.toString()).doesNotContain(result.participantToken());
    }

    @Test
    void threeArrivalsGetJoinOrders2To4() {
        String sessionId = sessionOf("Sofia");
        join.join(sessionId, "Bob", Role.VOTER);
        join.join(sessionId, "Karim", Role.OBSERVER);
        join.join(sessionId, "Paul", Role.VOTER);

        Session session = store.sessions.get(sessionId);
        assertThat(session.participants()).extracting(Participant::joinOrder).containsExactly(1, 2, 3, 4);
        assertThat(session.version()).isEqualTo(4);
    }

    @Test
    void anUnknownSessionIsNotFoundEvenWithAnInvalidPseudo() {
        assertThatThrownBy(() -> join.join("k3Jx9QvT2mLpZ8wR4nYb7A", "Bob", Role.VOTER))
                .isInstanceOf(SessionNotFoundException.class);
        assertThatThrownBy(() -> join.join("abc", "   ", Role.VOTER))
                .isInstanceOf(SessionNotFoundException.class);
        assertThat(store.calls).doesNotContain("save");
    }

    @Test
    void anInvalidPseudoOnAnExistingSessionIsRejectedWithoutWriting() {
        String sessionId = sessionOf("Sofia");
        assertThatThrownBy(() -> join.join(sessionId, "   ", Role.VOTER)).isInstanceOf(InvalidPseudoException.class);
        assertThat(store.calls).containsExactly("find");
    }

    @Test
    void aTakenPseudoIsRejectedWithoutWriting() {
        String sessionId = sessionOf("Sofia");
        assertThatThrownBy(() -> join.join(sessionId, " sofia  ", Role.VOTER))
                .isInstanceOf(PseudoTakenException.class);
        assertThat(store.calls).containsExactly("find");
        assertThat(store.sessions.get(sessionId).version()).isEqualTo(1);
    }

    @Test
    void checkTellsWhetherTheSessionExists() {
        String sessionId = sessionOf("Sofia");
        check.check(sessionId);
        assertThatThrownBy(() -> check.check("abc")).isInstanceOf(SessionNotFoundException.class);
        assertThatThrownBy(() -> check.check("k3Jx9QvT2mLpZ8wR4nYb7")).isInstanceOf(SessionNotFoundException.class);
    }

    @Test
    void twentySimultaneousArrivalsAllGetDistinctJoinOrders() throws Exception {
        InMemorySessionStore memory = new InMemorySessionStore();
        IdGenerator secureIds = new IdGenerator(new java.security.SecureRandom());
        String sessionId = new CreateSessionUseCase(memory, locks, secureIds, Clock.fixed(NOW, ZoneOffset.UTC))
                .create("Sofia", Role.VOTER).sessionId();
        JoinSessionUseCase concurrentJoin = new JoinSessionUseCase(memory, locks, secureIds);

        int arrivals = 20;
        ExecutorService pool = Executors.newFixedThreadPool(arrivals);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<JoinSessionResult>> futures = new ArrayList<>();
            for (int i = 0; i < arrivals; i++) {
                String pseudo = "Votant " + i;
                futures.add(pool.submit(() -> {
                    start.await();
                    return concurrentJoin.join(sessionId, pseudo, Role.VOTER);
                }));
            }
            start.countDown();
            for (Future<JoinSessionResult> future : futures) {
                future.get();
            }
        } finally {
            pool.shutdownNow();
        }

        Session session = memory.find(sessionId).orElseThrow();
        assertThat(session.participants()).hasSize(arrivals + 1);
        assertThat(session.participants().stream().skip(1).map(Participant::joinOrder).sorted().toList())
                .containsExactlyElementsOf(java.util.stream.IntStream.rangeClosed(2, arrivals + 1).boxed().toList());
        assertThat(session.version()).isEqualTo(arrivals + 1);
    }
}
