package com.planningpoker.adapter.in.rest;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;

import com.planningpoker.domain.Deck;
import com.planningpoker.domain.Role;

/**
 * Contrat : {@code create-session-request.json}. Le pseudo est brut : le domaine le normalise. Le jeu est facultatif
 * (toute la suite de Fibonacci à défaut) ; un jeu invalide est refusé par le domaine ({@code INVALID_DECK}).
 */
public record CreateSessionRequest(String pseudo, Role role, @JsonInclude(JsonInclude.Include.NON_NULL) DeckRequest deck) {

    /** Plus que les cartes de toutes les familles réunies : au-delà, le corps n'est pas conforme au schéma. */
    private static final int MAX_CARDS = 20;

    /** Jeu demandé : famille et cartes retenues, valeurs brutes. */
    public record DeckRequest(String type, List<String> cards) {
    }

    /** Vrai si le corps respecte le schéma (champs présents, pseudo brut de 200 points de code au plus). */
    boolean isWellFormed() {
        return EntryRequests.isWellFormed(pseudo, role)
                && (deck == null || deck.type() != null && deck.cards() != null && deck.cards().size() <= MAX_CARDS
                        && deck.cards().stream().allMatch(c -> c != null && c.length() <= 16));
    }

    /** Le jeu choisi, ou le jeu par défaut. */
    Deck deckOrDefault() {
        return deck == null ? Deck.standard() : Deck.of(deck.type(), deck.cards());
    }

    @Override
    public String toString() {
        return "CreateSessionRequest[role=" + role + "]";
    }
}
