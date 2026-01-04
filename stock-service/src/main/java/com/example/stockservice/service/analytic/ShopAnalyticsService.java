package com.example.stockservice.service.analytic;

import com.example.stockservice.dto.analytics.*;
import com.example.stockservice.jwt.JwtUtil;
import com.example.stockservice.model.Product;
import com.example.stockservice.model.analytics.ProductAnalytics;
import com.example.stockservice.repository.ProductRepository;
import com.example.stockservice.repository.analytics.ProductAnalyticsRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * ===== PHASE 4: SHOP ANALYTICS SERVICE =====
 * Service cung cấp analytics cho shop owner về hành vi khách hàng
 * 
 * CHỨC NĂNG:
 * 1. Overview Stats - Tổng views/carts/purchases và conversion rate
 * 2. Top Products - Sản phẩm được xem nhiều nhất
 * 3. Conversion Funnel - Phễu chuyển đổi View → Cart → Purchase
 * 4. Abandoned Products - Sản phẩm có views cao nhưng purchase thấp
 * 
 * NGUỒN DỮ LIỆU:
 * - product_analytics table (được update bởi Kafka Consumer từ Phase 1)
 * - Product table (thông tin sản phẩm)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ShopAnalyticsService {
    
    private final ProductAnalyticsRepository analyticsRepository;
    private final ProductRepository productRepository;
    private final JwtUtil jwtUtil;
    
    // Ngưỡng để xác định "abandoned product"
    private static final long MIN_VIEWS_FOR_ABANDONED = 50;  // Tối thiểu 50 views
    private static final long MAX_PURCHASES_FOR_ABANDONED = 5; // Tối đa 5 purchases
    
    // ==================== MAIN API METHODS ====================
    
    /**
     * Lấy tổng hợp analytics cho shop owner hiện tại
     * Bao gồm: overview stats, top products, funnel, abandoned products
     * 
     * @return ShopAnalyticsDTO chứa đầy đủ thông tin analytics
     */
    public ShopAnalyticsDTO getShopAnalytics() {
        String shopId = getCurrentShopId();
        
        log.info("Getting shop analytics for shopId: {}", shopId);
        
        // Lấy tổng stats một lần để tránh query nhiều lần
        Object[] stats = analyticsRepository.getShopTotalStats(shopId);
        
        Long totalViews = extractLongValue(stats, 0);
        Long totalCarts = extractLongValue(stats, 1);
        Long totalPurchases = extractLongValue(stats, 2);
        Double conversionRate = calculateRate(totalPurchases, totalViews);
        
        return ShopAnalyticsDTO.builder()
                .totalViews(totalViews)
                .totalCarts(totalCarts)
                .totalPurchases(totalPurchases)
                .conversionRate(conversionRate)
                .topViewedProducts(getTopViewedProducts(shopId, 10))
                .conversionFunnel(buildConversionFunnel(totalViews, totalCarts, totalPurchases))
                .abandonedProducts(getAbandonedProducts(shopId, 10))
                .build();
    }
    
    /**
     * Lấy danh sách sản phẩm được xem nhiều nhất
     * 
     * @param shopId ID shop owner
     * @param limit Số lượng sản phẩm tối đa
     * @return Danh sách TopProductDTO
     */
    public List<TopProductDTO> getTopViewedProducts(String shopId, int limit) {
        log.info("Getting top {} viewed products for shopId: {}", limit, shopId);
        
        List<ProductAnalytics> topAnalytics = analyticsRepository.findByShopIdOrderByViewCountDesc(
                shopId, 
                PageRequest.of(0, limit)
        );
        
        return topAnalytics.stream()
                .map(this::convertToTopProductDTO)
                .filter(dto -> dto != null) // Lọc bỏ products không tìm thấy
                .collect(Collectors.toList());
    }
    
    /**
     * Tạo conversion funnel từ dữ liệu đã có
     * 
     * @param views Total views
     * @param carts Total carts
     * @param purchases Total purchases
     * @return ConversionFunnelDTO
     */
    private ConversionFunnelDTO buildConversionFunnel(Long views, Long carts, Long purchases) {
        return ConversionFunnelDTO.builder()
                .views(views)
                .carts(carts)
                .purchases(purchases)
                .viewToCartRate(calculateRate(carts, views))
                .cartToPurchaseRate(calculateRate(purchases, carts))
                .overallConversionRate(calculateRate(purchases, views))
                .build();
    }
    
    /**
     * Lấy danh sách sản phẩm bị bỏ rơi (abandoned)
     * Điều kiện: views >= MIN_VIEWS_FOR_ABANDONED và purchases <= MAX_PURCHASES_FOR_ABANDONED
     * 
     * @param shopId ID shop owner
     * @param limit Số lượng sản phẩm tối đa
     * @return Danh sách AbandonedProductDTO
     */
    public List<AbandonedProductDTO> getAbandonedProducts(String shopId, int limit) {
        log.info("Getting abandoned products for shopId: {}", shopId);
        
        List<ProductAnalytics> abandonedAnalytics = analyticsRepository.findAbandonedProducts(
                shopId,
                MIN_VIEWS_FOR_ABANDONED,
                MAX_PURCHASES_FOR_ABANDONED,
                PageRequest.of(0, limit)
        );
        
        return abandonedAnalytics.stream()
                .map(this::convertToAbandonedProductDTO)
                .filter(dto -> dto != null)
                .collect(Collectors.toList());
    }
    
    // ==================== HELPER METHODS (Statistics) ====================
    
    /**
     * Trích xuất giá trị Long từ Object array một cách an toàn
     * Xử lý việc SQL aggregate query có thể trả về null hoặc các kiểu Number khác nhau
     * 
     * @param stats Object array từ query
     * @param index Vị trí cần lấy
     * @return Long value hoặc 0L nếu null
     */
    private Long extractLongValue(Object[] stats, int index) {
        if (stats == null || stats.length <= index || stats[index] == null) {
            return 0L;
        }
        
        Object value = stats[index];
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        
        log.warn("Unexpected type for stats[{}]: {}", index, value.getClass().getName());
        return 0L;
    }
    
    /**
     * Tính tỷ lệ phần trăm
     * 
     * @param numerator Tử số
     * @param denominator Mẫu số
     * @return Tỷ lệ phần trăm (0-100), hoặc 0 nếu denominator = 0
     */
    private Double calculateRate(Long numerator, Long denominator) {
        if (denominator == null || denominator == 0) {
            return 0.0;
        }
        if (numerator == null) {
            numerator = 0L;
        }
        return (numerator * 100.0) / denominator;
    }
    
    // ==================== HELPER METHODS (DTO Conversion) ====================
    
    /**
     * Convert ProductAnalytics thành TopProductDTO
     */
    private TopProductDTO convertToTopProductDTO(ProductAnalytics analytics) {
        try {
            Optional<Product> productOpt = productRepository.findById(analytics.getProductId());
            if (productOpt.isEmpty()) {
                log.warn("Product not found: {}", analytics.getProductId());
                return null;
            }
            
            Product product = productOpt.get();
            
            return TopProductDTO.builder()
                    .productId(product.getId())
                    .productName(product.getName())
                    .imageId(product.getImageId())
                    .price(product.getPrice())
                    .viewCount(analytics.getViewCount())
                    .cartCount(analytics.getCartCount())
                    .purchaseCount(analytics.getPurchaseCount())
                    .conversionRate(analytics.getConversionRate())
                    .build();
                    
        } catch (Exception e) {
            log.error("Error converting to TopProductDTO: {}", e.getMessage());
            return null;
        }
    }
    
    /**
     * Convert ProductAnalytics thành AbandonedProductDTO
     */
    private AbandonedProductDTO convertToAbandonedProductDTO(ProductAnalytics analytics) {
        try {
            Optional<Product> productOpt = productRepository.findById(analytics.getProductId());
            if (productOpt.isEmpty()) {
                log.warn("Product not found: {}", analytics.getProductId());
                return null;
            }
            
            Product product = productOpt.get();
            
            // Xác định vấn đề
            String issue = determineIssue(analytics);
            
            return AbandonedProductDTO.builder()
                    .productId(product.getId())
                    .productName(product.getName())
                    .imageId(product.getImageId())
                    .price(product.getPrice())
                    .viewCount(analytics.getViewCount())
                    .cartCount(analytics.getCartCount())
                    .purchaseCount(analytics.getPurchaseCount())
                    .issue(issue)
                    .conversionRate(analytics.getConversionRate())
                    .build();
                    
        } catch (Exception e) {
            log.error("Error converting to AbandonedProductDTO: {}", e.getMessage());
            return null;
        }
    }
    
    /**
     * Xác định vấn đề của abandoned product
     */
    private String determineIssue(ProductAnalytics analytics) {
        if (analytics.getCartCount() > 10 && analytics.getPurchaseCount() == 0) {
            return "Added to cart frequently, but never purchased";
        } else if (analytics.getCartCount() > 0 && analytics.getPurchaseCount() == 0) {
            return "Added to cart, but not purchased";
        } else {
            return "High views, very low purchases";
        }
    }
    
    // ==================== HELPER METHODS (Authentication) ====================
    
    /**
     * Lấy shopId (userId) của shop owner hiện tại từ JWT token
     */
    private String getCurrentShopId() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                String userId = jwtUtil.ExtractUserId(request);
                
                if (userId == null) {
                    throw new RuntimeException("Shop owner not authenticated");
                }
                
                return userId;
            }
            throw new RuntimeException("No request context available");
        } catch (Exception e) {
            log.error("Error getting current shop ID: {}", e.getMessage());
            throw new RuntimeException("Failed to get shop owner ID", e);
        }
    }
}
