package com.example.userservice.client;

import com.example.userservice.config.FeignConfig;
import com.example.userservice.dto.DeductSubscriptionRequestDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "order-service", path = "/v1/order", configuration = FeignConfig.class)
public interface OrderServiceClient {

    @PostMapping("/ledger/internal/deduct-fee")
    ResponseEntity<Void> deductSubscriptionFee(@RequestBody DeductSubscriptionRequestDTO request);

    @org.springframework.web.bind.annotation.GetMapping("/internal/stats/shop/{shopId}")
    ResponseEntity<java.util.Map<String, Object>> getShopOrderStats(
            @org.springframework.web.bind.annotation.PathVariable("shopId") String shopId);

    @org.springframework.web.bind.annotation.GetMapping("/internal/revenue-trend/shop/{shopId}")
    ResponseEntity<java.util.List<java.util.Map<String, Object>>> getShopRevenueTrend(
            @org.springframework.web.bind.annotation.PathVariable("shopId") String shopId);

    @org.springframework.web.bind.annotation.GetMapping("/internal/status-distribution/shop/{shopId}")
    ResponseEntity<java.util.List<java.util.Map<String, Object>>> getShopOrderStatusDistribution(
            @org.springframework.web.bind.annotation.PathVariable("shopId") String shopId);
}
