package com.planningpoker.application;

import java.util.Objects;
import java.util.UUID;
import java.util.function.UnaryOperator;

import com.planningpoker.domain.IdGenerator;
import com.planningpoker.domain.Session;

/**
 * Intentions {@code reveal} (FR-11, FR-12) et {@code clear} (FR-15) : sous le verrou de la session, charger →
 * règle → {@code save} → {@code publish} seulement si la {@code version} a changé (AD-3). Une intention périmée ou
 * déjà satisfaite ne fait rien (FR-17), sans réponse.
 */
public class RoundUseCase {

    private final SessionStore store;
    private final SessionLocks locks;
    private final IdGenerator ids;
    private final SessionBroadcaster broadcaster;

    public RoundUseCase(SessionStore store, SessionLocks locks, IdGenerator ids, SessionBroadcaster broadcaster) {
        this.store = Objects.requireNonNull(store, "store");
        this.locks = Objects.requireNonNull(locks, "locks");
        this.ids = Objects.requireNonNull(ids, "ids");
        this.broadcaster = Objects.requireNonNull(broadcaster, "broadcaster");
    }

    public void reveal(String sessionId, UUID participantId, String roundId) {
        apply(sessionId, participantId, session -> session.reveal(participantId, roundId));
    }

    public void clear(String sessionId, UUID participantId, String roundId) {
        apply(sessionId, participantId, session -> session.clear(participantId, roundId, newRoundId(session)));
    }

    private String newRoundId(Session session) {
        String candidate = ids.newRoundId();
        while (candidate.equals(session.roundId())) {
            candidate = ids.newRoundId();
        }
        return candidate;
    }

    private void apply(String sessionId, UUID participantId, UnaryOperator<Session> rule) {
        locks.withLock(sessionId, () -> {
            Session session = store.find(sessionId).orElse(null);
            if (session == null || session.participant(participantId).isEmpty()) {
                return null;
            }
            Session changed = rule.apply(session);
            if (changed.version() != session.version()) {
                store.save(changed);
                broadcaster.publish(changed);
            }
            return null;
        });
    }
}
