package com.planningpoker.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import tools.jackson.databind.cfg.CoercionAction;
import tools.jackson.databind.cfg.CoercionInputShape;
import tools.jackson.databind.cfg.EnumFeature;
import tools.jackson.databind.type.LogicalType;

/** Contrat d'abord (AD-6) : un nombre ou un booléen n'est jamais lu comme un texte, ni un nombre comme un rôle. */
@Configuration
public class JacksonConfig {

    @Bean
    public JsonMapperBuilderCustomizer strictTextualCoercion() {
        return builder -> builder.enable(EnumFeature.FAIL_ON_NUMBERS_FOR_ENUMS).withCoercionConfig(LogicalType.Textual, config -> config
                .setCoercion(CoercionInputShape.Integer, CoercionAction.Fail)
                .setCoercion(CoercionInputShape.Float, CoercionAction.Fail)
                .setCoercion(CoercionInputShape.Boolean, CoercionAction.Fail));
    }
}
