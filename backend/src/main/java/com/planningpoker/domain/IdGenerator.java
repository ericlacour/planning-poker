package com.planningpoker.domain;

import java.util.Base64;
import java.util.Objects;
import java.util.UUID;
import java.util.random.RandomGenerator;

/**
 * Identifiants de session, jetons, identifiants de tour et de participant, tirés d'un générateur fourni
 * ({@code SecureRandom} en production).
 */
public final class IdGenerator {

    private static final int RANDOM_BYTES = 16;

    private final RandomGenerator random;

    public IdGenerator(RandomGenerator random) {
        this.random = Objects.requireNonNull(random, "random");
    }

    /** 128 bits, base64url sans remplissage (22 caractères). */
    public String newSessionId() {
        return randomBase64Url();
    }

    /** SECRET : 128 bits, base64url sans remplissage (22 caractères). */
    public String newParticipantToken() {
        return randomBase64Url();
    }

    /** Identifiant opaque de tour. */
    public String newRoundId() {
        return randomBase64Url();
    }

    /** UUID version 4, tiré du même générateur. */
    public UUID newParticipantId() {
        byte[] bytes = randomBytes();
        bytes[6] = (byte) ((bytes[6] & 0x0f) | 0x40);
        bytes[8] = (byte) ((bytes[8] & 0x3f) | 0x80);
        long msb = 0;
        long lsb = 0;
        for (int i = 0; i < 8; i++) {
            msb = (msb << 8) | (bytes[i] & 0xff);
            lsb = (lsb << 8) | (bytes[i + 8] & 0xff);
        }
        return new UUID(msb, lsb);
    }

    private String randomBase64Url() {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes());
    }

    private byte[] randomBytes() {
        byte[] bytes = new byte[RANDOM_BYTES];
        random.nextBytes(bytes);
        return bytes;
    }
}
