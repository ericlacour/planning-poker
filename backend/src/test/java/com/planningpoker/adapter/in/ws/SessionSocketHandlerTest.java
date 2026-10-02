package com.planningpoker.adapter.in.ws;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.net.http.WebSocketHandshakeException;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.junit.jupiter.api.extension.ExtendWith;

import com.planningpoker.ContractExamples;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Le canal {@code /ws/sessions/{sessionId}} de bout en bout (asyncapi.yaml), webservice réel. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "planning-poker.allowed-origins=https://front.example",
        "planning-poker.hello-timeout=300ms",
        "planning-poker.tick-interval=200ms" })
@ExtendWith(OutputCaptureExtension.class)
class SessionSocketHandlerTest {

    private static final String UNKNOWN_SESSION_ID = "k3Jx9QvT2mLpZ8wR4nYb7A";
    private static final String ORIGIN = "https://front.example";
    /** Délai d'attente d'un message qui doit arriver ; bien au-delà de la seconde exigée, pour la CI. */
    private static final long WAIT_MS = 5_000;
    /** Fenêtre d'observation d'un message qui ne doit pas arriver. */
    private static final long QUIET_MS = 500;

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

    /** Client de test : retient les messages reçus (texte brut) et le code de fermeture. */
    static final class Client implements WebSocket.Listener {
        final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        final CompletableFuture<Integer> closeCode = new CompletableFuture<>();
        private final StringBuilder partial = new StringBuilder();
        WebSocket socket;

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

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            closeCode.completeExceptionally(error);
        }

        void send(String text) {
            socket.sendText(text, true).join();
        }
    }

    record Created(String sessionId, String participantId, String participantToken) {
    }

    private Created createSession(String pseudo, String role) throws Exception {
        JsonNode body = post("/api/sessions", pseudo, role);
        return new Created(body.get("sessionId").asString(), body.get("participantId").asString(),
                body.get("participantToken").asString());
    }

    private Created join(String sessionId, String pseudo, String role) throws Exception {
        JsonNode body = post("/api/sessions/" + sessionId + "/participants", pseudo, role);
        return new Created(sessionId, body.get("participantId").asString(), body.get("participantToken").asString());
    }

    private JsonNode post(String path, String pseudo, String role) throws Exception {
        HttpResponse<String> response = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        "{\"pseudo\":\"" + pseudo + "\",\"role\":\"" + role + "\"}"))
                .build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isBetween(200, 201);
        return jsonMapper.readTree(response.body());
    }

    private Client open(String sessionId, String origin) throws Exception {
        Client client = new Client();
        client.socket = http.newWebSocketBuilder()
                .header("Origin", origin)
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/sessions/" + sessionId), client)
                .get(5, TimeUnit.SECONDS);
        opened.add(client.socket);
        return client;
    }

    private Client open(String sessionId) throws Exception {
        return open(sessionId, ORIGIN);
    }

    /** Ouvre une connexion, envoie {@code hello} et renvoie le client avec son premier instantané lu. */
    private Connected connect(Created participant) throws Exception {
        Client client = open(participant.sessionId());
        client.send("{\"type\":\"hello\",\"participantToken\":\"" + participant.participantToken() + "\"}");
        return new Connected(client, nextState(client));
    }

    record Connected(Client client, JsonNode state) {
    }

    /** Prochain message autre que {@code tick}, ou {@code null} s'il n'en vient aucun dans le délai. */
    private JsonNode next(Client client, long timeoutMs) throws Exception {
        long deadline = System.nanoTime() + timeoutMs * 1_000_000;
        while (true) {
            long left = deadline - System.nanoTime();
            String text = client.messages.poll(Math.max(left, 0), TimeUnit.NANOSECONDS);
            if (text == null) {
                return null;
            }
            JsonNode node = jsonMapper.readTree(text);
            if (!"tick".equals(node.path("type").asString())) {
                assertThat(text).doesNotContain("participantToken");
                return node;
            }
        }
    }

    /** Prochain {@code sessionState}, vérifié contre les types écrits à la main (aucun champ hors contrat). */
    private JsonNode nextState(Client client) throws Exception {
        JsonNode node = next(client, WAIT_MS);
        assertThat(node).as("sessionState expected").isNotNull();
        assertThat(node.path("type").asString()).isEqualTo("sessionState");
        ServerMessages.SessionStateMessage typed = jsonMapper.treeToValue(node, ServerMessages.SessionStateMessage.class);
        assertThat(jsonMapper.readTree(jsonMapper.writeValueAsString(typed))).isEqualTo(node);
        return node;
    }

    private static JsonNode seat(JsonNode state, String participantId) {
        for (JsonNode participant : state.get("participants")) {
            if (participant.get("participantId").asString().equals(participantId)) {
                return participant;
            }
        }
        throw new AssertionError("no seat for " + participantId);
    }

    private static void assertInvalidMessage(JsonNode node) {
        assertThat(node).isNotNull();
        assertThat(node.toString()).isEqualTo("{\"type\":\"error\",\"code\":\"INVALID_MESSAGE\"}");
    }

    // --- Poignée de main ---

    @Test
    void rejectsTheHandshakeFromAnUnknownOrigin() {
        assertThatThrownBy(() -> open(UNKNOWN_SESSION_ID, "https://evil.example"))
                .isInstanceOf(ExecutionException.class)
                .cause().isInstanceOfSatisfying(WebSocketHandshakeException.class,
                        e -> assertThat(e.getResponse().statusCode()).isEqualTo(403));
    }

    @Test
    void helloWithTheCreatorTokenAttachesAndSendsTheSnapshot(CapturedOutput output) throws Exception {
        Created alice = createSession("Alice", "VOTER");
        JsonNode state = connect(alice).state();

        assertThat(state.get("version").asLong()).isGreaterThanOrEqualTo(2);
        assertThat(state.get("sessionId").asString()).isEqualTo(alice.sessionId());
        assertThat(state.get("selfParticipantId").asString()).isEqualTo(alice.participantId());
        assertThat(seat(state, alice.participantId()).get("connected").asBoolean()).isTrue();
        assertThat(state.get("lastChange").toString())
                .isEqualTo("{\"action\":\"PRESENCE\",\"byParticipantId\":\"" + alice.participantId() + "\"}");
        assertThat(state.get("summary").isNull()).isTrue();
        assertThat(state.get("progress").toString()).isEqualTo("{\"voted\":0,\"expected\":1}");
        assertThat(state.get("round").get("status").asString()).isEqualTo("HIDDEN");
        assertThat(state.toString()).doesNotContain(alice.participantToken());

        // Journaux : ni jeton, ni pseudo, ni identifiant de session.
        assertThat(output.getOut()).contains(alice.participantId())
                .doesNotContain(alice.participantToken()).doesNotContain(alice.sessionId())
                .doesNotContain("\"Alice\"");
    }

    @Test
    void anUnknownSessionClosesWith4404EvenWithAValidTokenOfAnotherSession() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Client client = open(UNKNOWN_SESSION_ID);
        client.send("{\"type\":\"hello\",\"participantToken\":\"" + alice.participantToken() + "\"}");
        assertThat(client.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(4404);
    }

    @Test
    void aSessionIdOfInvalidShapeClosesWith4404() throws Exception {
        Client client = open("not-a-session");
        client.send(ContractExamples.read("hello", "hello"));
        assertThat(client.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(4404);
    }

    @Test
    void anUnknownTokenClosesWith4401() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Client client = open(alice.sessionId());
        client.send(ContractExamples.read("hello", "hello"));
        assertThat(client.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(4401);
    }

    @Test
    void closesWith1008WhenNoHelloArrives() throws Exception {
        Client client = open(UNKNOWN_SESSION_ID);
        assertThat(client.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
    }

    @Test
    void closesWith1008WhenTheFirstMessageIsNotAHello() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Client client = open(alice.sessionId());
        client.send(ContractExamples.read("heartbeat", "heartbeat"));
        assertThat(client.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
    }

    @Test
    void closesWith4404OnAValidHelloForAnUnknownSession() throws Exception {
        Client client = open(UNKNOWN_SESSION_ID);
        client.send(ContractExamples.read("hello", "hello"));
        assertThat(client.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(4404);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"type\":\"hello\",\"participantToken\":\"Xb4Rt9LmQ2vN7cZp1HsK0w\",\"extra\":1}",
            "{\"type\":\"hello\",\"participantToken\":\"\"}",
            "{\"type\":\"hello\",\"participantToken\":42}",
            "{\"type\":\"hello\"}",
            "pas du JSON" })
    void closesWith1008OnAHelloThatBreaksItsSchema(String hello) throws Exception {
        Client client = open(UNKNOWN_SESSION_ID);
        client.send(hello);
        assertThat(client.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
    }

    @Test
    void closesWith1008OnATokenOver64CodePoints() throws Exception {
        Client client = open(UNKNOWN_SESSION_ID);
        client.send("{\"type\":\"hello\",\"participantToken\":\"" + "a".repeat(65) + "\"}");
        assertThat(client.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
    }

    @Test
    void acceptsATokenOf64CodePointsEvenOutsideTheBasicPlane() throws Exception {
        Client client = open(UNKNOWN_SESSION_ID);
        client.send("{\"type\":\"hello\",\"participantToken\":\"" + "😀".repeat(64) + "\"}");
        assertThat(client.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(4404);
    }

    @Test
    void closesWith1008OnABinaryFirstMessage() throws Exception {
        Client client = open(UNKNOWN_SESSION_ID);
        client.socket.sendBinary(ByteBuffer.wrap(new byte[] { 1, 2, 3 }), true);
        assertThat(client.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
    }

    // --- Après la poignée de main ---

    @Test
    void aSecondHelloGetsInvalidMessageAndChangesNothing() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected a = connect(alice);
        Created bob = join(alice.sessionId(), "Bob", "VOTER");
        nextState(a.client());
        Connected b = connect(bob);
        nextState(a.client());

        a.client().send("{\"type\":\"hello\",\"participantToken\":\"" + alice.participantToken() + "\"}");
        assertInvalidMessage(next(a.client(), WAIT_MS));
        assertThat(next(b.client(), QUIET_MS)).isNull();
        assertThat(next(a.client(), QUIET_MS)).isNull();
        assertThat(a.client().closeCode).isNotDone();
    }

    @ParameterizedTest
    @ValueSource(strings = { "{", "{\"type\":\"nope\"}", "{\"type\":\"heartbeat\",\"x\":1}", "[]", "42",
            "{\"type\":\"vote\",\"roundId\":\"r\",\"card\":\"12345678901234567\"}",
            "{\"type\":\"vote\",\"roundId\":\"r\"}",
            "{\"type\":\"reveal\",\"roundId\":\"\"}",
            "{\"type\":\"changeRole\",\"role\":\"ADMIN\"}" })
    void anInvalidMessageGetsInvalidMessageAndKeepsTheConnectionOpen(String message) throws Exception {
        Connected a = connect(createSession("Alice", "VOTER"));
        a.client().send(message);
        assertInvalidMessage(next(a.client(), WAIT_MS));
        a.client().send(ContractExamples.read("heartbeat", "heartbeat"));
        assertThat(next(a.client(), QUIET_MS)).isNull();
        assertThat(a.client().closeCode).isNotDone();
    }

    @Test
    void aBinaryMessageAfterTheHandshakeGetsInvalidMessage() throws Exception {
        Connected a = connect(createSession("Alice", "VOTER"));
        a.client().socket.sendBinary(ByteBuffer.wrap(new byte[] { 1 }), true).join();
        assertInvalidMessage(next(a.client(), WAIT_MS));
    }

    @Test
    void heartbeatAndConformingIntentsGetNoAnswer() throws Exception {
        Connected a = connect(createSession("Alice", "VOTER"));
        a.client().send(ContractExamples.read("heartbeat", "heartbeat"));
        for (String[] example : new String[][] { { "vote", "choose-card" }, { "vote", "withdraw" },
                { "vote", "coffee" }, { "reveal", "reveal" }, { "hide", "hide" }, { "clear", "clear" },
                { "change-role", "to-observer" } }) {
            a.client().send(ContractExamples.read(example[0], example[1]));
        }
        assertThat(next(a.client(), QUIET_MS)).isNull();
        assertThat(a.client().closeCode).isNotDone();
    }

    // --- Diffusion ---

    @Test
    void anArrivalIsBroadcastAsJoinThenPresenceWithinOneSecond() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected a = connect(alice);

        long start = System.nanoTime();
        Created bob = join(alice.sessionId(), "Bob", "OBSERVER");
        JsonNode joined = nextState(a.client());
        assertThat(System.nanoTime() - start).isLessThan(1_000_000_000L);
        assertThat(joined.get("lastChange").get("action").asString()).isEqualTo("JOIN");
        assertThat(joined.get("lastChange").get("byParticipantId").asString()).isEqualTo(bob.participantId());
        assertThat(seat(joined, bob.participantId()).get("connected").asBoolean()).isFalse();
        assertThat(joined.get("version").asLong()).isEqualTo(a.state().get("version").asLong() + 1);

        start = System.nanoTime();
        Connected b = connect(bob);
        JsonNode present = nextState(a.client());
        assertThat(System.nanoTime() - start).isLessThan(1_000_000_000L);
        assertThat(present.get("lastChange").get("action").asString()).isEqualTo("PRESENCE");
        assertThat(seat(present, bob.participantId()).get("connected").asBoolean()).isTrue();

        // Filtrage : chacun reçoit son propre instantané.
        assertThat(present.get("selfParticipantId").asString()).isEqualTo(alice.participantId());
        assertThat(b.state().get("selfParticipantId").asString()).isEqualTo(bob.participantId());
        assertThat(b.state().get("version")).isEqualTo(present.get("version"));
        assertThat(b.state().get("participants").get(1).get("canVoteThisRound").asBoolean()).isFalse();
    }

    @Test
    void aSecondTabChangesNoVersionAndClosingOneKeepsThePresence() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected a1 = connect(alice);
        Created bob = join(alice.sessionId(), "Bob", "VOTER");
        nextState(a1.client());
        Connected b = connect(bob);
        nextState(a1.client());

        Connected a2 = connect(alice);
        assertThat(a2.state().get("version")).isEqualTo(b.state().get("version"));
        assertThat(next(b.client(), QUIET_MS)).isNull();
        assertThat(next(a1.client(), QUIET_MS)).isNull();

        a2.client().socket.sendClose(WebSocket.NORMAL_CLOSURE, "").join();
        assertThat(next(b.client(), QUIET_MS)).isNull();

        a1.client().socket.sendClose(WebSocket.NORMAL_CLOSURE, "").join();
        JsonNode left = nextState(b.client());
        assertThat(left.get("lastChange").toString())
                .isEqualTo("{\"action\":\"PRESENCE\",\"byParticipantId\":\"" + alice.participantId() + "\"}");
        assertThat(seat(left, alice.participantId()).get("connected").asBoolean()).isFalse();
        assertThat(left.get("version").asLong()).isEqualTo(b.state().get("version").asLong() + 1);
    }

    @Test
    void aRefreshReconnectsToTheSameSeat() throws Exception {
        Created alice = createSession("Alice", "OBSERVER");
        Connected first = connect(alice);
        first.client().socket.sendClose(WebSocket.NORMAL_CLOSURE, "").join();
        first.client().closeCode.get(5, TimeUnit.SECONDS);

        JsonNode again = connect(alice).state();
        JsonNode me = seat(again, alice.participantId());
        assertThat(me.get("pseudo").asString()).isEqualTo("Alice");
        assertThat(me.get("role").asString()).isEqualTo("OBSERVER");
        assertThat(me.get("joinOrder").asInt()).isEqualTo(1);
        assertThat(me.get("connected").asBoolean()).isTrue();
        assertThat(again.get("participants")).hasSize(1);
    }

    @Test
    void ticksArriveEveryIntervalOnEachAttachedConnection() throws Exception {
        Connected a = connect(createSession("Alice", "VOTER"));
        Thread.sleep(550);
        long ticks = a.client().messages.stream().filter(m -> m.equals("{\"type\":\"tick\"}")).count();
        assertThat(ticks).isGreaterThanOrEqualTo(2);
    }

    @Test
    void noTickBeforeTheHandshake() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Client client = open(alice.sessionId());
        Thread.sleep(250);
        assertThat(client.messages).isEmpty();
    }
}
