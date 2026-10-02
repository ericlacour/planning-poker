package com.planningpoker.adapter.in.ws;

import java.util.List;

import com.planningpoker.domain.SessionSnapshot;
import com.planningpoker.domain.VoteRejectedException;

/**
 * Messages serveur → client du canal de session (asyncapi.yaml), écrits à la main d'après {@code tick.json},
 * {@code error.json} et {@code session-state.json} (AD-6).
 */
final class ServerMessages {

    private ServerMessages() {
    }

    /** {@code tick.json} */
    record TickMessage(String type) {
        static final TickMessage INSTANCE = new TickMessage("tick");
    }

    /** {@code error.json} */
    record ErrorMessage(String type, String code) {
        static final ErrorMessage INVALID_MESSAGE = new ErrorMessage("error", "INVALID_MESSAGE");

        /** Refus d'un {@code vote} : le code du contrat porte le nom de la raison. */
        static ErrorMessage of(VoteRejectedException.Reason reason) {
            return new ErrorMessage("error", reason.name());
        }
    }

    /** {@code session-state.json} : instantané pour un destinataire, sans aucun jeton. */
    record SessionStateMessage(String type, String sessionId, long version, String selfParticipantId,
            RoundView round, List<ParticipantView> participants, ProgressView progress, SummaryView summary,
            LastChangeView lastChange) {

        static SessionStateMessage of(SessionSnapshot snapshot) {
            return new SessionStateMessage("sessionState", snapshot.sessionId(), snapshot.version(),
                    snapshot.selfParticipantId().toString(),
                    new RoundView(snapshot.round().roundId(), snapshot.round().status().name()),
                    snapshot.participants().stream().map(ParticipantView::of).toList(),
                    new ProgressView(snapshot.progress().voted(), snapshot.progress().expected()),
                    null,
                    new LastChangeView(snapshot.lastChange().action().name(),
                            snapshot.lastChange().byParticipantId() == null ? null
                                    : snapshot.lastChange().byParticipantId().toString()));
        }
    }

    record RoundView(String roundId, String status) {
    }

    record ParticipantView(String participantId, String pseudo, String role, boolean connected, int joinOrder,
            boolean hasVoted, String vote, boolean canVoteThisRound) {

        static ParticipantView of(SessionSnapshot.Seat seat) {
            return new ParticipantView(seat.participantId().toString(), seat.pseudo().value(), seat.role().name(),
                    seat.connected(), seat.joinOrder(), seat.hasVoted(), seat.vote(), seat.canVoteThisRound());
        }
    }

    record ProgressView(int voted, int expected) {
    }

    /** Synthèse d'un tour révélé ; toujours nulle tant que la révélation n'existe pas (story 1.7). */
    record SummaryView(Double average, MostVotedView mostVoted, String min, String max, boolean consensus) {
    }

    record MostVotedView(List<String> values, int count) {
    }

    record LastChangeView(String action, String byParticipantId) {
    }
}
