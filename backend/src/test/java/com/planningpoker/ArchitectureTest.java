package com.planningpoker;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;

/** AD-1 : domaine pur et sens des dépendances de l'architecture hexagonale. */
class ArchitectureTest {

    private static final JavaClasses PRODUCTION = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.planningpoker");

    static ArchRule domainIsPure(String root) {
        return noClasses().that().resideInAPackage(root + ".domain..")
                .should().dependOnClassesThat().resideInAnyPackage(
                        "org.springframework..", "tools.jackson..", "com.fasterxml.jackson..", "jakarta..")
                .allowEmptyShould(true)
                .because("le domaine est en Java pur (AD-1)");
    }

    static ArchRule layersAreRespected(String root) {
        return layeredArchitecture().consideringOnlyDependenciesInLayers()
                .withOptionalLayers(true)
                .layer("Domain").definedBy(root + ".domain..")
                .layer("Application").definedBy(root + ".application..")
                .layer("AdapterIn").definedBy(root + ".adapter.in..")
                .layer("AdapterOut").definedBy(root + ".adapter.out..")
                .layer("Config").definedBy(root + ".config..")
                .whereLayer("Config").mayNotBeAccessedByAnyLayer()
                .whereLayer("AdapterIn").mayOnlyBeAccessedByLayers("Config")
                .whereLayer("AdapterOut").mayOnlyBeAccessedByLayers("Config")
                .whereLayer("Application").mayOnlyBeAccessedByLayers("AdapterIn", "AdapterOut", "Config")
                .whereLayer("Domain").mayOnlyBeAccessedByLayers("Application", "AdapterIn", "AdapterOut", "Config");
    }

    @Test
    void domainDependsOnNoFramework() {
        domainIsPure("com.planningpoker").check(PRODUCTION);
    }

    @Test
    void layersOnlyDependInwards() {
        layersAreRespected("com.planningpoker").check(PRODUCTION);
    }

    @Test
    void aDomainClassImportingSpringBreaksTheBuild() {
        JavaClasses fixture = new ClassFileImporter().importPackages("com.planningpoker.archfixture");
        assertThatThrownBy(() -> domainIsPure("com.planningpoker.archfixture").check(fixture))
                .isInstanceOf(AssertionError.class)
                .hasMessageContaining("PollutedDomainClass");
    }
}
