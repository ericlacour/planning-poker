package com.planningpoker.config;

import java.security.SecureRandom;
import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.planningpoker.adapter.out.memory.InMemorySessionStore;
import com.planningpoker.application.CheckSessionUseCase;
import com.planningpoker.application.CreateSessionUseCase;
import com.planningpoker.application.JoinSessionUseCase;
import com.planningpoker.application.RoundUseCase;
import com.planningpoker.application.SessionBroadcaster;
import com.planningpoker.application.SessionConnectionUseCase;
import com.planningpoker.application.SessionLocks;
import com.planningpoker.application.SessionStore;
import com.planningpoker.application.VoteUseCase;
import com.planningpoker.domain.IdGenerator;

/** Assemblage des sessions : aléa sûr, stockage en mémoire, verrous et cas d'usage (diffusion : adaptateur WS). */
@Configuration
public class SessionConfig {

    @Bean
    public SecureRandom secureRandom() {
        return new SecureRandom();
    }

    @Bean
    public IdGenerator idGenerator(SecureRandom secureRandom) {
        return new IdGenerator(secureRandom);
    }

    @Bean
    public SessionStore sessionStore() {
        return new InMemorySessionStore();
    }

    @Bean
    public SessionLocks sessionLocks() {
        return new SessionLocks();
    }

    @Bean
    public CreateSessionUseCase createSessionUseCase(SessionStore store, SessionLocks locks, IdGenerator ids,
            Clock clock) {
        return new CreateSessionUseCase(store, locks, ids, clock);
    }

    @Bean
    public CheckSessionUseCase checkSessionUseCase(SessionStore store) {
        return new CheckSessionUseCase(store);
    }

    @Bean
    public JoinSessionUseCase joinSessionUseCase(SessionStore store, SessionLocks locks, IdGenerator ids,
            SessionBroadcaster broadcaster) {
        return new JoinSessionUseCase(store, locks, ids, broadcaster);
    }

    @Bean
    public SessionConnectionUseCase sessionConnectionUseCase(SessionStore store, SessionLocks locks,
            SessionBroadcaster broadcaster) {
        return new SessionConnectionUseCase(store, locks, broadcaster);
    }

    @Bean
    public VoteUseCase voteUseCase(SessionStore store, SessionLocks locks, SessionBroadcaster broadcaster) {
        return new VoteUseCase(store, locks, broadcaster);
    }

    @Bean
    public RoundUseCase roundUseCase(SessionStore store, SessionLocks locks, IdGenerator ids,
            SessionBroadcaster broadcaster) {
        return new RoundUseCase(store, locks, ids, broadcaster);
    }
}
