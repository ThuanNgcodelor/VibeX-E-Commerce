package com.example.userservice.client;

import com.example.userservice.dto.SendUserUpdateEmailRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "auth-service", path = "/v1/auth")
public interface AuthServiceClient {

        @PostMapping(value = "/sendUserUpdateEmail", headers = "X-Internal-Call=true")
        ResponseEntity<?> sendUserUpdateEmail(@RequestBody SendUserUpdateEmailRequest request);

        @PostMapping(value = "/sendUserLockStatusEmail", headers = "X-Internal-Call=true")
        ResponseEntity<?> sendUserLockStatusEmail(
                        @RequestBody com.example.userservice.dto.SendUserLockStatusEmailRequest request);
}
