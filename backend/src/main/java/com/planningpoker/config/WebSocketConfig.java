package com.planningpoker.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.unit.DataSize;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import com.planningpoker.adapter.in.ws.SessionSocketHandler;

import jakarta.servlet.ServletContext;
import jakarta.websocket.server.ServerContainer;

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

    /**
     * Message entrant de {@code planning-poker.max-ws-message} au plus : au-delà, le conteneur ferme la connexion en
     * {@code 1009}, et le client se reconnecte (story 2.2). Sans conteneur WebSocket (tests MockMvc), rien à régler.
     */
    @Bean
    public static ServletServerContainerFactoryBean webSocketContainer(
            @Value("${planning-poker.max-ws-message:4KB}") DataSize maxWsMessage) {
        ServletServerContainerFactoryBean container = new OptionalServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize((int) maxWsMessage.toBytes());
        container.setMaxBinaryMessageBufferSize((int) maxWsMessage.toBytes());
        return container;
    }

    /** Ne règle le conteneur WebSocket que s'il existe : un contexte MockMvc n'en a pas. */
    private static final class OptionalServerContainerFactoryBean extends ServletServerContainerFactoryBean {

        private boolean hasContainer;

        @Override
        public void setServletContext(ServletContext servletContext) {
            super.setServletContext(servletContext);
            hasContainer = servletContext.getAttribute(ServerContainer.class.getName()) != null;
        }

        @Override
        public void afterPropertiesSet() {
            if (hasContainer) {
                super.afterPropertiesSet();
            }
        }
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/sessions/{sessionId}")
                .setAllowedOrigins(allowedOrigins.asArray());
    }
}
