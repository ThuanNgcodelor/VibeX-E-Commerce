package com.example.authservice.exception;

import com.fasterxml.jackson.databind.ObjectMapper;
import feign.Response;
import feign.Util;
import feign.codec.ErrorDecoder;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.http.HttpStatus;

public class CustomErrorDecoder implements ErrorDecoder {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Exception decode(String methodKey, Response response) {
        String errorMessage = "Error occurred while calling " + methodKey;

        try {
            if (response.body() != null) {
                String body = Util.toString(response.body().asReader(StandardCharsets.UTF_8));
                try {
                    Map map = objectMapper.readValue(body, Map.class);
                    if (map != null) {
                        if (map.containsKey("message")) {
                            errorMessage = map.get("message").toString();
                        } else if (map.containsKey("error")) {
                            errorMessage = map.get("error").toString();
                        } else if (map.containsKey("detail")) {
                            errorMessage = map.get("detail").toString();
                        } else {
                            // If we can't find a specific field, use the values
                            errorMessage = map.values().toString();
                        }
                    }
                } catch (Exception e) {
                    // Fallback using raw body if not JSON
                    if (body != null && !body.isBlank()) {
                        errorMessage = body;
                    }
                }
            }
        } catch (IOException e) {
            // ignore
        }

        return new GenericErrorResponse(errorMessage, HttpStatus.valueOf(response.status()));
    }
}