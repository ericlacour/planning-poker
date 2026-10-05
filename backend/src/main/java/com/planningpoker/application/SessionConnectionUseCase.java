package com.planningpoker.application;

import java.time.Clock;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.planningpoker.domain.Participant;
import com.planningpoker.domain.PseudoTakenException;
import com.planningpoker.domain.Session;
import com.planningpoker.domain.SessionFullException;

/**
 * Ouverture, activité et fermeture d'une connexion WebSocket à une session (FR-6, FR-16, AD-8). Chaque mutation
 * suit, sous le verrou de la session : charger → règle → {@code version++} si changement → {@code save} →
 * {@code publish} (AD-3). L'heure n'est lue que par {@link Clock}.
 */
public class SessionConnectionUseCase {

    private static final Logger LOG = LoggerFactory.getLogger(SessionConnectionUseCase.class);

    private final SessionStore store;
    private final SessionWriter writer;
    private final SessionBroadcaster broadcaster;
    private final Clock clock;
    private final int maxParticipants;

    public SessionConnectionUseCase(SessionStore store, SessionLocks locks, SessionBroadcaster broadcaster,
            Clock clock, int maxParticipants) {
        this.maxParticipants = maxParticipants;
        this.store = store;
        this.writer = new SessionWriter(store, locks, broadcaster);
        this.broadcaster = broadcaster;
        this.clock = clock;
    }

    /**
     * Poignée de main : session d'abord ({@code 4404}), puis jeton ({@code 4401}), puis rattachement de la
     * connexion et instantané. Seule la première connexion du participant change l'état observable.
     * Le jeton d'un participant retiré après une longue absence le remet à sa place si son pseudo est libre
     * ({@code JOIN}, déjà connecté, une seule diffusion) ; sinon (pseudo repris entre-temps, ou session pleine)
     * {@code 4401} et rien ne change : il reste parmi les retirés (AD-7).
     */
    public ConnectResult connect(String sessionId, String participantToken, String connectionId) {
        if (sessionId == null) {
            return new ConnectResult.SessionNotFound();
        }
        ConnectResult result = writer.withLock(sessionId, () -> {
            Session session = store.find(sessionId).orElse(null);
            if (session == null) {
                return new ConnectResult.SessionNotFound();
            }
            Participant participant = session.participantWithToken(participantToken).orElse(null);
            if (participant == null) {
                return session.departedWithToken(participantToken)
                        .map(departed -> rejoin(session, departed, connectionId))
                        .orElseGet(ConnectResult.UnknownToken::new);
            }
            if (!broadcaster.attach(connectionId, sessionId, participant.id())) {
                return new ConnectResult.ConnectionClosed();
            }
            Session connected = session.connect(participant.id(), connectionId, clock.instant());
            if (!writer.commit(session, connected)) {
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

    /** Remet à sa place un participant retiré, sous le verrou de la session : une mutation, une diffusion. */
    private ConnectResult rejoin(Session session, Participant departed, String connectionId) {
        Session rejoined;
        try {
            rejoined = session.rejoin(departed.id(), connectionId, clock.instant(), maxParticipants);
        } catch (PseudoTakenException e) {
            // Ni jeton, ni pseudo, ni identifiant de session (le lien) dans les journaux.
            LOG.info("Participant {} could not come back: pseudo taken", departed.id());
            return new ConnectResult.UnknownToken();
        } catch (SessionFullException e) {
            LOG.info("A removed participant could not come back: session full");
            return new ConnectResult.UnknownToken();
        }
        if (!broadcaster.attach(connectionId, session.id(), departed.id())) {
            return new ConnectResult.ConnectionClosed();
        }
        writer.commit(session, rejoined);
        LOG.info("Participant {} came back after a long absence", departed.id());
        return new ConnectResult.Connected(departed.id());
    }

    /**
     * Fermeture d'une connexion. Sans effet si elle n'était pas rattachée (ou déjà détachée) ; seule la dernière
     * connexion du participant change l'état observable.
     */
    public void disconnect(String sessionId, UUID participantId, String connectionId) {
        boolean detached = writer.withLock(sessionId, () -> {
            if (!broadcaster.detach(connectionId)) {
                return false;
            }
            store.find(sessionId).ifPresent(session -> writer.commit(session,
                    session.disconnect(participantId, connectionId, clock.instant())));
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
        writer.withLock(sessionId, () -> {
            store.find(sessionId)
                    .ifPresent(session -> writer.commit(session, session.touch(connectionId, clock.instant())));
            return null;
        });
    }
}
