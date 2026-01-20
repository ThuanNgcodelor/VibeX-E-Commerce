package com.example.notificationservice.request;

import com.example.notificationservice.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for shop owner notifications to followers
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShopNotifyRequest {
    private String title;
    private String message;
    private NotificationType type;
    private String actionUrl; // Optional - link to navigate when clicked (e.g., /flash-sale/123)
}
