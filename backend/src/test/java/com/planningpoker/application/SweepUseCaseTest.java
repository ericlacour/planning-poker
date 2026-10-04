package com.planningpoker.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.SplittableRandom;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.planningpoker.adapter.out.memory.InMemorySessionStore;
import com.planningpoker.domain.ChangeAction;
import com.planningpoker.domain.IdGenerator;
import com.planningpoker.domain.LastChange;
import com.planningpoker.domain.Role;
import com.planningpoker.domain.Session;

class SweepUseCaseTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");
    private static final Duration TIMEOUT = Duration.ofSeconds(15);
    private static final Duration ABSENCE = Duration.ofMinutes(5);
    private static final Duration LIFETIME = Duration.ofHours(24);

    private final InMemorySessionStore store = new InMemorySessionStore();
    private final SessionLocks locks = new SessionLocks();
    private final IdGenerator ids = new IdGenerator(new SplittableRandom(7));
    private final RecordingBroadcaster broadcaster = new RecordingBroadcaster();
    private final MutableClock clock = new MutableClock(NOW);
    private final SessionConnectionUseCase connections = new SessionConnectionUseCase(store, locks, broadcaster,
            clock, 30);
    private final SweepUseCase sweep = new SweepUseCase(store, locks, broadcaster, clock, TIMEOUT, ABSENCE, LIFETIME);
    private final CreateSessionResult created = new CreateSessionUseCase(store, locks, ids,
            Clock.fixed(NOW, ZoneOffset.UTC), 50).create("Alice", Role.VOTER);

    private Session session() {
        return store.find(created.sessionId()).orElseThrow();
    }

    private boolean connected() {
        return session().participant(created.participantId()).orElseThrow().connected();
    }

    private void connect(String connectionId) {
        connections.connect(created.sessionId(), created.participantToken(), connectionId);
    }

    @Test
    void aConnectionIsNotClosedBeforeTheTimeout() {
        connect("c1");
        broadcaster.published.clear();

        clock.advance(TIMEOUT.minusMillis(1));
        sweep.sweep();

        assertThat(connected()).isTrue();
        assertThat(broadcaster.attached).containsKey("c1");
        assertThat(broadcaster.closeRequested).isEmpty();
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void aConnectionSilentForTheTimeoutIsDetachedClosedAndThePresenceChangeIsPublished() {
        connect("c1");
        broadcaster.published.clear();
        long version = session().version();

        clock.advance(TIMEOUT);
        sweep.sweep();

        assertThat(connected()).isFalse();
        assertThat(session().version()).isEqualTo(version + 1);
        assertThat(session().lastChange()).isEqualTo(LastChange.of(ChangeAction.PRESENCE, created.participantId()));
        assertThat(broadcaster.attached).doesNotContainKey("c1");
        assertThat(broadcaster.closeRequested).containsExactly("c1");
        assertThat(broadcaster.published).singleElement().satisfies(p -> {
            assertThat(p.session()).isSameAs(session());
            assertThat(p.onlyTo()).isNull();
        });
    }

    @Test
    void anActiveConnectionIsNeverClosed() {
        connect("c1");
        for (int i = 0; i < 12; i++) {
            clock.advance(Duration.ofSeconds(5));
            connections.touch(created.sessionId(), "c1");
            sweep.sweep();
        }
        assertThat(connected()).isTrue();
        assertThat(broadcaster.closeRequested).isEmpty();
    }

    @Test
    void closingTheSilentTabOfTwoPublishesNothing() {
        connect("c1");
        connect("c2");
        broadcaster.published.clear();
        long version = session().version();

        clock.advance(Duration.ofSeconds(10));
        connections.touch(created.sessionId(), "c2");
        clock.advance(Duration.ofSeconds(5));
        sweep.sweep();

        assertThat(connected()).isTrue();
        assertThat(session().version()).isEqualTo(version);
        assertThat(broadcaster.closeRequested).containsExactly("c1");
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void theSocketClosingAfterTheSweepChangesNothingMore() {
        connect("c1");
        clock.advance(TIMEOUT);
        sweep.sweep();
        broadcaster.published.clear();
        Session swept = session();

        connections.disconnect(created.sessionId(), created.participantId(), "c1");
        connections.touch(created.sessionId(), "c1");

        assertThat(session()).isSameAs(swept);
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void aSweepWithoutSilentConnectionSavesNothing() {
        connect("c1");
        Session before = session();
        sweep.sweep();
        assertThat(session()).isSameAs(before);
    }

    @Test
    void aSessionThatDisappearsDuringTheSweepIsIgnored() {
        connect("c1");
        clock.advance(TIMEOUT);
        SessionStore vanishing = new SessionStore() {
            @Override
            public Optional<Session> find(String sessionId) {
                return Optional.empty();
            }

            @Override
            public void save(Session session) {
                throw new AssertionError("nothing to save");
            }

            @Override
            public void delete(String sessionId) {
            }

            @Override
            public Collection<Session> all() {
                return List.of(session());
            }

            @Override
            public int count() {
                return 1;
            }
        };
        new SweepUseCase(vanishing, locks, broadcaster, clock, TIMEOUT, ABSENCE, LIFETIME).sweep();
        assertThat(broadcaster.closeRequested).isEmpty();
    }

    @Test
    void theRuleIsAppliedToEverySession() {
        CreateSessionResult other = new CreateSessionUseCase(store, locks, ids, Clock.fixed(NOW, ZoneOffset.UTC), 50)
                .create("Bob", Role.VOTER);
        connect("c1");
        connections.connect(other.sessionId(), other.participantToken(), "c2");
        clock.advance(TIMEOUT);
        sweep.sweep();
        assertThat(broadcaster.closeRequested).containsExactlyInAnyOrder("c1", "c2");
        UUID bob = other.participantId();
        assertThat(store.find(other.sessionId()).orElseThrow().participant(bob).orElseThrow().connected()).isFalse();
    }

    @Test
    void eachParticipantSweptInTheSamePassGetsItsOwnPresenceChange() {
        JoinSessionResult bob = new JoinSessionUseCase(store, locks, ids, broadcaster,
                Clock.fixed(NOW, ZoneOffset.UTC), 30)
                .join(created.sessionId(), "Bob", Role.VOTER);
        connect("c1");
        connections.connect(created.sessionId(), bob.participantToken(), "c2");
        broadcaster.published.clear();
        long version = session().version();

        clock.advance(TIMEOUT);
        sweep.sweep();

        assertThat(broadcaster.published).hasSize(2);
        assertThat(broadcaster.published).extracting(p -> p.session().version())
                .containsExactly(version + 1, version + 2);
        assertThat(broadcaster.published).extracting(p -> p.session().lastChange().byParticipantId())
                .containsExactlyInAnyOrder(created.participantId(), bob.participantId());
    }

    private JoinSessionResult bobJoins() {
        return new JoinSessionUseCase(store, locks, ids, broadcaster, clock, 30)
                .join(created.sessionId(), "Bob", Role.VOTER);
    }

    @Test
    void aParticipantWithoutConnectionForTheAbsenceTimeoutIsRemovedAndTheLeaveIsPublished() {
        connect("c1");
        JoinSessionResult bob = bobJoins();
        connections.connect(created.sessionId(), bob.participantToken(), "c2");
        clock.advance(Duration.ofSeconds(1));
        connections.disconnect(created.sessionId(), bob.participantId(), "c2");
        broadcaster.published.clear();
        long version = session().version();

        // Alice garde une connexion vivante pendant toute l'absence de Bob.
        for (int i = 0; i < 59; i++) {
            clock.advance(Duration.ofSeconds(5));
            connections.touch(created.sessionId(), "c1");
            sweep.sweep();
        }
        clock.advance(Duration.ofSeconds(5).minusMillis(1));
        connections.touch(created.sessionId(), "c1");
        sweep.sweep();
        assertThat(session().participant(bob.participantId())).isPresent();
        assertThat(broadcaster.published).isEmpty();

        clock.advance(Duration.ofMillis(1));
        sweep.sweep();

        assertThat(session().participant(bob.participantId())).isEmpty();
        assertThat(session().participant(created.participantId()).orElseThrow().connected()).isTrue();
        assertThat(session().version()).isEqualTo(version + 1);
        assertThat(session().lastChange()).isEqualTo(LastChange.of(ChangeAction.LEAVE, bob.participantId()));
        assertThat(broadcaster.published).singleElement().satisfies(p -> {
            assertThat(p.session()).isSameAs(session());
            assertThat(p.onlyTo()).isNull();
        });
    }

    @Test
    void aSilentConnectionClosedAtFifteenSecondsLeadsToARemovalFiveMinutesLater() {
        connect("c1");
        clock.advance(TIMEOUT);
        sweep.sweep();
        assertThat(connected()).isFalse();
        broadcaster.published.clear();

        clock.advance(ABSENCE.minusMillis(1));
        sweep.sweep();
        assertThat(session().participant(created.participantId())).isPresent();
        assertThat(broadcaster.published).isEmpty();

        clock.advance(Duration.ofMillis(1));
        sweep.sweep();
        assertThat(session().participants()).isEmpty();
        assertThat(session().lastChange()).isEqualTo(LastChange.of(ChangeAction.LEAVE, created.participantId()));
        assertThat(broadcaster.published).singleElement().satisfies(p -> assertThat(p.onlyTo()).isNull());
    }

    @Test
    void aParticipantWhoNeverConnectedIsRemovedFiveMinutesAfterJoining() {
        connect("c1");
        for (int i = 0; i < 12; i++) {
            clock.advance(Duration.ofSeconds(5));
            connections.touch(created.sessionId(), "c1");
            sweep.sweep();
        }
        JoinSessionResult bob = bobJoins();
        broadcaster.published.clear();

        // Alice garde sa connexion vivante jusqu'à l'arrivée + ABSENCE − 1 ms.
        for (int i = 0; i < 59; i++) {
            clock.advance(Duration.ofSeconds(5));
            connections.touch(created.sessionId(), "c1");
            sweep.sweep();
        }
        clock.advance(Duration.ofSeconds(5).minusMillis(1));
        connections.touch(created.sessionId(), "c1");
        sweep.sweep();
        assertThat(session().participant(bob.participantId())).isPresent();
        assertThat(broadcaster.published).isEmpty();

        clock.advance(Duration.ofMillis(1));
        sweep.sweep();

        assertThat(session().participant(bob.participantId())).isEmpty();
        assertThat(broadcaster.published).singleElement().satisfies(
                p -> assertThat(p.session().lastChange()).isEqualTo(LastChange.of(ChangeAction.LEAVE,
                        bob.participantId())));
    }

    @Test
    void eachParticipantRemovedInTheSamePassGetsItsOwnLeave() {
        JoinSessionResult bob = bobJoins();
        broadcaster.published.clear();
        long version = session().version();

        clock.advance(ABSENCE);
        sweep.sweep();

        assertThat(session().participants()).isEmpty();
        assertThat(broadcaster.published).extracting(p -> p.session().version())
                .containsExactly(version + 1, version + 2);
        assertThat(broadcaster.published).extracting(p -> p.session().lastChange())
                .containsExactlyInAnyOrder(LastChange.of(ChangeAction.LEAVE, created.participantId()),
                        LastChange.of(ChangeAction.LEAVE, bob.participantId()));
    }

    /** Alice (deux onglets) et Bob (un onglet) connectés, gardés vivants jusqu'à {@code NOW + elapsed}. */
    private JoinSessionResult tableKeptAliveUntil(Duration elapsed) {
        JoinSessionResult bob = bobJoins();
        clock.advance(elapsed);
        connect("c1");
        connect("c2");
        connections.connect(created.sessionId(), bob.participantToken(), "c3");
        broadcaster.published.clear();
        return bob;
    }

    @Test
    void aSessionIsStillThereOneMinuteBeforeItsLifetime() {
        tableKeptAliveUntil(LIFETIME.minusMinutes(1));

        sweep.sweep();

        assertThat(store.find(created.sessionId())).isPresent();
        assertThat(broadcaster.attached).containsOnlyKeys("c1", "c2", "c3");
        assertThat(broadcaster.notFoundRequested).isEmpty();
        assertThat(broadcaster.closeRequested).isEmpty();
    }

    @Test
    void anExpiredSessionIsDeletedAndEachConnectionDetachedThenClosedAsNotFoundWithoutPublishing() {
        JoinSessionResult bob = tableKeptAliveUntil(LIFETIME.minusMinutes(1));
        clock.advance(Duration.ofMinutes(1));

        sweep.sweep();

        assertThat(store.find(created.sessionId())).isEmpty();
        assertThat(broadcaster.attached).isEmpty();
        assertThat(broadcaster.notFoundRequested).containsExactlyInAnyOrder("c1", "c2", "c3");
        assertThat(broadcaster.closeRequested).isEmpty();
        assertThat(broadcaster.published).isEmpty();

        // Après l'expiration, la session est inconnue : jetons comme fermetures tardives.
        assertThat(connections.connect(created.sessionId(), created.participantToken(), "c4"))
                .isEqualTo(new ConnectResult.SessionNotFound());
        assertThat(connections.connect(created.sessionId(), bob.participantToken(), "c5"))
                .isEqualTo(new ConnectResult.SessionNotFound());
        connections.disconnect(created.sessionId(), created.participantId(), "c1");
        assertThat(store.find(created.sessionId())).isEmpty();
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void anExpiredSessionWithoutConnectionIsDeleted() {
        clock.advance(Duration.ofHours(25));

        sweep.sweep();

        assertThat(store.find(created.sessionId())).isEmpty();
        assertThat(broadcaster.notFoundRequested).isEmpty();
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void onlyTheExpiredSessionIsDeletedTheOtherIsSweptAsUsual() {
        CreateSessionResult younger = new CreateSessionUseCase(store, locks, ids,
                Clock.fixed(NOW.plus(Duration.ofHours(1)), ZoneOffset.UTC), 50).create("Bob", Role.VOTER);
        clock.advance(LIFETIME.minus(TIMEOUT));
        connect("c1");
        connections.connect(younger.sessionId(), younger.participantToken(), "c2");
        clock.advance(TIMEOUT);

        sweep.sweep();

        assertThat(store.find(created.sessionId())).isEmpty();
        assertThat(broadcaster.notFoundRequested).containsExactly("c1");
        // La plus jeune vit encore ; sa connexion muette est fermée par la règle habituelle.
        assertThat(store.find(younger.sessionId())).isPresent();
        assertThat(broadcaster.closeRequested).containsExactly("c2");
    }
}
