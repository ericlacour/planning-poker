package com.planningpoker.adapter.in.ws;

import java.io.IOException;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

/**
 * Une connexion WebSocket et sa file d'envoi (AD-3). {@link #enqueue} ne bloque jamais : il range le message dans
 * la file, servie dans l'ordre par une seule tâche à la fois, hors de tout verrou de session. La connexion qui
 * déborde (plus de {@link #BUFFER_LIMIT} octets en attente, ou un envoi bloqué depuis plus de
 * {@link #SEND_TIME_LIMIT_MS} ms) est fermée.
 */
final class WsConnection {

    static final int SEND_TIME_LIMIT_MS = 2_000;
    static final int BUFFER_LIMIT = 64 * 1024;

    private static final Logger LOG = LoggerFactory.getLogger(WsConnection.class);

    /** Participant et session auxquels la connexion est rattachée après son {@code hello}. */
    record Attachment(String sessionId, UUID participantId) {
    }

    private final WebSocketSession session;
    private final WebSocketSession out;
    private final Executor senders;
    private final Queue<TextMessage> queue = new ConcurrentLinkedQueue<>();
    private final AtomicLong queuedBytes = new AtomicLong();
    private final AtomicBoolean draining = new AtomicBoolean();
    /** Début de l'envoi en cours ({@link System#nanoTime()}), 0 sans envoi en cours. */
    private volatile long sendingSince;
    private volatile boolean stopped;

    private Attachment attachment;
    private boolean closed;

    WsConnection(WebSocketSession session, Executor senders) {
        this.session = session;
        this.out = new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_LIMIT,
                ConcurrentWebSocketSessionDecorator.OverflowStrategy.TERMINATE);
        this.senders = senders;
    }

    String id() {
        return session.getId();
    }

    /** Rattache la connexion, sauf si elle est déjà fermée. */
    synchronized boolean attach(String sessionId, UUID participantId) {
        if (closed || attachment != null) {
            return false;
        }
        attachment = new Attachment(sessionId, participantId);
        return true;
    }

    synchronized Attachment attachment() {
        return attachment;
    }

    /** Note la fermeture et renvoie le rattachement éventuel : un rattachement ultérieur échouera. */
    synchronized Attachment markClosed() {
        closed = true;
        return attachment;
    }

    /** Met le message en file d'envoi, sans jamais bloquer. */
    void enqueue(TextMessage message) {
        if (stopped || !session.isOpen()) {
            return;
        }
        long since = sendingSince;
        boolean stuck = since != 0 && System.nanoTime() - since > SEND_TIME_LIMIT_MS * 1_000_000L;
        if (stuck || queuedBytes.get() + message.getPayloadLength() > BUFFER_LIMIT) {
            overflow();
            return;
        }
        queuedBytes.addAndGet(message.getPayloadLength());
        queue.add(message);
        if (draining.compareAndSet(false, true)) {
            senders.execute(this::drain);
        }
    }

    private void drain() {
        do {
            TextMessage message;
            while ((message = queue.poll()) != null) {
                queuedBytes.addAndGet(-message.getPayloadLength());
                if (stopped) {
                    continue;
                }
                sendingSince = System.nanoTime();
                try {
                    out.sendMessage(message);
                } catch (IOException | RuntimeException e) {
                    sendFailed(e);
                } finally {
                    sendingSince = 0;
                }
            }
            draining.set(false);
        } while (!queue.isEmpty() && draining.compareAndSet(false, true));
    }

    /** File pleine ou envoi bloqué trop longtemps : la connexion est fermée. */
    private void overflow() {
        if (stop()) {
            LOG.info("Closing connection {}: send buffer overflow", id());
            senders.execute(() -> close(CloseStatus.SESSION_NOT_RELIABLE));
        }
    }

    /**
     * Un envoi a échoué : presque toujours une connexion que le client ferme pendant l'envoi. Elle n'est plus
     * fiable : plus aucun envoi, et fermeture si elle ne l'est pas déjà.
     */
    private void sendFailed(Exception e) {
        if (stop()) {
            LOG.debug("WebSocket send failed for connection {}", id(), e);
            senders.execute(() -> close(CloseStatus.SESSION_NOT_RELIABLE));
        }
    }

    /** Arrête les envois ; vrai pour le seul appelant qui les arrête. */
    private synchronized boolean stop() {
        if (stopped) {
            return false;
        }
        stopped = true;
        return true;
    }

    /** Ferme la connexion ; sans effet si elle l'est déjà. */
    void close(CloseStatus status) {
        try {
            if (session.isOpen()) {
                session.close(status);
            }
        } catch (IOException | IllegalStateException e) {
            LOG.debug("WebSocket close failed for connection {}", id(), e);
        }
    }
}
