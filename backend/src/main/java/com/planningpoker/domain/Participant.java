package com.planningpoker.domain;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Participant d'une session : identifiant public, pseudo, rôle, ordre d'arrivée, empreinte de son jeton et
 * connexions ouvertes, chacune avec la date de sa dernière activité (AD-8). Il est connecté tant qu'il a au moins
 * une connexion ouverte.
 *
 * @param connections dernière activité de chaque connexion ouverte, par identifiant de connexion
 */
public record Participant(UUID id, Pseudo pseudo, Role role, int joinOrder, ParticipantToken token,
        Map<String, Instant> connections) {

    public Participant {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(pseudo, "pseudo");
        Objects.requireNonNull(role, "role");
        Objects.requireNonNull(token, "token");
        if (joinOrder < 1) {
            throw new IllegalArgumentException("joinOrder must be >= 1");
        }
        connections = Map.copyOf(connections);
    }

    /** Un participant qui vient d'entrer : aucune connexion ouverte. */
    public Participant(UUID id, Pseudo pseudo, Role role, int joinOrder, ParticipantToken token) {
        this(id, pseudo, role, joinOrder, token, Map.of());
    }

    public boolean connected() {
        return !connections.isEmpty();
    }

    /** La connexion est ouverte ou vient d'être active : sa dernière activité devient {@code now}. */
    Participant withActivity(String connectionId, Instant now) {
        Map<String, Instant> updated = new HashMap<>(connections);
        updated.put(connectionId, now);
        return new Participant(id, pseudo, role, joinOrder, token, updated);
    }

    Participant withoutConnection(String connectionId) {
        Map<String, Instant> updated = new HashMap<>(connections);
        updated.remove(connectionId);
        return new Participant(id, pseudo, role, joinOrder, token, updated);
    }
}
