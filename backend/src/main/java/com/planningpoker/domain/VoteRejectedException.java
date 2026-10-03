package com.planningpoker.domain;

import java.util.Objects;

/** Un {@code vote} interdit : rien n'a changé, l'auteur seul reçoit {@code error {code}}. */
public class VoteRejectedException extends RuntimeException {

    /** Codes d'erreur du contrat ({@code error.json}) propres au vote, dans l'ordre où ils sont vérifiés. */
    public enum Reason {
        NOT_A_VOTER,
        ROUND_REVEALED,
        INVALID_CARD
    }

    private final Reason reason;

    public VoteRejectedException(Reason reason) {
        super(Objects.requireNonNull(reason, "reason").name(), null, false, false);
        this.reason = reason;
    }

    public Reason reason() {
        return reason;
    }
}
