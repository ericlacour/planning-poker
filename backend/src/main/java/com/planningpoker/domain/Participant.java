package com.planningpoker.domain;

import java.util.Objects;
import java.util.UUID;

/**
 * Participant d'une session : identifiant public, pseudo, rôle, ordre d'arrivée, empreinte de son jeton et nombre
 * de connexions ouvertes. Il est connecté tant qu'il a au moins une connexion ouverte.
 */
public record Participant(UUID id, Pseudo pseudo, Role role, int joinOrder, ParticipantToken token,
        int connections) {

    public Participant {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(pseudo, "pseudo");
        Objects.requireNonNull(role, "role");
        Objects.requireNonNull(token, "token");
        if (joinOrder < 1) {
            throw new IllegalArgumentException("joinOrder must be >= 1");
        }
        if (connections < 0) {
            throw new IllegalArgumentException("connections must be >= 0");
        }
    }

    /** Un participant qui vient d'entrer : aucune connexion ouverte. */
    public Participant(UUID id, Pseudo pseudo, Role role, int joinOrder, ParticipantToken token) {
        this(id, pseudo, role, joinOrder, token, 0);
    }

    public boolean connected() {
        return connections > 0;
    }

    Participant withConnections(int count) {
        return new Participant(id, pseudo, role, joinOrder, token, count);
    }
}
