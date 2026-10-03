package com.planningpoker.adapter.out.memory;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.planningpoker.domain.ParticipantToken;
import com.planningpoker.domain.Pseudo;
import com.planningpoker.domain.Role;
import com.planningpoker.domain.Session;

class InMemorySessionStoreTest {

    private static Session session(String id) {
        return Session.create(id, "round", UUID.randomUUID(), Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("t"), Instant.EPOCH);
    }

    @Test
    void findsSavesListsAndDeletes() {
        InMemorySessionStore store = new InMemorySessionStore();
        assertThat(store.find("a")).isEmpty();

        store.save(session("a"));
        store.save(session("b"));
        assertThat(store.find("a")).hasValueSatisfying(s -> assertThat(s.id()).isEqualTo("a"));
        assertThat(store.all()).extracting(Session::id).containsExactlyInAnyOrder("a", "b");

        store.delete("a");
        assertThat(store.find("a")).isEmpty();
        assertThat(store.all()).extracting(Session::id).containsExactly("b");
    }
}
