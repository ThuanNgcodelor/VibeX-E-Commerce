package com.example.authservice.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FacebookLoginRequest {
    @NotBlank(message = "Code is required")
    private String code;
}
