package com.planningpoker.adapter.in.rest;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.planningpoker.application.CheckSessionUseCase;
import com.planningpoker.application.CreateSessionResult;
import com.planningpoker.application.CreateSessionUseCase;
import com.planningpoker.application.JoinSessionResult;
import com.planningpoker.application.JoinSessionUseCase;

import jakarta.servlet.http.HttpServletRequest;

/**
 * {@code POST /api/sessions} (createSession), {@code GET /api/sessions/{sessionId}} (checkSession) et
 * {@code POST /api/sessions/{sessionId}/participants} (joinSession).
 */
@RestController
public class SessionController {

    private final CreateSessionUseCase createSession;
    private final CheckSessionUseCase checkSession;
    private final JoinSessionUseCase joinSession;
    private final CreationRateLimiter creationRateLimiter;

    public SessionController(CreateSessionUseCase createSession, CheckSessionUseCase checkSession,
            JoinSessionUseCase joinSession, CreationRateLimiter creationRateLimiter) {
        this.createSession = createSession;
        this.checkSession = checkSession;
        this.joinSession = joinSession;
        this.creationRateLimiter = creationRateLimiter;
    }

    /**
     * Ordre : corps malformé (400) → trop de créations depuis cette IP (429) → pseudo invalide (400) → trop de
     * sessions (503). Seule une création réussie compte pour l'IP.
     */
    @PostMapping("/api/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateSessionResponse create(@RequestBody CreateSessionRequest request, HttpServletRequest http) {
        if (!request.isWellFormed()) {
            throw new MalformedRequestException();
        }
        CreationRateLimiter.Slot slot = creationRateLimiter.acquire(ClientAddress.of(http));
        CreateSessionResult result;
        try {
            result = createSession.create(request.pseudo(), request.role());
        } catch (RuntimeException e) {
            creationRateLimiter.release(slot);
            throw e;
        }
        return new CreateSessionResponse(result.sessionId(), result.participantId().toString(),
                result.participantToken());
    }

    /** 204 si la session existe ; un identifiant de forme invalide est une session inconnue (404). */
    @GetMapping("/api/sessions/{sessionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void check(@PathVariable String sessionId) {
        checkSession.check(sessionId);
    }

    /**
     * Ordre : corps malformé (400) → session inconnue (404) → pseudo invalide (400) → pseudo pris (409
     * {@code PSEUDO_TAKEN}) → session pleine (409 {@code SESSION_FULL}).
     */
    @PostMapping("/api/sessions/{sessionId}/participants")
    public JoinSessionResponse join(@PathVariable String sessionId, @RequestBody JoinSessionRequest request) {
        if (!request.isWellFormed()) {
            throw new MalformedRequestException();
        }
        JoinSessionResult result = joinSession.join(sessionId, request.pseudo(), request.role());
        return new JoinSessionResponse(result.participantId().toString(), result.participantToken());
    }
}
