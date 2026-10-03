package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.security.SecureRandom;
import java.util.HashSet;
import java.util.Set;
import java.util.SplittableRandom;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class IdGeneratorTest {

    private static final String BASE64URL_128_BITS = "^[A-Za-z0-9_-]{22}$";

    private final IdGenerator ids = new IdGenerator(new SecureRandom());

    @Test
    void sessionIdsAndTokensAre128BitsInBase64UrlWithoutPadding() {
        for (int i = 0; i < 200; i++) {
            assertThat(ids.newSessionId()).matches(BASE64URL_128_BITS);
            assertThat(ids.newParticipantToken()).matches(BASE64URL_128_BITS);
        }
    }

    @Test
    void participantIdsAreRandomUuids() {
        UUID id = ids.newParticipantId();
        assertThat(id.version()).isEqualTo(4);
        assertThat(id.variant()).isEqualTo(2);
        assertThat(UUID.fromString(id.toString())).isEqualTo(id);
    }

    @Test
    void doesNotRepeat() {
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            assertThat(seen.add(ids.newSessionId())).isTrue();
        }
    }

    @Test
    void isDeterministicWithASeededGenerator() {
        IdGenerator a = new IdGenerator(new SplittableRandom(42));
        IdGenerator b = new IdGenerator(new SplittableRandom(42));
        assertThat(a.newSessionId()).isEqualTo(b.newSessionId());
        assertThat(a.newParticipantId()).isEqualTo(b.newParticipantId());
    }
}
