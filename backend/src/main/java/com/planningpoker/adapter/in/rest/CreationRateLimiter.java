package com.planningpoker.adapter.in.rest;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.Objects;

/**
 * Créations de session par IP cliente sur une fenêtre glissante ({@code 429 TOO_MANY_REQUESTS}). Une IP qui a déjà
 * {@code maxCreations} créations dans la fenêtre est refusée. Seules les créations réussies comptent : une place est
 * réservée avant l'appel ({@link #acquire}) puis rendue si la création échoue ({@link #release}), ce qui garde le
 * plafond strict même pour des créations simultanées depuis la même IP.
 * <p>
 * Les compteurs ne vivent qu'en mémoire ; une IP sans création dans la fenêtre est oubliée au passage suivant.
 * L'heure n'est lue que par {@link Clock}. La création est rare : un seul verrou suffit.
 */
public class CreationRateLimiter {

    private final Clock clock;
    private final int maxCreations;
    private final Duration window;
    private final Map<String, Deque<Instant>> creations = new HashMap<>();

    public CreationRateLimiter(Clock clock, int maxCreations, Duration window) {
        this.clock = Objects.requireNonNull(clock, "clock");
        this.window = Objects.requireNonNull(window, "window");
        this.maxCreations = maxCreations;
    }

    /**
     * Réserve une création pour {@code client}.
     *
     * @return la place réservée, à rendre par {@link #release} si la création échoue
     * @throws TooManyCreationsException si {@code client} a déjà {@code maxCreations} créations dans la fenêtre ;
     *                                   rien n'est compté
     */
    public synchronized Slot acquire(String client) {
        Instant now = clock.instant();
        forgetOutside(now);
        Deque<Instant> recent = creations.computeIfAbsent(client, key -> new ArrayDeque<>());
        if (recent.size() >= maxCreations) {
            throw new TooManyCreationsException(retryAfterSeconds(recent.peekFirst(), now));
        }
        recent.addLast(now);
        return new Slot(client, now);
    }

    /** Rend une place réservée par {@link #acquire} : la création n'a pas abouti et ne compte pas. */
    public synchronized void release(Slot slot) {
        Deque<Instant> recent = creations.get(slot.client());
        if (recent != null) {
            recent.removeLastOccurrence(slot.at());
            if (recent.isEmpty()) {
                creations.remove(slot.client());
            }
        }
    }

    /** Nombre d'IP encore suivies. */
    synchronized int trackedClients() {
        forgetOutside(clock.instant());
        return creations.size();
    }

    /** Une création à {@code at} compte tant que {@code now < at + window}. */
    private void forgetOutside(Instant now) {
        Instant oldestKept = now.minus(window);
        Iterator<Deque<Instant>> clients = creations.values().iterator();
        while (clients.hasNext()) {
            Deque<Instant> recent = clients.next();
            while (!recent.isEmpty() && !recent.peekFirst().isAfter(oldestKept)) {
                recent.removeFirst();
            }
            if (recent.isEmpty()) {
                clients.remove();
            }
        }
    }

    /** Secondes entières avant que {@code oldest} sorte de la fenêtre, arrondies au supérieur, au moins 1. */
    private long retryAfterSeconds(Instant oldest, Instant now) {
        Duration remaining = Duration.between(now, oldest.plus(window));
        long seconds = remaining.getSeconds() + (remaining.getNano() > 0 ? 1 : 0);
        return Math.max(1, seconds);
    }

    /** Place réservée par une IP à un instant donné. */
    public record Slot(String client, Instant at) {
    }
}
