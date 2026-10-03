package com.planningpoker.application;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.planningpoker.domain.Session;

/**
 * Balayeur (AD-8) : ferme les connexions muettes depuis {@code livenessTimeout} ou plus. Pour chaque session, sous
 * son verrou, et pour chaque connexion muette : détacher → {@code disconnect} → {@code save} → {@code publish} si la
 * {@code version} change (un changement {@code PRESENCE} diffusé par participant) ; puis fermeture des sockets
 * demandée (AD-3). La connexion étant détachée avant d'être fermée,
 * sa fermeture ne produit aucun second {@code disconnect}.
 */
public class SweepUseCase {

    private static final Logger LOG = LoggerFactory.getLogger(SweepUseCase.class);

    private final SessionStore store;
    private final SessionLocks locks;
    private final SessionBroadcaster broadcaster;
    private final Clock clock;
    private final Duration livenessTimeout;

    public SweepUseCase(SessionStore store, SessionLocks locks, SessionBroadcaster broadcaster, Clock clock,
            Duration livenessTimeout) {
        this.store = store;
        this.locks = locks;
        this.broadcaster = broadcaster;
        this.clock = clock;
        this.livenessTimeout = Objects.requireNonNull(livenessTimeout, "livenessTimeout");
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
        List<Session.OpenConnection> silent = session.silentConnections(clock.instant(), livenessTimeout);
        if (silent.isEmpty()) {
            return;
        }
        Session current = session;
        List<Session.OpenConnection> toClose = new ArrayList<>();
        for (Session.OpenConnection connection : silent) {
            broadcaster.detach(connection.connectionId());
            Session swept = current.disconnect(connection.participantId(), connection.connectionId());
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
    }
}
