package com.example.userservice.request;

import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class RoleRequestResponse {
    private String id;
    private String userId;
    private String requestedRole;
    private String reason;
    private String status;
    private java.time.LocalDateTime creationTimestamp;
    private String adminNote;
    private String username; // Thêm username
    private String type; // RequestType: UNLOCK, REGISTRATION
}