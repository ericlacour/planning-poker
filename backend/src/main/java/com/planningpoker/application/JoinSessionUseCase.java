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

/**
 * Fait entrer un participant dans une session existante par son lien (FR-2), puis diffuse le nouvel état à ceux qui
 * y sont déjà connectés (AD-3). L'heure n'est lue que par {@link Clock}.
 */
public class JoinSessionUseCase {

    private static final Logger LOG = LoggerFactory.getLogger(JoinSessionUseCase.class);

    private final SessionStore store;
    private final SessionLocks locks;
    private final IdGenerator ids;
    private final SessionBroadcaster broadcaster;
    private final Clock clock;

    public JoinSessionUseCase(SessionStore store, SessionLocks locks, IdGenerator ids,
            SessionBroadcaster broadcaster, Clock clock) {
        this.store = store;
        this.locks = locks;
        this.ids = ids;
        this.broadcaster = broadcaster;
        this.clock = clock;
    }

    /**
     * Vérifie dans cet ordre : session inconnue, pseudo invalide, pseudo pris. Un pseudo porté par un participant
     * sans aucune connexion ouverte est repris depuis cet autre appareil (FR-8, AD-7) : le résultat porte alors
     * l'identifiant du participant repris et son nouveau jeton ; seul le jeton change, rien n'est diffusé.
     *
     * @throws SessionNotFoundException                         si la session est inconnue
     * @throws com.planningpoker.domain.InvalidPseudoException si le pseudo est vide ou trop long une fois normalisé
     * @throws com.planningpoker.domain.PseudoTakenException   si le pseudo est porté par un participant connecté
     */
    public JoinSessionResult join(String sessionId, String rawPseudo, Role role) {
        if (sessionId == null) {
            throw new SessionNotFoundException();
        }
        UUID newcomerId = ids.newParticipantId();
        String token = ids.newParticipantToken();
        UUID participantId = locks.withLock(sessionId, () -> {
            Session session = store.find(sessionId).orElseThrow(SessionNotFoundException::new);
            Pseudo pseudo = Pseudo.of(rawPseudo);
            Session joined = session.join(newcomerId, pseudo, role, ParticipantToken.of(token), clock.instant());
            store.save(joined);
            if (joined.version() != session.version()) {
                broadcaster.publish(joined);
            }
            return joined.participantWithToken(token)
                    .orElseThrow(() -> new IllegalStateException("joined participant not found"))
                    .id();
        });
        // Ni jeton, ni pseudo, ni identifiant de session (le lien) dans les journaux.
        if (participantId.equals(newcomerId)) {
            LOG.info("Participant {} joined a session", participantId);
        } else {
            LOG.info("Participant {} took over their place from another device", participantId);
        }
        return new JoinSessionResult(participantId, token);
    }
}
