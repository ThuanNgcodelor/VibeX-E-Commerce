package com.example.notificationservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for broadcast operations
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BroadcastResult {
    private int sentCount;
    private String message;
    private boolean success;
}
