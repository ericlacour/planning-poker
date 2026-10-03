package com.planningpoker.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Session de Planning Poker, immuable : chaque règle renvoie une nouvelle session, que le cas d'usage enregistre
 * sous le verrou de la session (AD-3). Une règle sans aucun effet renvoie la même instance ; un changement caché
 * (comme la dernière activité d'une connexion) donne une nouvelle instance de même {@code version}.
 *
 * @param version        incrémentée à chaque changement observable ; 1 à la création
 * @param nextJoinOrder  ordre d'arrivée du prochain participant
 * @param lastChange     dernier changement observable
 * @param roundStatus    tour caché ou révélé
 * @param votes          vote de chaque participant qui a voté pendant le tour courant
 * @param lateArrivals   participants arrivés pendant un tour révélé : ils ne votent qu'à partir du prochain tour
 *                       ({@code clear})
 */
public record Session(String id, List<Participant> participants, long version, String roundId, int nextJoinOrder,
        Instant createdAt, LastChange lastChange, RoundStatus roundStatus, Map<UUID, Card> votes,
        Set<UUID> lateArrivals) {

    /** Le contrat impose {@code joinOrder >= 1} : le créateur reçoit 1. */
    public static final int FIRST_JOIN_ORDER = 1;

    public Session {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(roundId, "roundId");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(lastChange, "lastChange");
        Objects.requireNonNull(roundStatus, "roundStatus");
        participants = List.copyOf(participants);
        votes = Map.copyOf(votes);
        lateArrivals = Set.copyOf(lateArrivals);
    }

    /** Crée une session avec son créateur pour seul participant. Le créateur n'a aucun droit particulier. */
    public static Session create(String id, String roundId, UUID creatorId, Pseudo pseudo, Role role,
            ParticipantToken token, Instant now) {
        Participant creator = new Participant(creatorId, pseudo, role, FIRST_JOIN_ORDER, token);
        return new Session(id, List.of(creator), 1, roundId, FIRST_JOIN_ORDER + 1, now,
                LastChange.of(ChangeAction.JOIN, creatorId), RoundStatus.HIDDEN, Map.of(), Set.of());
    }

    /**
     * Fait entrer un nouveau participant, avec l'ordre d'arrivée suivant (FR-2). Il n'a encore aucune connexion.
     * Arrivé pendant un tour révélé, il ne vote qu'à partir du prochain tour.
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
        Set<UUID> late = lateArrivals;
        if (roundStatus == RoundStatus.REVEALED) {
            late = new HashSet<>(lateArrivals);
            late.add(participantId);
        }
        return new Session(id, joined, version + 1, roundId, nextJoinOrder + 1, createdAt,
                LastChange.of(ChangeAction.JOIN, participantId), roundStatus, votes, late);
    }

    /** Le participant dont {@code token} est le jeton, s'il y en a un. */
    public Optional<Participant> participantWithToken(String token) {
        return participants.stream().filter(p -> p.token().matches(token)).findFirst();
    }

    public Optional<Participant> participant(UUID participantId) {
        return participants.stream().filter(p -> p.id().equals(participantId)).findFirst();
    }

    /**
     * Une connexion du participant s'ouvre, active à {@code now}. Seule la première change l'état observable
     * ({@code PRESENCE}).
     *
     * @throws IllegalArgumentException si le participant n'est pas dans la session
     */
    public Session connect(UUID participantId, String connectionId, Instant now) {
        Objects.requireNonNull(connectionId, "connectionId");
        Objects.requireNonNull(now, "now");
        Participant participant = requireParticipant(participantId);
        return withParticipant(participant, participant.withActivity(connectionId, now));
    }

    /**
     * Une connexion du participant se ferme. Seule la dernière change l'état observable ({@code PRESENCE}).
     * Sans effet (même instance) pour un participant absent ou une connexion qu'il ne porte pas, ou plus.
     */
    public Session disconnect(UUID participantId, String connectionId) {
        return participant(participantId)
                .filter(p -> p.connections().containsKey(connectionId))
                .map(p -> withParticipant(p, p.withoutConnection(connectionId)))
                .orElse(this);
    }

    /**
     * Activité reçue sur une connexion (pong ou message) : changement caché, de même {@code version}, qui ne se
     * diffuse pas (AD-3). Sans effet (même instance) pour une connexion inconnue.
     */
    public Session touch(String connectionId, Instant now) {
        Objects.requireNonNull(now, "now");
        return participants.stream()
                .filter(p -> p.connections().containsKey(connectionId))
                .findFirst()
                .map(p -> withParticipant(p, p.withActivity(connectionId, now)))
                .orElse(this);
    }

    /**
     * Connexions muettes : sans aucune activité depuis {@code timeout} ou plus à {@code now} (AD-8). Le balayeur
     * les ferme.
     */
    public List<OpenConnection> silentConnections(Instant now, Duration timeout) {
        Instant deadline = now.minus(timeout);
        List<OpenConnection> silent = new ArrayList<>();
        for (Participant participant : participants) {
            participant.connections().forEach((connectionId, lastSeenAt) -> {
                if (!lastSeenAt.isAfter(deadline)) {
                    silent.add(new OpenConnection(participant.id(), connectionId));
                }
            });
        }
        return List.copyOf(silent);
    }

    /** Une connexion ouverte et le participant qui la porte. */
    public record OpenConnection(UUID participantId, String connectionId) {
    }

    /**
     * Remplace le participant. Seul un changement de présence est observable ({@code version + 1},
     * {@code PRESENCE}) ; sinon nouvelle instance de même {@code version}.
     */
    private Session withParticipant(Participant before, Participant after) {
        List<Participant> updated = participants.stream()
                .map(p -> p.id().equals(before.id()) ? after : p)
                .toList();
        if (before.connected() == after.connected()) {
            return new Session(id, updated, version, roundId, nextJoinOrder, createdAt, lastChange, roundStatus,
                    votes, lateArrivals);
        }
        return new Session(id, updated, version + 1, roundId, nextJoinOrder, createdAt,
                LastChange.of(ChangeAction.PRESENCE, before.id()), roundStatus, votes, lateArrivals);
    }

    /** Le vote du participant pendant le tour courant, s'il a voté. */
    public Optional<Card> voteOf(UUID participantId) {
        return Optional.ofNullable(votes.get(participantId));
    }

    /** Vrai pour un votant qui peut voter pendant le tour courant (pas arrivé pendant un tour révélé). */
    public boolean canVoteThisRound(Participant participant) {
        return participant.role() == Role.VOTER && !lateArrivals.contains(participant.id());
    }

    /**
     * Choisit, change ou retire ({@code card == null}) le vote du participant (FR-10). Contrôles dans l'ordre du
     * contrat : {@code roundId} périmé (ignoré, même instance), observateur, tour révélé (ou participant arrivé
     * pendant la révélation de ce tour), carte hors du jeu. Une
     * intention déjà satisfaite (même carte, ou retrait sans vote) renvoie la même instance ; sinon
     * {@code version + 1} et {@code lastChange VOTE}.
     *
     * @throws VoteRejectedException    si le vote est interdit ; rien ne change
     * @throws IllegalArgumentException si le participant n'est pas dans la session
     */
    public Session vote(UUID participantId, String intentRoundId, String card) {
        Participant participant = participant(participantId)
                .orElseThrow(() -> new IllegalArgumentException("unknown participant"));
        if (!roundId.equals(intentRoundId)) {
            return this;
        }
        if (participant.role() != Role.VOTER) {
            throw new VoteRejectedException(VoteRejectedException.Reason.NOT_A_VOTER);
        }
        if (roundStatus == RoundStatus.REVEALED || lateArrivals.contains(participantId)) {
            throw new VoteRejectedException(VoteRejectedException.Reason.ROUND_REVEALED);
        }
        Card chosen = null;
        if (card != null) {
            chosen = Card.of(card)
                    .orElseThrow(() -> new VoteRejectedException(VoteRejectedException.Reason.INVALID_CARD));
        }
        if (Objects.equals(votes.get(participantId), chosen)) {
            return this;
        }
        Map<UUID, Card> updated = new HashMap<>(votes);
        if (chosen == null) {
            updated.remove(participantId);
        } else {
            updated.put(participantId, chosen);
        }
        return new Session(id, participants, version + 1, roundId, nextJoinOrder, createdAt,
                LastChange.of(ChangeAction.VOTE, participantId), roundStatus, updated, lateArrivals);
    }

    /**
     * Révèle les votes du tour (FR-11, FR-12), quel que soit l'auteur (votant ou observateur) et même sans aucun
     * vote. Un {@code roundId} périmé ou un tour déjà révélé renvoie la même instance (FR-17) ; sinon
     * {@code version + 1} et {@code lastChange REVEAL}.
     *
     * @throws IllegalArgumentException si l'auteur n'est pas dans la session
     */
    public Session reveal(UUID participantId, String intentRoundId) {
        requireParticipant(participantId);
        if (!roundId.equals(intentRoundId) || roundStatus == RoundStatus.REVEALED) {
            return this;
        }
        return new Session(id, participants, version + 1, roundId, nextJoinOrder, createdAt,
                LastChange.of(ChangeAction.REVEAL, participantId), RoundStatus.REVEALED, votes, lateArrivals);
    }

    /**
     * Efface les votes et ouvre un nouveau tour caché sous {@code newRoundId} (FR-15), que le tour soit caché ou
     * révélé, même sans aucun vote, quel que soit l'auteur. Un {@code roundId} périmé renvoie la même instance
     * (FR-17) : de deux effacements partis du même tour, seul le premier s'applique.
     *
     * @throws IllegalArgumentException si l'auteur n'est pas dans la session ou si {@code newRoundId} est le
     *                                  tour courant
     */
    public Session clear(UUID participantId, String intentRoundId, String newRoundId) {
        requireParticipant(participantId);
        Objects.requireNonNull(newRoundId, "newRoundId");
        if (!roundId.equals(intentRoundId)) {
            return this;
        }
        if (newRoundId.equals(roundId)) {
            throw new IllegalArgumentException("a new round needs a new roundId");
        }
        return new Session(id, participants, version + 1, newRoundId, nextJoinOrder, createdAt,
                LastChange.of(ChangeAction.CLEAR, participantId), RoundStatus.HIDDEN, Map.of(), Set.of());
    }

    /** Synthèse du tour révélé ; vide pendant un tour caché (FR-14). */
    public Optional<Summary> summary() {
        return roundStatus == RoundStatus.REVEALED ? Optional.of(Summary.of(votes.values())) : Optional.empty();
    }

    private Participant requireParticipant(UUID participantId) {
        return participant(participantId).orElseThrow(() -> new IllegalArgumentException("unknown participant"));
    }
}
