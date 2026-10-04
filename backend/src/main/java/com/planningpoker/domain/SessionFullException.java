package com.planningpoker.domain;

/**
 * La session a déjà atteint son plafond de participants et un <b>nouvel</b> arrivant voudrait y entrer
 * (contrat : {@code SESSION_FULL}). La reprise d'un participant déjà présent n'est pas concernée.
 */
public class SessionFullException extends RuntimeException {

    public SessionFullException() {
        super("This session is full.");
    }
}
