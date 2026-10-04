package com.planningpoker.adapter.in.rest;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

/** Lecture de l'IP cliente : Cloudflare, puis le dernier mandataire, puis la connexion ; jamais l'entrée du client. */
class ClientAddressTest {

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/sessions");
        request.setRemoteAddr("10.0.0.9");
        return request;
    }

    @Test
    void withoutProxyHeaderItIsTheConnectionAddress() {
        assertThat(ClientAddress.of(request())).isEqualTo("10.0.0.9");
    }

    @Test
    void cloudflareHeaderWinsOverEverything() {
        MockHttpServletRequest request = request();
        request.addHeader("CF-Connecting-IP", " 203.0.113.7 ");
        request.addHeader("X-Forwarded-For", "198.51.100.1, 198.51.100.2");
        assertThat(ClientAddress.of(request)).isEqualTo("203.0.113.7");
    }

    @Test
    void otherwiseItIsTheLastForwardedForEntry() {
        MockHttpServletRequest request = request();
        request.addHeader("X-Forwarded-For", "198.51.100.1, 198.51.100.2");
        assertThat(ClientAddress.of(request)).isEqualTo("198.51.100.2");
    }

    @Test
    void aForwardedForForgedByTheClientDoesNotChangeTheAddress() {
        // Le client écrit l'en-tête ; le mandataire (Render) y ajoute l'adresse réelle en dernier.
        MockHttpServletRequest first = request();
        first.addHeader("X-Forwarded-For", "1.1.1.1, 203.0.113.7");
        MockHttpServletRequest second = request();
        second.addHeader("X-Forwarded-For", "2.2.2.2, 3.3.3.3, 203.0.113.7");
        assertThat(ClientAddress.of(first)).isEqualTo("203.0.113.7").isEqualTo(ClientAddress.of(second));
    }

    @Test
    void severalForwardedForHeadersAreReadAsOneList() {
        MockHttpServletRequest request = request();
        request.addHeader("X-Forwarded-For", "1.1.1.1");
        request.addHeader("X-Forwarded-For", "203.0.113.7 , ");
        assertThat(ClientAddress.of(request)).isEqualTo("203.0.113.7");
    }

    @Test
    void blankHeadersAreIgnored() {
        MockHttpServletRequest request = request();
        request.addHeader("CF-Connecting-IP", "  ");
        request.addHeader("X-Forwarded-For", " , ");
        assertThat(ClientAddress.of(request)).isEqualTo("10.0.0.9");
    }
}
