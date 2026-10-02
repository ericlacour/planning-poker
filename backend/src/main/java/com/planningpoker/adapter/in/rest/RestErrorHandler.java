package com.planningpoker.adapter.in.rest;

import java.net.URI;

import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import com.planningpoker.application.SessionNotFoundException;
import com.planningpoker.domain.InvalidPseudoException;
import com.planningpoker.domain.PseudoTakenException;

/**
 * Erreurs REST en {@code application/problem+json} (RFC 9457), conformes à {@code problem.json} :
 * {@code type} toujours présent, propriété {@code code} pour les erreurs métier. Un corps illisible (JSON invalide,
 * rôle inconnu, champ en trop) est traité par la classe mère : 400 sans {@code code}.
 */
@RestControllerAdvice
public class RestErrorHandler extends ResponseEntityExceptionHandler {

    static final String CODE = "code";
    static final URI ABOUT_BLANK = URI.create("about:blank");

    @ExceptionHandler(InvalidPseudoException.class)
    ProblemDetail invalidPseudo() {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Invalid pseudo.");
        problem.setProperty(CODE, "INVALID_PSEUDO");
        return problem;
    }

    @ExceptionHandler(SessionNotFoundException.class)
    ProblemDetail sessionNotFound(SessionNotFoundException e) {
        ProblemDetail problem = problem(HttpStatus.NOT_FOUND, e.getMessage());
        problem.setProperty(CODE, "SESSION_NOT_FOUND");
        return problem;
    }

    @ExceptionHandler(PseudoTakenException.class)
    ProblemDetail pseudoTaken(PseudoTakenException e) {
        ProblemDetail problem = problem(HttpStatus.CONFLICT, e.getMessage());
        problem.setProperty(CODE, "PSEUDO_TAKEN");
        return problem;
    }

    @ExceptionHandler(MalformedRequestException.class)
    ProblemDetail malformed(MalformedRequestException e) {
        return problem(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    /** Corps illisible : même détail que {@code problem/bad-request-malformed-body.json}. */
    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, MalformedRequestException.DETAIL);
        return handleExceptionInternal(ex, problem, headers, status, request);
    }

    /** Spring 7 omet {@code type} quand il vaut {@code about:blank} ; le contrat l'exige. */
    @Override
    protected ResponseEntity<Object> createResponseEntity(@Nullable Object body, HttpHeaders headers,
            HttpStatusCode statusCode, WebRequest request) {
        if (body instanceof ProblemDetail problem && problem.getType() == null) {
            problem.setType(ABOUT_BLANK);
        }
        return super.createResponseEntity(body, headers, statusCode, request);
    }

    private static ProblemDetail problem(HttpStatus status, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setType(ABOUT_BLANK);
        return problem;
    }
}
