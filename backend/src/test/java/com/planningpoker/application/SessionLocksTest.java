package com.planningpoker.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SessionLocksTest {

    private static final String ID = "k3Jx9QvT2mLpZ8wR4nYb7A";

    private final SessionLocks locks = new SessionLocks();
    private final ExecutorService pool = Executors.newFixedThreadPool(8);

    @AfterEach
    void stop() {
        pool.shutdownNow();
    }

    private void anotherThreadCanTakeTheLock() throws Exception {
        Future<Boolean> other = pool.submit(() -> locks.withLock(ID, () -> true));
        assertThat(other.get(2, TimeUnit.SECONDS)).isTrue();
    }

    @Test
    void releasesTheLockWhenTheActionReturns() throws Exception {
        assertThat(locks.withLock(ID, () -> "done")).isEqualTo("done");
        anotherThreadCanTakeTheLock();
    }

    @Test
    void releasesTheLockWhenTheActionThrows() throws Exception {
        assertThatThrownBy(() -> locks.withLock(ID, () -> {
            throw new IllegalStateException("boom");
        })).isInstanceOf(IllegalStateException.class).hasMessage("boom");
        anotherThreadCanTakeTheLock();
    }

    @Test
    void twoConcurrentActionsOnOneIdNeverOverlap() throws Exception {
        AtomicInteger inside = new AtomicInteger();
        AtomicInteger maxInside = new AtomicInteger();
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            futures.add(pool.submit(() -> {
                start.await();
                for (int j = 0; j < 50; j++) {
                    locks.withLock(ID, () -> {
                        maxInside.accumulateAndGet(inside.incrementAndGet(), Math::max);
                        Thread.onSpinWait();
                        Thread.yield();
                        inside.decrementAndGet();
                        return null;
                    });
                }
                return null;
            }));
        }
        start.countDown();
        for (Future<?> future : futures) {
            future.get(10, TimeUnit.SECONDS);
        }
        assertThat(maxInside.get()).isEqualTo(1);
    }
}
