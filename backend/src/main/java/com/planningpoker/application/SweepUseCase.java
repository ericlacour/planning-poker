package com.planningpoker.application;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.planningpoker.domain.Session;

/**
 * Balayeur (AD-8) : pour chaque session, sous son verrou, supprime d'abord la session créée depuis
 * {@code sessionLifetime} ou plus (FR-4) : {@code delete}, puis chaque connexion ouverte détachée et fermée en
 * {@code 4404}, sans rien publier ; ses pseudos, votes et jetons disparaissent avec elle. Sinon, ferme les
 * connexions muettes depuis {@code livenessTimeout} ou plus, puis retire les participants sans aucune connexion
 * depuis {@code absenceTimeout} ou plus (AD-7). Chaque connexion muette : détacher → {@code disconnect} →
 * {@code save} → {@code publish} si la {@code version} change (un changement {@code PRESENCE} diffusé par
 * participant) ; chaque absent : {@code remove} → {@code save} → {@code publish} ({@code LEAVE}) ; puis fermeture
 * des sockets demandée (AD-3). La connexion étant détachée avant d'être fermée, sa fermeture ne produit aucun second
 * {@code disconnect}.
 */
public class SweepUseCase {

    private static final Logger LOG = LoggerFactory.getLogger(SweepUseCase.class);

    private final SessionStore store;
    private final SessionLocks locks;
    private final SessionBroadcaster broadcaster;
    private final Clock clock;
    private final Duration livenessTimeout;
    private final Duration absenceTimeout;
    private final Duration sessionLifetime;

    public SweepUseCase(SessionStore store, SessionLocks locks, SessionBroadcaster broadcaster, Clock clock,
            Duration livenessTimeout, Duration absenceTimeout, Duration sessionLifetime) {
        this.store = store;
        this.locks = locks;
        this.broadcaster = broadcaster;
        this.clock = clock;
        this.livenessTimeout = Objects.requireNonNull(livenessTimeout, "livenessTimeout");
        this.absenceTimeout = Objects.requireNonNull(absenceTimeout, "absenceTimeout");
        this.sessionLifetime = Objects.requireNonNull(sessionLifetime, "sessionLifetime");
    }

    /** Un passage sur toutes les sessions. Une session qui disparaît pendant le balayage est ignorée. */
    public void sweep() {
        List<String> sessionIds = store.all().stream().map(Session::id).toList();
        for (String sessionId : sessionIds) {
            locks.withLock(sessionId, () -> {
                sweep(sessionId);
                return null;
            });
        }
    }

    private void sweep(String sessionId) {
        Session session = store.find(sessionId).orElse(null);
        if (session == null) {
            return;
        }
        Instant now = clock.instant();
        if (session.isExpired(now, sessionLifetime)) {
            expire(session);
            return;
        }
        Session current = closeSilentConnections(session, now);
        removeAbsentParticipants(current, now);
    }

    private void expire(Session session) {
        store.delete(session.id());
        List<Session.OpenConnection> open = session.openConnections();
        for (Session.OpenConnection connection : open) {
            broadcaster.detach(connection.connectionId());
            broadcaster.closeSessionNotFound(connection.connectionId());
        }
        // Ni identifiant de session (le lien), ni pseudo, ni jeton, ni vote dans les journaux (NFR-6).
        LOG.info("Session expired, closing {} connections", open.size());
    }

    private Session closeSilentConnections(Session session, Instant now) {
        List<Session.OpenConnection> silent = session.silentConnections(now, livenessTimeout);
        Session current = session;
        List<Session.OpenConnection> toClose = new ArrayList<>();
        for (Session.OpenConnection connection : silent) {
            broadcaster.detach(connection.connectionId());
            Session swept = current.disconnect(connection.participantId(), connection.connectionId(), now);
            store.save(swept);
            if (swept.version() != current.version()) {
                broadcaster.publish(swept);
            }
            current = swept;
            toClose.add(connection);
        }
        for (Session.OpenConnection connection : toClose) {
            broadcaster.close(connection.connectionId());
            // Ni jeton, ni pseudo, ni identifiant de session (le lien) dans les journaux.
            LOG.info("Closing a silent connection of participant {}", connection.participantId());
        }
        return current;
    }

    private void removeAbsentParticipants(Session session, Instant now) {
        Session current = session;
        for (UUID participantId : session.absentParticipants(now, absenceTimeout)) {
            Session removed = current.remove(participantId);
            store.save(removed);
            broadcaster.publish(removed);
            current = removed;
            LOG.info("Removing participant {} after a long absence", participantId);
        }
    }
}
