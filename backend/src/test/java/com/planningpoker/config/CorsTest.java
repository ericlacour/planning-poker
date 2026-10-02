package com.planningpoker.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "planning-poker.allowed-origins=https://front.example, http://localhost:4200/")
class CorsTest {

    @LocalServerPort
    int port;

    private HttpResponse<String> preflight(String origin) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/health"))
                .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                .header("Origin", origin)
                .header("Access-Control-Request-Method", "GET")
                .build();
        return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void allowsAConfiguredOrigin() throws Exception {
        HttpResponse<String> response = preflight("https://front.example");
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).hasValue("https://front.example");
    }

    @Test
    void normalizesSpacesAndTrailingSlash() throws Exception {
        assertThat(preflight("http://localhost:4200").headers().firstValue("Access-Control-Allow-Origin"))
                .hasValue("http://localhost:4200");
    }

    @Test
    void rejectsAnUnknownOrigin() throws Exception {
        HttpResponse<String> response = preflight("https://evil.example");
        assertThat(response.statusCode()).isEqualTo(403);
        assertThat(response.headers().firstValue("Access-Control-Allow-Origin")).isEmpty();
    }
}
