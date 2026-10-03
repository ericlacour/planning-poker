package com.planningpoker.adapter.in.scheduling;

import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.planningpoker.application.SweepUseCase;

/**
 * Lance le balayeur toutes les {@code planning-poker.sweep-interval} (1 s par défaut, AD-8). Une exception est
 * journalisée et n'arrête pas les passages suivants ; arrêté avec l'application.
 */
@Component
public class SweepScheduler implements DisposableBean {

    private static final Logger LOG = LoggerFactory.getLogger(SweepScheduler.class);

    private final SweepUseCase sweep;
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().daemon().name("sweep").factory());

    public SweepScheduler(SweepUseCase sweep,
            @Value("${planning-poker.sweep-interval:1s}") Duration sweepInterval) {
        this.sweep = sweep;
        timer.scheduleWithFixedDelay(this::runOnce, sweepInterval.toMillis(), sweepInterval.toMillis(),
                TimeUnit.MILLISECONDS);
    }

    /** Un passage du balayeur ; aucune exception ni erreur ne remonte au minuteur, qui l'arrêterait sans bruit. */
    void runOnce() {
        try {
            sweep.sweep();
        } catch (Throwable e) {
            LOG.error("Sweep failed", e);
        }
    }

    @Override
    public void destroy() {
        timer.shutdownNow();
    }
}
