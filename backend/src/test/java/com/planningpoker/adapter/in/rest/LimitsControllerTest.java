package com.planningpoker.adapter.in.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.convention.TestBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.planningpoker.ContractExamples;
import com.planningpoker.application.MutableClock;
import com.planningpoker.application.SessionStore;
import com.planningpoker.application.SweepUseCase;
import com.planningpoker.domain.Session;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/** Plafonds face aux abus (story 2.6), réduits pour le test : 3 sessions, 2 créations par IP, 3 participants. */
@SpringBootTest(properties = {
        "planning-poker.max-sessions=3",
        "planning-poker.max-creations-per-ip=2",
        "planning-poker.creation-window=1m",
        "planning-poker.max-participants=3",
        "planning-poker.max-request-body=2KB",
        "planning-poker.sweep-interval=1h" })
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class LimitsControllerTest {

    private static final MutableClock CLOCK = new MutableClock(Instant.parse("2026-10-04T09:00:00Z"));

    @TestBean
    java.time.Clock clock;

    static java.time.Clock clock() {
        return CLOCK;
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper jsonMapper;

    @Autowired
    SessionStore store;

    @Autowired
    SweepUseCase sweep;

    /** Une adresse neuve par test : les compteurs par IP ne débordent pas d'un test à l'autre. */
    private String ip;

    @BeforeEach
    void emptyStore() {
        store.all().forEach(session -> store.delete(session.id()));
        ip = UUID.randomUUID().toString();
    }

    private ResultActions create(String clientIp, String body) throws Exception {
        return mvc.perform(post("/api/sessions").header("CF-Connecting-IP", clientIp)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions create(String clientIp) throws Exception {
        return create(clientIp, "{\"pseudo\":\"Alice\",\"role\":\"VOTER\"}");
    }

    private String created(String clientIp) throws Exception {
        String body = create(clientIp).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return jsonMapper.readTree(body).get("sessionId").asString();
    }

    private ResultActions join(String sessionId, String pseudo) throws Exception {
        return mvc.perform(post("/api/sessions/" + sessionId + "/participants").contentType(MediaType.APPLICATION_JSON)
                .content("{\"pseudo\":\"" + pseudo + "\",\"role\":\"VOTER\"}"));
    }

    private void expectProblem(ResultActions actions, int status, String example, String path) throws Exception {
        String body = actions.andExpect(status().is(status))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andReturn().getResponse().getContentAsString();
        ObjectNode expected = (ObjectNode) jsonMapper.readTree(ContractExamples.read("problem", example));
        expected.put("instance", path);
        assertThat(jsonMapper.readTree(body)).isEqualTo(expected);
    }

    private static String bodyOf(int bytes) {
        String json = "{\"pseudo\":\"Alice\",\"role\":\"VOTER\"}";
        return json + " ".repeat(bytes - json.length());
    }

    // --- 413

    @Test
    void aBodyOverTheLimitIsRefusedWith413() throws Exception {
        expectProblem(create(ip, bodyOf(2049)), 413, "payload-too-large", "/api/sessions");
        assertThat(store.count()).isZero();
    }

    @Test
    void aBodyAtTheLimitIsProcessed() throws Exception {
        create(ip, bodyOf(2048)).andExpect(status().isCreated());
    }

    @Test
    void aJoinBodyOverTheLimitIsRefusedWith413() throws Exception {
        String sessionId = created(ip);
        String path = "/api/sessions/" + sessionId + "/participants";
        expectProblem(mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(bodyOf(4096))), 413,
                "payload-too-large", path);
    }

    // --- 429

    @Test
    void theThirdCreationWithinTheWindowIsRefusedWithRetryAfter() throws Exception {
        created(ip);
        CLOCK.advance(Duration.ofSeconds(40));
        created(ip);

        ResultActions refused = create(ip).andExpect(header().string("Retry-After", "20"));
        expectProblem(refused, 429, "too-many-requests", "/api/sessions");
        assertThat(store.count()).isEqualTo(2);

        CLOCK.advance(Duration.ofSeconds(20));
        store.all().forEach(session -> store.delete(session.id()));
        created(ip);
    }

    @Test
    void anotherClientIsNotAffected() throws Exception {
        created(ip);
        created(ip);
        create(ip).andExpect(status().isTooManyRequests());
        created(UUID.randomUUID().toString());
    }

    @Test
    void theRealAddressIsCountedWhateverTheClientWritesInForwardedFor() throws Exception {
        String real = UUID.randomUUID().toString();
        for (int i = 0; i < 2; i++) {
            mvc.perform(forwardedCreate("forged-" + i + ", " + real)).andExpect(status().isCreated());
        }
        mvc.perform(forwardedCreate("forged-3, " + real)).andExpect(status().isTooManyRequests());
    }

    private static MockHttpServletRequestBuilder forwardedCreate(String forwardedFor) {
        return post("/api/sessions").header("X-Forwarded-For", forwardedFor)
                .contentType(MediaType.APPLICATION_JSON).content("{\"pseudo\":\"Alice\",\"role\":\"VOTER\"}");
    }

    @Test
    void aFailedCreationIsNotCounted() throws Exception {
        create(ip, "{\"pseudo\":\"   \",\"role\":\"VOTER\"}").andExpect(status().isBadRequest());
        create(ip, "{\"pseudo\":\"   \",\"role\":\"VOTER\"}").andExpect(status().isBadRequest());
        created(ip);
        created(ip);
    }

    // --- 503

    @Test
    void theFourthSessionIsRefusedWith503AndTheStoreIsUnchanged() throws Exception {
        for (int i = 0; i < 3; i++) {
            created(UUID.randomUUID().toString());
        }
        expectProblem(create(ip), 503, "session-limit-reached", "/api/sessions");
        assertThat(store.count()).isEqualTo(3);
        // Le refus n'a pas compté : sinon la troisième tentative de l'IP serait un 429, pas un 503.
        store.delete(store.all().iterator().next().id());
        created(ip);
        create(ip).andExpect(status().isServiceUnavailable());
    }

    @Test
    void tooManyRequestsIsCheckedBeforeTheSessionLimit() throws Exception {
        created(ip);
        created(ip);
        created(UUID.randomUUID().toString());
        create(ip).andExpect(status().isTooManyRequests());
    }

    @Test
    void anExpiredSessionFreesItsPlace() throws Exception {
        for (int i = 0; i < 3; i++) {
            created(UUID.randomUUID().toString());
        }
        create(ip).andExpect(status().isServiceUnavailable());

        CLOCK.advance(Duration.ofHours(24));
        sweep.sweep();

        created(ip);
    }

    // --- 409 SESSION_FULL

    @Test
    void aFourthParticipantIsRefusedWithSessionFullAndNothingChanges() throws Exception {
        String sessionId = created(ip);
        join(sessionId, "Bob").andExpect(status().isOk());
        join(sessionId, "Chloé").andExpect(status().isOk());
        Session before = store.find(sessionId).orElseThrow();

        expectProblem(join(sessionId, "David"), 409, "session-full", "/api/sessions/" + sessionId + "/participants");
        assertThat(store.find(sessionId).orElseThrow()).isEqualTo(before);
    }

    @Test
    void aDisconnectedParticipantTakesOverHisPlaceInAFullSession() throws Exception {
        String sessionId = created(ip);
        String bob = join(sessionId, "Bob").andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        join(sessionId, "Chloé").andExpect(status().isOk());

        String again = join(sessionId, "BOB").andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString();

        JsonNode first = jsonMapper.readTree(bob);
        assertThat(jsonMapper.readTree(again).get("participantId")).isEqualTo(first.get("participantId"));
    }

    @Test
    void aTakenPseudoIsReportedBeforeTheFullSession() throws Exception {
        String sessionId = created(ip);
        Session session = store.find(sessionId).orElseThrow();
        store.save(session.connect(session.participants().get(0).id(), "c-alice", CLOCK.instant()));
        join(sessionId, "Bob").andExpect(status().isOk());
        join(sessionId, "Chloé").andExpect(status().isOk());

        expectProblem(join(sessionId, "alice"), 409, "pseudo-taken", "/api/sessions/" + sessionId + "/participants");
    }

    // --- Journaux

    @Test
    void refusalsLogOneLineEachWithoutAnyIdentifyingDetail(CapturedOutput output) throws Exception {
        String sessionId = created(ip);
        join(sessionId, "Zorglub-Témoin").andExpect(status().isOk());
        join(sessionId, "Bob").andExpect(status().isOk());
        join(sessionId, "Marsupilami").andExpect(status().isConflict());
        created(ip);
        create(ip, "{\"pseudo\":\"Zorglub-Témoin\",\"role\":\"VOTER\"}").andExpect(status().isTooManyRequests());
        created(UUID.randomUUID().toString());
        create(UUID.randomUUID().toString()).andExpect(status().isServiceUnavailable());
        create(ip, bodyOf(3000)).andExpect(status().isPayloadTooLarge());

        String logs = output.getAll();
        assertThat(logs).doesNotContain(ip).doesNotContain("Zorglub").doesNotContain("Marsupilami")
                .doesNotContain(sessionId);
        assertThat(logs.lines().filter(l -> l.contains("Join refused: session full"))).hasSize(1);
        assertThat(logs.lines().filter(l -> l.contains("too many creations"))).hasSize(1);
        assertThat(logs.lines().filter(l -> l.contains("session limit reached"))).hasSize(1);
        assertThat(logs.lines().filter(l -> l.contains("body too large"))).hasSize(1);
    }
}
