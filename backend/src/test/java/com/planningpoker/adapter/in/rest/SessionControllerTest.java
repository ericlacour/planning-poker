package com.planningpoker.adapter.in.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Set;
import java.util.UUID;

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
import com.planningpoker.domain.Card;
import com.planningpoker.domain.Deck;
import com.planningpoker.domain.DeckType;
import com.planningpoker.domain.Role;
import com.planningpoker.domain.Session;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ExtendWith(OutputCaptureExtension.class)
class SessionControllerTest {

    private static final String BASE64URL_128_BITS = "^[A-Za-z0-9_-]{22}$";

    @Autowired
    MockMvc mvc;

    @Autowired
    JsonMapper jsonMapper;

    @Autowired
    SessionStore store;

    private ResultActions create(String body) throws Exception {
        return mvc.perform(post("/api/sessions").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private JsonNode created(String body) throws Exception {
        String response = create(body)
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andReturn().getResponse().getContentAsString();
        return jsonMapper.readTree(response);
    }

    private Session stored(JsonNode response) {
        return store.find(response.get("sessionId").asString()).orElseThrow();
    }

    @Test
    void createsASessionAndAnswersTheContractShape() throws Exception {
        JsonNode response = created("{\"pseudo\":\"  Sofia \",\"role\":\"VOTER\"}");

        assertThat(Set.copyOf(response.propertyNames())).containsExactlyInAnyOrder(
                "sessionId", "participantId", "participantToken");
        assertThat(response.get("sessionId").asString()).matches(BASE64URL_128_BITS);
        assertThat(response.get("participantToken").asString()).matches(BASE64URL_128_BITS);
        UUID participantId = UUID.fromString(response.get("participantId").asString());

        Session session = stored(response);
        assertThat(session.participants()).singleElement().satisfies(p -> {
            assertThat(p.id()).isEqualTo(participantId);
            assertThat(p.pseudo().value()).isEqualTo("Sofia");
            assertThat(p.role()).isEqualTo(Role.VOTER);
        });
    }

    @Test
    void acceptsTheContractRequestExamples() throws Exception {
        JsonNode voter = created(ContractExamples.read("create-session-request", "voter"));
        assertThat(stored(voter).participants().getFirst().role()).isEqualTo(Role.VOTER);

        Session tshirt = stored(created(ContractExamples.read("create-session-request", "tshirt")));
        assertThat(tshirt.deck().cards()).containsExactly(Card.S, Card.M, Card.L, Card.XL);
        Session subset = stored(created(ContractExamples.read("create-session-request", "fibonacci-subset")));
        assertThat(subset.deck().cards()).containsExactly(Card.ONE, Card.THREE, Card.FIVE, Card.EIGHT, Card.UNKNOWN,
                Card.COFFEE);

        JsonNode observer = created(ContractExamples.read("create-session-request", "observer"));
        assertThat(stored(observer).participants().getFirst().role()).isEqualTo(Role.OBSERVER);
        assertThat(stored(observer).participants().getFirst().pseudo().value()).isEqualTo("Paul");
    }

    @Test
    void accepts20EmojisAndStoresNfc() throws Exception {
        String emojis = "😀".repeat(20);
        assertThat(stored(created("{\"pseudo\":\"" + emojis + "\",\"role\":\"VOTER\"}"))
                .participants().getFirst().pseudo().value()).isEqualTo(emojis);
        assertThat(stored(created("{\"pseudo\":\"e\\u0301\",\"role\":\"VOTER\"}"))
                .participants().getFirst().pseudo().value()).isEqualTo("é");
    }

    @ParameterizedTest
    @ValueSource(strings = { "", "   ", "aaaaaaaaaaaaaaaaaaaaa" })
    void answersInvalidPseudoAsAProblemWithCode(String pseudo) throws Exception {
        String body = create("{\"pseudo\":\"" + pseudo + "\",\"role\":\"VOTER\"}")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("INVALID_PSEUDO"))
                .andReturn().getResponse().getContentAsString();

        JsonNode problem = jsonMapper.readTree(body);
        JsonNode example = jsonMapper.readTree(ContractExamples.read("problem", "bad-request-invalid-pseudo"));
        assertThat(problem).isEqualTo(example);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"pseudo\":\"Alice\",\"role\":\"ADMIN\"}",
            "{\"pseudo\":\"Alice\"}",
            "{\"role\":\"VOTER\"}",
            "{\"pseudo\":null,\"role\":\"VOTER\"}",
            "{\"pseudo\":\"Alice\",\"role\":null}",
            "{\"pseudo\":\"Alice\",\"role\":\"VOTER\",\"extra\":1}",
            "{\"pseudo\":42,\"role\":\"VOTER\"}",
            "{\"pseudo\":true,\"role\":\"VOTER\"}",
            "{\"pseudo\":4.2,\"role\":\"VOTER\"}",
            "{\"pseudo\":\"Alice\",\"role\":0}",
            "[]",
            "pas du JSON",
            "" })
    void answersAMalformedBodyAsAProblemWithoutCode(String body) throws Exception {
        expectMalformed(body);
    }

    @Test
    void answersARawPseudoOver200CodePointsAsMalformed() throws Exception {
        expectMalformed("{\"pseudo\":\"" + "a".repeat(201) + "\",\"role\":\"VOTER\"}");
    }

    @Test
    void answersARawPseudoOf200CodePointsAsAnInvalidPseudo() throws Exception {
        create("{\"pseudo\":\"" + "😀".repeat(200) + "\",\"role\":\"VOTER\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PSEUDO"));
    }

    private void expectMalformed(String body) throws Exception {
        String response = create(body)
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andReturn().getResponse().getContentAsString();
        JsonNode problem = jsonMapper.readTree(response);
        JsonNode example = jsonMapper.readTree(ContractExamples.read("problem", "bad-request-malformed-body"));
        assertThat(problem).isEqualTo(example);
    }

    @Test
    void neverLogsTheTokenNorThePseudo(CapturedOutput output) throws Exception {
        JsonNode response = created("{\"pseudo\":\"Zébulon-Témoin\",\"role\":\"VOTER\"}");
        create("{\"pseudo\":\"" + "Zébulon-Témoin".repeat(2) + "\",\"role\":\"VOTER\"}");

        String token = response.get("participantToken").asString();
        assertThat(output.getAll()).contains(response.get("participantId").asString());
        assertThat(output.getAll()).doesNotContain(token).doesNotContain("Zébulon")
                .doesNotContain(response.get("sessionId").asString());
    }

    @Test
    void withoutADeckTheSessionOffersTheWholeFibonacciSuite() throws Exception {
        JsonNode response = created("{\"pseudo\":\"Sofia\",\"role\":\"VOTER\"}");
        assertThat(stored(response).deck()).isEqualTo(Deck.standard());
    }

    @Test
    void storesTheChosenDeckInTheFamilyOrder() throws Exception {
        JsonNode response = created(
                "{\"pseudo\":\"Sofia\",\"role\":\"VOTER\",\"deck\":{\"type\":\"TSHIRT\",\"cards\":[\"XL\",\"S\",\"M\"]}}");
        Deck deck = stored(response).deck();
        assertThat(deck.type()).isEqualTo(DeckType.TSHIRT);
        assertThat(deck.cards()).containsExactly(Card.S, Card.M, Card.XL);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"type\":\"EMOJI\",\"cards\":[\"S\",\"M\"]}",
            "{\"type\":\"TSHIRT\",\"cards\":[\"S\"]}",
            "{\"type\":\"TSHIRT\",\"cards\":[\"S\",\"S\"]}",
            "{\"type\":\"TSHIRT\",\"cards\":[\"S\",\"5\"]}",
            "{\"type\":\"FIBONACCI\",\"cards\":[\"1\",\"2\"]}",
            "{\"type\":\"FIBONACCI\",\"cards\":[\"1\",\"nope\"]}",
            "{\"type\":\"FIBONACCI\",\"cards\":[]}" })
    void refusesAnInvalidDeckWithItsCodeAndStoresNothing(String deck) throws Exception {
        int before = store.count();
        create("{\"pseudo\":\"Sofia\",\"role\":\"VOTER\",\"deck\":" + deck + "}")
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("INVALID_DECK"));
        assertThat(store.count()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "null",
            "\"S\"",
            "{\"type\":\"TSHIRT\"}",
            "{\"cards\":[\"S\",\"M\"]}",
            "{\"type\":\"TSHIRT\",\"cards\":[\"S\",null]}",
            "{\"type\":\"TSHIRT\",\"cards\":[\"S\",\"M\"],\"extra\":1}",
            "{\"type\":\"TSHIRT\",\"cards\":[\"S\",\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"]}" })
    void answersAMalformedDeckAsAMalformedBody(String deck) throws Exception {
        // « deck: null » est lu comme l'absence de jeu : la création réussit avec le jeu par défaut.
        if (deck.equals("null")) {
            created("{\"pseudo\":\"Sofia\",\"role\":\"VOTER\",\"deck\":null}");
            return;
        }
        create("{\"pseudo\":\"Sofia\",\"role\":\"VOTER\",\"deck\":" + deck + "}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").doesNotExist());
    }
}
