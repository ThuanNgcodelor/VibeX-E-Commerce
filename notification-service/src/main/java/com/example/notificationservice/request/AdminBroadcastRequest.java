package com.example.notificationservice.request;

import com.example.notificationservice.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for admin broadcast notifications
 * Sends notification to all users
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminBroadcastRequest {
    private String title;
    private String message;
    private NotificationType type;
    private String actionUrl; // Optional - link to navigate when clicked
}
