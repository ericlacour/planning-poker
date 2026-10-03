package com.planningpoker.adapter.in.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.planningpoker.ContractExamples;
import com.planningpoker.application.SessionStore;
import com.planningpoker.domain.Participant;
import com.planningpoker.domain.Role;
import com.planningpoker.domain.Session;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/** {@code GET /api/sessions/{sessionId}} et {@code POST /api/sessions/{sessionId}/participants}. */
@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class JoinSessionControllerTest {

    private static final String BASE64URL_128_BITS = "^[A-Za-z0-9_-]{22}$";
    private static final String UNKNOWN_ID = "k3Jx9QvT2mLpZ8wR4nYb7A";

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper jsonMapper;

    @Autowired
    SessionStore store;

    private String createSession(String pseudo) throws Exception {
        String response = mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON)
                .content("{\"pseudo\":\"" + pseudo + "\",\"role\":\"VOTER\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return jsonMapper.readTree(response).get("sessionId").asString();
    }

    private ResultActions join(String sessionId, String body) throws Exception {
        return mvc.perform(post("/api/sessions/" + sessionId + "/participants")
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions join(String sessionId, String pseudo, String role) throws Exception {
        return join(sessionId, "{\"pseudo\":\"" + pseudo + "\",\"role\":\"" + role + "\"}");
    }

    private JsonNode joined(String sessionId, String body) throws Exception {
        String response = join(sessionId, body)
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andReturn().getResponse().getContentAsString();
        return jsonMapper.readTree(response);
    }

    private Session stored(String sessionId) {
        return store.find(sessionId).orElseThrow();
    }

    /** Le corps du problème est celui de l'exemple du contrat, {@code instance} suivant le chemin réel. */
    private void expectProblem(ResultActions actions, int status, String example, String path) throws Exception {
        String body = actions
                .andExpect(status().is(status))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andReturn().getResponse().getContentAsString();
        ObjectNode expected = (ObjectNode) jsonMapper.readTree(ContractExamples.read("problem", example));
        expected.put("instance", path);
        assertThat(jsonMapper.readTree(body)).isEqualTo(expected);
    }

    private static String participantsPath(String sessionId) {
        return "/api/sessions/" + sessionId + "/participants";
    }

    // --- GET /api/sessions/{sessionId}

    @Test
    void answers204WithoutBodyForAnExistingSession() throws Exception {
        String sessionId = createSession("Sofia");
        String body = mvc.perform(get("/api/sessions/" + sessionId))
                .andExpect(status().isNoContent())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = { UNKNOWN_ID, "abc", "k3Jx9QvT2mLpZ8wR4nYb7", "k3Jx9QvT2mLpZ8wR4nYb7AB", "a.b~c" })
    void answersSessionNotFoundForAnUnknownOrMisshapenId(String sessionId) throws Exception {
        expectProblem(mvc.perform(get("/api/sessions/" + sessionId)), 404, "session-not-found",
                "/api/sessions/" + sessionId);
    }

    // --- POST /api/sessions/{sessionId}/participants

    @Test
    void joinsWithTheContractExampleAndAnswersTheContractShape() throws Exception {
        String sessionId = createSession("Sofia");

        JsonNode response = joined(sessionId, ContractExamples.read("join-session-request", "voter"));

        assertThat(Set.copyOf(response.propertyNames())).containsExactlyInAnyOrder(
                "participantId", "participantToken");
        assertThat(response.get("participantToken").asString()).matches(BASE64URL_128_BITS);
        UUID participantId = UUID.fromString(response.get("participantId").asString());

        Session session = stored(sessionId);
        assertThat(session.participants()).hasSize(2);
        assertThat(session.participants().getFirst().joinOrder()).isEqualTo(1);
        assertThat(session.participants().getLast()).satisfies(p -> {
            assertThat(p.id()).isEqualTo(participantId);
            assertThat(p.pseudo().value()).isEqualTo("Bob");
            assertThat(p.role()).isEqualTo(Role.VOTER);
            assertThat(p.joinOrder()).isEqualTo(2);
            assertThat(p.token().matches(response.get("participantToken").asString())).isTrue();
        });
    }

    @Test
    void successiveArrivalsGetIncreasingJoinOrdersAndVersions() throws Exception {
        String sessionId = createSession("Sofia");
        for (String pseudo : List.of("Bob", "Karim", "Paul")) {
            long before = stored(sessionId).version();
            join(sessionId, pseudo, "OBSERVER").andExpect(status().isOk());
            assertThat(stored(sessionId).version()).isEqualTo(before + 1);
        }
        assertThat(stored(sessionId).participants()).extracting(Participant::joinOrder).containsExactly(1, 2, 3, 4);
        assertThat(stored(sessionId).participants()).extracting(Participant::role)
                .containsExactly(Role.VOTER, Role.OBSERVER, Role.OBSERVER, Role.OBSERVER);
    }

    @ParameterizedTest
    @ValueSource(strings = { " sofia  ", "SOFIA", "Sofia" })
    void answersPseudoTakenIgnoringCaseAndSpaces(String pseudo) throws Exception {
        String sessionId = createSession("Sofia");
        expectProblem(join(sessionId, pseudo, "VOTER"), 409, "pseudo-taken", participantsPath(sessionId));
        assertThat(stored(sessionId).participants()).hasSize(1);
    }

    @Test
    void answersPseudoTakenAfterNfcNormalization() throws Exception {
        String sessionId = createSession("Élodie");
        expectProblem(join(sessionId, "E\\u0301lodie", "VOTER"), 409, "pseudo-taken", participantsPath(sessionId));
    }

    @ParameterizedTest
    @ValueSource(strings = { "", "   ", "aaaaaaaaaaaaaaaaaaaaa" })
    void answersInvalidPseudoOnAnExistingSession(String pseudo) throws Exception {
        String sessionId = createSession("Sofia");
        expectProblem(join(sessionId, pseudo, "VOTER"), 400, "bad-request-invalid-pseudo",
                participantsPath(sessionId));
    }

    @ParameterizedTest
    @ValueSource(strings = { "Bob", "   " })
    void answersSessionNotFoundBeforeLookingAtThePseudo(String pseudo) throws Exception {
        expectProblem(join(UNKNOWN_ID, pseudo, "VOTER"), 404, "session-not-found", participantsPath(UNKNOWN_ID));
        expectProblem(join("abc", pseudo, "VOTER"), 404, "session-not-found", participantsPath("abc"));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"pseudo\":\"Alice\",\"role\":\"ADMIN\"}",
            "{\"pseudo\":\"Alice\"}",
            "{\"role\":\"VOTER\"}",
            "{\"pseudo\":null,\"role\":\"VOTER\"}",
            "{\"pseudo\":\"Alice\",\"role\":\"VOTER\",\"extra\":1}",
            "{\"pseudo\":42,\"role\":\"VOTER\"}",
            "{\"pseudo\":\"Alice\",\"role\":0}",
            "pas du JSON",
            "" })
    void answersAMalformedBodyWithoutCodeBeforeLookingAtTheSession(String body) throws Exception {
        String sessionId = createSession("Sofia");
        expectProblem(join(sessionId, body), 400, "bad-request-malformed-body", participantsPath(sessionId));
        expectProblem(join(UNKNOWN_ID, body), 400, "bad-request-malformed-body", participantsPath(UNKNOWN_ID));
    }

    @Test
    void answersARawPseudoOver200CodePointsAsMalformed() throws Exception {
        String sessionId = createSession("Sofia");
        expectProblem(join(sessionId, "a".repeat(201), "VOTER"), 400, "bad-request-malformed-body",
                participantsPath(sessionId));
    }

    @Test
    void twentySimultaneousArrivalsAllJoinWithDistinctJoinOrders() throws Exception {
        String sessionId = createSession("Sofia");
        int arrivals = 20;
        ExecutorService pool = Executors.newFixedThreadPool(arrivals);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Integer>> futures = new ArrayList<>();
            for (int i = 0; i < arrivals; i++) {
                String pseudo = "Votant " + i;
                futures.add(pool.submit(() -> {
                    start.await();
                    return join(sessionId, pseudo, "VOTER").andReturn().getResponse().getStatus();
                }));
            }
            start.countDown();
            for (Future<Integer> future : futures) {
                assertThat(future.get()).isEqualTo(200);
            }
        } finally {
            pool.shutdownNow();
        }
        Session session = stored(sessionId);
        assertThat(session.participants()).hasSize(arrivals + 1);
        assertThat(session.participants().stream().skip(1).map(Participant::joinOrder).sorted().toList())
                .containsExactlyElementsOf(IntStream.rangeClosed(2, arrivals + 1).boxed().toList());
        assertThat(session.version()).isEqualTo(arrivals + 1);
    }

    @Test
    void neverLogsTheTokenThePseudoNorTheSessionId(CapturedOutput output) throws Exception {
        String sessionId = createSession("Sofia");
        JsonNode response = joined(sessionId, "{\"pseudo\":\"Zorglub-Témoin\",\"role\":\"VOTER\"}");
        join(sessionId, "zorglub-témoin", "VOTER");

        assertThat(output.getAll()).contains(response.get("participantId").asString());
        assertThat(output.getAll()).doesNotContain(response.get("participantToken").asString())
                .doesNotContain("Zorglub").doesNotContain("zorglub").doesNotContain(sessionId);
    }
}
