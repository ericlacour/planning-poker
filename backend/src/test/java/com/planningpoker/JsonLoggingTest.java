package com.planningpoker;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Les journaux sortent en JSON sur la sortie standard. */
@SpringBootTest
@ExtendWith(OutputCaptureExtension.class)
class JsonLoggingTest {

    @Autowired
    JsonMapper jsonMapper;

    @Test
    void logsAreJsonLines(CapturedOutput output) {
        LoggerFactory.getLogger(JsonLoggingTest.class).info("json-logging-probe");

        String line = output.getOut().lines()
                .filter(l -> l.contains("json-logging-probe"))
                .findFirst().orElseThrow();
        JsonNode node = jsonMapper.readTree(line);
        assertThat(node.path("message").asString()).isEqualTo("json-logging-probe");
        assertThat(node.has("@timestamp")).isTrue();
    }
}
