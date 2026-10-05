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
import java.util.function.Consumer;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PongMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.planningpoker.adapter.in.ws.ClientMessages.ChangeRoleMessage;
import com.planningpoker.adapter.in.ws.ClientMessages.ClearMessage;
import com.planningpoker.adapter.in.ws.ClientMessages.ClientMessage;
import com.planningpoker.adapter.in.ws.ClientMessages.HeartbeatMessage;
import com.planningpoker.adapter.in.ws.ClientMessages.HelloMessage;
import com.planningpoker.adapter.in.ws.ClientMessages.Intent;
import com.planningpoker.adapter.in.ws.ClientMessages.RevealMessage;
import com.planningpoker.adapter.in.ws.ClientMessages.VoteMessage;
import com.planningpoker.application.ChangeRoleUseCase;
import com.planningpoker.application.ConnectResult;
import com.planningpoker.application.RoundUseCase;
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
 * Ensuite, tout message et tout pong d'une connexion rattachée comptent comme activité (AD-8) ;
 * {@code heartbeat} sans autre effet ; {@code vote} confié au cas d'usage, son refus renvoyé à son seul auteur
 * ({@code error {code}}) ; {@code reveal} et {@code clear} confiés au cas d'usage du tour, et {@code changeRole} au
 * sien, sans réponse ; {@code hide} conforme ignoré (story 3.2) ; tout le reste (second {@code hello}, JSON
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
    private final RoundUseCase rounds;
    private final ChangeRoleUseCase roles;
    private final WebSocketBroadcaster broadcaster;
    private final Duration helloTimeout;
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().daemon().name("ws-hello-timeout").factory());
    private final Map<String, PendingHello> pendingHellos = new ConcurrentHashMap<>();

    public SessionSocketHandler(JsonMapper jsonMapper, SessionConnectionUseCase connections, VoteUseCase votes,
            RoundUseCase rounds, ChangeRoleUseCase roles, WebSocketBroadcaster broadcaster,
            @Value("${planning-poker.hello-timeout:5s}") Duration helloTimeout) {
        this.jsonMapper = jsonMapper;
        this.connections = connections;
        this.votes = votes;
        this.rounds = rounds;
        this.roles = roles;
        this.broadcaster = broadcaster;
        this.helloTimeout = helloTimeout;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        broadcaster.open(session);
        // Inscrite avant d'être programmée : un délai qui expire avant la fin de cette méthode la trouve toujours.
        PendingHello pending = new PendingHello();
        pendingHellos.put(session.getId(), pending);
        pending.timeout = timer.schedule(() -> {
            if (pendingHellos.remove(session.getId(), pending)) {
                close(session, INVALID_HELLO);
            }
        }, helloTimeout.toMillis(), TimeUnit.MILLISECONDS);
    }

    /** Attente du {@code hello} d'une connexion ; {@code timeout} est nul tant que son délai n'est pas programmé. */
    private static final class PendingHello {
        volatile ScheduledFuture<?> timeout;

        void cancel() {
            ScheduledFuture<?> scheduled = timeout;
            if (scheduled != null) {
                scheduled.cancel(false);
            }
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        ClientMessage parsed = ClientMessages.parse(jsonMapper, message.getPayload());
        if (cancelTimeout(session)) {
            handshake(session, parsed);
            return;
        }
        touch(session);
        switch (parsed) {
            case HeartbeatMessage heartbeat -> {
                // Signe de vie du client : rien d'autre que l'activité.
            }
            case VoteMessage vote -> vote(session, vote);
            case RevealMessage reveal -> withAttachment(session,
                    a -> rounds.reveal(a.sessionId(), a.participantId(), reveal.roundId()));
            case ClearMessage clear -> withAttachment(session,
                    a -> rounds.clear(a.sessionId(), a.participantId(), clear.roundId()));
            case ChangeRoleMessage change -> withAttachment(session,
                    a -> roles.changeRole(a.sessionId(), a.participantId(), change.role()));
            case Intent intent -> {
                // hide conforme : livré par la story 3.2.
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
        touch(session);
        broadcaster.send(session.getId(), ServerMessages.ErrorMessage.INVALID_MESSAGE);
    }

    @Override
    protected void handlePongMessage(WebSocketSession session, PongMessage message) {
        touch(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        if (status.getCode() == CloseStatus.TOO_BIG_TO_PROCESS.getCode()) {
            // Plafond du message entrant (story 2.6) : une ligne, sans détail identifiant.
            LOG.info("WebSocket message refused: too large");
        }
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

    /** Activité d'une connexion rattachée ; ignorée pour une connexion pas (ou plus) rattachée. */
    private void touch(WebSocketSession session) {
        withAttachment(session, a -> connections.touch(a.sessionId(), session.getId()));
    }

    private void withAttachment(WebSocketSession session, Consumer<WsConnection.Attachment> action) {
        WsConnection.Attachment attachment = broadcaster.attachmentOf(session.getId());
        if (attachment != null) {
            action.accept(attachment);
        }
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
        PendingHello pending = pendingHellos.remove(session.getId());
        if (pending == null) {
            return false;
        }
        pending.cancel();
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
