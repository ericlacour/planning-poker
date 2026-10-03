package com.planningpoker.application;

import java.util.UUID;

/** Participant entré dans la session. Le jeton est secret : {@link #toString()} ne l'affiche pas. */
public record JoinSessionResult(UUID participantId, String participantToken) {

    @Override
    public String toString() {
        return "JoinSessionResult[participantId=" + participantId + "]";
    }
}
