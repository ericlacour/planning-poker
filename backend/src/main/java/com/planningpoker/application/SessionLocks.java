package com.planningpoker.application;

import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;

/**
 * Verrou par session : une session correspond toujours au même verrou, pris pour toute la séquence
 * charger → règle → enregistrer (AD-3). Verrous en nombre fixe, pour ne rien avoir à nettoyer quand une session
 * disparaît ; deux sessions peuvent partager un verrou, ce qui ne fait que sérialiser leurs écritures.
 */
public final class SessionLocks {

    private static final int STRIPES = 64;

    private final ReentrantLock[] locks = new ReentrantLock[STRIPES];

    public SessionLocks() {
        for (int i = 0; i < STRIPES; i++) {
            locks[i] = new ReentrantLock();
        }
    }

    public <T> T withLock(String sessionId, Supplier<T> action) {
        ReentrantLock lock = locks[Math.floorMod(sessionId.hashCode(), STRIPES)];
        lock.lock();
        try {
            return action.get();
        } finally {
            lock.unlock();
        }
    }
}
