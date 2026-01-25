package com.example.orderservice.client;

import java.util.List;
import java.util.Map;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

import com.example.orderservice.config.FeignConfig;
import com.example.orderservice.dto.AddRefundRequestDto;
import com.example.orderservice.dto.AddressDto;
import com.example.orderservice.dto.ShopOwnerDto;
import com.example.orderservice.dto.ShopSubscriptionDTO;
import com.example.orderservice.dto.UserDto;
import com.example.orderservice.dto.UserLocationStatDto;

@FeignClient(name = "user-service", path = "/v1", configuration = FeignConfig.class)
public interface UserServiceClient {
        @GetMapping("/user/getUserById/{userId}")
        ResponseEntity<UserDto> getUserById(@PathVariable String userId);

        @GetMapping("/user/address/getAllAddresses")
        ResponseEntity<List<AddressDto>> getAllAddresses(@RequestHeader("Authorization") String authorization);

        @GetMapping("/user/address/getAddressById/{addressId}")
        ResponseEntity<AddressDto> getAddressById(@PathVariable String addressId);

        @GetMapping("/user/shop-owners/{userId}")
        ResponseEntity<ShopOwnerDto> getShopOwnerByUserId(@PathVariable String userId);

        @PostMapping("/user/wallet/internal/refund")
        ResponseEntity<Map<String, Object>> addRefundToWallet(
                        @RequestBody AddRefundRequestDto request);

        @GetMapping("/user/shop-subscriptions/internal/shop/{shopOwnerId}")
        ResponseEntity<ShopSubscriptionDTO> getSubscriptionByShopOwnerId(
                        @PathVariable String shopOwnerId);

        @GetMapping("/user/stats/count")
        ResponseEntity<Long> countActiveUsers();

        @PostMapping("/user/wallet/internal/admin/commission")
        ResponseEntity<Map<String, Object>> addAdminCommission(@RequestBody AddRefundRequestDto request);

        @PostMapping("/user/wallet/internal/payment")
        ResponseEntity<Map<String, Object>> processWalletPayment(@RequestBody AddRefundRequestDto request);

        @GetMapping("/user/stats/locations")
        ResponseEntity<List<UserLocationStatDto>> getUserLocationStats();

        @GetMapping("/user/shop-coin/internal/balance/{userId}")
        ResponseEntity<Long> getUserCoinBalance(@PathVariable String userId);

        @PostMapping("/user/shop-coin/internal/deduct/{userId}")
        ResponseEntity<Map<String, Object>> deductPoints(@PathVariable String userId, @RequestParam("points") long points);
}
