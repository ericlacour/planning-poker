package com.planningpoker.domain;

/** Tour caché ou révélé. Seul le tour caché existe tant que la révélation n'est pas livrée (story 1.7). */
public enum RoundStatus {
    HIDDEN,
    REVEALED
}
