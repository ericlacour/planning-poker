package com.planningpoker.adapter.in.scheduling;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;

import com.planningpoker.adapter.out.memory.InMemorySessionStore;
import com.planningpoker.application.SessionLocks;
import com.planningpoker.application.SweepUseCase;

class SweepSchedulerTest {

    /** Balayeur qui échoue à chaque passage, et compte ses passages. */
    static final class FailingSweep extends SweepUseCase {
        final CountDownLatch runs = new CountDownLatch(3);

        FailingSweep() {
            super(new InMemorySessionStore(), new SessionLocks(), null, Clock.systemUTC(), Duration.ofSeconds(15),
                    Duration.ofMinutes(5), Duration.ofHours(24));
        }

        @Override
        public void sweep() {
            runs.countDown();
            throw new IllegalStateException("boom");
        }
    }

    @Test
    void anExceptionDoesNotStopTheNextRuns() throws Exception {
        FailingSweep sweep = new FailingSweep();
        SweepScheduler scheduler = new SweepScheduler(sweep, Duration.ofMillis(20));
        try {
            assertThat(sweep.runs.await(5, TimeUnit.SECONDS)).isTrue();
        } finally {
            scheduler.destroy();
        }
    }
}
