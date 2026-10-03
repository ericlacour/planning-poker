package com.planningpoker.adapter.in.rest;

/** Contrat : {@code create-session-response.json}. Le jeton est secret : {@link #toString()} ne l'affiche pas. */
public record CreateSessionResponse(String sessionId, String participantId, String participantToken) {

    @Override
    public String toString() {
        return "CreateSessionResponse[participantId=" + participantId + "]";
    }
}
