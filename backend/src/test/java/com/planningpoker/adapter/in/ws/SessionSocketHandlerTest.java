package com.planningpoker.adapter.in.ws;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocketHandshakeException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import com.planningpoker.ContractExamples;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "planning-poker.allowed-origins=https://front.example",
        "planning-poker.hello-timeout=300ms" })
class SessionSocketHandlerTest {

    private static final String SESSION_ID = "k3Jx9QvT2mLpZ8wR4nYb7A";

    @LocalServerPort
    int port;

    /** Retient le code de fermeture envoyé par le serveur. */
    static final class CloseRecorder implements WebSocket.Listener {
        final CompletableFuture<Integer> closeCode = new CompletableFuture<>();

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            closeCode.complete(statusCode);
            return null;
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            closeCode.completeExceptionally(error);
        }
    }

    private WebSocket open(String origin, CloseRecorder recorder) throws Exception {
        return HttpClient.newHttpClient().newWebSocketBuilder()
                .header("Origin", origin)
                .buildAsync(URI.create("ws://localhost:" + port + "/ws/sessions/" + SESSION_ID), recorder)
                .get(5, TimeUnit.SECONDS);
    }

    @Test
    void rejectsTheHandshakeFromAnUnknownOrigin() {
        assertThatThrownBy(() -> open("https://evil.example", new CloseRecorder()))
                .isInstanceOf(ExecutionException.class)
                .cause().isInstanceOfSatisfying(WebSocketHandshakeException.class,
                        e -> assertThat(e.getResponse().statusCode()).isEqualTo(403));
    }

    @Test
    void closesWith1008WhenNoHelloArrives() throws Exception {
        CloseRecorder recorder = new CloseRecorder();
        open("https://front.example", recorder);
        assertThat(recorder.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
    }

    @Test
    void closesWith1008WhenTheFirstMessageIsNotAHello() throws Exception {
        CloseRecorder recorder = new CloseRecorder();
        WebSocket socket = open("https://front.example", recorder);
        socket.sendText(ContractExamples.read("heartbeat", "heartbeat"), true);
        assertThat(recorder.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(1008);
    }

    @Test
    void closesWith4404OnAValidHelloSinceNoSessionExistsYet() throws Exception {
        CloseRecorder recorder = new CloseRecorder();
        WebSocket socket = open("https://front.example", recorder);
        socket.sendText(ContractExamples.read("hello", "hello"), true);
        assertThat(recorder.closeCode.get(5, TimeUnit.SECONDS)).isEqualTo(4404);
    }
}
