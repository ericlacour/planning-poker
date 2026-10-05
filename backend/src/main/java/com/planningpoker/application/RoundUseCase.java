package com.planningpoker.application;

import java.util.Objects;
import java.util.UUID;

import com.planningpoker.domain.IdGenerator;
import com.planningpoker.domain.Session;

/**
 * Intentions {@code reveal} (FR-11, FR-12) et {@code clear} (FR-15) : sous le verrou de la session, charger →
 * règle → {@code save} → {@code publish} seulement si la {@code version} a changé (AD-3). Une intention périmée ou
 * déjà satisfaite ne fait rien (FR-17), sans réponse.
 */
public class RoundUseCase {

    private final SessionWriter writer;
    private final IdGenerator ids;

    public RoundUseCase(SessionStore store, SessionLocks locks, IdGenerator ids, SessionBroadcaster broadcaster) {
        this.writer = new SessionWriter(Objects.requireNonNull(store, "store"),
                Objects.requireNonNull(locks, "locks"), Objects.requireNonNull(broadcaster, "broadcaster"));
        this.ids = Objects.requireNonNull(ids, "ids");
    }

    public void reveal(String sessionId, UUID participantId, String roundId) {
        writer.apply(sessionId, participantId, session -> session.reveal(participantId, roundId));
    }

    public void clear(String sessionId, UUID participantId, String roundId) {
        writer.apply(sessionId, participantId, session -> session.clear(participantId, roundId, newRoundId(session)));
    }

    private String newRoundId(Session session) {
        String candidate = ids.newRoundId();
        while (candidate.equals(session.roundId())) {
            candidate = ids.newRoundId();
        }
        return candidate;
    }
}
