package com.planningpoker.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.SplittableRandom;

import org.junit.jupiter.api.Test;

import com.planningpoker.adapter.out.memory.InMemorySessionStore;
import com.planningpoker.domain.Card;
import com.planningpoker.domain.ChangeAction;
import com.planningpoker.domain.IdGenerator;
import com.planningpoker.domain.Role;
import com.planningpoker.domain.Session;
import com.planningpoker.domain.VoteRejectedException;

class VoteUseCaseTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");

    private final InMemorySessionStore store = new InMemorySessionStore();
    private final SessionLocks locks = new SessionLocks();
    private final IdGenerator ids = new IdGenerator(new SplittableRandom(7));
    private final RecordingBroadcaster broadcaster = new RecordingBroadcaster();
    private final VoteUseCase votes = new VoteUseCase(store, locks, broadcaster);
    private final CreateSessionResult alice = new CreateSessionUseCase(store, locks, ids,
            Clock.fixed(NOW, ZoneOffset.UTC)).create("Alice", Role.VOTER);
    private final JoinSessionResult emma = new JoinSessionUseCase(store, locks, ids, broadcaster,
            Clock.fixed(NOW, ZoneOffset.UTC))
            .join(alice.sessionId(), "Emma", Role.OBSERVER);

    private Session session() {
        return store.find(alice.sessionId()).orElseThrow();
    }

    private String round() {
        return session().roundId();
    }

    @Test
    void aVoteIsSavedAndPublished() {
        broadcaster.published.clear();
        long before = session().version();

        assertThat(votes.vote(alice.sessionId(), alice.participantId(), round(), "8")).isEmpty();

        assertThat(session().version()).isEqualTo(before + 1);
        assertThat(session().voteOf(alice.participantId())).contains(Card.EIGHT);
        assertThat(session().lastChange().action()).isEqualTo(ChangeAction.VOTE);
        assertThat(broadcaster.published).singleElement().satisfies(p -> {
            assertThat(p.session()).isSameAs(session());
            assertThat(p.onlyTo()).isNull();
        });
    }

    @Test
    void anAlreadySatisfiedOrStaleIntentPublishesNothing() {
        votes.vote(alice.sessionId(), alice.participantId(), round(), "8");
        broadcaster.published.clear();
        Session before = session();

        assertThat(votes.vote(alice.sessionId(), alice.participantId(), round(), "8")).isEmpty();
        assertThat(votes.vote(alice.sessionId(), alice.participantId(), "stale", "5")).isEmpty();

        assertThat(session()).isSameAs(before);
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void aRejectedVoteReturnsItsReasonAndChangesNothing() {
        broadcaster.published.clear();
        Session before = session();

        assertThat(votes.vote(alice.sessionId(), emma.participantId(), round(), "8"))
                .contains(VoteRejectedException.Reason.NOT_A_VOTER);
        assertThat(votes.vote(alice.sessionId(), alice.participantId(), round(), "4"))
                .contains(VoteRejectedException.Reason.INVALID_CARD);

        assertThat(session()).isSameAs(before);
        assertThat(broadcaster.published).isEmpty();
    }

    @Test
    void anUnknownSessionIsIgnored() {
        assertThat(votes.vote("k3Jx9QvT2mLpZ8wR4nYb7A", alice.participantId(), "r", "8")).isEmpty();
    }
}
