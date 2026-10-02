package com.planningpoker.adapter.in.rest;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** {@code GET /api/health} : sonde de réveil du front et sonde de santé de Render (contrat : getHealth). */
@RestController
public class HealthController {

    public record HealthResponse(String status) {
    }

    private static final HealthResponse UP = new HealthResponse("UP");

    @GetMapping("/api/health")
    public HealthResponse health() {
        return UP;
    }
}
