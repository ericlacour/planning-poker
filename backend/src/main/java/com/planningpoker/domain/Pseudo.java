package com.planningpoker.domain;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Pseudo normalisé : Unicode NFC, espaces Unicode de début et de fin retirés ({@link String#strip()}),
 * 1 à 20 points de code. Deux pseudos sont « le même » quand leurs {@link #uniquenessKey() clés} sont égales.
 */
public record Pseudo(String value) {

    public static final int MAX_CODE_POINTS = 20;

    public Pseudo {
        if (value == null) {
            throw new InvalidPseudoException();
        }
        int length = value.codePointCount(0, value.length());
        if (length < 1 || length > MAX_CODE_POINTS || !value.equals(normalize(value))) {
            throw new InvalidPseudoException();
        }
    }

    /** Normalise le pseudo tel que saisi, ou lève {@link InvalidPseudoException}. */
    public static Pseudo of(String raw) {
        if (raw == null) {
            throw new InvalidPseudoException();
        }
        return new Pseudo(normalize(raw));
    }

    private static String normalize(String raw) {
        return Normalizer.normalize(raw, Normalizer.Form.NFC).strip();
    }

    /** Clé d'unicité dans une session : insensible à la casse, indépendante de la langue. */
    public String uniquenessKey() {
        return value.toLowerCase(Locale.ROOT);
    }

    /** Jamais le pseudo lui-même : il ne doit pas finir dans un journal. */
    @Override
    public String toString() {
        return "Pseudo[" + value.codePointCount(0, value.length()) + " code points]";
    }
}
