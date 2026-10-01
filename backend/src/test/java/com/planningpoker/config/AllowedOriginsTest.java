package com.planningpoker.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AllowedOriginsTest {

    @Test
    void readsANormalizedListOfOrigins() {
        assertThat(new AllowedOrigins(" HTTPS://Front.Example/ , http://localhost:4200,").asList())
                .containsExactly("https://front.example", "http://localhost:4200");
    }

    @Test
    void acceptsNoOriginByDefault() {
        assertThat(new AllowedOrigins(null).asList()).isEmpty();
        assertThat(new AllowedOrigins("").asList()).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = { "*", "https://*.example", "https://front.example/app", "front.example",
            "ftp://front.example", "https://front.example?x=1", "https://user@front.example" })
    void rejectsAnythingThatIsNotAnOrigin(String entry) {
        assertThatThrownBy(() -> new AllowedOrigins(entry).asList())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ALLOWED_ORIGINS");
    }
}
