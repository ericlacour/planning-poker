package com.planningpoker.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Reprise de sa place depuis un autre appareil (FR-8, AD-7). */
class SessionTakeOverTest {

    private static final Instant NOW = Instant.parse("2026-10-02T09:00:00Z");
    private static final Instant LATER = NOW.plusSeconds(90);
    private static final Duration ABSENCE = Duration.ofMinutes(5);
    private static final String ROUND = "round-1";
    private static final UUID ALICE = UUID.fromString("3f6c2a1e-8b4d-4c7a-9e2f-1d5b6a7c8e90");
    private static final UUID BOB = UUID.fromString("7d2e9f4a-1c3b-4e5d-8a6f-2b9c0d1e3f45");
    private static final UUID NEWCOMER = UUID.fromString("0c8b5d3e-6f2a-4b1c-9d7e-5a4f3b2c1d06");

    /** Alice et « Bob » votent, tous deux connectés ; Bob a voté 5. */
    private static Session table() {
        return Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", ROUND, ALICE, Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("alice"), NOW)
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob-old"), NOW)
                .connect(ALICE, "alice-1", NOW)
                .connect(BOB, "bob-1", NOW)
                .vote(BOB, ROUND, "5");
    }

    /** Bob a fermé son dernier onglet à {@code NOW}. */
    private static Session bobOffline() {
        return table().disconnect(BOB, "bob-1", NOW);
    }

    private static Session takeOver(Session session, String pseudo, Role role) {
        return session.join(NEWCOMER, Pseudo.of(pseudo), role, ParticipantToken.of("bob-new"), LATER);
    }

    @ParameterizedTest
    @ValueSource(strings = { "Bob", "bob", " BOB  " })
    void aDisconnectedParticipantIsTakenOverIgnoringCaseAndSpaces(String pseudo) {
        Session before = bobOffline();
        Session taken = takeOver(before, pseudo, Role.VOTER);

        assertThat(taken.participants()).hasSize(2);
        assertThat(taken.participant(NEWCOMER)).isEmpty();
        assertThat(taken.participantWithToken("bob-new")).map(Participant::id).contains(BOB);
    }

    @Test
    void theTakenOverParticipantKeepsEverythingButHisToken() {
        Session before = bobOffline();
        Participant old = before.participant(BOB).orElseThrow();

        Session taken = takeOver(before, "bob", Role.OBSERVER);

        Participant bob = taken.participant(BOB).orElseThrow();
        assertThat(bob.pseudo().value()).isEqualTo("Bob");
        assertThat(bob.role()).isEqualTo(Role.VOTER);
        assertThat(bob.joinOrder()).isEqualTo(old.joinOrder());
        assertThat(bob.connected()).isFalse();
        assertThat(bob.offlineSince()).isEqualTo(NOW);
        assertThat(taken.voteOf(BOB)).map(Card::value).contains("5");
        assertThat(taken.participants()).extracting(Participant::id).containsExactly(ALICE, BOB);
        assertThat(taken.nextJoinOrder()).isEqualTo(before.nextJoinOrder());
    }

    @Test
    void onlyTheTokenChangesHiddenly() {
        Session before = bobOffline();
        Session taken = takeOver(before, "Bob", Role.VOTER);

        assertThat(taken.version()).isEqualTo(before.version());
        assertThat(taken.lastChange()).isEqualTo(before.lastChange());
        assertThat(SessionSnapshot.forRecipient(taken, ALICE)).isEqualTo(SessionSnapshot.forRecipient(before, ALICE));
    }

    @Test
    void theOldTokenIsRevokedAndTheNewOneDesignatesTheSameParticipant() {
        Session taken = takeOver(bobOffline(), "Bob", Role.VOTER);

        assertThat(taken.participantWithToken("bob-old")).isEmpty();
        assertThat(taken.departedWithToken("bob-old")).isEmpty();
        assertThat(taken.participantWithToken("bob-new")).map(Participant::id).contains(BOB);
    }

    @Test
    void aParticipantWhoNeverConnectedIsTakenOver() {
        Session before = Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", ROUND, ALICE, Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("alice"), NOW)
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob-old"), NOW);

        Session taken = takeOver(before, "Bob", Role.VOTER);

        assertThat(taken.version()).isEqualTo(before.version());
        assertThat(taken.participantWithToken("bob-new")).map(Participant::id).contains(BOB);
        assertThat(taken.participantWithToken("bob-old")).isEmpty();
    }

    @Test
    void aLateArrivalStaysLateAfterTheTakeOver() {
        Session before = Session.create("k3Jx9QvT2mLpZ8wR4nYb7A", ROUND, ALICE, Pseudo.of("Alice"), Role.VOTER,
                ParticipantToken.of("alice"), NOW)
                .reveal(ALICE, ROUND)
                .join(BOB, Pseudo.of("Bob"), Role.VOTER, ParticipantToken.of("bob-old"), NOW);
        assertThat(before.lateArrivals()).containsExactly(BOB);

        Session taken = takeOver(before, "Bob", Role.VOTER);

        assertThat(taken.lateArrivals()).containsExactly(BOB);
        assertThat(taken.canVoteThisRound(taken.participant(BOB).orElseThrow())).isFalse();
    }

    @Test
    void aConnectedParticipantIsNotTakenOver() {
        Session before = table();
        assertThatThrownBy(() -> takeOver(before, "bob", Role.VOTER)).isInstanceOf(PseudoTakenException.class);
        assertThat(before.participantWithToken("bob-old")).map(Participant::id).contains(BOB);
    }

    @Test
    void theAbsenceDelayKeepsRunningUntilTheNewDeviceConnects() {
        Session taken = takeOver(bobOffline(), "Bob", Role.VOTER);

        assertThat(taken.absentParticipants(NOW.plus(ABSENCE).minusMillis(1), ABSENCE)).isEmpty();
        assertThat(taken.absentParticipants(NOW.plus(ABSENCE), ABSENCE)).containsExactly(BOB);
    }

    @Test
    void theNewDeviceConnectsWithTheNewToken() {
        Session taken = takeOver(bobOffline(), "Bob", Role.VOTER);
        UUID id = taken.participantWithToken("bob-new").orElseThrow().id();

        Session connected = taken.connect(id, "bob-2", LATER);

        assertThat(connected.version()).isEqualTo(taken.version() + 1);
        assertThat(connected.lastChange()).isEqualTo(LastChange.of(ChangeAction.PRESENCE, BOB));
        assertThat(connected.participant(BOB).orElseThrow().connected()).isTrue();
        assertThat(connected.voteOf(BOB)).map(Card::value).contains("5");
    }

    @Test
    void aDepartedParticipantIsNotTakenOverHisPseudoIsFree() {
        Session removed = bobOffline().remove(BOB);

        Session joined = takeOver(removed, "Bob", Role.OBSERVER);

        assertThat(joined.version()).isEqualTo(removed.version() + 1);
        assertThat(joined.lastChange()).isEqualTo(LastChange.of(ChangeAction.JOIN, NEWCOMER));
        assertThat(joined.participant(NEWCOMER)).hasValueSatisfying(p -> {
            assertThat(p.role()).isEqualTo(Role.OBSERVER);
            assertThat(p.token().matches("bob-new")).isTrue();
        });
        assertThat(joined.participant(BOB)).isEmpty();
        assertThat(joined.departedWithToken("bob-old")).map(Participant::id).contains(BOB);
    }
}
