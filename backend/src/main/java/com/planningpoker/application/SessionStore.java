package com.planningpoker.application;

import java.util.Collection;
import java.util.Optional;

import com.planningpoker.domain.Session;

/** Port de stockage des sessions. Toute écriture se fait sous le verrou de la session (AD-3, AD-9). */
public interface SessionStore {

    Optional<Session> find(String sessionId);

    void save(Session session);

    void delete(String sessionId);

    Collection<Session> all();

    /** Nombre de sessions en mémoire. */
    int count();
}
