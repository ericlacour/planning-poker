package com.planningpoker.config;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Origines acceptées en CORS et à l'ouverture du WebSocket (AD-11), lues dans {@code ALLOWED_ORIGINS}
 * (liste séparée par des virgules). Vide par défaut : aucune origine n'est acceptée. Chaque entrée doit être une
 * origine {@code http(s)://hôte[:port]} : un joker {@code *} ou un chemin font échouer le démarrage.
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
                .map(AllowedOrigins::toOrigin)
                .toList();
    }

    private static String toOrigin(String entry) {
        String candidate = entry.endsWith("/") ? entry.substring(0, entry.length() - 1) : entry;
        try {
            URI uri = new URI(candidate);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            boolean isOrigin = (scheme.equals("https") || scheme.equals("http")) && uri.getHost() != null
                    && uri.getRawPath().isEmpty() && uri.getRawQuery() == null && uri.getRawFragment() == null
                    && uri.getRawUserInfo() == null;
            if (isOrigin) {
                return scheme + "://" + uri.getHost().toLowerCase(Locale.ROOT)
                        + (uri.getPort() == -1 ? "" : ":" + uri.getPort());
            }
        } catch (URISyntaxException e) {
            // signalé ci-dessous
        }
        throw new IllegalStateException("ALLOWED_ORIGINS : origine invalide « " + entry
                + " » (attendu : http(s)://hôte[:port], sans joker ni chemin)");
    }

    public String[] asArray() {
        return asList().toArray(String[]::new);
    }
}
