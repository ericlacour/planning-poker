package com.planningpoker.adapter.in.rest;

import com.planningpoker.domain.Role;

/** Contrat : {@code create-session-request.json}. Le pseudo est brut : le domaine le normalise. */
public record CreateSessionRequest(String pseudo, Role role) {

    /** Vrai si le corps respecte le schéma (champs présents, pseudo brut de 200 points de code au plus). */
    boolean isWellFormed() {
        return EntryRequests.isWellFormed(pseudo, role);
    }

    @Override
    public String toString() {
        return "CreateSessionRequest[role=" + role + "]";
    }
}
