package com.planningpoker.application;

import java.time.Clock;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.planningpoker.domain.Participant;
import com.planningpoker.domain.Session;

/**
 * Ouverture, activité et fermeture d'une connexion WebSocket à une session (FR-6, FR-16, AD-8). Chaque mutation
 * suit, sous le verrou de la session : charger → règle → {@code version++} si changement → {@code save} →
 * {@code publish} (AD-3). L'heure n'est lue que par {@link Clock}.
 */
public class SessionConnectionUseCase {

    private static final Logger LOG = LoggerFactory.getLogger(SessionConnectionUseCase.class);

    private final SessionStore store;
    private final SessionLocks locks;
    private final SessionBroadcaster broadcaster;
    private final Clock clock;

    public SessionConnectionUseCase(SessionStore store, SessionLocks locks, SessionBroadcaster broadcaster,
            Clock clock) {
        this.store = store;
        this.locks = locks;
        this.broadcaster = broadcaster;
        this.clock = clock;
    }

    /**
     * Poignée de main : session d'abord ({@code 4404}), puis jeton ({@code 4401}), puis rattachement de la
     * connexion et instantané. Seule la première connexion du participant change l'état observable.
     */
    public ConnectResult connect(String sessionId, String participantToken, String connectionId) {
        if (sessionId == null) {
            return new ConnectResult.SessionNotFound();
        }
        ConnectResult result = locks.withLock(sessionId, () -> {
            Session session = store.find(sessionId).orElse(null);
            if (session == null) {
                return new ConnectResult.SessionNotFound();
            }
            Participant participant = session.participantWithToken(participantToken).orElse(null);
            if (participant == null) {
                return new ConnectResult.UnknownToken();
            }
            if (!broadcaster.attach(connectionId, sessionId, participant.id())) {
                return new ConnectResult.ConnectionClosed();
            }
            Session connected = session.connect(participant.id(), connectionId, clock.instant());
            store.save(connected);
            if (connected.version() != session.version()) {
                broadcaster.publish(connected);
            } else {
                broadcaster.publishTo(connected, connectionId);
            }
            return new ConnectResult.Connected(participant.id());
        });
        if (result instanceof ConnectResult.Connected(UUID participantId)) {
            // Ni jeton, ni pseudo, ni identifiant de session (le lien) dans les journaux.
            LOG.info("Participant {} opened a connection", participantId);
        }
        return result;
    }

    /**
     * Fermeture d'une connexion. Sans effet si elle n'était pas rattachée (ou déjà détachée) ; seule la dernière
     * connexion du participant change l'état observable.
     */
    public void disconnect(String sessionId, UUID participantId, String connectionId) {
        boolean detached = locks.withLock(sessionId, () -> {
            if (!broadcaster.detach(connectionId)) {
                return false;
            }
            store.find(sessionId).ifPresent(session -> {
                Session disconnected = session.disconnect(participantId, connectionId);
                if (disconnected != session) {
                    store.save(disconnected);
                    if (disconnected.version() != session.version()) {
                        broadcaster.publish(disconnected);
                    }
                }
            });
            return true;
        });
        if (detached) {
            LOG.info("Participant {} closed a connection", participantId);
        }
    }

    /**
     * Activité reçue sur une connexion rattachée (pong ou message) : sa dernière activité devient maintenant.
     * Changement caché : ni {@code version++}, ni diffusion (AD-3). Sans effet pour une connexion inconnue.
     */
    public void touch(String sessionId, String connectionId) {
        locks.withLock(sessionId, () -> {
            store.find(sessionId).ifPresent(session -> {
                Session touched = session.touch(connectionId, clock.instant());
                if (touched != session) {
                    store.save(touched);
                }
            });
            return null;
        });
    }
}
