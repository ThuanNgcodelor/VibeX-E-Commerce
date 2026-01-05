package com.example.userservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendUserLockStatusEmailRequest {
    private String email;
    private String username;
    private String firstName;
    private String lastName;
    private boolean locked;
}
