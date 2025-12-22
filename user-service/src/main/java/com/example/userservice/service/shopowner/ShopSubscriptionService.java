package com.example.userservice.service.shopowner;

import com.example.userservice.dto.ShopSubscriptionDTO;

public interface ShopSubscriptionService {
    ShopSubscriptionDTO getActiveSubscription(String shopOwnerId);

    ShopSubscriptionDTO subscribe(String shopOwnerId,
                                  com.example.userservice.request.subscription.CreateShopSubscriptionRequest request);

    void cancelSubscription(String shopOwnerId);
}