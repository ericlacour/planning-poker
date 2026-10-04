package com.planningpoker.config;

import java.time.Clock;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.planningpoker.adapter.in.rest.CreationRateLimiter;

@Configuration
@EnableConfigurationProperties(AllowedOrigins.class)
public class WebConfig implements WebMvcConfigurer {

    private final AllowedOrigins allowedOrigins;

    public WebConfig(AllowedOrigins allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins.asArray())
                .allowedMethods("GET", "POST")
                .allowedHeaders("Content-Type");
    }

    /** Créations de session par IP cliente sur une fenêtre glissante (429). */
    @Bean
    public CreationRateLimiter creationRateLimiter(Clock clock,
            @Value("${planning-poker.max-creations-per-ip:10}") int maxCreationsPerIp,
            @Value("${planning-poker.creation-window:1m}") Duration creationWindow) {
        return new CreationRateLimiter(clock, maxCreationsPerIp, creationWindow);
    }

    /** Toute lecture de l'heure passe par cette horloge, en UTC (AD-8). */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
