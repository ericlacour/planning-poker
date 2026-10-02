package com.planningpoker.adapter.out.memory;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import com.planningpoker.application.SessionStore;
import com.planningpoker.domain.Session;

/** Sessions en mémoire, une seule instance en V1 (AD-9). */
public class InMemorySessionStore implements SessionStore {

    private final Map<String, Session> sessions = new ConcurrentHashMap<>();

    @Override
    public Optional<Session> find(String sessionId) {
        return Optional.ofNullable(sessions.get(sessionId));
    }

    @Override
    public void save(Session session) {
        sessions.put(session.id(), session);
    }

    @Override
    public void delete(String sessionId) {
        sessions.remove(sessionId);
    }

    @Override
    public Collection<Session> all() {
        return List.copyOf(sessions.values());
    }
}
