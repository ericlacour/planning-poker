package com.planningpoker.adapter.in.ws;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

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

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Poignée de main minimale du canal {@code /ws/sessions/{sessionId}} (asyncapi.yaml), en attendant la story 1.5 :
 * un premier message autre qu'un {@code hello} valide, ou aucun {@code hello} dans le délai, ferme en 1008 ;
 * un {@code hello} valide ferme en 4404, puisqu'aucune session n'existe encore.
 * Seul celui qui retire la connexion de {@code pendingHellos} la ferme : le délai et le premier message ne se
 * concurrencent jamais.
 */
@Component
public class SessionSocketHandler extends TextWebSocketHandler implements DisposableBean {

    static final CloseStatus SESSION_NOT_FOUND = new CloseStatus(4404, "Session not found");
    static final CloseStatus INVALID_HELLO = CloseStatus.POLICY_VIOLATION.withReason("hello expected");

    private static final Logger LOG = LoggerFactory.getLogger(SessionSocketHandler.class);
    private static final int TOKEN_MAX_LENGTH = 64;

    private final JsonMapper jsonMapper;
    private final Duration helloTimeout;
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().daemon().name("ws-hello-timeout").factory());
    private final Map<String, ScheduledFuture<?>> pendingHellos = new ConcurrentHashMap<>();

    public SessionSocketHandler(JsonMapper jsonMapper,
            @Value("${planning-poker.hello-timeout:5s}") Duration helloTimeout) {
        this.jsonMapper = jsonMapper;
        this.helloTimeout = helloTimeout;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        ScheduledFuture<?> timeout = timer.schedule(() -> {
            if (pendingHellos.remove(session.getId()) != null) {
                close(session, INVALID_HELLO);
            }
        }, helloTimeout.toMillis(), TimeUnit.MILLISECONDS);
        pendingHellos.put(session.getId(), timeout);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        if (cancelTimeout(session)) {
            close(session, isValidHello(message.getPayload()) ? SESSION_NOT_FOUND : INVALID_HELLO);
        }
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        if (cancelTimeout(session)) {
            close(session, INVALID_HELLO);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        cancelTimeout(session);
    }

    @Override
    public void destroy() {
        timer.shutdownNow();
    }

    private boolean isValidHello(String payload) {
        try {
            JsonNode node = jsonMapper.readTree(payload);
            if (node == null || !node.isObject() || node.size() != 2) {
                return false;
            }
            JsonNode token = node.get("participantToken");
            if (!"hello".equals(node.path("type").asString(null)) || token == null || !token.isString()) {
                return false;
            }
            // JSON Schema compte les longueurs en points de code.
            int length = token.asString().codePointCount(0, token.asString().length());
            return length >= 1 && length <= TOKEN_MAX_LENGTH;
        } catch (JacksonException e) {
            return false;
        }
    }

    /** Vrai si l'appelant a retiré la connexion de l'attente du {@code hello}, et lui seul peut donc la fermer. */
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
