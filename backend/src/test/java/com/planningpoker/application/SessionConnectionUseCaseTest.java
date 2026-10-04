package com.planningpoker.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.SplittableRandom;

import org.junit.jupiter.api.Test;

import com.planningpoker.adapter.out.memory.InMemorySessionStore;
import com.planningpoker.domain.ChangeAction;
import com.planningpoker.domain.IdGenerator;
import com.planningpoker.domain.LastChange;
import com.planningpoker.domain.Role;
import com.planningpoker.domain.Session;

class SessionConnectionUseCaseTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");

    private final InMemorySessionStore store = new InMemorySessionStore();
    private final SessionLocks locks = new SessionLocks();
    private final IdGenerator ids = new IdGenerator(new SplittableRandom(5));
    private final RecordingBroadcaster broadcaster = new RecordingBroadcaster();
    private final MutableClock clock = new MutableClock(NOW);
    private final SessionConnectionUseCase connections = new SessionConnectionUseCase(store, locks, broadcaster,
            clock);
    private final CreateSessionResult created = new CreateSessionUseCase(store, locks, ids,
            Clock.fixed(NOW, ZoneOffset.UTC)).create("Alice", Role.VOTER);
    private final SweepUseCase sweep = new SweepUseCase(store, locks, broadcaster, clock, Duration.ofSeconds(15),
            Duration.ofMinutes(5));

    private Session session() {
        return store.find(created.sessionId()).orElseThrow();
    }

    /** Alice se connecte puis se déconnecte, et reste absente cinq minutes : le balayeur la retire. */
    private void aliceLeavesForFiveMinutes() {
        connections.connect(created.sessionId(), created.participantToken(), "c1");
        connections.disconnect(created.sessionId(), created.participantId(), "c1");
        clock.advance(Duration.ofMinutes(5));
        sweep.sweep();
        assertThat(session().participants()).isEmpty();
    }

    @Test
    void anUnknownSessionIsCheckedBeforeTheToken() {
        assertThat(connections.connect("k3Jx9QvT2mLpZ8wR4nYb7A", created.participantToken(), "c1"))
                .isInstanceOf(ConnectResult.SessionNotFound.class);
        assertThat(connections.connect(null, created.participantToken(), "c1"))
                .isInstanceOf(ConnectResult.SessionNotFound.class);
        assertThat(broadcaster.attached).isEmpty();
    }

    @Test
    void anUnknownTokenIsRefused() {
        assertThat(connections.connect(created.sessionId(), "Xb4Rt9LmQ2vN7cZp1HsK0w", "c1"))
                .isInstanceOf(ConnectResult.UnknownToken.class);
        assertThat(broadcaster.attached).isEmpty();
        assertThat(session().version()).isEqualTo(1);
    }

    @Test
    void theFirstConnectionChangesPresenceAndPublishesToEveryone() {
        ConnectResult result = connections.connect(created.sessionId(), created.participantToken(), "c1");

        assertThat(result).isEqualTo(new ConnectResult.Connected(created.participantId()));
        assertThat(broadcaster.attached).containsEntry("c1", created.participantId());
        assertThat(session().version()).isEqualTo(2);
        assertThat(session().lastChange().action()).isEqualTo(ChangeAction.PRESENCE);
        assertThat(broadcaster.published).singleElement().satisfies(p -> {
            assertThat(p.session()).isSameAs(session());
            assertThat(p.onlyTo()).isNull();
        });
    }

    @Test
    void aSecondTabOnlyGetsItsOwnSnapshotAndClosingOneChangesNothing() {
        connections.connect(created.sessionId(), created.participantToken(), "c1");
        broadcaster.published.clear();

        connections.connect(created.sessionId(), created.participantToken(), "c2");
        assertThat(session().version()).isEqualTo(2);
        assertThat(broadcaster.published).singleElement().satisfies(p -> assertThat(p.onlyTo()).isEqualTo("c2"));

        broadcaster.published.clear();
        connections.disconnect(created.sessionId(), created.participantId(), "c1");
        assertThat(session().version()).isEqualTo(2);
        assertThat(session().participant(created.participantId()).orElseThrow().connected()).isTrue();
        assertThat(broadcaster.published).isEmpty();

        connections.disconnect(created.sessionId(), created.participantId(), "c2");
        assertThat(session().version()).isEqualTo(3);
        assertThat(session().participant(created.participantId()).orElseThrow().connected()).isFalse();
        assertThat(broadcaster.published).singleElement().satisfies(p -> assertThat(p.onlyTo()).isNull());
    }

    @Test
    void aConnectionIsDetachedOnlyOnce() {
        connections.connect(created.sessionId(), created.participantToken(), "c1");
        connections.connect(created.sessionId(), created.participantToken(), "c2");
        connections.disconnect(created.sessionId(), created.participantId(), "c1");
        connections.disconnect(created.sessionId(), created.participantId(), "c1");
        assertThat(session().participant(created.participantId()).orElseThrow().connected()).isTrue();
    }

    @Test
    void aConnectionClosedBeforeItsHelloIsProcessedChangesNothing() {
        broadcaster.closed.add("c1");
        assertThat(connections.connect(created.sessionId(), created.participantToken(), "c1"))
                .isInstanceOf(ConnectResult.ConnectionClosed.class);
        assertThat(session().version()).isEqualTo(1);
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void theConnectionIsActiveWhenItOpens() {
        clock.advance(Duration.ofSeconds(3));
        connections.connect(created.sessionId(), created.participantToken(), "c1");
        assertThat(session().participant(created.participantId()).orElseThrow().connections())
                .containsEntry("c1", NOW.plusSeconds(3));
    }

    @Test
    void activityIsRecordedWithoutVersionNorBroadcast() {
        connections.connect(created.sessionId(), created.participantToken(), "c1");
        broadcaster.published.clear();
        long version = session().version();

        clock.advance(Duration.ofSeconds(5));
        connections.touch(created.sessionId(), "c1");

        assertThat(session().version()).isEqualTo(version);
        assertThat(broadcaster.published).isEmpty();
        assertThat(session().participant(created.participantId()).orElseThrow().connections())
                .containsEntry("c1", NOW.plusSeconds(5));
    }

    @Test
    void activityOfAnUnknownConnectionOrSessionIsIgnored() {
        Session before = session();
        connections.touch(created.sessionId(), "c9");
        connections.touch("k3Jx9QvT2mLpZ8wR4nYb7A", "c9");
        assertThat(session()).isSameAs(before);
    }

    @Test
    void aRemovedParticipantWhosePseudoIsFreeIsBackAtTheTableWithASingleJoin() {
        aliceLeavesForFiveMinutes();
        broadcaster.published.clear();
        long version = session().version();

        ConnectResult result = connections.connect(created.sessionId(), created.participantToken(), "c2");

        assertThat(result).isEqualTo(new ConnectResult.Connected(created.participantId()));
        assertThat(broadcaster.attached).containsEntry("c2", created.participantId());
        assertThat(session().version()).isEqualTo(version + 1);
        assertThat(session().lastChange()).isEqualTo(LastChange.of(ChangeAction.JOIN, created.participantId()));
        assertThat(session().participant(created.participantId()).orElseThrow()).satisfies(p -> {
            assertThat(p.connected()).isTrue();
            assertThat(p.pseudo().value()).isEqualTo("Alice");
            assertThat(p.role()).isEqualTo(Role.VOTER);
            assertThat(p.joinOrder()).isEqualTo(2);
        });
        assertThat(broadcaster.published).singleElement().satisfies(p -> {
            assertThat(p.session()).isSameAs(session());
            assertThat(p.onlyTo()).isNull();
        });
    }

    @Test
    void aRemovedParticipantWhosePseudoWasTakenIsRefusedAndNothingChanges() {
        aliceLeavesForFiveMinutes();
        new JoinSessionUseCase(store, locks, ids, broadcaster, clock).join(created.sessionId(), "ALICE",
                Role.OBSERVER);
        broadcaster.published.clear();
        Session before = session();

        assertThat(connections.connect(created.sessionId(), created.participantToken(), "c2"))
                .isInstanceOf(ConnectResult.UnknownToken.class);

        assertThat(session()).isSameAs(before);
        assertThat(broadcaster.attached).doesNotContainKey("c2");
        assertThat(broadcaster.published).isEmpty();
        assertThat(session().departedWithToken(created.participantToken())).isPresent();
    }

    @Test
    void aRemovedParticipantWhoseConnectionClosedBeforeItsHelloStaysRemoved() {
        aliceLeavesForFiveMinutes();
        broadcaster.published.clear();
        Session before = session();
        broadcaster.closed.add("c2");

        assertThat(connections.connect(created.sessionId(), created.participantToken(), "c2"))
                .isInstanceOf(ConnectResult.ConnectionClosed.class);

        assertThat(session()).isSameAs(before);
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void aParticipantCanBeRemovedAndComeBackAgain() {
        aliceLeavesForFiveMinutes();
        connections.connect(created.sessionId(), created.participantToken(), "c2");
        connections.disconnect(created.sessionId(), created.participantId(), "c2");
        clock.advance(Duration.ofMinutes(5));
        sweep.sweep();
        assertThat(session().participants()).isEmpty();

        assertThat(connections.connect(created.sessionId(), created.participantToken(), "c3"))
                .isEqualTo(new ConnectResult.Connected(created.participantId()));
        assertThat(session().participant(created.participantId()).orElseThrow().joinOrder()).isEqualTo(3);
    }

    @Test
    void afterATakeOverTheOldTokenIsRefusedAndTheNewOneConnectsTheSameParticipant() {
        connections.connect(created.sessionId(), created.participantToken(), "c1");
        connections.disconnect(created.sessionId(), created.participantId(), "c1");
        JoinSessionResult takenOver = new JoinSessionUseCase(store, locks, ids, broadcaster, clock)
                .join(created.sessionId(), "alice", Role.OBSERVER);
        assertThat(takenOver.participantId()).isEqualTo(created.participantId());
        broadcaster.published.clear();
        Session before = session();

        assertThat(connections.connect(created.sessionId(), created.participantToken(), "c2"))
                .isInstanceOf(ConnectResult.UnknownToken.class);
        assertThat(session()).isSameAs(before);
        assertThat(broadcaster.attached).doesNotContainKey("c2");
        assertThat(broadcaster.published).isEmpty();

        assertThat(connections.connect(created.sessionId(), takenOver.participantToken(), "c3"))
                .isEqualTo(new ConnectResult.Connected(created.participantId()));
        assertThat(session().version()).isEqualTo(before.version() + 1);
        assertThat(session().lastChange()).isEqualTo(LastChange.of(ChangeAction.PRESENCE, created.participantId()));
        assertThat(session().participant(created.participantId()).orElseThrow().role()).isEqualTo(Role.VOTER);
        assertThat(broadcaster.published).singleElement().satisfies(p -> assertThat(p.onlyTo()).isNull());
    }
}
