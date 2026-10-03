package com.planningpoker.domain;

import java.util.Objects;
import java.util.UUID;

/**
 * Dernier changement observable d'une session, tenu par la session elle-même.
 *
 * @param byParticipantId auteur du changement ; {@code null} quand le serveur l'a fait lui-même (balayeur)
 */
public record LastChange(ChangeAction action, UUID byParticipantId) {

    public LastChange {
        Objects.requireNonNull(action, "action");
    }

    public static LastChange of(ChangeAction action, UUID byParticipantId) {
        return new LastChange(action, byParticipantId);
    }
}
