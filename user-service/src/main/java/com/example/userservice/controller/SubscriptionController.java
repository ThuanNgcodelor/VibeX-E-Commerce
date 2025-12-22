package com.example.userservice.controller;

import com.example.userservice.dto.ShopSubscriptionDTO;
import com.example.userservice.service.shopowner.ShopSubscriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/shop-subscriptions")
@RequiredArgsConstructor
public class SubscriptionController {

    private final ShopSubscriptionService shopSubscriptionService;

    @GetMapping("/internal/shop/{shopOwnerId}")
    public ResponseEntity<ShopSubscriptionDTO> getSubscriptionByShopOwnerInernal(@PathVariable String shopOwnerId) {
        return ResponseEntity.ok(shopSubscriptionService.getActiveSubscription(shopOwnerId));
    }

    // Public API for Shop Owner
    @GetMapping("/shop/{shopOwnerId}")
    public ResponseEntity<ShopSubscriptionDTO> getMySubscription(@PathVariable String shopOwnerId) {
        return ResponseEntity.ok(shopSubscriptionService.getActiveSubscription(shopOwnerId));
    }

    @org.springframework.web.bind.annotation.PostMapping("/shop/{shopOwnerId}/subscribe")
    public ResponseEntity<ShopSubscriptionDTO> subscribe(
            @PathVariable String shopOwnerId,
            @org.springframework.web.bind.annotation.RequestBody @jakarta.validation.Valid com.example.userservice.request.subscription.CreateShopSubscriptionRequest request) {
        return ResponseEntity.ok(shopSubscriptionService.subscribe(shopOwnerId, request));
    }

    @org.springframework.web.bind.annotation.PostMapping("/shop/{shopOwnerId}/cancel")
    public ResponseEntity<Void> cancel(
            @PathVariable String shopOwnerId) {
        shopSubscriptionService.cancelSubscription(shopOwnerId);
        return ResponseEntity.ok().build();
    }
}