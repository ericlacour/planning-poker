package com.planningpoker.domain;

/** Nature du dernier changement observable d'une session ({@code session-state.json#/properties/lastChange}). */
public enum ChangeAction {
    JOIN,
    LEAVE,
    VOTE,
    REVEAL,
    HIDE,
    CLEAR,
    ROLE,
    PRESENCE
}
