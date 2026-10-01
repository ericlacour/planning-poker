package com.planningpoker.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Origines acceptées en CORS et à l'ouverture du WebSocket (AD-11), lues dans {@code ALLOWED_ORIGINS}
 * (liste séparée par des virgules). Vide par défaut : aucune origine n'est acceptée.
 */
@ConfigurationProperties(prefix = "planning-poker")
public record AllowedOrigins(String allowedOrigins) {

    public List<String> asList() {
        if (allowedOrigins == null) {
            return List.of();
        }
        return Arrays.stream(allowedOrigins.split(","))
                .map(String::strip)
                .filter(origin -> !origin.isEmpty())
                .map(origin -> origin.endsWith("/") ? origin.substring(0, origin.length() - 1) : origin)
                .toList();
    }

    public String[] asArray() {
        return asList().toArray(String[]::new);
    }
}
