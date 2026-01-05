package com.example.stockservice.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SendNotificationRequest {
    private String userId;
    private String shopId;
    private String orderId;
    private String message;
    private Boolean isShopOwnerNotification;
}
