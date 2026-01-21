package com.example.userservice.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
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
