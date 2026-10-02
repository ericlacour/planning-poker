package com.planningpoker.application;

/** Session inconnue ou expirée (contrat : {@code SESSION_NOT_FOUND}). */
public class SessionNotFoundException extends RuntimeException {

    public SessionNotFoundException() {
        super("Session not found.");
    }
}
