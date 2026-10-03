package com.planningpoker.adapter.in.rest;

/** Contrat : {@code join-session-response.json}. Le jeton est secret : {@link #toString()} ne l'affiche pas. */
public record JoinSessionResponse(String participantId, String participantToken) {

    @Override
    public String toString() {
        return "JoinSessionResponse[participantId=" + participantId + "]";
    }
}
