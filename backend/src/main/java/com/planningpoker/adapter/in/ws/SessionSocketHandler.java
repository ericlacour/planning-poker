package com.planningpoker.adapter.in.ws;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.planningpoker.adapter.in.ws.ClientMessages.ClientMessage;
import com.planningpoker.adapter.in.ws.ClientMessages.HeartbeatMessage;
import com.planningpoker.adapter.in.ws.ClientMessages.HelloMessage;
import com.planningpoker.adapter.in.ws.ClientMessages.Intent;
import com.planningpoker.adapter.in.ws.ClientMessages.VoteMessage;
import com.planningpoker.application.ConnectResult;
import com.planningpoker.application.SessionConnectionUseCase;
import com.planningpoker.application.VoteUseCase;

import tools.jackson.databind.json.JsonMapper;

/**
 * Canal {@code /ws/sessions/{sessionId}} (asyncapi.yaml).
 * <p>
 * Poignée de main : un premier message autre qu'un {@code hello} conforme, ou aucun {@code hello} dans le délai,
 * ferme en 1008 ; puis session inconnue (ou de forme invalide) en 4404, jeton inconnu en 4401 ; sinon la connexion
 * est rattachée au participant et reçoit son instantané. Seul celui qui retire la connexion de
 * {@code pendingHellos} poursuit la poignée de main : le délai et le premier message ne se concurrencent jamais.
 * <p>
 * Ensuite : {@code heartbeat} sans effet ; {@code vote} confié au cas d'usage, son refus renvoyé à son seul auteur
 * ({@code error {code}}) ; {@code reveal}, {@code hide}, {@code clear}, {@code changeRole} conformes ignorés
 * (stories 1.7, 3.x) ; tout le reste (second {@code hello}, JSON
 * invalide, {@code type} inconnu, message hors schéma) reçoit {@code error INVALID_MESSAGE}, sans effet.
 */
@Component
public class SessionSocketHandler extends TextWebSocketHandler implements DisposableBean {

    static final CloseStatus SESSION_NOT_FOUND = new CloseStatus(4404, "Session not found");
    static final CloseStatus UNKNOWN_TOKEN = new CloseStatus(4401, "Unknown token");
    static final CloseStatus INVALID_HELLO = CloseStatus.POLICY_VIOLATION.withReason("hello expected");

    private static final Logger LOG = LoggerFactory.getLogger(SessionSocketHandler.class);
    private static final Pattern SESSION_ID = Pattern.compile("^[A-Za-z0-9_-]{22}$");

    private final JsonMapper jsonMapper;
    private final SessionConnectionUseCase connections;
    private final VoteUseCase votes;
    private final WebSocketBroadcaster broadcaster;
    private final Duration helloTimeout;
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().daemon().name("ws-hello-timeout").factory());
    private final Map<String, ScheduledFuture<?>> pendingHellos = new ConcurrentHashMap<>();

    public SessionSocketHandler(JsonMapper jsonMapper, SessionConnectionUseCase connections, VoteUseCase votes,
            WebSocketBroadcaster broadcaster,
            @Value("${planning-poker.hello-timeout:5s}") Duration helloTimeout) {
        this.jsonMapper = jsonMapper;
        this.connections = connections;
        this.votes = votes;
        this.broadcaster = broadcaster;
        this.helloTimeout = helloTimeout;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        broadcaster.open(session);
        ScheduledFuture<?> timeout = timer.schedule(() -> {
            if (pendingHellos.remove(session.getId()) != null) {
                close(session, INVALID_HELLO);
            }
        }, helloTimeout.toMillis(), TimeUnit.MILLISECONDS);
        pendingHellos.put(session.getId(), timeout);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        ClientMessage parsed = ClientMessages.parse(jsonMapper, message.getPayload());
        if (cancelTimeout(session)) {
            handshake(session, parsed);
            return;
        }
        switch (parsed) {
            case HeartbeatMessage heartbeat -> {
                // Signe de vie du client : aucun effet.
            }
            case VoteMessage vote -> vote(session, vote);
            case Intent intent -> {
                // Intentions conformes : livrées par les stories 1.7 et 3.x.
            }
            default -> broadcaster.send(session.getId(), ServerMessages.ErrorMessage.INVALID_MESSAGE);
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        if (cancelTimeout(session)) {
            close(session, INVALID_HELLO);
            return;
        }
        broadcaster.send(session.getId(), ServerMessages.ErrorMessage.INVALID_MESSAGE);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        cancelTimeout(session);
        WsConnection.Attachment attachment = broadcaster.closed(session.getId());
        if (attachment != null) {
            connections.disconnect(attachment.sessionId(), attachment.participantId(), session.getId());
        }
    }

    @Override
    public void destroy() {
        timer.shutdownNow();
    }

    private void handshake(WebSocketSession session, ClientMessage parsed) {
        if (!(parsed instanceof HelloMessage hello)) {
            close(session, INVALID_HELLO);
            return;
        }
        ConnectResult result = connections.connect(sessionIdOf(session), hello.participantToken(),
                session.getId());
        switch (result) {
            case ConnectResult.SessionNotFound notFound -> refuse(session, SESSION_NOT_FOUND);
            case ConnectResult.UnknownToken unknown -> refuse(session, UNKNOWN_TOKEN);
            case ConnectResult.ConnectionClosed gone -> broadcaster.forget(session.getId());
            case ConnectResult.Connected connected -> {
                // Instantané déjà en file d'envoi.
            }
        }
    }

    private void vote(WebSocketSession session, VoteMessage vote) {
        WsConnection.Attachment attachment = broadcaster.attachmentOf(session.getId());
        if (attachment == null) {
            return;
        }
        votes.vote(attachment.sessionId(), attachment.participantId(), vote.roundId(), vote.card())
                .ifPresent(reason -> broadcaster.send(session.getId(), ServerMessages.ErrorMessage.of(reason)));
    }

    private void refuse(WebSocketSession session, CloseStatus status) {
        broadcaster.forget(session.getId());
        close(session, status);
    }

    /** Identifiant de session pris dans le chemin ; {@code null} s'il n'a pas la forme du contrat. */
    static String sessionIdOf(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri == null || uri.getRawPath() == null) {
            return null;
        }
        String path = uri.getRawPath();
        String candidate = path.substring(path.lastIndexOf('/') + 1);
        return SESSION_ID.matcher(candidate).matches() ? candidate : null;
    }

    /** Vrai si l'appelant a retiré la connexion de l'attente du {@code hello}, et lui seul peut donc la traiter. */
    private boolean cancelTimeout(WebSocketSession session) {
        ScheduledFuture<?> timeout = pendingHellos.remove(session.getId());
        if (timeout == null) {
            return false;
        }
        timeout.cancel(false);
        return true;
    }

    private void close(WebSocketSession session, CloseStatus status) {
        try {
            if (session.isOpen()) {
                session.close(status);
            }
        } catch (IOException | IllegalStateException e) {
            LOG.debug("WebSocket close failed for connection {}", session.getId(), e);
        }
    }
}
