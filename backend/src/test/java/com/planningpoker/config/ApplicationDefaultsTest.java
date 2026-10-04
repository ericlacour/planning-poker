package com.planningpoker.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.util.Properties;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/** Plafonds de production (story 2.6) : les tests en relèvent certains, ceux de {@code application.properties}. */
class ApplicationDefaultsTest {

    @Test
    void theAbuseLimitsHaveTheirDocumentedDefaults() throws Exception {
        Properties properties = new Properties();
        try (InputStream in = new ClassPathResource("application.properties").getInputStream()) {
            properties.load(in);
        }
        assertThat(properties).containsEntry("planning-poker.max-request-body", "2KB")
                .containsEntry("planning-poker.max-ws-message", "4KB")
                .containsEntry("planning-poker.max-sessions", "50")
                .containsEntry("planning-poker.max-creations-per-ip", "10")
                .containsEntry("planning-poker.creation-window", "1m")
                .containsEntry("planning-poker.max-participants", "30");
    }
}
