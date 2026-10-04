package com.planningpoker.adapter.in.ws;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Expiration d'une session de bout en bout (FR-4), durée de vie raccourcie : le balayeur ferme chaque connexion
 * en {@code 4404}, puis la session est inconnue de l'API REST.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "planning-poker.allowed-origins=https://front.example",
        "planning-poker.session-lifetime=5s",
        "planning-poker.sweep-interval=100ms" })
class SessionExpiryTest {

    private static final String ORIGIN = "https://front.example";

    @LocalServerPort
    int port;

    @Autowired
    JsonMapper jsonMapper;

    private final HttpClient http = HttpClient.newHttpClient();
    private final List<WebSocket> opened = new ArrayList<>();

    @AfterEach
    void closeAll() {
        opened.forEach(WebSocket::abort);
    }

    static final class Client implements WebSocket.Listener {
        final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        final CompletableFuture<Integer> closeCode = new CompletableFuture<>();
        private final StringBuilder partial = new StringBuilder();

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            partial.append(data);
            if (last) {
                messages.add(partial.toString());
                partial.setLength(0);
            }
            webSocket.request(1);
            return null;
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            closeCode.complete(statusCode);
            return null;
        }
    }

    private HttpResponse<String> send(HttpRequest.Builder request) throws Exception {
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
    }

    private JsonNode post(String path, String pseudo) throws Exception {
        return jsonMapper.readTree(send(request(path)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"pseudo\":\"" + pseudo + "\",\"role\":\"VOTER\"}")))
                .body());
    }

    private Client connect(String sessionId, String token) throws Exception {
        Client client = new Client();
        WebSocket socket = http.newWebSocketBuilder()
                .header("Origin", ORIGIN)
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/sessions/" + sessionId), client)
                .get(5, TimeUnit.SECONDS);
        opened.add(socket);
        socket.sendText("{\"type\":\"hello\",\"participantToken\":\"" + token + "\"}", true).join();
        assertThat(client.messages.poll(5, TimeUnit.SECONDS)).contains("sessionState");
        return client;
    }

    @Test
    void everyConnectionIsClosedAs4404AndTheSessionNoLongerExists() throws Exception {
        JsonNode alice = post("/api/sessions", "Alice");
        String sessionId = alice.get("sessionId").asString();
        JsonNode bob = post("/api/sessions/" + sessionId + "/participants", "Bob");
        Client a = connect(sessionId, alice.get("participantToken").asString());
        Client b = connect(sessionId, bob.get("participantToken").asString());
        // Encore en vie avant sa durée de vie.
        assertThat(send(request("/api/sessions/" + sessionId).GET()).statusCode()).isEqualTo(204);
        assertThat(a.closeCode).isNotDone();

        assertThat(a.closeCode.get(10, TimeUnit.SECONDS)).isEqualTo(4404);
        assertThat(b.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(4404);

        assertThat(send(request("/api/sessions/" + sessionId).GET()).statusCode()).isEqualTo(404);
        JsonNode join = post("/api/sessions/" + sessionId + "/participants", "Chloe");
        assertThat(join.get("code").asString()).isEqualTo("SESSION_NOT_FOUND");
    }
}
