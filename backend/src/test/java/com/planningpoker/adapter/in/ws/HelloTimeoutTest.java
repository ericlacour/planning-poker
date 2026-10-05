package com.planningpoker.adapter.in.ws;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

/**
 * Délai du {@code hello} plus court que l'ouverture de la connexion (rétrospective de l'epic 2, F2) : un délai nul
 * expire avant même la fin de {@code afterConnectionEstablished}. Il doit quand même fermer la connexion en 1008.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "planning-poker.allowed-origins=https://front.example",
        "planning-poker.hello-timeout=0ms" })
class HelloTimeoutTest {

    private static final String SESSION_ID = "k3Jx9QvT2mLpZ8wR4nYb7A";
    /** Plusieurs connexions, pour que le délai expire au moins une fois avant la fin de l'ouverture. */
    private static final int CONNECTIONS = 20;

    @LocalServerPort
    int port;

    private final HttpClient http = HttpClient.newHttpClient();
    private final List<WebSocket> opened = new ArrayList<>();

    @AfterEach
    void closeAll() {
        opened.forEach(WebSocket::abort);
    }

    @Test
    void aTimeoutThatExpiresDuringTheOpeningStillClosesWith1008() throws Exception {
        List<SessionSocketHandlerTest.Client> clients = new ArrayList<>();
        for (int i = 0; i < CONNECTIONS; i++) {
            SessionSocketHandlerTest.Client client = new SessionSocketHandlerTest.Client();
            client.socket = http.newWebSocketBuilder()
                    .header("Origin", "https://front.example")
                    .buildAsync(URI.create("ws://localhost:" + port + "/ws/sessions/" + SESSION_ID), client)
                    .get(5, TimeUnit.SECONDS);
            opened.add(client.socket);
            clients.add(client);
        }
        for (SessionSocketHandlerTest.Client client : clients) {
            assertThat(client.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
        }
    }
}
