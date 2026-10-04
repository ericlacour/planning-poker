package com.planningpoker.application;

/** Le service compte déjà le nombre maximal de sessions en mémoire (contrat : {@code SESSION_LIMIT_REACHED}). */
public class SessionLimitReachedException extends RuntimeException {

    public SessionLimitReachedException() {
        super("Too many sessions are open right now.");
    }
}
