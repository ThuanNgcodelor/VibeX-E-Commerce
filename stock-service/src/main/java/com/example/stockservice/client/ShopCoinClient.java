package com.example.stockservice.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "user-service", path = "/v1/shop-coin", contextId = "shopCoinClient")
public interface ShopCoinClient {

    @PostMapping("/mission/review-completion")
    void completeReviewMission(@RequestHeader("Authorization") String token, @RequestParam("userId") String userId);
}
