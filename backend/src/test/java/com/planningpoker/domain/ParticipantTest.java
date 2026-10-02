package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.Test;

class ParticipantTest {

    private static Participant withJoinOrder(int joinOrder) {
        return new Participant(UUID.randomUUID(), Pseudo.of("Sofia"), Role.VOTER, joinOrder,
                ParticipantToken.of("secret"));
    }

    @Test
    void theContractRequiresAJoinOrderOfAtLeastOne() {
        assertThatThrownBy(() -> withJoinOrder(0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> withJoinOrder(-1)).isInstanceOf(IllegalArgumentException.class);
        assertThat(withJoinOrder(1).joinOrder()).isEqualTo(1);
    }
}
