package com.planningpoker.adapter.in.rest;

import com.planningpoker.domain.Role;

/** Règles de forme communes aux corps de création et d'entrée dans une session ({@code pseudo}, {@code role}). */
final class EntryRequests {

    /** {@code common.json#/$defs/rawPseudo} : au plus 200 points de code. */
    static final int RAW_PSEUDO_MAX_CODE_POINTS = 200;

    private EntryRequests() {
    }

    /** Vrai si le corps respecte le schéma (champs présents, pseudo brut de 200 points de code au plus). */
    static boolean isWellFormed(String pseudo, Role role) {
        return pseudo != null && role != null
                && pseudo.codePointCount(0, pseudo.length()) <= RAW_PSEUDO_MAX_CODE_POINTS;
    }
}
