package com.planningpoker.adapter.in.rest;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.planningpoker.application.CreateSessionResult;
import com.planningpoker.application.CreateSessionUseCase;

/** {@code POST /api/sessions} (contrat : createSession). */
@RestController
public class SessionController {

    private final CreateSessionUseCase createSession;

    public SessionController(CreateSessionUseCase createSession) {
        this.createSession = createSession;
    }

    @PostMapping("/api/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public CreateSessionResponse create(@RequestBody CreateSessionRequest request) {
        if (!request.isWellFormed()) {
            throw new MalformedRequestException();
        }
        CreateSessionResult result = createSession.create(request.pseudo(), request.role());
        return new CreateSessionResponse(result.sessionId(), result.participantId().toString(),
                result.participantToken());
    }
}
