package com.example.userservice.client;

import com.example.userservice.exception.GenericErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import feign.Response;
import feign.codec.ErrorDecoder;
import org.springframework.http.HttpStatus;
import org.apache.commons.io.IOUtils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

public class CustomErrorDecoder implements ErrorDecoder {
    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Exception decode(String methodKey, Response response) {
        if (response.body() == null) {
            return GenericErrorResponse.builder()
                    .httpStatus(HttpStatus.valueOf(response.status()))
                    .message("Error calling " + methodKey + " - No response body")
                    .build();
        }

        try (InputStream body = response.body().asInputStream()) {
            Map<String, String> errors = mapper.readValue(IOUtils.toString(body, StandardCharsets.UTF_8), Map.class);
            String msg = errors.get("message");
            if (msg == null) {
                msg = errors.get("error");
            }
            return GenericErrorResponse
                    .builder()
                    .httpStatus(HttpStatus.valueOf(response.status()))
                    .message(msg)
                    .build();

        } catch (IOException exception) {
            throw GenericErrorResponse.builder()
                    .httpStatus(HttpStatus.valueOf(response.status()))
                    .message(exception.getMessage())
                    .build();
        }
    }
}