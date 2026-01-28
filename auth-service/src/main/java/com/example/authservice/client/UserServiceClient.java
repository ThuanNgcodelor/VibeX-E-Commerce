package com.example.authservice.client;

import com.example.authservice.dto.AuthUserDto;
import com.example.authservice.dto.RegisterDto;
import com.example.authservice.dto.UpdatePassword;
import com.example.authservice.request.RegisterRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@FeignClient(name = "user-service", path = "/v1/user")
public interface UserServiceClient {
    @PostMapping("/save")
    ResponseEntity<RegisterDto> save(@RequestBody RegisterRequest request);

    @GetMapping(value = "/getUserByEmail", headers = "X-Internal-Call=true")
    ResponseEntity<AuthUserDto> getUserByEmail(@RequestParam String email);

    @PostMapping(value = "/update-password",headers = "X-Internal-Call=true")
    ResponseEntity<Void> updatePassword(@RequestBody UpdatePassword request);
}

