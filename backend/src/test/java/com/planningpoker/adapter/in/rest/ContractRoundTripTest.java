package com.planningpoker.adapter.in.rest;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.json.ProblemDetailJacksonMixin;

import com.planningpoker.ContractExamples;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Les exemples du contrat font l'aller-retour à travers les types Java écrits à la main sans rien perdre ni
 * ajouter (AD-6).
 */
class ContractRoundTripTest {

    private final JsonMapper jsonMapper = JsonMapper.builder()
            .addMixIn(ProblemDetail.class, ProblemDetailJacksonMixin.class)
            .build();

    private void assertRoundTrip(String schema, String example, Class<?> type) throws Exception {
        String json = ContractExamples.read(schema, example);
        Object value = jsonMapper.readValue(json, type);
        JsonNode written = jsonMapper.readTree(jsonMapper.writeValueAsString(value));
        assertThat(written).isEqualTo(jsonMapper.readTree(json));
    }

    @ParameterizedTest
    @ValueSource(strings = { "voter", "observer" })
    void createSessionRequest(String example) throws Exception {
        assertRoundTrip("create-session-request", example, CreateSessionRequest.class);
    }

    @Test
    void createSessionResponse() throws Exception {
        assertRoundTrip("create-session-response", "created", CreateSessionResponse.class);
    }

    @Test
    void joinSessionRequest() throws Exception {
        assertRoundTrip("join-session-request", "voter", JoinSessionRequest.class);
    }

    @Test
    void joinSessionResponse() throws Exception {
        assertRoundTrip("join-session-response", "joined", JoinSessionResponse.class);
    }

    @ParameterizedTest
    @ValueSource(strings = { "bad-request-invalid-pseudo", "bad-request-malformed-body", "pseudo-taken",
            "session-not-found", "session-full", "payload-too-large", "too-many-requests",
            "session-limit-reached" })
    void problems(String example) throws Exception {
        JsonNode json = jsonMapper.readTree(ContractExamples.read("problem", example));
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                org.springframework.http.HttpStatusCode.valueOf(json.get("status").asInt()),
                json.get("detail").asString());
        problem.setType(URI.create(json.get("type").asString()));
        problem.setTitle(json.get("title").asString());
        problem.setInstance(URI.create(json.get("instance").asString()));
        if (json.has("code")) {
            problem.setProperty(RestErrorHandler.CODE, json.get("code").asString());
        }
        assertThat(jsonMapper.readTree(jsonMapper.writeValueAsString(problem))).isEqualTo(json);
    }
}
