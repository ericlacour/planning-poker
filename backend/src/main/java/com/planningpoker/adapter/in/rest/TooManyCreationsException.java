package com.planningpoker.adapter.in.rest;

/** Trop de créations depuis cette IP cliente : {@code 429 TOO_MANY_REQUESTS} avec {@code Retry-After}. */
class TooManyCreationsException extends RuntimeException {

    private final long retryAfterSeconds;

    TooManyCreationsException(long retryAfterSeconds) {
        super("Too many sessions created from your network.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
