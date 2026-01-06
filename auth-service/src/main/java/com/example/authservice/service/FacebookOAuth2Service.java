package com.example.authservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Slf4j
@Service
public class FacebookOAuth2Service {

    @Value("${facebook.client-id}")
    private String clientId;

    @Value("${facebook.client-secret}")
    private String clientSecret;

    @Value("${facebook.redirect-uri}")
    private String redirectUri;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public FacebookOAuth2Service() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }

    public FacebookUserInfo getUserInfoFromCode(String code) {
        try {
            // Exchange authorization code for access token
            String accessToken = exchangeCodeForAccessToken(code);

            // Get user info using access token
            return getUserInfoFromAccessToken(accessToken);

        } catch (Exception e) {
            log.error("Error getting user info from Facebook code", e);
            throw new RuntimeException("Error getting user info from Facebook", e);
        }
    }

    private String exchangeCodeForAccessToken(String code) {
        String tokenUrl = "https://graph.facebook.com/v19.0/oauth/access_token";

        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(tokenUrl)
                .queryParam("client_id", clientId)
                .queryParam("client_secret", clientSecret)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("code", code);

        try {
            ResponseEntity<String> res = restTemplate.getForEntity(builder.toUriString(), String.class);
            JsonNode json = objectMapper.readTree(res.getBody());
            if (res.getStatusCode().is2xxSuccessful()) {
                return json.path("access_token").asText();
            }
            throw new IllegalArgumentException("Facebook token exchange failed");
        } catch (HttpClientErrorException ex) {
            String bodyText = ex.getResponseBodyAsString();
            log.error("Token exchange failed: {}", bodyText);
            throw new IllegalArgumentException("Facebook token exchange failed: " + bodyText, ex);
        } catch (Exception ex) {
            log.error("Unexpected error exchanging token", ex);
            throw new IllegalStateException("Unexpected error exchanging token", ex);
        }
    }

    private FacebookUserInfo getUserInfoFromAccessToken(String accessToken) throws JsonProcessingException {
        // Request fields: id, name, email, picture
        String userInfoUrl = "https://graph.facebook.com/me";
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(userInfoUrl)
                .queryParam("access_token", accessToken)
                .queryParam("fields", "id,name,email,picture");

        ResponseEntity<String> response = restTemplate.getForEntity(builder.toUriString(), String.class);

        JsonNode json = objectMapper.readTree(response.getBody());

        String email = json.has("email") ? json.path("email").asText() : null;
        // Fallback: nếu không có email, dùng ID để tạo fake email (Facebook có thể ko
        // trả email nếu user đk bằng SĐT)
        if (email == null || email.isEmpty()) {
            email = json.path("id").asText() + "@facebook.com";
        }

        String pictureUrl = null;
        if (json.has("picture") && json.path("picture").has("data")) {
            pictureUrl = json.path("picture").path("data").path("url").asText();
        }

        return FacebookUserInfo.builder()
                .id(json.path("id").asText())
                .email(email)
                .name(json.path("name").asText())
                .picture(pictureUrl)
                .build();
    }

    @lombok.Builder
    @lombok.Getter
    public static class FacebookUserInfo {
        private String id;
        private String email;
        private String name;
        private String picture;
    }
}
