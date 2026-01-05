package com.example.orderservice.client;

import com.example.orderservice.config.FeignConfig;
import com.example.orderservice.dto.AddressDto;
import com.example.orderservice.dto.AddRefundRequestDto;
import com.example.orderservice.dto.ShopOwnerDto;
import com.example.orderservice.dto.UserDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

import java.util.List;
import java.util.Map;

@FeignClient(name = "user-service", path = "/v1", configuration = com.example.orderservice.config.FeignConfig.class)
public interface UserServiceClient {
        @GetMapping("/user/getUserById/{userId}")
        ResponseEntity<UserDto> getUserById(@PathVariable String userId);

        @GetMapping("/user/address/getAllAddresses")
        ResponseEntity<List<AddressDto>> getAllAddresses(@RequestHeader("Authorization") String authorization);

        @GetMapping("/user/address/getAddressById/{addressId}")
        ResponseEntity<AddressDto> getAddressById(@PathVariable String addressId);

        @GetMapping("/user/shop-owners/{userId}")
        ResponseEntity<ShopOwnerDto> getShopOwnerByUserId(@PathVariable String userId);

        @PostMapping("/wallet/internal/refund")
        ResponseEntity<Map<String, Object>> addRefundToWallet(
                        @RequestBody com.example.orderservice.dto.AddRefundRequestDto request);

        @GetMapping("/shop-subscriptions/internal/shop/{shopOwnerId}")
        ResponseEntity<com.example.orderservice.dto.ShopSubscriptionDTO> getSubscriptionByShopOwnerId(
                        @PathVariable("shopOwnerId") String shopOwnerId);

        @GetMapping("/user/stats/count")
        ResponseEntity<Long> countActiveUsers();
}
