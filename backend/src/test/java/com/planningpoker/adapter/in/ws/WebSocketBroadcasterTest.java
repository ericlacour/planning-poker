package com.planningpoker.adapter.in.ws;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import tools.jackson.databind.json.JsonMapper;

/** Registre des connexions : une connexion détachée encore ouverte reste joignable pour être fermée. */
class WebSocketBroadcasterTest {

    private final WebSocketBroadcaster broadcaster = new WebSocketBroadcaster(JsonMapper.builder().build(),
            Duration.ofMinutes(10), Duration.ofMinutes(10));
    private final WebSocketSession session = mock(WebSocketSession.class);
    private final UUID participant = UUID.randomUUID();

    @AfterEach
    void stop() {
        broadcaster.destroy();
    }

    private void openAndAttach() {
        when(session.getId()).thenReturn("c1");
        when(session.isOpen()).thenReturn(true);
        broadcaster.open(session);
        assertThat(broadcaster.attach("c1", "s", participant)).isTrue();
    }

    @Test
    void aDetachedOpenConnectionIsClosedAndItsClosingIsNotADisconnection() throws Exception {
        openAndAttach();
        assertThat(broadcaster.detach("c1")).isTrue();
        assertThat(broadcaster.attachmentOf("c1")).isNull();

        broadcaster.close("c1");
        verify(session, timeout(2_000)).close(CloseStatus.SESSION_NOT_RELIABLE);

        assertThat(broadcaster.closed("c1")).isNull();
        assertThat(broadcaster.detach("c1")).isFalse();
    }

    @Test
    void aConnectionClosedByTheClientIsDetachedOnceThenForgotten() throws Exception {
        openAndAttach();
        assertThat(broadcaster.closed("c1")).isEqualTo(new WsConnection.Attachment("s", participant));
        assertThat(broadcaster.detach("c1")).isTrue();
        assertThat(broadcaster.detach("c1")).isFalse();
        broadcaster.close("c1");
        Thread.sleep(100);
        verify(session, never()).close(CloseStatus.SESSION_NOT_RELIABLE);
    }

    @Test
    void closingAnUnknownConnectionDoesNothing() {
        broadcaster.close("unknown");
        broadcaster.closeSessionNotFound("unknown");
        assertThat(broadcaster.detach("unknown")).isFalse();
    }

    @Test
    void aConnectionOfAnExpiredSessionIsClosedAs4404() throws Exception {
        openAndAttach();
        assertThat(broadcaster.detach("c1")).isTrue();

        broadcaster.closeSessionNotFound("c1");
        verify(session, timeout(2_000)).close(new CloseStatus(4404, "Session not found"));
        verify(session, never()).close(CloseStatus.SESSION_NOT_RELIABLE);

        assertThat(broadcaster.closed("c1")).isNull();
    }
}
