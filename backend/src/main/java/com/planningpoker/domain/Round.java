package com.planningpoker.domain;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Tour en cours d'une session, immuable : chaque règle renvoie un nouveau tour, ou la même instance si elle est
 * sans effet. Il ne connaît pas les participants : {@link Session} vérifie qui agit et avec quel rôle.
 *
 * @param id           identifiant du tour, qui change à chaque {@code clear}
 * @param status       tour caché ou révélé
 * @param votes        vote de chaque participant qui a voté pendant ce tour
 * @param lateArrivals participants qui ne votent qu'à partir du prochain tour : arrivés pendant la révélation, ou
 *                     devenus votants pendant la révélation sans vote dans ce tour ; toujours vide pendant un tour
 *                     caché, le masquage la vidant
 */
public record Round(String id, RoundStatus status, Map<UUID, Card> votes, Set<UUID> lateArrivals) {

    public Round {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(status, "status");
        votes = Map.copyOf(votes);
        lateArrivals = Set.copyOf(lateArrivals);
    }

    /** Un nouveau tour caché, sans aucun vote. */
    public static Round open(String id) {
        return new Round(id, RoundStatus.HIDDEN, Map.of(), Set.of());
    }

    public boolean isRevealed() {
        return status == RoundStatus.REVEALED;
    }

    public Optional<Card> voteOf(UUID participantId) {
        return Optional.ofNullable(votes.get(participantId));
    }

    /** Vrai pour un participant qui ne vote qu'à partir du prochain tour. */
    public boolean isLate(UUID participantId) {
        return lateArrivals.contains(participantId);
    }

    /** Un participant arrive à la table : pendant la révélation, il ne vote qu'à partir du prochain tour. */
    Round withArrival(UUID participantId) {
        return isRevealed() ? withLate(participantId) : this;
    }

    /** Le participant quitte la table : son vote et sa marque d'arrivée tardive disparaissent. */
    Round without(UUID participantId) {
        if (!votes.containsKey(participantId) && !isLate(participantId)) {
            return this;
        }
        Map<UUID, Card> remainingVotes = new HashMap<>(votes);
        remainingVotes.remove(participantId);
        Set<UUID> late = new HashSet<>(lateArrivals);
        late.remove(participantId);
        return new Round(id, status, remainingVotes, late);
    }

    /**
     * Choisit, change ou retire ({@code card == null}) le vote d'un votant. Une intention déjà satisfaite renvoie la
     * même instance.
     *
     * @throws VoteRejectedException si le tour est révélé (ou si le participant n'y vote pas encore), ou si la carte
     *                               est hors du jeu ; rien ne change
     */
    Round vote(UUID participantId, String card) {
        if (isRevealed() || isLate(participantId)) {
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
        return new Round(id, status, updated, lateArrivals);
    }

    /** Révèle les votes ; même instance si le tour est déjà révélé. */
    Round reveal() {
        return isRevealed() ? this : new Round(id, RoundStatus.REVEALED, votes, lateArrivals);
    }

    /**
     * Remet le tour révélé en caché, sous le même {@code id} (FR13) : les votes de {@code observers} sont retirés,
     * ceux des votants restent et redeviennent modifiables, et plus personne n'est en retard (chaque votant peut
     * voter dans ce tour). Même instance si le tour est déjà caché.
     */
    Round hide(Set<UUID> observers) {
        if (!isRevealed()) {
            return this;
        }
        Map<UUID, Card> kept = new HashMap<>(votes);
        kept.keySet().removeAll(observers);
        return new Round(id, RoundStatus.HIDDEN, kept, Set.of());
    }

    /**
     * Effet d'un changement de rôle sur ce tour (FR5) :
     * <ul>
     * <li>devenu observateur : son vote est retiré pendant un tour caché, et reste jusqu'au {@code clear} ou au
     * masquage pendant un tour révélé ; il n'est plus marqué en retard ;</li>
     * <li>devenu votant pendant un tour révélé sans vote dans ce tour : il ne vote qu'à partir du prochain tour.</li>
     * </ul>
     */
    Round withRole(UUID participantId, Role role) {
        if (role == Role.OBSERVER) {
            return isRevealed() ? withoutLate(participantId) : without(participantId);
        }
        return isRevealed() && !votes.containsKey(participantId) ? withLate(participantId) : this;
    }

    /** Synthèse du tour révélé ; vide pendant un tour caché (FR-14). */
    public Optional<Summary> summary() {
        return isRevealed() ? Optional.of(Summary.of(votes.values())) : Optional.empty();
    }

    private Round withLate(UUID participantId) {
        if (isLate(participantId)) {
            return this;
        }
        Set<UUID> late = new HashSet<>(lateArrivals);
        late.add(participantId);
        return new Round(id, status, votes, late);
    }

    private Round withoutLate(UUID participantId) {
        if (!isLate(participantId)) {
            return this;
        }
        Set<UUID> late = new HashSet<>(lateArrivals);
        late.remove(participantId);
        return new Round(id, status, votes, late);
    }
}
