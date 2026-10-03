package com.planningpoker.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/**
 * Empreinte SHA-256 d'un jeton de participant : le domaine ne garde jamais le jeton lui-même,
 * seulement de quoi le reconnaître.
 */
public record ParticipantToken(String fingerprint) {

    public static ParticipantToken of(String token) {
        return new ParticipantToken(fingerprintOf(token));
    }

    /** Vrai si {@code token} est le jeton dont on garde l'empreinte (comparaison à temps constant). */
    public boolean matches(String token) {
        if (token == null) {
            return false;
        }
        return MessageDigest.isEqual(
                fingerprint.getBytes(StandardCharsets.US_ASCII),
                fingerprintOf(token).getBytes(StandardCharsets.US_ASCII));
    }

    private static String fingerprintOf(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    @Override
    public String toString() {
        return "ParticipantToken[***]";
    }
}
