package com.planningpoker.domain;

/** Le pseudo appartient déjà à un participant de la session, casse ignorée (contrat : {@code PSEUDO_TAKEN}). */
public class PseudoTakenException extends RuntimeException {

    public PseudoTakenException() {
        super("Pseudo already taken in this session.");
    }
}
