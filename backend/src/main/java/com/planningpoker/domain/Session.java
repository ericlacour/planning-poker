package com.planningpoker.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Session de Planning Poker, immuable : chaque règle renvoie une nouvelle session, que le cas d'usage enregistre
 * sous le verrou de la session (AD-3). Une règle sans aucun effet renvoie la même instance ; un changement caché
 * (comme le nombre de connexions d'un participant) donne une nouvelle instance de même {@code version}.
 *
 * @param version        incrémentée à chaque changement observable ; 1 à la création
 * @param nextJoinOrder  ordre d'arrivée du prochain participant
 * @param lastChange     dernier changement observable
 */
public record Session(String id, List<Participant> participants, long version, String roundId, int nextJoinOrder,
        Instant createdAt, LastChange lastChange) {

    /** Le contrat impose {@code joinOrder >= 1} : le créateur reçoit 1. */
    public static final int FIRST_JOIN_ORDER = 1;

    public Session {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(roundId, "roundId");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(lastChange, "lastChange");
        participants = List.copyOf(participants);
    }

    /** Crée une session avec son créateur pour seul participant. Le créateur n'a aucun droit particulier. */
    public static Session create(String id, String roundId, UUID creatorId, Pseudo pseudo, Role role,
            ParticipantToken token, Instant now) {
        Participant creator = new Participant(creatorId, pseudo, role, FIRST_JOIN_ORDER, token);
        return new Session(id, List.of(creator), 1, roundId, FIRST_JOIN_ORDER + 1, now,
                LastChange.of(ChangeAction.JOIN, creatorId));
    }

    /**
     * Fait entrer un nouveau participant, avec l'ordre d'arrivée suivant (FR-2). Il n'a encore aucune connexion.
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
        return new Session(id, joined, version + 1, roundId, nextJoinOrder + 1, createdAt,
                LastChange.of(ChangeAction.JOIN, participantId));
    }

    /** Le participant dont {@code token} est le jeton, s'il y en a un. */
    public Optional<Participant> participantWithToken(String token) {
        return participants.stream().filter(p -> p.token().matches(token)).findFirst();
    }

    public Optional<Participant> participant(UUID participantId) {
        return participants.stream().filter(p -> p.id().equals(participantId)).findFirst();
    }

    /**
     * Une connexion du participant s'ouvre. Seule la première change l'état observable ({@code PRESENCE}).
     *
     * @throws IllegalArgumentException si le participant n'est pas dans la session
     */
    public Session connect(UUID participantId) {
        Participant participant = participant(participantId)
                .orElseThrow(() -> new IllegalArgumentException("unknown participant"));
        return withConnections(participant, participant.connections() + 1);
    }

    /**
     * Une connexion du participant se ferme. Seule la dernière change l'état observable ({@code PRESENCE}).
     * Sans effet pour un participant absent ou déjà sans connexion.
     */
    public Session disconnect(UUID participantId) {
        return participant(participantId)
                .filter(Participant::connected)
                .map(p -> withConnections(p, p.connections() - 1))
                .orElse(this);
    }

    private Session withConnections(Participant participant, int count) {
        List<Participant> updated = participants.stream()
                .map(p -> p.id().equals(participant.id()) ? p.withConnections(count) : p)
                .toList();
        boolean presenceChanged = participant.connected() != (count > 0);
        if (!presenceChanged) {
            return new Session(id, updated, version, roundId, nextJoinOrder, createdAt, lastChange);
        }
        return new Session(id, updated, version + 1, roundId, nextJoinOrder, createdAt,
                LastChange.of(ChangeAction.PRESENCE, participant.id()));
    }
}
