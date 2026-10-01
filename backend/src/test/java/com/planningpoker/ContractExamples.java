package com.planningpoker;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Accès aux exemples du contrat ({@code contract/examples}), source de vérité des échanges (AD-6). */
public final class ContractExamples {

    private static final Path ROOT = Path.of("..", "contract", "examples");

    private ContractExamples() {
    }

    public static String read(String schema, String example) throws IOException {
        return Files.readString(ROOT.resolve(schema).resolve(example + ".json"));
    }
}
