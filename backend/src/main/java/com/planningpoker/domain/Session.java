package com.planningpoker.domain;

import java.time.Instant;
import java.util.ArrayList;
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

    /** Le contrat impose {@code joinOrder >= 1} : le créateur reçoit 1. */
    public static final int FIRST_JOIN_ORDER = 1;

    public Session {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(roundId, "roundId");
        Objects.requireNonNull(createdAt, "createdAt");
        participants = List.copyOf(participants);
    }

    /** Crée une session avec son créateur pour seul participant. Le créateur n'a aucun droit particulier. */
    public static Session create(String id, String roundId, UUID creatorId, Pseudo pseudo, Role role,
            ParticipantToken token, Instant now) {
        Participant creator = new Participant(creatorId, pseudo, role, FIRST_JOIN_ORDER, token);
        return new Session(id, List.of(creator), 1, roundId, FIRST_JOIN_ORDER + 1, now);
    }

    /**
     * Fait entrer un nouveau participant, avec l'ordre d'arrivée suivant (FR-2).
     *
     * @throws PseudoTakenException si un participant de la session porte déjà ce pseudo (casse ignorée)
     */
    public Session join(UUID participantId, Pseudo pseudo, Role role, ParticipantToken token) {
        Objects.requireNonNull(pseudo, "pseudo");
        String key = pseudo.uniquenessKey();
        if (participants.stream().anyMatch(p -> p.pseudo().uniquenessKey().equals(key))) {
            throw new PseudoTakenException();
        }
        List<Participant> joined = new ArrayList<>(participants);
        joined.add(new Participant(participantId, pseudo, role, nextJoinOrder, token));
        return new Session(id, joined, version + 1, roundId, nextJoinOrder + 1, createdAt);
    }
}
