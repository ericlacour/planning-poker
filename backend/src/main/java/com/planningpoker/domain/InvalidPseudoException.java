package com.planningpoker.domain;

/** Pseudo vide, ou de plus de 20 points de code une fois normalisé (contrat : {@code INVALID_PSEUDO}). */
public class InvalidPseudoException extends RuntimeException {

    public InvalidPseudoException() {
        super("Invalid pseudo.");
    }
}
