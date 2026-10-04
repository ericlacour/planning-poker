package com.planningpoker.adapter.in.rest;

import java.util.Collections;
import java.util.List;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Seule lecture de l'IP cliente (décision du 2026-10-04) : {@code CF-Connecting-IP} s'il est présent, puisque
 * Cloudflare l'écrit en écrasant toute valeur venue du client ; sinon la <b>dernière</b> entrée de
 * {@code X-Forwarded-For}, ajoutée par le dernier mandataire (Render) ; sinon l'adresse de la connexion. L'entrée la
 * plus à gauche de {@code X-Forwarded-For} n'est jamais utilisée : le client peut l'écrire à sa guise.
 * <p>
 * L'IP sert uniquement à compter les créations : elle n'apparaît jamais dans les journaux.
 */
final class ClientAddress {

    static final String CF_CONNECTING_IP = "CF-Connecting-IP";
    static final String X_FORWARDED_FOR = "X-Forwarded-For";

    private ClientAddress() {
    }

    static String of(HttpServletRequest request) {
        String cloudflare = request.getHeader(CF_CONNECTING_IP);
        if (cloudflare != null && !cloudflare.isBlank()) {
            return cloudflare.strip();
        }
        String forwarded = lastForwardedFor(request);
        if (forwarded != null) {
            return forwarded;
        }
        return request.getRemoteAddr();
    }

    /** Dernière entrée non vide de {@code X-Forwarded-For}, sur toutes ses occurrences ; {@code null} sinon. */
    private static String lastForwardedFor(HttpServletRequest request) {
        List<String> headers = Collections.list(request.getHeaders(X_FORWARDED_FOR));
        for (int h = headers.size() - 1; h >= 0; h--) {
            String[] entries = headers.get(h).split(",");
            for (int e = entries.length - 1; e >= 0; e--) {
                if (!entries[e].isBlank()) {
                    return entries[e].strip();
                }
            }
        }
        return null;
    }
}
