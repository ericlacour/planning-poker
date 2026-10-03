package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class PseudoTest {

    @Test
    void stripsSurroundingSpaces() {
        assertThat(Pseudo.of("  Sofia ").value()).isEqualTo("Sofia");
    }

    @Test
    void stripsUnicodeSpacesToo() {
        assertThat(Pseudo.of(" \tSofia　\n").value()).isEqualTo("Sofia");
    }

    @Test
    void keepsInnerSpaces() {
        assertThat(Pseudo.of(" Jean Paul ").value()).isEqualTo("Jean Paul");
    }

    @Test
    void normalizesToNfc() {
        Pseudo pseudo = Pseudo.of("é");
        assertThat(pseudo.value()).isEqualTo("é");
        assertThat(pseudo.value().codePointCount(0, pseudo.value().length())).isEqualTo(1);
    }

    @ParameterizedTest
    @ValueSource(strings = { "", " ", "   ", "\t\n", " " })
    void rejectsAnEmptyPseudo(String raw) {
        assertThatThrownBy(() -> Pseudo.of(raw)).isInstanceOf(InvalidPseudoException.class);
    }

    @Test
    void rejectsNull() {
        assertThatThrownBy(() -> Pseudo.of(null)).isInstanceOf(InvalidPseudoException.class);
    }

    @Test
    void accepts20CodePoints() {
        assertThat(Pseudo.of("a".repeat(20)).value()).hasSize(20);
    }

    @Test
    void rejects21CodePointsAfterNormalization() {
        assertThatThrownBy(() -> Pseudo.of(" " + "a".repeat(21) + " ")).isInstanceOf(InvalidPseudoException.class);
    }

    @Test
    void accepts20EmojisThatAre40Utf16Units() {
        String emojis = "😀".repeat(20);
        assertThat(emojis).hasSize(40);
        assertThat(Pseudo.of(emojis).value()).isEqualTo(emojis);
    }

    @Test
    void rejects21Emojis() {
        assertThatThrownBy(() -> Pseudo.of("😀".repeat(21))).isInstanceOf(InvalidPseudoException.class);
    }

    @Test
    void countsCodePointsAfterNfc() {
        // 20 « é » décomposés font 40 points de code avant NFC, 20 après.
        assertThat(Pseudo.of("é".repeat(20)).value()).isEqualTo("é".repeat(20));
    }

    @Test
    void uniquenessKeyIgnoresCaseWithTheRootLocale() {
        assertThat(Pseudo.of("Sofia").uniquenessKey()).isEqualTo(Pseudo.of(" sOFIA ").uniquenessKey());
        assertThat(Pseudo.of("TITI").uniquenessKey()).isEqualTo("titi");
    }

    @Test
    void theConstructorOnlyAcceptsANormalizedValue() {
        assertThatThrownBy(() -> new Pseudo(" Sofia")).isInstanceOf(InvalidPseudoException.class);
        assertThatThrownBy(() -> new Pseudo("é")).isInstanceOf(InvalidPseudoException.class);
    }

    @Test
    void toStringDoesNotRevealThePseudo() {
        assertThat(Pseudo.of("Sofia").toString()).doesNotContain("Sofia");
    }
}
