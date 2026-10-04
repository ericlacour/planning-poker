package com.planningpoker.adapter.in.rest;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.unit.DataSize;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.json.JsonMapper;

/**
 * Corps des deux routes {@code POST} limité à {@code planning-poker.max-request-body} ({@code 413}, problem+json
 * sans {@code code}). Un {@code Content-Length} au-delà de la limite est refusé sans rien lire ; sans
 * {@code Content-Length}, au plus limite + 1 octets sont lus. Le corps accepté est rejoué tel quel à la suite.
 * <p>
 * Le filtre passe avant le {@code DispatcherServlet} : la réponse {@code 413} ne porte pas d'en-têtes CORS. Le front
 * n'envoie jamais un tel corps et l'afficherait comme une erreur réseau.
 */
@Component
public class RequestBodyLimitFilter extends OncePerRequestFilter {

    static final String DETAIL = "Request body too large.";

    private static final Logger LOG = LoggerFactory.getLogger(RequestBodyLimitFilter.class);
    private static final Pattern LIMITED_PATHS = Pattern.compile("^/api/sessions(/[^/]+/participants)?$");

    private final long maxBytes;
    private final JsonMapper jsonMapper;

    public RequestBodyLimitFilter(@Value("${planning-poker.max-request-body:2KB}") DataSize maxRequestBody,
            JsonMapper jsonMapper) {
        this.maxBytes = maxRequestBody.toBytes();
        this.jsonMapper = jsonMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Chemin décodé, sans paramètres « ; » : celui que Spring route vers le contrôleur.
        String path = UrlPathHelper.defaultInstance.getPathWithinApplication(request);
        return !"POST".equals(request.getMethod()) || !LIMITED_PATHS.matcher(path).matches();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getContentLengthLong() > maxBytes) {
            refuse(request, response);
            return;
        }
        byte[] body = request.getInputStream().readNBytes((int) Math.min(maxBytes + 1, Integer.MAX_VALUE));
        if (body.length > maxBytes) {
            refuse(request, response);
            return;
        }
        chain.doFilter(new BufferedBodyRequest(request, body), response);
    }

    private void refuse(HttpServletRequest request, HttpServletResponse response) throws IOException {
        // Une ligne par refus, sans IP, pseudo, jeton ni identifiant de session.
        LOG.info("Request refused: body too large");
        HttpStatus status = HttpStatus.CONTENT_TOO_LARGE;
        Map<String, Object> problem = new LinkedHashMap<>();
        problem.put("type", RestErrorHandler.ABOUT_BLANK.toString());
        problem.put("title", status.getReasonPhrase());
        problem.put("status", status.value());
        problem.put("detail", DETAIL);
        problem.put("instance", request.getRequestURI());
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setHeader("Connection", "close");
        response.getOutputStream().write(jsonMapper.writeValueAsBytes(problem));
    }

    /** Requête dont le corps, déjà lu dans la limite, est rejoué depuis la mémoire. */
    private static final class BufferedBodyRequest extends HttpServletRequestWrapper {

        private final byte[] body;

        BufferedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream in = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public int read() throws IOException {
                    return in.read();
                }

                @Override
                public int read(byte[] b, int off, int len) throws IOException {
                    return in.read(b, off, len);
                }

                @Override
                public boolean isFinished() {
                    return in.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException();
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            String encoding = getCharacterEncoding();
            Charset charset = encoding != null ? Charset.forName(encoding) : StandardCharsets.UTF_8;
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }

        @Override
        public int getContentLength() {
            return body.length;
        }

        @Override
        public long getContentLengthLong() {
            return body.length;
        }
    }
}
