package com.example.stockservice.controller.analytics;

import com.example.stockservice.dto.analytics.SystemAnalyticsTrendDto;
import com.example.stockservice.dto.analytics.TrackCartRequest;
import com.example.stockservice.dto.analytics.TrackSearchRequest;
import com.example.stockservice.dto.analytics.TrackViewRequest;
import com.example.stockservice.service.analytic.TrackingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * REST Controller for user behavior tracking
 * Provides endpoints to track views, searches, and cart actions
 * 
 * Endpoints are designed to return quickly (< 10ms) as tracking is async
 */
@RestController
@RequestMapping("/v1/stock/analytics")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Analytics Tracking", description = "User behavior tracking APIs")
public class TrackingController {

    private final TrackingService trackingService;

    // ==================== TRACKING ENDPOINTS ====================

    /**
     * Track product view event
     * Called when user views a product detail page
     */
    @PostMapping("/track/view")
    @Operation(summary = "Track product view", description = "Track when user views a product")
    public ResponseEntity<Void> trackView(@RequestBody TrackViewRequest request) {
        trackingService.trackView(request);
        return ResponseEntity.ok().build();
    }

    /**
     * Track search event
     * Called when user performs a search
     */
    @PostMapping("/track/search")
    @Operation(summary = "Track search", description = "Track user search queries")
    public ResponseEntity<Void> trackSearch(@RequestBody TrackSearchRequest request) {
        trackingService.trackSearch(request);
        return ResponseEntity.ok().build();
    }

    /**
     * Track add to cart event
     * Called when user adds a product to cart
     */
    @PostMapping("/track/cart")
    @Operation(summary = "Track add to cart", description = "Track when user adds product to cart")
    public ResponseEntity<Void> trackCart(@RequestBody TrackCartRequest request) {
        trackingService.trackCart(request);
        return ResponseEntity.ok().build();
    }

    /**
     * Track purchase event
     * Called when user successfully places an order
     */
    @PostMapping("/track/purchase")
    @Operation(summary = "Track purchase", description = "Track when user purchases a product")
    public ResponseEntity<Void> trackPurchase(@RequestBody TrackCartRequest request) {
        // Reuse TrackCartRequest since purchase has same fields (productId, quantity)
        trackingService.trackPurchaseFromFrontend(request.getProductId(), request.getQuantity());
        return ResponseEntity.ok().build();
    }

    // ==================== QUERY ENDPOINTS ====================

    /**
     * Get recently viewed products for current user
     */
    @GetMapping("/recently-viewed")
    @Operation(summary = "Get recently viewed", description = "Get user's recently viewed products")
    public ResponseEntity<List<String>> getRecentlyViewed(
            @RequestParam(defaultValue = "10") int limit) {
        List<String> productIds = trackingService.getRecentlyViewed(limit);
        return ResponseEntity.ok(productIds);
    }

    /**
     * Get trending search keywords
     */
    @GetMapping("/trending/keywords")
    @Operation(summary = "Get trending keywords", description = "Get top trending search keywords")
    public ResponseEntity<Set<String>> getTrendingKeywords(
            @RequestParam(defaultValue = "10") int limit) {
        Set<String> keywords = trackingService.getTrendingKeywords(limit);
        return ResponseEntity.ok(keywords);
    }

    /**
     * Get trending products
     */
    @GetMapping("/trending/products")
    @Operation(summary = "Get trending products", description = "Get most viewed products")
    public ResponseEntity<Set<String>> getTrendingProducts(
            @RequestParam(defaultValue = "10") int limit) {
        Set<String> productIds = trackingService.getTrendingProducts(limit);
        return ResponseEntity.ok(productIds);
    }

    /**
     * Get view count for a specific product
     */
    @GetMapping("/view-count/{productId}")
    @Operation(summary = "Get view count", description = "Get view count for a product")
    public ResponseEntity<Map<String, Object>> getViewCount(@PathVariable String productId) {
        Long count = trackingService.getViewCount(productId);
        return ResponseEntity.ok(Map.of(
                "productId", productId,
                "viewCount", count));
    }

    // ==================== SYSTEM & COMPATIBILITY ENDPOINTS ====================

    @PostMapping("/visit")
    @Operation(summary = "Track site visit", description = "Track homepage visit")
    public ResponseEntity<Void> trackVisit(@RequestParam(required = false) String sessionId) {
        trackingService.trackVisit(sessionId);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/view/{productId}")
    @Operation(summary = "Track product view (Frontend)", description = "Frontend compatibility endpoint")
    public ResponseEntity<Void> trackViewFrontend(@PathVariable String productId) {
        TrackViewRequest request = new TrackViewRequest();
        request.setProductId(productId);
        request.setSource("direct");
        trackingService.trackView(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/cart-add")
    @Operation(summary = "Track cart add (Frontend)", description = "Frontend compatibility endpoint")
    public ResponseEntity<Void> trackCartFrontend() {
        // Frontend calls this without body sometimes, just to increment system counter
        // Frontend calls this without body just to increment system counter
        trackingService.trackSystemCartAdd();
        return ResponseEntity.ok().build();
    }

    @GetMapping("/system/views")
    public ResponseEntity<Long> getSystemTotalViews() {
        return ResponseEntity.ok(trackingService.getSystemViews());
    }

    @GetMapping("/system/visits")
    public ResponseEntity<Long> getSystemSiteVisits() {
        return ResponseEntity.ok(trackingService.getSystemVisits());
    }

    @GetMapping("/system/cart-adds")
    public ResponseEntity<Long> getSystemAddToCart() {
        return ResponseEntity.ok(trackingService.getSystemCartAdds());
    }

    @GetMapping("/system/trend")
    public ResponseEntity<List<SystemAnalyticsTrendDto>> getSystemAnalyticsTrend(
            @RequestParam(required = false) LocalDate startDate,
            @RequestParam(required = false) LocalDate endDate) {

        // Default to last 30 days if not provided
        if (startDate == null)
            startDate = LocalDate.now().minusDays(30);
        if (endDate == null)
            endDate = LocalDate.now();

        return ResponseEntity.ok(trackingService.getSystemAnalyticsTrend(startDate, endDate));
    }
}
