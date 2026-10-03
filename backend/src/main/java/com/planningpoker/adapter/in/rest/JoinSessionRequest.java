package com.planningpoker.adapter.in.rest;

import com.planningpoker.domain.Role;

/** Contrat : {@code join-session-request.json}. Le pseudo est brut : le domaine le normalise. */
public record JoinSessionRequest(String pseudo, Role role) {

    /** Mêmes règles de forme que la création. */
    boolean isWellFormed() {
        return EntryRequests.isWellFormed(pseudo, role);
    }

    @Override
    public String toString() {
        return "JoinSessionRequest[role=" + role + "]";
    }
}
