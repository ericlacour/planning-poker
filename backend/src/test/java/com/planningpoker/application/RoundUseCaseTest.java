package com.planningpoker.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.SplittableRandom;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.planningpoker.adapter.out.memory.InMemorySessionStore;
import com.planningpoker.domain.ChangeAction;
import com.planningpoker.domain.IdGenerator;
import com.planningpoker.domain.Role;
import com.planningpoker.domain.RoundStatus;
import com.planningpoker.domain.Session;

class RoundUseCaseTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");

    private final InMemorySessionStore store = new InMemorySessionStore();
    private final SessionLocks locks = new SessionLocks();
    private final IdGenerator ids = new IdGenerator(new SplittableRandom(7));
    private final RecordingBroadcaster broadcaster = new RecordingBroadcaster();
    private final RoundUseCase rounds = new RoundUseCase(store, locks, ids, broadcaster);
    private final VoteUseCase votes = new VoteUseCase(store, locks, broadcaster);
    private final CreateSessionResult alice = new CreateSessionUseCase(store, locks, ids,
            Clock.fixed(NOW, ZoneOffset.UTC), 50).create("Alice", Role.VOTER);
    private final JoinSessionResult emma = new JoinSessionUseCase(store, locks, ids, broadcaster,
            Clock.fixed(NOW, ZoneOffset.UTC), 30)
            .join(alice.sessionId(), "Emma", Role.OBSERVER);

    private Session session() {
        return store.find(alice.sessionId()).orElseThrow();
    }

    @Test
    void aRevealIsSavedAndPublished() {
        votes.vote(alice.sessionId(), alice.participantId(), session().roundId(), "8");
        broadcaster.published.clear();
        long before = session().version();

        rounds.reveal(alice.sessionId(), emma.participantId(), session().roundId());

        assertThat(session().version()).isEqualTo(before + 1);
        assertThat(session().roundStatus()).isEqualTo(RoundStatus.REVEALED);
        assertThat(session().lastChange().action()).isEqualTo(ChangeAction.REVEAL);
        assertThat(broadcaster.published).singleElement().satisfies(p -> {
            assertThat(p.session()).isSameAs(session());
            assertThat(p.onlyTo()).isNull();
        });
    }

    @Test
    void anAlreadySatisfiedOrStaleRevealPublishesNothing() {
        String round = session().roundId();
        rounds.reveal(alice.sessionId(), alice.participantId(), round);
        broadcaster.published.clear();
        Session before = session();

        rounds.reveal(alice.sessionId(), alice.participantId(), round);
        rounds.reveal(alice.sessionId(), alice.participantId(), "stale");

        assertThat(session()).isSameAs(before);
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void aClearStartsANewRoundWithAGeneratedIdAndPublishesOnce() {
        String round = session().roundId();
        votes.vote(alice.sessionId(), alice.participantId(), round, "8");
        broadcaster.published.clear();
        long before = session().version();

        rounds.clear(alice.sessionId(), alice.participantId(), round);
        rounds.clear(alice.sessionId(), emma.participantId(), round);

        assertThat(session().version()).isEqualTo(before + 1);
        assertThat(session().roundId()).isNotEqualTo(round).hasSize(22);
        assertThat(session().votes()).isEmpty();
        assertThat(session().lastChange().action()).isEqualTo(ChangeAction.CLEAR);
        assertThat(broadcaster.published).hasSize(1);
    }

    @Test
    void anUnknownSessionOrParticipantIsIgnored() {
        broadcaster.published.clear();
        Session before = session();
        rounds.reveal("k3Jx9QvT2mLpZ8wR4nYb7A", alice.participantId(), "r");
        rounds.clear("k3Jx9QvT2mLpZ8wR4nYb7A", alice.participantId(), "r");
        rounds.reveal(alice.sessionId(), UUID.randomUUID(), before.roundId());
        rounds.clear(alice.sessionId(), UUID.randomUUID(), before.roundId());
        assertThat(session()).isSameAs(before);
        assertThat(broadcaster.published).isEmpty();
    }
}
