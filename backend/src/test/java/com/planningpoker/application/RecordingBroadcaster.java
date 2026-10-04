package com.planningpoker.application;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.planningpoker.domain.Session;

/** Diffuseur de test : retient les rattachements, les sessions publiées et les fermetures demandées. */
final class RecordingBroadcaster implements SessionBroadcaster {

    record Published(Session session, String onlyTo) {
    }

    final Map<String, UUID> attached = new HashMap<>();
    final List<Published> published = new ArrayList<>();
    /** Connexions déjà fermées : leur rattachement échoue. */
    final List<String> closed = new ArrayList<>();
    /** Connexions dont la fermeture a été demandée, dans l'ordre. */
    final List<String> closeRequested = new ArrayList<>();
    /** Connexions dont la fermeture en {@code 4404} (session expirée) a été demandée, dans l'ordre. */
    final List<String> notFoundRequested = new ArrayList<>();

    @Override
    public boolean attach(String connectionId, String sessionId, UUID participantId) {
        if (closed.contains(connectionId) || attached.containsKey(connectionId)) {
            return false;
        }
        attached.put(connectionId, participantId);
        return true;
    }

    @Override
    public boolean detach(String connectionId) {
        return attached.remove(connectionId) != null;
    }

    @Override
    public void publish(Session session) {
        published.add(new Published(session, null));
    }

    @Override
    public void publishTo(Session session, String connectionId) {
        published.add(new Published(session, connectionId));
    }

    @Override
    public void close(String connectionId) {
        closeRequested.add(connectionId);
    }

    @Override
    public void closeSessionNotFound(String connectionId) {
        notFoundRequested.add(connectionId);
    }
}
