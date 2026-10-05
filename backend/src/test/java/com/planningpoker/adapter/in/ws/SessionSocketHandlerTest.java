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
    void helloWithTheCreatorTokenAttachesAndSendsTheSnapshot() throws Exception {
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
    }

    @Test
    void neverLogsTheTokenThePseudoNorTheSessionId(CapturedOutput output) throws Exception {
        Created zorglub = createSession("Zorglub-Ws", "VOTER");
        Connected connected = connect(zorglub);
        connected.client().socket.sendClose(WebSocket.NORMAL_CLOSURE, "").join();
        connected.client().closeCode.get(5, TimeUnit.SECONDS);
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (!output.getAll().contains("Participant " + zorglub.participantId() + " closed a connection")
                && System.nanoTime() < deadline) {
            Thread.sleep(20);
        }

        assertThat(output.getAll()).contains("Participant " + zorglub.participantId() + " closed a connection")
                .doesNotContain("Zorglub")
                .doesNotContain(zorglub.participantToken())
                .doesNotContain(zorglub.sessionId());
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

    /** Les exemples du contrat portent un {@code roundId} qui n'est pas celui de la session : ils sont périmés. */
    @Test
    void heartbeatStaleVotesAndConformingIntentsGetNoAnswer() throws Exception {
        Connected a = connect(createSession("Alice", "VOTER"));
        a.client().send(ContractExamples.read("heartbeat", "heartbeat"));
        for (String[] example : new String[][] { { "vote", "choose-card" }, { "vote", "withdraw" },
                { "vote", "coffee" }, { "reveal", "reveal" }, { "hide", "hide" }, { "clear", "clear" } }) {
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
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(3);
        long ticks = 0;
        while (ticks < 2 && System.nanoTime() < deadline) {
            Thread.sleep(20);
            ticks = a.client().messages.stream().filter(m -> m.equals("{\"type\":\"tick\"}")).count();
        }
        assertThat(ticks).isGreaterThanOrEqualTo(2);
    }

    @Test
    void noTickBeforeTheHandshake() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Client client = open(alice.sessionId());
        Thread.sleep(250);
        assertThat(client.messages).isEmpty();
    }

    // --- Vote ---

    private static String vote(JsonNode state, String card) {
        String roundId = state.get("round").get("roundId").asString();
        return "{\"type\":\"vote\",\"roundId\":\"" + roundId + "\",\"card\":"
                + (card == null ? "null" : "\"" + card + "\"") + "}";
    }

    private static void assertError(JsonNode node, String code) {
        assertThat(node).isNotNull();
        assertThat(node.toString()).isEqualTo("{\"type\":\"error\",\"code\":\"" + code + "\"}");
    }

    /** Alice et Bob votants, tous deux connectés ; renvoie leurs connexions, à jour. */
    private Connected[] twoVoters(Created alice) throws Exception {
        Connected a = connect(alice);
        Created bob = join(alice.sessionId(), "Bob", "VOTER");
        nextState(a.client());
        Connected b = connect(bob);
        JsonNode aState = nextState(a.client());
        return new Connected[] { new Connected(a.client(), aState), b };
    }

    @Test
    void aVoteIsBroadcastFilteredForEachRecipientWithinOneSecond() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        Connected a = both[0];
        Connected b = both[1];
        String bobId = b.state().get("selfParticipantId").asString();
        long version = b.state().get("version").asLong();

        long start = System.nanoTime();
        a.client().send(vote(a.state(), "8"));
        JsonNode forAlice = nextState(a.client());
        JsonNode forBob = nextState(b.client());
        assertThat(System.nanoTime() - start).isLessThan(1_000_000_000L);

        for (JsonNode state : new JsonNode[] { forAlice, forBob }) {
            assertThat(state.get("version").asLong()).isEqualTo(version + 1);
            assertThat(state.get("lastChange").toString())
                    .isEqualTo("{\"action\":\"VOTE\",\"byParticipantId\":\"" + alice.participantId() + "\"}");
            assertThat(state.get("progress").toString()).isEqualTo("{\"voted\":1,\"expected\":2}");
            assertThat(seat(state, alice.participantId()).get("hasVoted").asBoolean()).isTrue();
            assertThat(seat(state, bobId).get("hasVoted").asBoolean()).isFalse();
        }
        assertThat(seat(forAlice, alice.participantId()).get("vote").asString()).isEqualTo("8");
        assertThat(seat(forBob, alice.participantId()).get("vote").isNull()).isTrue();
        assertThat(forBob.toString()).doesNotContain("\"8\"");

        // Changer : la version avance, le compteur reste.
        a.client().send(vote(a.state(), "5"));
        JsonNode changed = nextState(a.client());
        assertThat(seat(changed, alice.participantId()).get("vote").asString()).isEqualTo("5");
        assertThat(changed.get("progress").get("voted").asInt()).isEqualTo(1);
        assertThat(seat(nextState(b.client()), alice.participantId()).get("vote").isNull()).isTrue();

        // Déjà satisfait : rien.
        a.client().send(vote(a.state(), "5"));
        assertThat(next(a.client(), QUIET_MS)).isNull();
        assertThat(next(b.client(), QUIET_MS)).isNull();

        // Retirer.
        a.client().send(vote(a.state(), null));
        JsonNode withdrawn = nextState(b.client());
        assertThat(seat(withdrawn, alice.participantId()).get("hasVoted").asBoolean()).isFalse();
        assertThat(withdrawn.get("progress").get("voted").asInt()).isZero();
        assertThat(withdrawn.get("version").asLong()).isEqualTo(version + 3);
        nextState(a.client());

        // Retrait sans vote : rien.
        a.client().send(vote(a.state(), null));
        assertThat(next(a.client(), QUIET_MS)).isNull();
        assertThat(next(b.client(), QUIET_MS)).isNull();
    }

    @Test
    void coffeeIsAcceptedAndCounted() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        both[1].client().send(vote(both[1].state(), "coffee"));
        JsonNode forBob = nextState(both[1].client());
        assertThat(seat(forBob, both[1].state().get("selfParticipantId").asString()).get("vote").asString())
                .isEqualTo("coffee");
        assertThat(nextState(both[0].client()).get("progress").get("voted").asInt()).isEqualTo(1);
    }

    @Test
    void aStaleVoteIsIgnoredWithoutAnswer() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        both[0].client().send("{\"type\":\"vote\",\"roundId\":\"stale\",\"card\":\"8\"}");
        // Périmé d'abord, même pour une carte inconnue.
        both[0].client().send("{\"type\":\"vote\",\"roundId\":\"stale\",\"card\":\"4\"}");
        assertThat(next(both[0].client(), QUIET_MS)).isNull();
        assertThat(next(both[1].client(), QUIET_MS)).isNull();
    }

    @Test
    void anObserverGetsNotAVoterAloneAndNothingChanges() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected a = connect(alice);
        Created emma = join(alice.sessionId(), "Emma", "OBSERVER");
        nextState(a.client());
        Connected e = connect(emma);
        nextState(a.client());

        // Observateur et carte inconnue : NOT_A_VOTER d'abord.
        e.client().send(vote(e.state(), "4"));
        assertError(next(e.client(), WAIT_MS), "NOT_A_VOTER");
        e.client().send(vote(e.state(), "8"));
        assertError(next(e.client(), WAIT_MS), "NOT_A_VOTER");
        assertThat(next(a.client(), QUIET_MS)).isNull();
        assertThat(next(e.client(), QUIET_MS)).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = { "4", "☕", "COFFEE" })
    void aCardOutsideTheDeckGetsInvalidCardAlone(String card) throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        both[0].client().send(vote(both[0].state(), card));
        assertError(next(both[0].client(), WAIT_MS), "INVALID_CARD");
        assertThat(next(both[1].client(), QUIET_MS)).isNull();
        assertThat(both[0].client().closeCode).isNotDone();
    }

    @ParameterizedTest
    @ValueSource(strings = { "{\"type\":\"vote\",\"roundId\":\"r\",\"card\":\"12345678901234567\"}",
            "{\"type\":\"vote\",\"roundId\":\"\",\"card\":\"8\"}",
            "{\"type\":\"vote\",\"card\":\"8\"}",
            "{\"type\":\"vote\",\"roundId\":\"r\",\"card\":\"8\",\"extra\":1}",
            "{\"type\":\"vote\",\"roundId\":\"r\",\"card\":8}" })
    void aVoteOutsideItsSchemaGetsInvalidMessage(String message) throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        both[0].client().send(message);
        assertInvalidMessage(next(both[0].client(), WAIT_MS));
        assertThat(next(both[1].client(), QUIET_MS)).isNull();
    }

    @Test
    void aVoteWithARoundIdOver64CodePointsGetsInvalidMessage() throws Exception {
        Connected a = connect(createSession("Alice", "VOTER"));
        a.client().send("{\"type\":\"vote\",\"roundId\":\"" + "r".repeat(65) + "\",\"card\":\"8\"}");
        assertInvalidMessage(next(a.client(), WAIT_MS));
    }

    @Test
    void theVoteSurvivesAReconnection() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected a = connect(alice);
        a.client().send(vote(a.state(), "13"));
        nextState(a.client());
        a.client().socket.sendClose(WebSocket.NORMAL_CLOSURE, "").join();
        a.client().closeCode.get(5, TimeUnit.SECONDS);

        JsonNode again = connect(alice).state();
        assertThat(seat(again, alice.participantId()).get("vote").asString()).isEqualTo("13");
    }

    // --- Révéler, effacer ---

    private static String intent(String type, JsonNode state) {
        return "{\"type\":\"" + type + "\",\"roundId\":\"" + state.get("round").get("roundId").asString() + "\"}";
    }

    @Test
    void anObserverRevealsAndEveryoneSeesTheVotesAndTheSummaryWithinOneSecond() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        Connected a = both[0];
        Connected b = both[1];
        String bobId = b.state().get("selfParticipantId").asString();
        Created emma = join(alice.sessionId(), "Emma", "OBSERVER");
        nextState(a.client());
        nextState(b.client());
        Connected e = connect(emma);
        nextState(a.client());
        nextState(b.client());

        a.client().send(vote(a.state(), "5"));
        nextState(a.client());
        nextState(b.client());
        nextState(e.client());
        b.client().send(vote(b.state(), "8"));
        nextState(a.client());
        nextState(b.client());
        long version = nextState(e.client()).get("version").asLong();

        long start = System.nanoTime();
        e.client().send(intent("reveal", e.state()));
        JsonNode[] states = { nextState(a.client()), nextState(b.client()), nextState(e.client()) };
        assertThat(System.nanoTime() - start).isLessThan(1_000_000_000L);

        for (JsonNode state : states) {
            assertThat(state.get("version").asLong()).isEqualTo(version + 1);
            assertThat(state.get("round").get("status").asString()).isEqualTo("REVEALED");
            assertThat(state.get("lastChange").toString())
                    .isEqualTo("{\"action\":\"REVEAL\",\"byParticipantId\":\"" + emma.participantId() + "\"}");
            assertThat(seat(state, alice.participantId()).get("vote").asString()).isEqualTo("5");
            assertThat(seat(state, bobId).get("vote").asString()).isEqualTo("8");
            JsonNode summary = state.get("summary");
            assertThat(summary.get("average").decimalValue()).isEqualByComparingTo("6.5");
            assertThat(summary.get("mostVoted").toString()).isEqualTo("{\"values\":[\"5\",\"8\"],\"count\":1}");
            assertThat(summary.get("min").asString()).isEqualTo("5");
            assertThat(summary.get("max").asString()).isEqualTo("8");
            assertThat(summary.get("consensus").asBoolean()).isFalse();
        }

        // Déjà révélé : rien. Vote : ROUND_REVEALED à son seul auteur.
        a.client().send(intent("reveal", a.state()));
        assertThat(next(e.client(), QUIET_MS)).isNull();
        a.client().send(vote(a.state(), "13"));
        assertError(next(a.client(), WAIT_MS), "ROUND_REVEALED");
        assertThat(next(b.client(), QUIET_MS)).isNull();

        // Nouveau tour : tout le monde revient à un tour caché sans vote.
        b.client().send(intent("clear", b.state()));
        for (Client client : new Client[] { a.client(), b.client(), e.client() }) {
            JsonNode state = nextState(client);
            assertThat(state.get("version").asLong()).isEqualTo(version + 2);
            assertThat(state.get("round").get("status").asString()).isEqualTo("HIDDEN");
            assertThat(state.get("round").get("roundId").asString())
                    .isNotEqualTo(a.state().get("round").get("roundId").asString());
            assertThat(state.get("summary").isNull()).isTrue();
            assertThat(state.get("progress").toString()).isEqualTo("{\"voted\":0,\"expected\":2}");
            assertThat(state.get("lastChange").get("action").asString()).isEqualTo("CLEAR");
            for (JsonNode participant : state.get("participants")) {
                assertThat(participant.get("hasVoted").asBoolean()).isFalse();
                assertThat(participant.get("vote").isNull()).isTrue();
            }
        }
    }

    @Test
    void twoClearsFromTheSameRoundMakeOneNewRound() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        long version = both[1].state().get("version").asLong();
        String clear = intent("clear", both[0].state());

        both[0].client().send(clear);
        both[1].client().send(clear);

        JsonNode forAlice = nextState(both[0].client());
        JsonNode forBob = nextState(both[1].client());
        assertThat(forAlice.get("version").asLong()).isEqualTo(version + 1);
        assertThat(forBob.get("round")).isEqualTo(forAlice.get("round"));
        assertThat(next(both[0].client(), QUIET_MS)).isNull();
        assertThat(next(both[1].client(), QUIET_MS)).isNull();
    }

    @Test
    void staleRevealAndClearAreIgnoredWithoutAnswer() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        both[0].client().send("{\"type\":\"reveal\",\"roundId\":\"stale\"}");
        both[0].client().send("{\"type\":\"clear\",\"roundId\":\"stale\"}");
        assertThat(next(both[0].client(), QUIET_MS)).isNull();
        assertThat(next(both[1].client(), QUIET_MS)).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = { "{\"type\":\"reveal\"}", "{\"type\":\"clear\",\"roundId\":\"\"}",
            "{\"type\":\"reveal\",\"roundId\":\"r\",\"extra\":1}", "{\"type\":\"clear\",\"roundId\":7}" })
    void aRevealOrClearOutsideItsSchemaGetsInvalidMessage(String message) throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        both[0].client().send(message);
        assertInvalidMessage(next(both[0].client(), WAIT_MS));
        assertThat(next(both[1].client(), QUIET_MS)).isNull();
    }

    @Test
    void aVoterArrivingDuringARevealedRoundVotesFromTheNextRound() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected a = connect(alice);
        a.client().send(vote(a.state(), "3"));
        nextState(a.client());
        a.client().send(intent("reveal", a.state()));
        nextState(a.client());

        Created farid = join(alice.sessionId(), "Farid", "VOTER");
        nextState(a.client());
        Connected f = connect(farid);
        nextState(a.client());
        assertThat(seat(f.state(), farid.participantId()).get("canVoteThisRound").asBoolean()).isFalse();
        assertThat(seat(f.state(), alice.participantId()).get("vote").asString()).isEqualTo("3");
        assertThat(f.state().get("summary").isNull()).isFalse();

        f.client().send(vote(f.state(), "5"));
        assertError(next(f.client(), WAIT_MS), "ROUND_REVEALED");

        f.client().send(intent("clear", f.state()));
        JsonNode next = nextState(f.client());
        assertThat(seat(next, farid.participantId()).get("canVoteThisRound").asBoolean()).isTrue();
        f.client().send(vote(next, "5"));
        assertThat(seat(nextState(f.client()), farid.participantId()).get("vote").asString()).isEqualTo("5");
    }

    // --- Masquer (story 3.2) ---

    @Test
    void anObserverHidesAndEveryoneGetsAHiddenRoundWithTheSameRoundIdWithinOneSecond() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        Connected a = both[0];
        Connected b = both[1];
        String bobId = b.state().get("selfParticipantId").asString();
        Created emma = join(alice.sessionId(), "Emma", "OBSERVER");
        nextState(a.client());
        nextState(b.client());
        Connected e = connect(emma);
        nextState(a.client());
        nextState(b.client());

        a.client().send(vote(a.state(), "3"));
        nextState(a.client());
        nextState(b.client());
        nextState(e.client());
        b.client().send(vote(b.state(), "8"));
        nextState(a.client());
        nextState(b.client());
        nextState(e.client());
        a.client().send(intent("reveal", a.state()));
        nextState(a.client());
        nextState(b.client());
        JsonNode revealed = nextState(e.client());
        long version = revealed.get("version").asLong();
        String roundId = revealed.get("round").get("roundId").asString();

        long start = System.nanoTime();
        e.client().send(intent("hide", revealed));
        JsonNode[] states = { nextState(a.client()), nextState(b.client()), nextState(e.client()) };
        assertThat(System.nanoTime() - start).isLessThan(1_000_000_000L);

        for (JsonNode state : states) {
            assertThat(state.get("version").asLong()).isEqualTo(version + 1);
            assertThat(state.get("round").get("status").asString()).isEqualTo("HIDDEN");
            assertThat(state.get("round").get("roundId").asString()).isEqualTo(roundId);
            assertThat(state.get("lastChange").toString())
                    .isEqualTo("{\"action\":\"HIDE\",\"byParticipantId\":\"" + emma.participantId() + "\"}");
            assertThat(state.get("summary").isNull()).isTrue();
            assertThat(state.get("progress").toString()).isEqualTo("{\"voted\":2,\"expected\":2}");
            assertThat(seat(state, alice.participantId()).get("hasVoted").asBoolean()).isTrue();
            assertThat(seat(state, bobId).get("hasVoted").asBoolean()).isTrue();
        }
        // Filtrage : chacun ne voit que son propre vote pendant un tour caché.
        assertThat(seat(states[0], alice.participantId()).get("vote").asString()).isEqualTo("3");
        assertThat(seat(states[0], bobId).get("vote").isNull()).isTrue();

        // Déjà caché : rien. Revoter : accepté.
        b.client().send(intent("hide", states[1]));
        assertThat(next(a.client(), QUIET_MS)).isNull();
        a.client().send(vote(states[0], "5"));
        assertThat(seat(nextState(a.client()), alice.participantId()).get("vote").asString()).isEqualTo("5");
    }

    @Test
    void twoHidesFromTheSameRoundMakeOneChange() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        both[0].client().send(intent("reveal", both[0].state()));
        nextState(both[0].client());
        long version = nextState(both[1].client()).get("version").asLong();
        String hide = intent("hide", both[0].state());

        both[0].client().send(hide);
        both[1].client().send(hide);

        JsonNode forAlice = nextState(both[0].client());
        JsonNode forBob = nextState(both[1].client());
        assertThat(forAlice.get("version").asLong()).isEqualTo(version + 1);
        assertThat(forBob.get("round")).isEqualTo(forAlice.get("round"));
        assertThat(next(both[0].client(), QUIET_MS)).isNull();
        assertThat(next(both[1].client(), QUIET_MS)).isNull();
    }

    @Test
    void aStaleHideIsIgnoredWithoutAnswer() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        both[0].client().send(intent("reveal", both[0].state()));
        nextState(both[0].client());
        nextState(both[1].client());
        both[0].client().send("{\"type\":\"hide\",\"roundId\":\"stale\"}");
        assertThat(next(both[0].client(), QUIET_MS)).isNull();
        assertThat(next(both[1].client(), QUIET_MS)).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = { "{\"type\":\"hide\"}", "{\"type\":\"hide\",\"roundId\":\"\"}",
            "{\"type\":\"hide\",\"roundId\":\"r\",\"extra\":1}" })
    void aHideOutsideItsSchemaGetsInvalidMessage(String message) throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected[] both = twoVoters(alice);
        both[0].client().send(message);
        assertInvalidMessage(next(both[0].client(), WAIT_MS));
        assertThat(next(both[1].client(), QUIET_MS)).isNull();
    }

    @Test
    void aVoterArrivingDuringARevealedRoundVotesOnceTheRoundIsHidden() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected a = connect(alice);
        a.client().send(intent("reveal", a.state()));
        nextState(a.client());

        Created farid = join(alice.sessionId(), "Farid", "VOTER");
        nextState(a.client());
        Connected f = connect(farid);
        nextState(a.client());
        assertThat(seat(f.state(), farid.participantId()).get("canVoteThisRound").asBoolean()).isFalse();

        f.client().send(intent("hide", f.state()));
        JsonNode hidden = nextState(f.client());
        assertThat(seat(hidden, farid.participantId()).get("canVoteThisRound").asBoolean()).isTrue();
        assertThat(hidden.get("progress").toString()).isEqualTo("{\"voted\":0,\"expected\":2}");
        f.client().send(vote(hidden, "5"));
        assertThat(seat(nextState(f.client()), farid.participantId()).get("vote").asString()).isEqualTo("5");
    }

    // --- Changement de rôle (story 3.1) ---

    private static String changeRole(String role) {
        return "{\"type\":\"changeRole\",\"role\":\"" + role + "\"}";
    }

    @Test
    void aRoleChangeIsBroadcastToEveryoneWithinOneSecond() throws Exception {
        Created alice = createSession("Alice", "VOTER");
        Connected a = connect(alice);
        Created bob = join(alice.sessionId(), "Bob", "VOTER");
        nextState(a.client());
        Connected b = connect(bob);
        nextState(a.client());
        a.client().send(vote(b.state(), "5"));
        nextState(a.client());
        nextState(b.client());

        long start = System.nanoTime();
        a.client().send(changeRole("OBSERVER"));
        JsonNode seenByBob = nextState(b.client());
        JsonNode seenByAlice = nextState(a.client());
        assertThat(System.nanoTime() - start).isLessThan(1_000_000_000L);

        for (JsonNode state : new JsonNode[] { seenByBob, seenByAlice }) {
            assertThat(state.get("lastChange").get("action").asString()).isEqualTo("ROLE");
            assertThat(state.get("lastChange").get("byParticipantId").asString()).isEqualTo(alice.participantId());
            assertThat(seat(state, alice.participantId()).get("role").asString()).isEqualTo("OBSERVER");
            assertThat(seat(state, alice.participantId()).get("hasVoted").asBoolean()).isFalse();
            assertThat(state.get("progress").get("expected").asInt()).isEqualTo(1);
            assertThat(state.get("participants").get(1).get("participantId").asString())
                    .isEqualTo(alice.participantId());
        }
    }

    @Test
    void theSameRoleGetsNoAnswerAndBroadcastsNothing() throws Exception {
        Connected a = connect(createSession("Alice", "VOTER"));
        a.client().send(changeRole("VOTER"));
        assertThat(next(a.client(), QUIET_MS)).isNull();
    }

    @Test
    void anObserverBecomingVoterDuringARevealedRoundVotesFromTheNextRound() throws Exception {
        Connected e = connect(createSession("Emma", "OBSERVER"));
        e.client().send(intent("reveal", e.state()));
        JsonNode revealed = nextState(e.client());

        e.client().send(changeRole("VOTER"));
        JsonNode voter = nextState(e.client());
        assertThat(voter.get("participants").get(0).get("role").asString()).isEqualTo("VOTER");
        assertThat(voter.get("participants").get(0).get("canVoteThisRound").asBoolean()).isFalse();
        e.client().send(vote(revealed, "5"));
        assertError(next(e.client(), WAIT_MS), "ROUND_REVEALED");
    }
}
