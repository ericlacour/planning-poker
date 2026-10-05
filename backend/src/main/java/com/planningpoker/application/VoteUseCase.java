package com.planningpoker.application;

import java.util.Optional;
import java.util.UUID;

import com.planningpoker.domain.VoteRejectedException;

/**
 * Intention {@code vote} (FR-10) : sous le verrou de la session, charger → règle → {@code save} → {@code publish}
 * seulement si la {@code version} a changé (AD-3). Un vote interdit ne change rien : sa raison est renvoyée pour
 * être envoyée à son seul auteur.
 */
public class VoteUseCase {

    private final SessionWriter writer;

    public VoteUseCase(SessionStore store, SessionLocks locks, SessionBroadcaster broadcaster) {
        this.writer = new SessionWriter(store, locks, broadcaster);
    }

    /**
     * @param card valeur de la carte, ou {@code null} pour retirer son vote
     * @return la raison du refus, ou vide si le vote est appliqué, déjà satisfait ou périmé (ignoré)
     */
    public Optional<VoteRejectedException.Reason> vote(String sessionId, UUID participantId, String roundId,
            String card) {
        try {
            writer.apply(sessionId, participantId, session -> session.vote(participantId, roundId, card));
        } catch (VoteRejectedException e) {
            return Optional.of(e.reason());
        }
        return Optional.empty();
    }
}
