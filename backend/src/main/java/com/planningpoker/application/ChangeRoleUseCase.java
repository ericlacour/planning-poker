package com.planningpoker.application;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.planningpoker.domain.Role;

/**
 * Intention {@code changeRole} (FR5) : sous le verrou de la session, la règle du domaine, puis enregistrer et diffuser
 * si la {@code version} change (AD-3). Le rôle déjà porté, ou un participant qui n'est plus à la table, ne fait rien,
 * sans réponse.
 */
public class ChangeRoleUseCase {

    private static final Logger LOG = LoggerFactory.getLogger(ChangeRoleUseCase.class);

    private final SessionWriter writer;

    public ChangeRoleUseCase(SessionStore store, SessionLocks locks, SessionBroadcaster broadcaster) {
        this.writer = new SessionWriter(store, locks, broadcaster);
    }

    public void changeRole(String sessionId, UUID participantId, Role role) {
        if (writer.apply(sessionId, participantId, session -> session.changeRole(participantId, role))) {
            // Ni pseudo, ni identifiant de session (le lien) dans les journaux.
            LOG.info("Participant {} changed role", participantId);
        }
    }
}
