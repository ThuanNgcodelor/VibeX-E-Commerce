package com.example.stockservice.client;

import com.example.stockservice.dto.UserDto;
import com.example.stockservice.dto.ShopOwnerDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "user-service", path = "/v1/user")
public interface UserServiceClient {
    @GetMapping("/getUserById/{userId}")
    ResponseEntity<UserDto> getUserById(@PathVariable String userId);

    @GetMapping("/shop-owners/{userId}")
    ResponseEntity<ShopOwnerDto> getShopOwnerByUserId(@PathVariable String userId);
}
