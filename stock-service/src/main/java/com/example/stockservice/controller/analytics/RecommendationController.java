package com.example.stockservice.controller.analytics;

import com.example.stockservice.dto.analytics.RecommendationResponse;
import com.example.stockservice.service.analytic.RecommendationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller for product recommendations
 * Provides endpoints for personalized, trending, and similar product recommendations
 */
@RestController
@RequestMapping("/v1/stock/analytics/recommendations")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Recommendations", description = "Product recommendation APIs")
public class RecommendationController {
    
    private final RecommendationService recommendationService;
    
    // ==================== RECOMMENDATION ENDPOINTS ====================
    
    /**
     * Get recently viewed products for current user
     * Requires authentication
     */
    @GetMapping("/recently-viewed")
    @Operation(summary = "Get recently viewed", description = "Get user's recently viewed products with details")
    public ResponseEntity<List<RecommendationResponse>> getRecentlyViewed(
            @RequestParam(defaultValue = "10") int limit) {
        log.info("Getting recently viewed products, limit={}", limit);
        List<RecommendationResponse> products = recommendationService.getRecentlyViewedWithDetails(limit);
        return ResponseEntity.ok(products);
    }
    
    /**
     * Get trending products
     * Available for all users (guest and authenticated)
     */
    @GetMapping("/trending")
    @Operation(summary = "Get trending products", description = "Get most viewed products with details")
    public ResponseEntity<List<RecommendationResponse>> getTrendingProducts(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int limit) {
        log.info("Getting trending products, page={}, limit={}", page, limit);
        List<RecommendationResponse> products = recommendationService.getTrendingProductsWithDetails(page, limit);
        return ResponseEntity.ok(products);
    }
    
    /**
     * Get personalized recommendations for current user
     * Requires authentication
     */
    @GetMapping("/personalized")
    @Operation(summary = "Get personalized recommendations", description = "Get product recommendations based on user behavior")
    public ResponseEntity<List<RecommendationResponse>> getPersonalizedRecommendations(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int limit) {
        log.info("Getting personalized recommendations, page={}, limit={}", page, limit);
        List<RecommendationResponse> products = recommendationService.getPersonalizedRecommendations(page, limit);
        return ResponseEntity.ok(products);
    }
    
    /**
     * Get similar products to a given product
     * Available for all users
     */
    @GetMapping("/similar/{productId}")
    @Operation(summary = "Get similar products", description = "Get products similar to the specified product")
    public ResponseEntity<List<RecommendationResponse>> getSimilarProducts(
            @PathVariable String productId,
            @RequestParam(defaultValue = "6") int limit) {
        log.info("Getting similar products for productId={}, limit={}", productId, limit);
        List<RecommendationResponse> products = recommendationService.getSimilarProducts(productId, limit);
        return ResponseEntity.ok(products);
    }
}
