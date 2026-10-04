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
 * @param connections  dernière activité de chaque connexion ouverte, par identifiant de connexion
 * @param offlineSince depuis quand il n'a plus aucune connexion ouverte : fermeture de la dernière, ou son entrée
 *                     s'il n'en a jamais ouvert ; nul s'il est connecté (AD-8)
 */
public record Participant(UUID id, Pseudo pseudo, Role role, int joinOrder, ParticipantToken token,
        Map<String, Instant> connections, Instant offlineSince) {

    public Participant {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(pseudo, "pseudo");
        Objects.requireNonNull(role, "role");
        Objects.requireNonNull(token, "token");
        if (joinOrder < 1) {
            throw new IllegalArgumentException("joinOrder must be >= 1");
        }
        connections = Map.copyOf(connections);
        if (connections.isEmpty() != (offlineSince != null)) {
            throw new IllegalArgumentException("offlineSince is set exactly when there is no connection");
        }
    }

    /** Un participant qui vient d'entrer à {@code now} : aucune connexion ouverte. */
    public Participant(UUID id, Pseudo pseudo, Role role, int joinOrder, ParticipantToken token, Instant now) {
        this(id, pseudo, role, joinOrder, token, Map.of(), Objects.requireNonNull(now, "now"));
    }

    public boolean connected() {
        return !connections.isEmpty();
    }

    /** La connexion est ouverte ou vient d'être active : sa dernière activité devient {@code now}. */
    Participant withActivity(String connectionId, Instant now) {
        Map<String, Instant> updated = new HashMap<>(connections);
        updated.put(connectionId, now);
        return new Participant(id, pseudo, role, joinOrder, token, updated, null);
    }

    /**
     * La connexion se ferme à {@code now} : si c'était la dernière, le participant est hors ligne depuis
     * {@code now}.
     */
    Participant withoutConnection(String connectionId, Instant now) {
        Map<String, Instant> updated = new HashMap<>(connections);
        updated.remove(connectionId);
        return new Participant(id, pseudo, role, joinOrder, token, updated, updated.isEmpty() ? now : null);
    }

    /** Le même participant, de retour avec un nouvel ordre d'arrivée, hors ligne depuis {@code now}. */
    Participant returning(int newJoinOrder, Instant now) {
        return new Participant(id, pseudo, role, newJoinOrder, token, now);
    }
}
