package com.planningpoker.adapter.in.rest;

import com.planningpoker.domain.Role;

/** Contrat : {@code create-session-request.json}. Le pseudo est brut : le domaine le normalise. */
public record CreateSessionRequest(String pseudo, Role role) {

    /** {@code common.json#/$defs/rawPseudo} : au plus 200 points de code. */
    static final int RAW_PSEUDO_MAX_CODE_POINTS = 200;

    /** Vrai si le corps respecte le schéma (champs présents, pseudo brut de 200 points de code au plus). */
    boolean isWellFormed() {
        return pseudo != null && role != null
                && pseudo.codePointCount(0, pseudo.length()) <= RAW_PSEUDO_MAX_CODE_POINTS;
    }

    @Override
    public String toString() {
        return "CreateSessionRequest[role=" + role + "]";
    }
}
