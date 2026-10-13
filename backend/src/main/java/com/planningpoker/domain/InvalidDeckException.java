package com.planningpoker.domain;

/** Jeu de cartes refusé : famille inconnue, carte hors de la famille, doublon ou moins de deux cartes. */
public class InvalidDeckException extends RuntimeException {

    public InvalidDeckException(String message) {
        super(message);
    }
}
