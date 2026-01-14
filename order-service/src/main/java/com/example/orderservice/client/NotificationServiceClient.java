package com.example.orderservice.client;

import com.example.orderservice.config.FeignConfig;
import com.example.orderservice.request.SendNotificationRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "notification-service", path = "/v1/notifications", configuration = FeignConfig.class)
public interface NotificationServiceClient {

    @PostMapping("/send")
    void sendNotification(@RequestBody SendNotificationRequest request);
}
