package com.planningpoker.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.planningpoker.adapter.in.ws.SessionSocketHandler;

/** WebSocket brut, sans STOMP ni SockJS (AD-2), ouvert aux seules origines de {@code ALLOWED_ORIGINS} (AD-11). */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final SessionSocketHandler handler;
    private final AllowedOrigins allowedOrigins;

    public WebSocketConfig(SessionSocketHandler handler, AllowedOrigins allowedOrigins) {
        this.handler = handler;
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/sessions/{sessionId}")
                .setAllowedOrigins(allowedOrigins.asArray());
    }
}
