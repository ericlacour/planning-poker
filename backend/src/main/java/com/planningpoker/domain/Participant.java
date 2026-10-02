package com.planningpoker.domain;

import java.util.Objects;
import java.util.UUID;

/**
 * Participant d'une session : identifiant public, pseudo, rôle, ordre d'arrivée et empreinte de son jeton.
 */
public record Participant(UUID id, Pseudo pseudo, Role role, int joinOrder, ParticipantToken token) {

    public Participant {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(pseudo, "pseudo");
        Objects.requireNonNull(role, "role");
        Objects.requireNonNull(token, "token");
        if (joinOrder < 1) {
            throw new IllegalArgumentException("joinOrder must be >= 1");
        }
    }
}
