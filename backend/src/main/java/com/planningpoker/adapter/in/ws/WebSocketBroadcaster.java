package com.planningpoker.adapter.in.ws;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.planningpoker.application.SessionBroadcaster;
import com.planningpoker.domain.Session;
import com.planningpoker.domain.SessionSnapshot;

import tools.jackson.databind.json.JsonMapper;

/**
 * Registre des connexions ouvertes et diffusion des instantanés (AD-3, AD-5). Les instantanés sont construits et
 * sérialisés sous le verrou de la session (appelant), puis confiés à la file d'envoi de chaque connexion
 * ({@link WsConnection}), servie hors du verrou. Envoie aussi {@code tick} sur chaque connexion rattachée.
 */
@Component
public class WebSocketBroadcaster implements SessionBroadcaster, DisposableBean {

    private final JsonMapper jsonMapper;
    private final ExecutorService senders = Executors.newThreadPerTaskExecutor(
            Thread.ofVirtual().name("ws-send-", 0).factory());
    private final ScheduledExecutorService ticker = Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().daemon().name("ws-tick").factory());
    private final Map<String, WsConnection> connections = new ConcurrentHashMap<>();
    private final Map<String, Set<WsConnection>> bySession = new ConcurrentHashMap<>();
    private final TextMessage tick;

    public WebSocketBroadcaster(JsonMapper jsonMapper,
            @Value("${planning-poker.tick-interval:5s}") Duration tickInterval) {
        this.jsonMapper = jsonMapper;
        this.tick = toText(ServerMessages.TickMessage.INSTANCE);
        ticker.scheduleAtFixedRate(this::tickAll, tickInterval.toMillis(), tickInterval.toMillis(),
                TimeUnit.MILLISECONDS);
    }

    /** Enregistre une connexion qui vient de s'ouvrir, pas encore rattachée. */
    WsConnection open(WebSocketSession session) {
        WsConnection connection = new WsConnection(session, senders);
        connections.put(connection.id(), connection);
        return connection;
    }

    /**
     * La connexion s'est fermée. Renvoie son rattachement, que l'appelant détache par le cas d'usage ; une
     * connexion jamais rattachée est oubliée tout de suite.
     */
    WsConnection.Attachment closed(String connectionId) {
        WsConnection connection = connections.get(connectionId);
        if (connection == null) {
            return null;
        }
        WsConnection.Attachment attachment = connection.markClosed();
        if (attachment == null) {
            connections.remove(connectionId);
        }
        return attachment;
    }

    /** Oublie une connexion refusée à la poignée de main (jamais rattachée). */
    void forget(String connectionId) {
        WsConnection connection = connections.get(connectionId);
        if (connection != null && connection.attachment() == null) {
            connections.remove(connectionId);
        }
    }

    /** Rattachement de la connexion ouverte, ou {@code null} si elle n'est pas (ou plus) rattachée. */
    WsConnection.Attachment attachmentOf(String connectionId) {
        WsConnection connection = connections.get(connectionId);
        return connection == null ? null : connection.attachment();
    }

    /** Envoie un message à une seule connexion rattachée (réponse {@code error}). */
    void send(String connectionId, Object message) {
        WsConnection connection = connections.get(connectionId);
        if (connection != null && connection.attachment() != null) {
            connection.enqueue(toText(message));
        }
    }

    @Override
    public boolean attach(String connectionId, String sessionId, UUID participantId) {
        WsConnection connection = connections.get(connectionId);
        if (connection == null || !connection.attach(sessionId, participantId)) {
            return false;
        }
        bySession.computeIfAbsent(sessionId, id -> ConcurrentHashMap.newKeySet()).add(connection);
        return true;
    }

    @Override
    public boolean detach(String connectionId) {
        WsConnection connection = connections.remove(connectionId);
        if (connection == null) {
            return false;
        }
        WsConnection.Attachment attachment = connection.attachment();
        if (attachment == null) {
            return false;
        }
        bySession.computeIfPresent(attachment.sessionId(), (id, set) -> {
            set.remove(connection);
            return set.isEmpty() ? null : set;
        });
        return true;
    }

    @Override
    public void publish(Session session) {
        Set<WsConnection> targets = bySession.get(session.id());
        if (targets == null) {
            return;
        }
        Map<UUID, TextMessage> byParticipant = new HashMap<>();
        for (WsConnection connection : targets) {
            UUID participantId = connection.attachment().participantId();
            TextMessage snapshot = byParticipant.computeIfAbsent(participantId, id -> snapshotFor(session, id));
            if (snapshot != null) {
                connection.enqueue(snapshot);
            }
        }
    }

    @Override
    public void publishTo(Session session, String connectionId) {
        WsConnection connection = connections.get(connectionId);
        if (connection == null || connection.attachment() == null) {
            return;
        }
        TextMessage snapshot = snapshotFor(session, connection.attachment().participantId());
        if (snapshot != null) {
            connection.enqueue(snapshot);
        }
    }

    /** Instantané filtré pour ce participant ; {@code null} s'il n'est plus dans la session. */
    private TextMessage snapshotFor(Session session, UUID participantId) {
        if (session.participant(participantId).isEmpty()) {
            return null;
        }
        return toText(ServerMessages.SessionStateMessage.of(SessionSnapshot.forRecipient(session, participantId)));
    }

    private void tickAll() {
        for (Set<WsConnection> set : bySession.values()) {
            for (WsConnection connection : set) {
                connection.enqueue(tick);
            }
        }
    }

    private TextMessage toText(Object message) {
        return new TextMessage(jsonMapper.writeValueAsString(message));
    }

    @Override
    public void destroy() {
        ticker.shutdownNow();
        senders.shutdownNow();
    }
}
