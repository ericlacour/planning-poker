package com.planningpoker.adapter.in.ws;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.socket.CloseStatus;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Vivacité des connexions de bout en bout (AD-8), délais raccourcis : ping de protocole, pong qui garde la
 * connexion vivante, connexion muette fermée par le balayeur et son départ diffusé aux autres.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "planning-poker.allowed-origins=https://front.example",
        "planning-poker.tick-interval=10m",
        "planning-poker.ping-interval=100ms",
        "planning-poker.liveness-timeout=1s",
        "planning-poker.sweep-interval=100ms" })
class LivenessTest {

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

    /**
     * Client de test. Le client WebSocket du JDK répond seul aux pings tant qu'il lit : un client « muet » cesse de
     * lire après son premier instantané, comme un réseau coupé, et ne répond donc plus aux pings.
     */
    static final class Client implements WebSocket.Listener {
        final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        final AtomicInteger pings = new AtomicInteger();
        final AtomicBoolean closed = new AtomicBoolean();
        final CompletableFuture<Integer> closeCode = new CompletableFuture<>();
        private final boolean silent;
        WebSocket socket;
        private final StringBuilder partial = new StringBuilder();

        Client(boolean silent) {
            this.silent = silent;
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            partial.append(data);
            if (last) {
                messages.add(partial.toString());
                partial.setLength(0);
            }
            if (!silent) {
                webSocket.request(1);
            }
            return null;
        }

        @Override
        public CompletionStage<?> onPing(WebSocket webSocket, ByteBuffer message) {
            pings.incrementAndGet();
            webSocket.request(1);
            return null;
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            closed.set(true);
            closeCode.complete(statusCode);
            return null;
        }
    }

    private String[] post(String path, String pseudo) throws Exception {
        HttpResponse<String> response = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"pseudo\":\"" + pseudo + "\",\"role\":\"VOTER\"}"))
                .build(), HttpResponse.BodyHandlers.ofString());
        JsonNode body = jsonMapper.readTree(response.body());
        return new String[] { body.path("sessionId").asString(), body.get("participantId").asString(),
                body.get("participantToken").asString() };
    }

    private Client connect(String sessionId, String token, boolean silent) throws Exception {
        return connect(sessionId, token, new Client(silent));
    }

    private Client connect(String sessionId, String token, Client client) throws Exception {
        WebSocket socket = http.newWebSocketBuilder()
                .header("Origin", ORIGIN)
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/sessions/" + sessionId), client)
                .get(5, TimeUnit.SECONDS);
        opened.add(socket);
        client.socket = socket;
        socket.sendText("{\"type\":\"hello\",\"participantToken\":\"" + token + "\"}", true).join();
        assertThat(client.messages.poll(5, TimeUnit.SECONDS)).contains("sessionState");
        return client;
    }

    /** Prochain instantané dont le dernier changement est {@code PRESENCE}, ou {@code null} dans le délai. */
    private JsonNode nextPresence(Client client, long timeoutMs) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs);
        while (true) {
            String text = client.messages.poll(Math.max(deadline - System.nanoTime(), 0), TimeUnit.NANOSECONDS);
            if (text == null) {
                return null;
            }
            JsonNode node = jsonMapper.readTree(text);
            if ("PRESENCE".equals(node.path("lastChange").path("action").asString())) {
                return node;
            }
        }
    }

    @Test
    void aConnectionThatAnswersPingsStaysConnected() throws Exception {
        String[] alice = post("/api/sessions", "Alice");
        Client a = connect(alice[0], alice[2], false);
        Thread.sleep(2_000);
        assertThat(a.pings.get()).isGreaterThanOrEqualTo(5);
        assertThat(a.closed.get()).isFalse();
        assertThat(nextPresence(a, 100)).isNull();
    }

    @Test
    void aSilentConnectionIsClosedAndTheOthersSeeItDisconnected() throws Exception {
        String[] alice = post("/api/sessions", "Alice");
        Client a = connect(alice[0], alice[2], false);
        String[] bob = post("/api/sessions/" + alice[0] + "/participants", "Bob");
        Client b = connect(alice[0], bob[2], true);

        JsonNode left = null;
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (left == null && System.nanoTime() < deadline) {
            JsonNode presence = nextPresence(a, 5_000);
            if (presence != null && presence.get("lastChange").get("byParticipantId").asString().equals(bob[1])) {
                for (JsonNode seat : presence.get("participants")) {
                    if (seat.get("participantId").asString().equals(bob[1])
                            && !seat.get("connected").asBoolean()) {
                        left = presence;
                    }
                }
            }
        }
        assertThat(left).as("Bob disconnected").isNotNull();
        // Le serveur a bien fermé le socket muet : Bob relit et reçoit SESSION_NOT_RELIABLE (4500).
        b.socket.request(Long.MAX_VALUE);
        assertThat(b.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(CloseStatus.SESSION_NOT_RELIABLE.getCode());
        assertThat(nextPresence(a, 1_500)).as("no second PRESENCE").isNull();
        assertThat(a.closed.get()).isFalse();
    }

    @Test
    void anyMessageCountsAsActivity() throws Exception {
        String[] alice = post("/api/sessions", "Alice");
        Client a = connect(alice[0], alice[2], false);
        String[] bob = post("/api/sessions/" + alice[0] + "/participants", "Bob");
        Client b = connect(alice[0], bob[2], true);
        nextPresence(a, 1_000);

        for (int i = 0; i < 8; i++) {
            Thread.sleep(250);
            b.socket.sendText("{\"type\":\"heartbeat\"}", true).join();
        }
        assertThat(nextPresence(a, 100)).as("Bob still connected").isNull();
    }
}
