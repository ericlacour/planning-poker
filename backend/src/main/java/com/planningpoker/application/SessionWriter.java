package com.planningpoker.application;

import java.util.UUID;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;

import com.planningpoker.domain.Session;

/**
 * Point unique d'écriture d'une session (AD-3), partagé par tous les cas d'usage : sous le verrou de la session,
 * charger → règle → enregistrer si l'instance change → publier si la {@code version} change. Une règle sans effet
 * renvoie la même instance (rien n'est enregistré) ; un changement caché garde la même {@code version} (enregistré,
 * jamais diffusé).
 */
final class SessionWriter {

    private final SessionStore store;
    private final SessionLocks locks;
    private final SessionBroadcaster broadcaster;

    SessionWriter(SessionStore store, SessionLocks locks, SessionBroadcaster broadcaster) {
        this.store = store;
        this.locks = locks;
        this.broadcaster = broadcaster;
    }

    /** Exécute {@code action} sous le verrou de la session. */
    <T> T withLock(String sessionId, Supplier<T> action) {
        return locks.withLock(sessionId, action);
    }

    /**
     * Enregistre {@code after} s'il diffère de {@code before}, puis le diffuse si sa {@code version} a changé. À
     * appeler sous le verrou de la session.
     *
     * @return vrai si {@code after} a été diffusé
     */
    boolean commit(Session before, Session after) {
        if (after == before) {
            return false;
        }
        store.save(after);
        if (after.version() == before.version()) {
            return false;
        }
        broadcaster.publish(after);
        return true;
    }

    /**
     * Intention d'un participant : sous le verrou, applique {@code rule} à la session et en écrit le résultat. Sans
     * effet si la session est inconnue ou si le participant n'y est pas (ou plus). Une exception de la règle laisse la
     * session inchangée et remonte à l'appelant.
     *
     * @return vrai si le résultat a été diffusé (changement observable)
     */
    boolean apply(String sessionId, UUID participantId, UnaryOperator<Session> rule) {
        return locks.withLock(sessionId, () -> {
            Session session = store.find(sessionId).orElse(null);
            return session != null && session.participant(participantId).isPresent()
                    && commit(session, rule.apply(session));
        });
    }
}
