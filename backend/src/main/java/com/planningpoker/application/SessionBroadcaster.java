package com.planningpoker.application;

import java.util.UUID;

import com.planningpoker.domain.Session;

/**
 * Port de diffusion des instantanés et registre des connexions ouvertes (AD-3, AD-5). Toutes ses méthodes sont
 * appelées sous le verrou de la session et ne bloquent jamais : l'envoi se fait hors du verrou.
 * Une connexion est désignée par un identifiant opaque fourni par l'adaptateur.
 */
public interface SessionBroadcaster {

    /** Rattache la connexion au participant : elle recevra désormais les instantanés de la session. */
    void attach(String connectionId, String sessionId, UUID participantId);

    /** Détache la connexion ; renvoie vrai si elle était rattachée (une seule fois par connexion). */
    boolean detach(String connectionId);

    /** Construit l'instantané de chaque connexion rattachée à la session et le met en file d'envoi. */
    void publish(Session session);

    /** Construit l'instantané d'une seule connexion rattachée et le met en file d'envoi. */
    void publishTo(Session session, String connectionId);
}
