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
import com.planningpoker.domain.SessionFullException;

class JoinSessionUseCaseTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");

    private final CreateSessionUseCaseTest.RecordingStore store = new CreateSessionUseCaseTest.RecordingStore();
    private final SessionLocks locks = new SessionLocks();
    private final IdGenerator ids = new IdGenerator(new SplittableRandom(11));
    private final CreateSessionUseCase create = new CreateSessionUseCase(store, locks, ids,
            Clock.fixed(NOW, ZoneOffset.UTC), 50);
    private final RecordingBroadcaster broadcaster = new RecordingBroadcaster();
    private final JoinSessionUseCase join = new JoinSessionUseCase(store, locks, ids, broadcaster,
            Clock.fixed(NOW, ZoneOffset.UTC), 30);
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
        assertThat(broadcaster.published).singleElement()
                .satisfies(p -> assertThat(p.session()).isSameAs(session))
                .satisfies(p -> assertThat(p.onlyTo()).isNull());
        assertThat(session.lastChange()).isEqualTo(
                com.planningpoker.domain.LastChange.of(com.planningpoker.domain.ChangeAction.JOIN,
                        result.participantId()));
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

    /** Le créateur ouvre une connexion : son pseudo est pris, pas repris (FR-8). */
    private void connectCreator(String sessionId) {
        Session session = store.sessions.get(sessionId);
        store.sessions.put(sessionId, session.connect(session.participants().get(0).id(), "c-creator", NOW));
        store.calls.clear();
    }

    @Test
    void aTakenPseudoIsRejectedWithoutWriting() {
        String sessionId = sessionOf("Sofia");
        connectCreator(sessionId);
        assertThatThrownBy(() -> join.join(sessionId, " sofia  ", Role.VOTER))
                .isInstanceOf(PseudoTakenException.class);
        assertThat(store.calls).containsExactly("find");
        assertThat(store.sessions.get(sessionId).version()).isEqualTo(2);
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void aDisconnectedPseudoIsTakenOverWithoutBroadcast() {
        String sessionId = sessionOf("Sofia");
        JoinSessionResult bob = join.join(sessionId, "Bob", Role.VOTER);
        Session before = store.sessions.get(sessionId);
        broadcaster.published.clear();
        store.calls.clear();

        JoinSessionResult again = join.join(sessionId, " BOB ", Role.OBSERVER);

        assertThat(again.participantId()).isEqualTo(bob.participantId());
        assertThat(again.participantToken()).isNotEqualTo(bob.participantToken());
        Session after = store.sessions.get(sessionId);
        assertThat(after.version()).isEqualTo(before.version());
        assertThat(after.participants()).hasSize(2);
        assertThat(after.participantWithToken(again.participantToken())).hasValueSatisfying(p -> {
            assertThat(p.id()).isEqualTo(bob.participantId());
            assertThat(p.pseudo().value()).isEqualTo("Bob");
            assertThat(p.role()).isEqualTo(Role.VOTER);
        });
        assertThat(after.participantWithToken(bob.participantToken())).isEmpty();
        assertThat(store.calls).containsExactly("find", "save");
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void aNewcomerToAFullSessionIsRejectedWithoutWritingNorBroadcast() {
        JoinSessionUseCase joinOfTwo = new JoinSessionUseCase(store, locks, ids, broadcaster,
                Clock.fixed(NOW, ZoneOffset.UTC), 2);
        String sessionId = sessionOf("Sofia");
        joinOfTwo.join(sessionId, "Bob", Role.VOTER);
        connectCreator(sessionId);
        broadcaster.published.clear();
        Session before = store.sessions.get(sessionId);

        assertThatThrownBy(() -> joinOfTwo.join(sessionId, "Karim", Role.VOTER))
                .isInstanceOf(SessionFullException.class);
        assertThatThrownBy(() -> joinOfTwo.join(sessionId, "SOFIA", Role.VOTER))
                .isInstanceOf(PseudoTakenException.class);

        assertThat(store.calls).containsExactly("find", "find");
        assertThat(store.sessions.get(sessionId)).isSameAs(before);
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void aDisconnectedParticipantTakesOverHisPlaceInAFullSession() {
        JoinSessionUseCase joinOfTwo = new JoinSessionUseCase(store, locks, ids, broadcaster,
                Clock.fixed(NOW, ZoneOffset.UTC), 2);
        String sessionId = sessionOf("Sofia");
        JoinSessionResult bob = joinOfTwo.join(sessionId, "Bob", Role.VOTER);

        JoinSessionResult again = joinOfTwo.join(sessionId, "bob", Role.VOTER);

        assertThat(again.participantId()).isEqualTo(bob.participantId());
        assertThat(store.sessions.get(sessionId).participants()).hasSize(2);
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
        String sessionId = new CreateSessionUseCase(memory, locks, secureIds, Clock.fixed(NOW, ZoneOffset.UTC), 50)
                .create("Sofia", Role.VOTER).sessionId();
        JoinSessionUseCase concurrentJoin = new JoinSessionUseCase(memory, locks, secureIds,
                new RecordingBroadcaster(), Clock.fixed(NOW, ZoneOffset.UTC), 30);

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
