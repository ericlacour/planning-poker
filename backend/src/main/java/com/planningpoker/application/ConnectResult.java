package com.planningpoker.application;

import java.util.UUID;

/** Issue de la poignée de main {@code hello} (asyncapi.yaml). */
public sealed interface ConnectResult {

    /** Session inconnue : fermeture {@code 4404}, vérifiée avant le jeton. */
    record SessionNotFound() implements ConnectResult {
    }

    /** Jeton inconnu : fermeture {@code 4401}. */
    record UnknownToken() implements ConnectResult {
    }

    /** La connexion s'est fermée avant d'être rattachée : rien n'a changé. */
    record ConnectionClosed() implements ConnectResult {
    }

    /** Connexion rattachée au participant, qui a reçu son instantané. */
    record Connected(UUID participantId) implements ConnectResult {
    }
}
