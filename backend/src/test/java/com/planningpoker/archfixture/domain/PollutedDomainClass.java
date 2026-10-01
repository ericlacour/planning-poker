package com.planningpoker.archfixture.domain;

import org.springframework.context.ApplicationContext;

/**
 * Classe volontairement fautive, utilisée par ArchitectureTest pour prouver que la règle AD-1 échoue.
 * Elle dépend de Spring sans être un composant, pour ne jamais entrer dans le contexte des tests.
 */
public class PollutedDomainClass {

    ApplicationContext context;
}
