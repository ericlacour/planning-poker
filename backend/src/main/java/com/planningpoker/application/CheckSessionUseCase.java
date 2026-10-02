package com.planningpoker.application;

/** Vérifie qu'une session existe, dès l'ouverture de son lien (FR-3). */
public class CheckSessionUseCase {

    private final SessionStore store;

    public CheckSessionUseCase(SessionStore store) {
        this.store = store;
    }

    /** @throws SessionNotFoundException si la session est inconnue (quelle que soit la forme de l'identifiant) */
    public void check(String sessionId) {
        if (sessionId == null || store.find(sessionId).isEmpty()) {
            throw new SessionNotFoundException();
        }
    }
}
