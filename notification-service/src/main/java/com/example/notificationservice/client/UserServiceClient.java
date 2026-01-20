package com.example.notificationservice.client;

import com.example.notificationservice.config.FeignConfig;
import com.example.notificationservice.dto.ShopOwnerDto;
import com.example.notificationservice.dto.UserDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;

@FeignClient(name = "user-service", path = "/v1/user", configuration = FeignConfig.class)
public interface UserServiceClient {

    @GetMapping(value = "/getUserById/{userId}", headers = "X-Internal-Call=true")
    ResponseEntity<UserDto> getUserById(@PathVariable String userId);

    @GetMapping(value = "/shop-owners/{userId}", headers = "X-Internal-Call=true")
    ResponseEntity<ShopOwnerDto> getShopOwnerByUserId(@PathVariable String userId);

    /**
     * Get all active user IDs for admin broadcast
     */
    @GetMapping(value = "/all-ids", headers = "X-Internal-Call=true")
    ResponseEntity<List<String>> getAllActiveUserIds();

    /**
     * Get all follower IDs for a shop
     */
    @GetMapping(value = "/follow/{shopId}/follower-ids", headers = "X-Internal-Call=true")
    ResponseEntity<List<String>> getFollowerIds(@PathVariable String shopId);
}
