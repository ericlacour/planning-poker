package com.planningpoker.adapter.in.ws;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.time.Duration;
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
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.server.LocalServerPort;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Plafonds de bout en bout, sur un vrai serveur (story 2.6) : message WebSocket de 4 Ko, corps REST par morceaux. */
@ExtendWith(OutputCaptureExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "planning-poker.allowed-origins=https://front.example",
        "planning-poker.max-ws-message=4KB",
        "planning-poker.max-request-body=2KB" })
class LimitsEndToEndTest {

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

    private String[] createSession() throws Exception {
        HttpResponse<String> response = http.send(HttpRequest.newBuilder(uri("/api/sessions"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"pseudo\":\"Alice\",\"role\":\"VOTER\"}"))
                .build(), HttpResponse.BodyHandlers.ofString());
        JsonNode body = jsonMapper.readTree(response.body());
        return new String[] { body.get("sessionId").asString(), body.get("participantToken").asString() };
    }

    private URI uri(String path) {
        return URI.create("http://localhost:" + port + path);
    }

    private Client connect() throws Exception {
        String[] session = createSession();
        Client client = new Client();
        WebSocket socket = http.newWebSocketBuilder()
                .header("Origin", ORIGIN)
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/sessions/" + session[0]), client)
                .get(5, TimeUnit.SECONDS);
        opened.add(socket);
        socket.sendText("{\"type\":\"hello\",\"participantToken\":\"" + session[1] + "\"}", true).join();
        assertThat(client.messages.poll(5, TimeUnit.SECONDS)).contains("sessionState");
        return client;
    }

    @Test
    void aMessageOverTheLimitClosesWith1009(CapturedOutput output) throws Exception {
        Client client = connect();
        opened.getLast().sendText("x".repeat(4097), true).join();
        assertThat(client.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(1009);
        long deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
        while (!output.getAll().contains("WebSocket message refused: too large") && System.nanoTime() < deadline) {
            Thread.sleep(20);
        }
        assertThat(output.getAll()).contains("WebSocket message refused: too large");
    }

    @Test
    void aMessageAtTheLimitIsReadAndAnsweredAsInvalid() throws Exception {
        Client client = connect();
        opened.getLast().sendText("x".repeat(4096), true).join();
        assertThat(client.messages.poll(5, TimeUnit.SECONDS)).contains("INVALID_MESSAGE");
        assertThat(client.closeCode).isNotDone();
    }

    @Test
    void pathParametersOrEncodedCharactersDoNotBypassTheLimit() throws Exception {
        for (String path : new String[] { "/api/sessions;x=y", "/api/session%73" }) {
            String body = "{\"pseudo\":\"Alice\",\"role\":\"VOTER\"}" + " ".repeat(5 * 1024);
            HttpResponse<String> response = http.send(HttpRequest.newBuilder(uri(path))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build(), HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).as(path).isEqualTo(413);
        }
    }

    @Test
    void aChunkedBodyOverTheLimitIsRefusedWith413() throws Exception {
        HttpResponse<String> response = http.send(HttpRequest.newBuilder(uri("/api/sessions"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofInputStream(() -> new ByteArrayInputStream(new byte[10 * 1024])))
                .build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(413);
        assertThat(response.headers().firstValue("Content-Type")).hasValueSatisfying(
                type -> assertThat(type).startsWith("application/problem+json"));
        assertThat(jsonMapper.readTree(response.body()).get("status").asInt()).isEqualTo(413);
    }
}
