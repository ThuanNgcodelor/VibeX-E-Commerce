package com.example.notificationservice.client;

import com.example.notificationservice.config.FeignConfig;
import com.example.notificationservice.dto.UserDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "user-service", path = "/v1/user", configuration = FeignConfig.class)
public interface UserServiceClient {

    @GetMapping(value = "/{userId}", headers = "X-Internal-Call=true")
    ResponseEntity<UserDto> getUserById(@PathVariable String userId);
}
