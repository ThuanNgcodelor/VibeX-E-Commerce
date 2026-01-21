package com.example.userservice.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.example.userservice.config.FeignConfig;
import com.example.userservice.request.SendNotificationRequest;

@FeignClient(name = "notification-service", path = "/v1/notifications", configuration = FeignConfig.class)
public interface NotificationServiceClient {

    @PostMapping("/send")
    ResponseEntity<Void> sendNotification(@RequestBody SendNotificationRequest request);
}
