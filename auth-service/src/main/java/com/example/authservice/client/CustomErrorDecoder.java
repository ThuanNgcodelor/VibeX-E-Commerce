package com.example.authservice.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.authservice.exception.GenericErrorResponse;
import com.example.authservice.exception.ValidationException;
import feign.Response;
import feign.codec.ErrorDecoder;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.IOUtils;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@Slf4j
public class CustomErrorDecoder implements ErrorDecoder {
    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Exception decode(String methodKey, Response response) {
        // For 404, we want to throw a FeignException that can be caught and handled
        if (response.status() == 404) {
            log.debug("404 response from {}: User not found", methodKey);
            try {
                return new feign.FeignException.NotFound(
                        response.request().toString(),
                        response.request(),
                        null,
                        null);
            } catch (Exception e) {
                return new RuntimeException("User not found", e);
            }
        }

        if (response.body() == null) {
            return GenericErrorResponse.builder()
                    .httpStatus(HttpStatus.valueOf(response.status()))
                    .message("No error body returned from server")
                    .build();
        }

        try (InputStream body = response.body().asInputStream()) {
            String responseBody = IOUtils.toString(body, StandardCharsets.UTF_8);


            try {
                Map<String, Object> errors = mapper.readValue(responseBody, Map.class);
                if (response.status() == 400) {
                    String errorMsg = errors.get("error") != null ? errors.get("error").toString() : "";
                    if (errorMsg.contains("Duplicate entry") || errorMsg.contains("UK_6dotkott2kjsp8vw4d0m25fb7")) {
                        return GenericErrorResponse.builder()
                                .httpStatus(HttpStatus.valueOf(response.status()))
                                .message(errorMsg)
                                .build();
                    }

                    // Handle IllegalArgumentException for email already exists
                    if (errorMsg.contains("Email already exists")) {
                        log.warn("Email already exists in the system");
                        return GenericErrorResponse.builder()
                                .httpStatus(HttpStatus.valueOf(response.status()))
                                .message("Email already exists")
                                .build();
                    }

                    // Handle ProblemDetail format (RFC 7807) - Spring Boot 3.x default format
                    // ProblemDetail has: type, title, status, detail, instance, and optionally
                    // "errors" or "violations"
                    if (errors.containsKey("type") && errors.containsKey("title") && errors.containsKey("detail")) {
                        Map<String, String> validationErrors = new HashMap<>();

                        // Try to extract validation errors from "errors" field
                        @SuppressWarnings("unchecked")
                        Map<String, Object> nestedErrors = (Map<String, Object>) errors.get("errors");
                        if (nestedErrors != null && !nestedErrors.isEmpty()) {
                            nestedErrors.forEach((key, value) -> {
                                if (value instanceof String) {
                                    validationErrors.put(key, (String) value);
                                } else if (value instanceof java.util.List) {
                                    // Handle case where errors are in a list format
                                    @SuppressWarnings("unchecked")
                                    java.util.List<Object> errorList = (java.util.List<Object>) value;
                                    if (!errorList.isEmpty()) {
                                        validationErrors.put(key, errorList.get(0).toString());
                                    }
                                } else {
                                    validationErrors.put(key, value != null ? value.toString() : "");
                                }
                            });
                        }

                        // If we found validation errors, return ValidationException
                        if (!validationErrors.isEmpty()) {
                            return ValidationException.builder()
                                    .validationErrors(validationErrors)
                                    .build();
                        }

                        // If no validation errors found, check if detail message suggests validation
                        // issue
                        String detail = errors.get("detail") != null ? errors.get("detail").toString() : "";
                        if (detail.contains("Invalid request") || detail.contains("validation")
                                || detail.contains("constraint")) {
                            log.warn("General validation error from user-service: {}", detail);
                            // Return as generic error but mark it as validation-related
                            validationErrors.put("_general", detail);
                            return ValidationException.builder()
                                    .validationErrors(validationErrors)
                                    .build();
                        }

                        // Fall back to GenericErrorResponse with detail message
                        return GenericErrorResponse.builder()
                                .httpStatus(HttpStatus.valueOf(response.status()))
                                .message(detail)
                                .build();
                    }

                    // Check if this is validation errors (has field names like username, email,
                    // password)
                    // and doesn't have a generic "error" key
                    if (errors.containsKey("username") || errors.containsKey("email")
                            || errors.containsKey("password")) {
                        log.warn("Field-specific validation errors detected in response");
                        // Convert Map<String, Object> to Map<String, String>
                        Map<String, String> validationErrors = new HashMap<>();
                        errors.forEach((key, value) -> {
                            if (!key.equals("error")) { // Skip generic error key
                                validationErrors.put(key, value != null ? value.toString() : "");
                            }
                        });

                        log.warn("Field validation errors: {}", validationErrors);
                        return ValidationException.builder()
                                .validationErrors(validationErrors)
                                .build();
                    }

                    // Try to extract field errors if present; fall back to generic map
                    Map<String, String> validationErrors = new HashMap<>();
                    @SuppressWarnings("unchecked")
                    Map<String, Object> nestedErrors = (Map<String, Object>) errors.get("errors");
                    if (nestedErrors != null) {
                        nestedErrors.forEach(
                                (key, value) -> validationErrors.put(key, value != null ? value.toString() : ""));
                    } else {
                        // Only add non-standard error keys as validation errors
                        errors.forEach((key, value) -> {
                            if (!key.equals("error") && !key.equals("message") && !key.equals("type")
                                    && !key.equals("title") && !key.equals("status") && !key.equals("detail")
                                    && !key.equals("instance")) {
                                validationErrors.put(key, value != null ? value.toString() : "");
                            }
                        });
                    }

                    // If we have validation errors, return ValidationException
                    if (!validationErrors.isEmpty()) {
                        return ValidationException.builder()
                                .validationErrors(validationErrors)
                                .build();
                    }

                    // Fall back to GenericErrorResponse
                    String msg = errors.get("error") != null ? errors.get("error").toString()
                            : (errors.get("detail") != null ? errors.get("detail").toString()
                                    : (errors.get("message") != null ? errors.get("message").toString()
                                            : "Invalid request content"));
                    return GenericErrorResponse.builder()
                            .httpStatus(HttpStatus.valueOf(response.status()))
                            .message(msg)
                            .build();
                } else {
                    String msg = (errors.get("error") != null ? errors.get("error").toString()
                            : (errors.get("detail") != null ? errors.get("detail").toString()
                                    : (errors.get("message") != null ? errors.get("message").toString()
                                            : "Unknown error")));
                    return GenericErrorResponse.builder()
                            .httpStatus(HttpStatus.valueOf(response.status()))
                            .message(msg)
                            .build();
                }
            } catch (Exception e) {
                log.error("Error parsing response body: {}", e.getMessage());
                return GenericErrorResponse.builder()
                        .httpStatus(HttpStatus.valueOf(response.status()))
                        .message("Error response: " + responseBody)
                        .build();
            }

        } catch (IOException exception) {
            return GenericErrorResponse.builder()
                    .httpStatus(HttpStatus.valueOf(response.status()))
                    .message(exception.getMessage())
                    .build();
        }
    }
}