package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class ParticipantTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");

    private static Participant withJoinOrder(int joinOrder) {
        return new Participant(UUID.randomUUID(), Pseudo.of("Sofia"), Role.VOTER, joinOrder,
                ParticipantToken.of("secret"), NOW);
    }

    private static Participant withConnections(Map<String, Instant> connections, Instant offlineSince) {
        return new Participant(UUID.randomUUID(), Pseudo.of("Sofia"), Role.VOTER, 1, ParticipantToken.of("secret"),
                connections, offlineSince);
    }

    @Test
    void theContractRequiresAJoinOrderOfAtLeastOne() {
        assertThatThrownBy(() -> withJoinOrder(0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> withJoinOrder(-1)).isInstanceOf(IllegalArgumentException.class);
        assertThat(withJoinOrder(1).joinOrder()).isEqualTo(1);
    }

    @Test
    void offlineSinceIsSetExactlyWhenThereIsNoConnection() {
        assertThatThrownBy(() -> withConnections(Map.of("c1", NOW), NOW))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> withConnections(Map.of(), null)).isInstanceOf(IllegalArgumentException.class);
        assertThat(withConnections(Map.of("c1", NOW), null).offlineSince()).isNull();
        assertThat(withConnections(Map.of(), NOW).offlineSince()).isEqualTo(NOW);
    }

    @Test
    void closingTheLastConnectionSetsOfflineSinceButNotClosingAnother() {
        Instant later = NOW.plusSeconds(30);
        Participant twoTabs = withJoinOrder(1).withActivity("c1", NOW).withActivity("c2", NOW);

        Participant oneTab = twoTabs.withoutConnection("c1", later);
        assertThat(oneTab.connected()).isTrue();
        assertThat(oneTab.offlineSince()).isNull();

        Participant offline = oneTab.withoutConnection("c2", later);
        assertThat(offline.connected()).isFalse();
        assertThat(offline.offlineSince()).isEqualTo(later);
    }
}
