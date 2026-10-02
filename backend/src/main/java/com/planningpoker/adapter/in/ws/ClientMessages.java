package com.planningpoker.adapter.in.ws;

import java.util.Set;

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
    private static final Set<String> ROLES = Set.of("VOTER", "OBSERVER");

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

    /**
     * {@code vote}, {@code reveal}, {@code hide}, {@code clear} ou {@code changeRole} conforme à son schéma, que la
     * story 1.5 ignore (stories 1.6, 1.7, 3.x).
     */
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
