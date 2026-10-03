package com.planningpoker.application;

import java.time.Clock;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.planningpoker.domain.IdGenerator;
import com.planningpoker.domain.ParticipantToken;
import com.planningpoker.domain.Pseudo;
import com.planningpoker.domain.Role;
import com.planningpoker.domain.Session;

/** Crée une session et y fait entrer son créateur (FR-1). */
public class CreateSessionUseCase {

    private static final Logger LOG = LoggerFactory.getLogger(CreateSessionUseCase.class);

    private final SessionStore store;
    private final SessionLocks locks;
    private final IdGenerator ids;
    private final Clock clock;

    public CreateSessionUseCase(SessionStore store, SessionLocks locks, IdGenerator ids, Clock clock) {
        this.store = store;
        this.locks = locks;
        this.ids = ids;
        this.clock = clock;
    }

    /**
     * @throws com.planningpoker.domain.InvalidPseudoException si le pseudo est vide ou trop long une fois normalisé
     */
    public CreateSessionResult create(String rawPseudo, Role role) {
        Pseudo pseudo = Pseudo.of(rawPseudo);
        UUID participantId = ids.newParticipantId();
        String token = ids.newParticipantToken();
        while (true) {
            String sessionId = ids.newSessionId();
            boolean created = locks.withLock(sessionId, () -> {
                if (store.find(sessionId).isPresent()) {
                    return false;
                }
                store.save(Session.create(sessionId, ids.newRoundId(), participantId, pseudo, role,
                        ParticipantToken.of(token), clock.instant()));
                return true;
            });
            if (created) {
                // Ni jeton, ni pseudo, ni identifiant de session (le lien) dans les journaux.
                LOG.info("Session created by participant {}", participantId);
                return new CreateSessionResult(sessionId, participantId, token);
            }
        }
    }
}
