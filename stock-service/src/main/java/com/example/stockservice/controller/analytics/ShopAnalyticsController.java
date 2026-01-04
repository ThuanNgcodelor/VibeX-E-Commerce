package com.example.stockservice.controller.analytics;

import com.example.stockservice.dto.analytics.*;
import com.example.stockservice.service.analytic.ShopAnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ===== PHASE 4: SHOP ANALYTICS CONTROLLER =====
 * REST API controller cho shop owner analytics
 * 
 * ENDPOINTS:
 * - GET /v1/stock/analytics/shop/overview - Tổng hợp analytics
 * - GET /v1/stock/analytics/shop/top-products - Top sản phẩm được xem nhiều
 * - GET /v1/stock/analytics/shop/funnel - Conversion funnel
 * - GET /v1/stock/analytics/shop/abandoned - Sản phẩm bị bỏ rơi
 * 
 * AUTHENTICATION: Yêu cầu JWT token của shop owner
 */
@RestController
@RequestMapping("/v1/stock/analytics/shop")
@RequiredArgsConstructor
@Slf4j
public class ShopAnalyticsController {
    
    private final ShopAnalyticsService analyticsService;
    
    /**
     * Lấy tổng hợp analytics cho shop owner hiện tại
     * Bao gồm: overview stats, top products, funnel, abandoned products
     * 
     * Endpoint: GET /v1/stock/analytics/shop/overview
     * Auth: Yêu cầu JWT token (shop owner)
     * 
     * Response Example:
     * {
     *   "totalViews": 12450,
     *   "totalCarts": 1823,
     *   "totalPurchases": 456,
     *   "conversionRate": 3.66,
     *   "topViewedProducts": [...],
     *   "conversionFunnel": {...},
     *   "abandonedProducts": [...]
     * }
     * 
     * @return ShopAnalyticsDTO chứa đầy đủ thông tin analytics
     */
    @GetMapping("/overview")
    public ResponseEntity<ShopAnalyticsDTO> getShopAnalytics() {
        log.info("API: Getting shop analytics overview");
        
        try {
            ShopAnalyticsDTO analytics = analyticsService.getShopAnalytics();
            return ResponseEntity.ok(analytics);
            
        } catch (Exception e) {
            log.error("Error getting shop analytics: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Lấy danh sách sản phẩm được xem nhiều nhất
     * 
     * Endpoint: GET /v1/stock/analytics/shop/top-products?limit=10
     * Auth: Yêu cầu JWT token (shop owner)
     * 
     * @param limit Số lượng sản phẩm tối đa (default: 10)
     * @return Danh sách TopProductDTO
     */
    @GetMapping("/top-products")
    public ResponseEntity<List<TopProductDTO>> getTopProducts(
            @RequestParam(defaultValue = "10") int limit
    ) {
        log.info("API: Getting top {} viewed products", limit);
        
        try {
            // Validate limit
            if (limit < 1 || limit > 100) {
                limit = 10;
            }
            
            // Service will extract shopId from JWT internally
            ShopAnalyticsDTO analytics = analyticsService.getShopAnalytics();
            List<TopProductDTO> topProducts = analytics.getTopViewedProducts();
            
            // Limit if needed
            if (topProducts.size() > limit) {
                topProducts = topProducts.subList(0, limit);
            }
            
            return ResponseEntity.ok(topProducts);
            
        } catch (Exception e) {
            log.error("Error getting top products: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Lấy thông tin conversion funnel
     * 
     * Endpoint: GET /v1/stock/analytics/shop/funnel
     * Auth: Yêu cầu JWT token (shop owner)
     * 
     * Response Example:
     * {
     *   "views": 12450,
     *   "carts": 1823,
     *   "purchases": 456,
     *   "viewToCartRate": 14.64,
     *   "cartToPurchaseRate": 25.01,
     *   "overallConversionRate": 3.66
     * }
     * 
     * @return ConversionFunnelDTO
     */
    @GetMapping("/funnel")
    public ResponseEntity<ConversionFunnelDTO> getConversionFunnel() {
        log.info("API: Getting conversion funnel");
        
        try {
            ShopAnalyticsDTO analytics = analyticsService.getShopAnalytics();
            return ResponseEntity.ok(analytics.getConversionFunnel());
            
        } catch (Exception e) {
            log.error("Error getting conversion funnel: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * Lấy danh sách sản phẩm bị bỏ rơi (abandoned)
     * Sản phẩm có views cao nhưng purchases thấp
     * 
     * Endpoint: GET /v1/stock/analytics/shop/abandoned?limit=10
     * Auth: Yêu cầu JWT token (shop owner)
     * 
     * @param limit Số lượng sản phẩm tối đa (default: 10)
     * @return Danh sách AbandonedProductDTO
     */
    @GetMapping("/abandoned")
    public ResponseEntity<List<AbandonedProductDTO>> getAbandonedProducts(
            @RequestParam(defaultValue = "10") int limit
    ) {
        log.info("API: Getting abandoned products with limit {}", limit);
        
        try {
            // Validate limit
            if (limit < 1 || limit > 100) {
                limit = 10;
            }
            
            ShopAnalyticsDTO analytics = analyticsService.getShopAnalytics();
            List<AbandonedProductDTO> abandonedProducts = analytics.getAbandonedProducts();
            
            // Limit if needed
            if (abandonedProducts.size() > limit) {
                abandonedProducts = abandonedProducts.subList(0, limit);
            }
            
            return ResponseEntity.ok(abandonedProducts);
            
        } catch (Exception e) {
            log.error("Error getting abandoned products: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
