package com.planningpoker.adapter.in.ws;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

/** File d'envoi d'une connexion : ordre conservé, jamais bloquante, fermeture de la connexion qui déborde. */
class WsConnectionTest {

    private final ExecutorService senders = Executors.newVirtualThreadPerTaskExecutor();
    private final WebSocketSession session = mock(WebSocketSession.class);
    private final List<String> sent = new CopyOnWriteArrayList<>();

    @AfterEach
    void stop() {
        senders.shutdownNow();
    }

    private WsConnection connection(CountDownLatch release) throws Exception {
        when(session.getId()).thenReturn("c1");
        when(session.isOpen()).thenReturn(true);
        doAnswer(invocation -> {
            release.await(5, TimeUnit.SECONDS);
            sent.add(((WebSocketMessage<?>) invocation.getArgument(0)).getPayload().toString());
            return null;
        }).when(session).sendMessage(any());
        return new WsConnection(session, senders);
    }

    @Test
    void sendsInOrderWithoutBlockingTheCaller() throws Exception {
        CountDownLatch release = new CountDownLatch(1);
        WsConnection connection = connection(release);
        long start = System.nanoTime();
        for (int i = 0; i < 20; i++) {
            connection.enqueue(new TextMessage("m" + i));
        }
        assertThat(System.nanoTime() - start).isLessThan(TimeUnit.MILLISECONDS.toNanos(500));
        release.countDown();
        verify(session, timeout(2_000).times(20)).sendMessage(any());
        assertThat(sent).containsExactlyElementsOf(java.util.stream.IntStream.range(0, 20).mapToObj(i -> "m" + i)
                .toList());
        verify(session, never()).close(any());
    }

    @Test
    void aConnectionThatOverflowsItsBufferIsClosed() throws Exception {
        CountDownLatch release = new CountDownLatch(1);
        WsConnection connection = connection(release);
        String big = "x".repeat(16 * 1024);
        for (int i = 0; i < 6; i++) {
            connection.enqueue(new TextMessage(big));
        }
        verify(session, timeout(2_000)).close(CloseStatus.SESSION_NOT_RELIABLE);
        release.countDown();
    }

    @Test
    void attachingAClosedConnectionFails() throws Exception {
        WsConnection connection = connection(new CountDownLatch(0));
        UUID participant = UUID.randomUUID();
        assertThat(connection.markClosed()).isNull();
        assertThat(connection.attach("s", participant)).isFalse();

        WsConnection other = new WsConnection(session, senders);
        assertThat(other.attach("s", participant)).isTrue();
        assertThat(other.attach("s", participant)).isFalse();
        assertThat(other.markClosed()).isEqualTo(new WsConnection.Attachment("s", participant));
    }
}
