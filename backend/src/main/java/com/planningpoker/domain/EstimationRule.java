package com.planningpoker.domain;

/**
 * Règle de proposition d'une estimation après la révélation ({@code common.json#/$defs/estimationRule}), choisie à
 * la création de la session et figée ensuite, comme le jeu de cartes. La proposition n'est qu'une suggestion :
 * rien n'est retenu.
 */
public enum EstimationRule {
    /** Aucune proposition (règle par défaut). */
    NONE,
    /** La carte maximale votée. */
    MAX,
    /**
     * La médiane des votes classés (la carte supérieure des deux du milieu pour un nombre pair), seulement si le
     * minimum et le maximum sont à {@value Summary#MAX_MEDIAN_LEVELS} niveaux au plus dans le jeu de la session.
     */
    MEDIAN,
    /** La carte du jeu juste sous le maximum voté, même si personne ne l'a votée. */
    BELOW_MAX
}
