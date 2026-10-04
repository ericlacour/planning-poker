package com.planningpoker.adapter.in.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;

import org.junit.jupiter.api.Test;

import com.planningpoker.application.MutableClock;

class CreationRateLimiterTest {

    private static final Instant NOW = Instant.parse("2026-10-04T09:00:00Z");

    private final MutableClock clock = new MutableClock(NOW);
    private final CreationRateLimiter limiter = new CreationRateLimiter(clock, 10, Duration.ofMinutes(1));

    private void tenCreationsIn40Seconds(String client) {
        for (int i = 0; i < 10; i++) {
            limiter.acquire(client);
            if (i < 9) {
                clock.advance(Duration.ofMillis(4444));
            }
        }
        clock.advance(Duration.ofSeconds(40).minus(Duration.ofMillis(4444 * 9)));
    }

    private long refusal(String client) {
        try {
            limiter.acquire(client);
        } catch (TooManyCreationsException e) {
            return e.retryAfterSeconds();
        }
        throw new AssertionError("expected a refusal");
    }

    @Test
    void theEleventhCreationWithinAMinuteIsRefusedUntilTheOldestLeavesTheWindow() {
        tenCreationsIn40Seconds("A");
        assertThat(refusal("A")).isEqualTo(20);
        clock.advance(Duration.ofMillis(19_500));
        assertThat(refusal("A")).isEqualTo(1);
        clock.advance(Duration.ofMillis(500));
        limiter.acquire("A");
    }

    @Test
    void retryAfterIsRoundedUp() {
        tenCreationsIn40Seconds("A");
        clock.advance(Duration.ofMillis(1));
        assertThat(refusal("A")).isEqualTo(20);
        clock.advance(Duration.ofMillis(999));
        assertThat(refusal("A")).isEqualTo(19);
    }

    @Test
    void aRefusalIsNotCounted() {
        tenCreationsIn40Seconds("A");
        for (int i = 0; i < 5; i++) {
            refusal("A");
        }
        clock.advance(Duration.ofSeconds(20));
        limiter.acquire("A");
    }

    @Test
    void anotherClientIsNotAffected() {
        tenCreationsIn40Seconds("A");
        limiter.acquire("B");
        assertThat(refusal("A")).isEqualTo(20);
    }

    @Test
    void aReleasedSlotDoesNotCount() {
        for (int i = 0; i < 9; i++) {
            limiter.acquire("A");
        }
        limiter.release(limiter.acquire("A"));
        limiter.acquire("A");
        assertThatThrownBy(() -> limiter.acquire("A")).isInstanceOf(TooManyCreationsException.class);
    }

    @Test
    void aClientWithoutCreationForAMinuteIsForgotten() {
        limiter.acquire("A");
        limiter.acquire("B");
        clock.advance(Duration.ofSeconds(30));
        limiter.acquire("B");
        assertThat(limiter.trackedClients()).isEqualTo(2);
        clock.advance(Duration.ofSeconds(30));
        assertThat(limiter.trackedClients()).isEqualTo(1);
        clock.advance(Duration.ofSeconds(30));
        assertThat(limiter.trackedClients()).isZero();
    }
}
