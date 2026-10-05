package com.planningpoker.adapter.in.ws;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

import com.planningpoker.domain.Role;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Lecture stricte des messages client → serveur (asyncapi.yaml) : tout ce qui sort de son schéma (champ en plus ou
 * en moins, type de valeur, bornes de longueur comptées en points de code comme JSON Schema) est {@link Invalid}.
 */
final class ClientMessages {

    static final int TOKEN_MAX_LENGTH = 64;
    static final int ROUND_ID_MAX_LENGTH = 64;
    static final int CARD_MAX_LENGTH = 16;
    /** Rôles acceptés par {@code changeRole} : ceux du domaine, pour que la validation suive l'énumération. */
    private static final Set<String> ROLES = Arrays.stream(Role.values()).map(Role::name)
            .collect(Collectors.toUnmodifiableSet());

    private ClientMessages() {
    }

    sealed interface ClientMessage {
    }

    /** {@code hello.json} */
    record HelloMessage(String type, String participantToken) implements ClientMessage {
        /** Jamais le jeton lui-même dans un journal. */
        @Override
        public String toString() {
            return "HelloMessage[***]";
        }
    }

    /** {@code heartbeat.json} */
    record HeartbeatMessage(String type) implements ClientMessage {
    }

    /** {@code vote.json} : {@code card} nul pour retirer son vote. */
    record VoteMessage(String type, String roundId, String card) implements ClientMessage {
    }

    /** {@code reveal.json} */
    record RevealMessage(String type, String roundId) implements ClientMessage {
    }

    /** {@code clear.json} */
    record ClearMessage(String type, String roundId) implements ClientMessage {
    }

    /** {@code change-role.json} */
    record ChangeRoleMessage(String type, Role role) implements ClientMessage {
    }

    /** {@code hide} conforme à son schéma, encore ignoré (story 3.2). */
    record Intent(String type) implements ClientMessage {
    }

    /** JSON invalide, {@code type} inconnu ou message hors schéma. */
    record Invalid() implements ClientMessage {
    }

    static ClientMessage parse(JsonMapper jsonMapper, String payload) {
        JsonNode node;
        try {
            node = jsonMapper.readTree(payload);
        } catch (JacksonException e) {
            return new Invalid();
        }
        if (node == null || !node.isObject() || !node.path("type").isString()) {
            return new Invalid();
        }
        String type = node.get("type").asString();
        boolean valid = switch (type) {
            case "hello" -> hasExactly(node, 2) && isString(node.get("participantToken"), 1, TOKEN_MAX_LENGTH);
            case "heartbeat" -> hasExactly(node, 1);
            case "vote" -> hasExactly(node, 3) && isRoundId(node.get("roundId")) && node.has("card")
                    && (node.get("card").isNull() || isString(node.get("card"), 0, CARD_MAX_LENGTH));
            case "reveal", "hide", "clear" -> hasExactly(node, 2) && isRoundId(node.get("roundId"));
            case "changeRole" -> hasExactly(node, 2) && node.path("role").isString()
                    && ROLES.contains(node.get("role").asString());
            default -> false;
        };
        if (!valid) {
            return new Invalid();
        }
        return switch (type) {
            case "hello" -> new HelloMessage(type, node.get("participantToken").asString());
            case "heartbeat" -> new HeartbeatMessage(type);
            case "vote" -> new VoteMessage(type, node.get("roundId").asString(),
                    node.get("card").isNull() ? null : node.get("card").asString());
            case "reveal" -> new RevealMessage(type, node.get("roundId").asString());
            case "clear" -> new ClearMessage(type, node.get("roundId").asString());
            case "changeRole" -> new ChangeRoleMessage(type, Role.valueOf(node.get("role").asString()));
            default -> new Intent(type);
        };
    }

    /** {@code type} plus {@code count - 1} autres champs (leur présence est vérifiée par l'appelant). */
    private static boolean hasExactly(JsonNode node, int count) {
        return node.size() == count;
    }

    private static boolean isRoundId(JsonNode value) {
        return isString(value, 1, ROUND_ID_MAX_LENGTH);
    }

    private static boolean isString(JsonNode value, int min, int max) {
        if (value == null || !value.isString()) {
            return false;
        }
        String text = value.asString();
        int length = text.codePointCount(0, text.length());
        return length >= min && length <= max;
    }
}
