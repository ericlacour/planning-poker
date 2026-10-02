package com.planningpoker.application;

import java.util.UUID;

/** Session créée et son créateur. Le jeton est secret : {@link #toString()} ne l'affiche pas. */
public record CreateSessionResult(String sessionId, UUID participantId, String participantToken) {

    @Override
    public String toString() {
        return "CreateSessionResult[participantId=" + participantId + "]";
    }
}
