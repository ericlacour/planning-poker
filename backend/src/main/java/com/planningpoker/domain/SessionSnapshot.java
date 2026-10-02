package com.planningpoker.domain;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Instantané d'une session pour un destinataire ({@code session-state.json}, AD-5) : tout ce qu'il a le droit de
 * voir, rien de plus. Aucun jeton n'y figure. Calcul pur, sans effet de bord. Le tour est toujours caché tant que
 * la révélation n'existe pas (story 1.7) : la synthèse est donc absente (nulle dans le message).
 */
public record SessionSnapshot(String sessionId, long version, UUID selfParticipantId, Round round,
        List<Seat> participants, Progress progress, LastChange lastChange) {

    public SessionSnapshot {
        participants = List.copyOf(participants);
    }

    public record Round(String roundId, RoundStatus status) {
    }

    /** Place d'un participant, vue par le destinataire. {@code vote} reste nul tant que le vote n'existe pas. */
    public record Seat(UUID participantId, Pseudo pseudo, Role role, boolean connected, int joinOrder,
            boolean hasVoted, String vote, boolean canVoteThisRound) {
    }

    /** « N votes sur M » : M compte tous les votants, déconnectés compris. */
    public record Progress(int voted, int expected) {
    }

    /** Votants d'abord, puis observateurs ; chaque groupe par ordre d'arrivée. */
    static final Comparator<Participant> SEAT_ORDER = Comparator
            .comparing((Participant p) -> p.role() == Role.VOTER ? 0 : 1)
            .thenComparingInt(Participant::joinOrder);

    /**
     * @throws IllegalArgumentException si le destinataire n'est pas un participant de la session
     */
    public static SessionSnapshot forRecipient(Session session, UUID recipientId) {
        Objects.requireNonNull(session, "session");
        if (session.participant(recipientId).isEmpty()) {
            throw new IllegalArgumentException("recipient is not a participant");
        }
        List<Seat> seats = session.participants().stream()
                .sorted(SEAT_ORDER)
                .map(p -> new Seat(p.id(), p.pseudo(), p.role(), p.connected(), p.joinOrder(), false, null,
                        p.role() == Role.VOTER))
                .toList();
        int voters = (int) session.participants().stream().filter(p -> p.role() == Role.VOTER).count();
        return new SessionSnapshot(session.id(), session.version(), recipientId,
                new Round(session.roundId(), RoundStatus.HIDDEN), seats, new Progress(0, voters),
                session.lastChange());
    }
}
