package com.planningpoker.domain;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Optional;

/**
 * Une carte ({@code card.json}). Seul le front affiche {@code coffee} en ☕. L'ordre de déclaration est l'ordre du
 * jeu : il départage les égalités et situe le minimum et le maximum d'un tour.
 */
public enum Card {
    ZERO("0"),
    HALF("0.5"),
    ONE("1"),
    TWO("2"),
    THREE("3"),
    FIVE("5"),
    EIGHT("8"),
    THIRTEEN("13"),
    TWENTY_ONE("21"),
    UNKNOWN("?"),
    COFFEE("coffee"),
    XXS("XXS"),
    XS("XS"),
    S("S"),
    M("M"),
    L("L"),
    XL("XL"),
    XXL("XXL");

    private final String value;

    Card(String value) {
        this.value = value;
    }

    /** Valeur numérique de la carte ; vide pour {@code ?}, {@code coffee} et les tailles. */
    public Optional<BigDecimal> numericValue() {
        return value.matches("\\d+(\\.\\d+)?") ? Optional.of(new BigDecimal(value)) : Optional.empty();
    }

    public boolean isNumeric() {
        return numericValue().isPresent();
    }

    /** Vrai pour une taille de tee-shirt ({@code XXS} à {@code XXL}). */
    public boolean isSize() {
        return ordinal() >= XXS.ordinal();
    }

    /** Vrai si la carte compte dans la synthèse (minimum, maximum, plus votée) : tout sauf {@code ?} et {@code coffee}. */
    public boolean isRanked() {
        return isNumeric() || isSize();
    }

    /** Valeur échangée dans le contrat. */
    public String value() {
        return value;
    }

    /** La carte de cette valeur, si elle existe (comparaison exacte). */
    public static Optional<Card> of(String value) {
        return Arrays.stream(values()).filter(c -> c.value.equals(value)).findFirst();
    }
}
