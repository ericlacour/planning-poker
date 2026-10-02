package com.planningpoker.adapter.in.ws;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.planningpoker.ContractExamples;

import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Les exemples WebSocket du contrat font l'aller-retour à travers les types Java écrits à la main sans rien perdre
 * ni ajouter (AD-6), et la lecture stricte des messages client les accepte.
 */
class WsContractRoundTripTest {

    private final JsonMapper jsonMapper = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private void assertRoundTrip(String schema, String example, Class<?> type) throws Exception {
        String json = ContractExamples.read(schema, example);
        Object value = jsonMapper.readValue(json, type);
        JsonNode written = jsonMapper.readTree(jsonMapper.writeValueAsString(value));
        assertThat(written).isEqualTo(jsonMapper.readTree(json));
    }

    @ParameterizedTest
    @ValueSource(strings = { "alone-after-create", "hidden-round" })
    void sessionState(String example) throws Exception {
        assertRoundTrip("session-state", example, ServerMessages.SessionStateMessage.class);
    }

    @Test
    void hello() throws Exception {
        assertRoundTrip("hello", "hello", ClientMessages.HelloMessage.class);
    }

    @Test
    void heartbeat() throws Exception {
        assertRoundTrip("heartbeat", "heartbeat", ClientMessages.HeartbeatMessage.class);
    }

    @Test
    void tick() throws Exception {
        assertRoundTrip("tick", "tick", ServerMessages.TickMessage.class);
        assertThat(jsonMapper.writeValueAsString(ServerMessages.TickMessage.INSTANCE))
                .isEqualTo("{\"type\":\"tick\"}");
    }

    @ParameterizedTest
    @ValueSource(strings = { "invalid-card", "invalid-message", "not-a-voter", "round-revealed" })
    void error(String example) throws Exception {
        assertRoundTrip("error", example, ServerMessages.ErrorMessage.class);
    }

    @Test
    void invalidMessageIsTheContractExample() throws Exception {
        assertThat(jsonMapper.readTree(jsonMapper.writeValueAsString(ServerMessages.ErrorMessage.INVALID_MESSAGE)))
                .isEqualTo(jsonMapper.readTree(ContractExamples.read("error", "invalid-message")));
    }

    @ParameterizedTest
    @CsvSource({ "hello,hello,HelloMessage", "heartbeat,heartbeat,HeartbeatMessage", "vote,choose-card,Intent",
            "vote,withdraw,Intent", "vote,coffee,Intent", "reveal,reveal,Intent", "hide,hide,Intent",
            "clear,clear,Intent", "change-role,to-observer,Intent" })
    void clientExamplesAreAccepted(String schema, String example, String kind) throws Exception {
        ClientMessages.ClientMessage parsed = ClientMessages.parse(jsonMapper, ContractExamples.read(schema, example));
        assertThat(parsed.getClass().getSimpleName()).isEqualTo(kind);
    }

    @Test
    void theHelloTokenNeverShowsInItsDescription() throws Exception {
        ClientMessages.ClientMessage hello = ClientMessages.parse(jsonMapper, ContractExamples.read("hello", "hello"));
        assertThat(hello.toString()).doesNotContain("Xb4Rt9LmQ2vN7cZp1HsK0w");
    }
}
