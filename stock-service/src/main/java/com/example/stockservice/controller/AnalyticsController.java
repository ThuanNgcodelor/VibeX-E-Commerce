package com.example.stockservice.controller;

import com.example.stockservice.service.analytics.RedisAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/v1/stock/analytics")
@RequiredArgsConstructor
public class AnalyticsController {

    private final RedisAnalyticsService redisAnalyticsService;

    // Public endpoint for tracking pixel
    @PostMapping("/view/{productId}")
    public ResponseEntity<Void> trackProductView(@PathVariable String productId) {
        // Fire and forget - minimal latency
        redisAnalyticsService.incrementView(productId);
        return ResponseEntity.accepted().build();
    }

    // Internal endpoint for Dashboard Service
    @GetMapping("/shop/{shopId}/views")
    public ResponseEntity<Long> getShopTotalViews(@PathVariable String shopId) {
        return ResponseEntity.ok(redisAnalyticsService.getTotalShopViews(shopId));
    }

    @GetMapping("/system/views")
    public ResponseEntity<Long> getSystemTotalViews() {
        return ResponseEntity.ok(redisAnalyticsService.getTotalSystemViews());
    }

    // New Endpoints for Extended Analytics

    @PostMapping("/visit")
    public ResponseEntity<Void> trackSiteVisit() {
        redisAnalyticsService.incrementSiteVisit();
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/cart-add")
    public ResponseEntity<Void> trackAddToCart() {
        redisAnalyticsService.incrementAddToCart();
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/system/visits")
    public ResponseEntity<Long> getSystemSiteVisits() {
        return ResponseEntity.ok(redisAnalyticsService.getSiteVisits());
    }

    @GetMapping("/system/cart-adds")
    public ResponseEntity<Long> getSystemAddToCart() {
        return ResponseEntity.ok(redisAnalyticsService.getAddToCartCount());
    }

    // Internal endpoint to get product views
    @GetMapping("/product/{productId}/views")
    public ResponseEntity<Long> getProductViews(@PathVariable String productId) {
        return ResponseEntity.ok(redisAnalyticsService.getViewCount(productId));
    }
}
