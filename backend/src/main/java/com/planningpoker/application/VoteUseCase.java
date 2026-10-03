package com.planningpoker.application;

import java.util.Optional;
import java.util.UUID;

import com.planningpoker.domain.Session;
import com.planningpoker.domain.VoteRejectedException;

/**
 * Intention {@code vote} (FR-10) : sous le verrou de la session, charger → règle → {@code save} → {@code publish}
 * seulement si la {@code version} a changé (AD-3). Un vote interdit ne change rien : sa raison est renvoyée pour
 * être envoyée à son seul auteur.
 */
public class VoteUseCase {

    private final SessionStore store;
    private final SessionLocks locks;
    private final SessionBroadcaster broadcaster;

    public VoteUseCase(SessionStore store, SessionLocks locks, SessionBroadcaster broadcaster) {
        this.store = store;
        this.locks = locks;
        this.broadcaster = broadcaster;
    }

    /**
     * @param card valeur de la carte, ou {@code null} pour retirer son vote
     * @return la raison du refus, ou vide si le vote est appliqué, déjà satisfait ou périmé (ignoré)
     */
    public Optional<VoteRejectedException.Reason> vote(String sessionId, UUID participantId, String roundId,
            String card) {
        return locks.withLock(sessionId, () -> {
            Session session = store.find(sessionId).orElse(null);
            if (session == null || session.participant(participantId).isEmpty()) {
                return Optional.<VoteRejectedException.Reason>empty();
            }
            Session voted;
            try {
                voted = session.vote(participantId, roundId, card);
            } catch (VoteRejectedException e) {
                return Optional.of(e.reason());
            }
            if (voted.version() != session.version()) {
                store.save(voted);
                broadcaster.publish(voted);
            }
            return Optional.<VoteRejectedException.Reason>empty();
        });
    }
}
