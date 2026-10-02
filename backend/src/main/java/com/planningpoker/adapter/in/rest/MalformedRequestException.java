package com.planningpoker.adapter.in.rest;

/** Corps lisible en JSON mais hors schéma : 400 {@code problem+json} sans {@code code}. */
class MalformedRequestException extends RuntimeException {

    static final String DETAIL = "Failed to read request.";

    MalformedRequestException() {
        super(DETAIL);
    }
}
