package com.planningpoker.domain;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Session de Planning Poker, immuable : chaque règle renvoie une nouvelle session, que le cas d'usage enregistre
 * sous le verrou de la session (AD-3).
 *
 * @param version        incrémentée à chaque changement observable ; 1 à la création
 * @param nextJoinOrder  ordre d'arrivée du prochain participant
 */
public record Session(String id, List<Participant> participants, long version, String roundId, int nextJoinOrder,
        Instant createdAt) {

    public Session {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(roundId, "roundId");
        Objects.requireNonNull(createdAt, "createdAt");
        participants = List.copyOf(participants);
    }

    /** Crée une session avec son créateur pour seul participant. Le créateur n'a aucun droit particulier. */
    public static Session create(String id, String roundId, UUID creatorId, Pseudo pseudo, Role role,
            ParticipantToken token, Instant now) {
        Participant creator = new Participant(creatorId, pseudo, role, 0, token);
        return new Session(id, List.of(creator), 1, roundId, 1, now);
    }
}
