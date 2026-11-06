package com.planningpoker.adapter.in.ws;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.planningpoker.ContractExamples;
import com.planningpoker.domain.Card;
import com.planningpoker.domain.Deck;
import com.planningpoker.domain.EstimationRule;
import com.planningpoker.domain.Summary;

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
        assertThat(written.equals(NUMERIC, jsonMapper.readTree(json)))
                .as("%s/%s round trip: %s", schema, example, written).isTrue();
    }

    /** Égalité des nombres par leur valeur : {@code 3} et {@code 3.0} sont égaux ({@code average}). */
    private static final Comparator<JsonNode> NUMERIC = (a, b) -> {
        if (a.equals(b)) {
            return 0;
        }
        if (a.isNumber() && b.isNumber()) {
            return a.decimalValue().compareTo(b.decimalValue());
        }
        return 1;
    };

    @ParameterizedTest
    @ValueSource(strings = { "alone-after-create", "hidden-round", "new-round-after-sweep", "revealed-consensus",
            "revealed-no-numeric-vote", "revealed-seen-by-observer", "revealed-tie", "revealed-tshirt-tie", "revealed-median",
            "revealed-spread-too-wide" })
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

    @ParameterizedTest
    @ValueSource(strings = { "choose-card", "coffee", "withdraw" })
    void vote(String example) throws Exception {
        assertRoundTrip("vote", example, ClientMessages.VoteMessage.class);
        assertThat(ClientMessages.parse(jsonMapper, ContractExamples.read("vote", example)))
                .isEqualTo(jsonMapper.readValue(ContractExamples.read("vote", example),
                        ClientMessages.VoteMessage.class));
    }

    @ParameterizedTest
    @CsvSource({ "NOT_A_VOTER,not-a-voter", "ROUND_REVEALED,round-revealed", "INVALID_CARD,invalid-card" })
    void voteRejectionsAreTheContractExamples(String reason, String example) throws Exception {
        assertThat(jsonMapper.readTree(jsonMapper.writeValueAsString(
                ServerMessages.ErrorMessage.of(com.planningpoker.domain.VoteRejectedException.Reason.valueOf(reason)))))
                .isEqualTo(jsonMapper.readTree(ContractExamples.read("error", example)));
    }

    @Test
    void reveal() throws Exception {
        assertRoundTrip("reveal", "reveal", ClientMessages.RevealMessage.class);
        assertThat(ClientMessages.parse(jsonMapper, ContractExamples.read("reveal", "reveal")))
                .isEqualTo(new ClientMessages.RevealMessage("reveal", "Jd8sK2pQ"));
    }

    @Test
    void clear() throws Exception {
        assertRoundTrip("clear", "clear", ClientMessages.ClearMessage.class);
        assertThat(ClientMessages.parse(jsonMapper, ContractExamples.read("clear", "clear")))
                .isEqualTo(new ClientMessages.ClearMessage("clear", "Jd8sK2pQ"));
    }

    /** Une synthèse du domaine s'écrit comme celle de l'exemple (moyenne comparée par sa valeur). */
    @Test
    void aDomainSummaryIsWrittenLikeTheExample() throws Exception {
        JsonNode written = writtenSummary("revealed-tie", "5", "8", "5", "8", "?");
        assertThat(written.equals(NUMERIC, exampleSummary("revealed-tie"))).as(written.toString()).isTrue();

        written = writtenSummary("revealed-consensus", "3", "3", "coffee");
        assertThat(written.equals(NUMERIC, exampleSummary("revealed-consensus"))).as(written.toString()).isTrue();
        assertThat(written.get("average").isNumber()).isTrue();

        // Sans carte chiffrée : un objet aux valeurs nulles, jamais « summary: null » sur un tour révélé.
        written = writtenSummary("revealed-no-numeric-vote", "?", "coffee");
        assertThat(written.equals(NUMERIC, exampleSummary("revealed-no-numeric-vote"))).as(written.toString()).isTrue();
        assertThat(written.get("proposal").isNull()).isTrue();
    }

    @Test
    void aSizeSummaryIsWrittenLikeTheExampleWithoutAnAverage() throws Exception {
        JsonNode written = writtenSummary("revealed-tshirt-tie", "M", "L", "M", "L");
        assertThat(written.equals(NUMERIC, exampleSummary("revealed-tshirt-tie"))).as(written.toString()).isTrue();
        assertThat(written.get("average").isNull()).isTrue();
    }

    /** La proposition du domaine s'écrit comme celle des exemples : médiane, puis écart trop grand. */
    @Test
    void aDomainProposalIsWrittenLikeTheExamples() throws Exception {
        JsonNode written = writtenSummary("revealed-median", "3", "5", "5", "8");
        assertThat(written.equals(NUMERIC, exampleSummary("revealed-median"))).as(written.toString()).isTrue();

        written = writtenSummary("revealed-spread-too-wide", "2", "13", "5", "5", "?");
        assertThat(written.equals(NUMERIC, exampleSummary("revealed-spread-too-wide"))).as(written.toString()).isTrue();
        assertThat(written.get("proposal").isNull()).isTrue();
        assertThat(written.get("spreadTooWide").asBoolean()).isTrue();
    }

    /** Synthèse du domaine pour ces votes, avec le jeu et la règle de l'exemple. */
    private JsonNode writtenSummary(String example, String... cards) throws Exception {
        JsonNode state = jsonMapper.readTree(ContractExamples.read("session-state", example));
        List<String> deckCards = new java.util.ArrayList<>();
        state.get("deck").get("cards").forEach(c -> deckCards.add(c.asString()));
        Deck deck = Deck.of(state.get("deck").get("type").asString(), deckCards);
        EstimationRule rule = EstimationRule.valueOf(state.get("estimationRule").asString());
        List<Card> votes = Stream.of(cards).map(c -> Card.of(c).orElseThrow()).toList();
        return jsonMapper.readTree(
                jsonMapper.writeValueAsString(ServerMessages.SummaryView.of(Summary.of(votes, deck, rule))));
    }

    private JsonNode exampleSummary(String example) throws Exception {
        return jsonMapper.readTree(ContractExamples.read("session-state", example)).get("summary");
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
    @CsvSource({ "hello,hello,HelloMessage", "heartbeat,heartbeat,HeartbeatMessage", "vote,choose-card,VoteMessage",
            "vote,withdraw,VoteMessage", "vote,coffee,VoteMessage", "reveal,reveal,RevealMessage",
            "hide,hide,HideMessage", "clear,clear,ClearMessage", "change-role,to-observer,ChangeRoleMessage" })
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
