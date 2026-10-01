package com.planningpoker.config;

import java.time.Clock;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

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

    /** Toute lecture de l'heure passe par cette horloge, en UTC (AD-8). */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
