package com.example.stockservice.service.analytic;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.example.stockservice.dto.analytics.RecommendationResponse;
import com.example.stockservice.enums.ProductStatus;
import com.example.stockservice.jwt.JwtUtil;
import com.example.stockservice.model.Product;
import com.example.stockservice.repository.ProductRepository;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * ===== PHASE 2: RECOMMENDATION SERVICE =====
 * 
 * Service tạo gợi ý sản phẩm cá nhân hóa dựa trên dữ liệu hành vi từ Phase 1
 * Sử dụng dữ liệu tracking từ Redis để gợi ý real-time
 * 
 * CÁC LOẠI GỢI Ý:
 * 
 * 1. RECENTLY VIEWED (Đã xem gần đây)
 *    - Nguồn: Redis list "analytics:recent:{userId}"
 *    - Chỉ dành cho user đã đăng nhập
 *    - Hiển thị: Section "Đã xem gần đây" trên HomePage
 * 
 * 2. TRENDING PRODUCTS (Sản phẩm xu hướng)
 *    - Nguồn: Redis sorted set "analytics:trending_products"
 *    - Dành cho tất cả (Guest + User)
 *    - Hiển thị: Section "Sản phẩm xu hướng" trên HomePage
 * 
 * 3. PERSONALIZED (Có thể bạn quan tâm)
 *    - Logic: Tìm sản phẩm cùng category với sản phẩm đã xem
 *    - Fallback: Nếu không có history → trả về trending
 *    - Chỉ dành cho user đã đăng nhập
 *    - Hiển thị: Section "Có thể bạn quan tâm" trên HomePage
 * 
 * 4. SIMILAR PRODUCTS (Sản phẩm tương tự)
 *    - Logic: Tìm sản phẩm cùng category hoặc cùng shop
 *    - Dành cho tất cả
 *    - Hiển thị: Section "Sản phẩm tương tự" trên ProductDetailPage
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecommendationService {
    
    private final AnalyticsRedisService redisService;
    private final ProductRepository productRepository;
    private final JwtUtil jwtUtil;
    
    // ==================== API METHODS (Phương thức API) ====================
    
    /**
     * Lấy sản phẩm ĐÃ XEM GẦN ĐÂY với đầy đủ thông tin
     * Luồng:
     * 1. Lấy userId từ JWT
     * 2. Query Redis để lấy danh sách productId đã xem
     * 3. Lookup product details từ MySQL
     * 4. Trả về RecommendationResponse với đầy đủ thông tin
     * @param limit Số lượng sản phẩm tối đa
     * @return Danh sách sản phẩm đã xem (rỗng nếu chưa đăng nhập)
     */
    public List<RecommendationResponse> getRecentlyViewedWithDetails(int limit) {
        String userId = getCurrentUserId();
        if (userId == null) {
            return List.of(); // Guest user - không có history
        }
        
        List<String> productIds = redisService.getRecentlyViewed(userId, limit);
        if (productIds.isEmpty()) {
            return List.of();
        }
        
        return productIds.stream()
                .map(id -> buildRecommendation(id, "recently_viewed", null))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }
    
    /**
     * Lấy sản phẩm XU HƯỚNG (được xem nhiều nhất) với đầy đủ thông tin
     * Dành cho: Tất cả users (Guest + Logged-in)
     * @param page Trang
     * @param limit Số lượng sản phẩm tối đa
     * @return Danh sách sản phẩm trending
     */
    public List<RecommendationResponse> getTrendingProductsWithDetails(int page, int limit) {
        int offset = (page - 1) * limit;
        List<String> productIds = redisService.getTrendingProducts(offset, limit);
        if (productIds.isEmpty()) {
            return List.of();
        }
        
        return productIds.stream()
                .map(id -> buildRecommendation(id, "trending", null))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }
    
    /**
     * Lấy gợi ý CÁ NHÂN HÓA dựa trên hành vi user (Phân trang)
     * Logic gợi ý:
     * 1. Lấy sản phẩm đã xem gần đây (để xác định category)
     * 2. Nếu không có history → trả về trending (phân trang)
     * 3. Tìm sản phẩm cùng category (loại bỏ sản phẩm đã xem) (phân trang)
     * 
     * @param page Trang
     * @param limit Số lượng sản phẩm
     * @return Danh sách sản phẩm gợi ý cá nhân hóa
     */
    public List<RecommendationResponse> getPersonalizedRecommendations(int page, int limit) {
        String userId = getCurrentUserId();
        if (userId == null) {
            // Guest user -> Trending
            return getTrendingProductsWithDetails(page, limit);
        }
        
        // Lấy 10 sản phẩm đã xem gần đây để loại trừ
        List<String> recentlyViewed = redisService.getRecentlyViewed(userId, 10);
        if (recentlyViewed.isEmpty()) {
            // Không có history → trả về trending products
            return getTrendingProductsWithDetails(page, limit);
        }
        
        // Lấy sản phẩm đầu tiên để xác định category
        Optional<Product> firstProduct = productRepository.findById(recentlyViewed.get(0));
        if (firstProduct.isEmpty()) {
            return getTrendingProductsWithDetails(page, limit);
        }
        
        Product baseProduct = firstProduct.get();
        String categoryId = getCategoryIdFromProduct(baseProduct);
        String reason = "Vì bạn đã xem " + baseProduct.getName();
        
        if (categoryId != null) {
            org.springframework.data.domain.Pageable pageable = 
                    org.springframework.data.domain.PageRequest.of(page - 1, limit);
            
            org.springframework.data.domain.Page<Product> productPage = 
                    productRepository.findByCategoryIdAndIdNotIn(categoryId, recentlyViewed, pageable);
             
            // Nếu trang hiện tại rỗng (đã hết sản phẩm Category), có thể fallback sang Trending?
            // Tạm thời trả về rỗng để Client biết là hết load more cho phần này.
            // (Nếu muốn phức tạp hơn: tính toán offset bù trừ để load tiếp Trending ở dưới, nhưng khá rắc rối)
            
            return productPage.getContent().stream()
                    .map(p -> buildRecommendationFromProduct(p, "personalized", reason))
                    .collect(Collectors.toList());
        }
        
        return getTrendingProductsWithDetails(page, limit);
    }
    
    /**
     * Lấy sản phẩm TƯƠNG TỰ với một sản phẩm cụ thể
     * Dùng cho: ProductDetailPage
     * Logic:
     * 1. Tìm sản phẩm cùng category
     * 2. Nếu không đủ → thêm sản phẩm cùng shop
     * 
     * @param productId ID sản phẩm gốc
     * @param limit Số lượng sản phẩm tối đa
     * @return Danh sách sản phẩm tương tự
     */
    public List<RecommendationResponse> getSimilarProducts(String productId, int limit) {
        Optional<Product> productOpt = productRepository.findById(productId);
        if (productOpt.isEmpty()) {
            return List.of();
        }
        
        Product product = productOpt.get();
        String categoryId = getCategoryIdFromProduct(product);
        String shopId = product.getUserId();
        
        List<Product> similar = new ArrayList<>();
        
        // Bước 1: Tìm sản phẩm cùng category (Database filtering)
        if (categoryId != null) {
            org.springframework.data.domain.Pageable pageable = 
                    org.springframework.data.domain.PageRequest.of(0, limit);
            
            // Find products in same category, exclude current, only IN_STOCK
            List<Product> categoryProducts = productRepository.findByCategoryIdAndIdNotAndStatus(
                    categoryId, productId, ProductStatus.IN_STOCK, pageable).getContent();
            
            similar.addAll(categoryProducts);
        }
        
        // Bước 2: Nếu không đủ → thêm sản phẩm cùng shop
        if (similar.size() < limit && shopId != null) {
            int remaining = limit - similar.size();
            org.springframework.data.domain.Pageable pageable = 
                    org.springframework.data.domain.PageRequest.of(0, remaining);
            
            // Prepare list of IDs to exclude (current product + already found products)
            List<String> excludedIds = new ArrayList<>();
            excludedIds.add(productId);
            similar.forEach(p -> excludedIds.add(p.getId()));

            List<Product> shopProducts = productRepository.findByUserIdAndIdNotInAndStatus(
                    shopId, excludedIds, ProductStatus.IN_STOCK, pageable).getContent();
            
            similar.addAll(shopProducts);
        }
        
        return similar.stream()
                .map(p -> buildRecommendationFromProduct(p, "similar", "Sản phẩm tương tự"))
                .collect(Collectors.toList());
    }
    
    // ==================== HELPER METHODS (Phương thức hỗ trợ) ====================
    
    /**
     * Kiểm tra sản phẩm có đang bán không (status = IN_STOCK)
     */
    private boolean isProductActive(Product product) {
        return product.getStatus() == ProductStatus.IN_STOCK;
    }
    
    /**
     * Lấy categoryId từ product một cách an toàn
     */
    private String getCategoryIdFromProduct(Product product) {
        if (product.getCategory() != null) {
            return product.getCategory().getId();
        }
        return null;
    }
    
    /**
     * Tạo RecommendationResponse từ productId
     */
    private RecommendationResponse buildRecommendation(String productId, String source, String reason) {
        try {
            Optional<Product> productOpt = productRepository.findById(productId);
            return productOpt.map(product -> buildRecommendationFromProduct(product, source, reason)).orElse(null);
        } catch (Exception e) {
            log.warn("Lỗi tạo recommendation cho sản phẩm {}: {}", productId, e.getMessage());
            return null;
        }
    }
    
    /**
     * Tạo RecommendationResponse từ Product entity
     */
    private RecommendationResponse buildRecommendationFromProduct(Product product, String source, String reason) {
        Long viewCount = redisService.getViewCount(product.getId());
        String categoryId = getCategoryIdFromProduct(product);
        
        return RecommendationResponse.builder()
                .productId(product.getId())
                .name(product.getName())
                .price(product.getPrice())
                .originalPrice(product.getOriginalPrice())
                .imageId(product.getImageId())
                .shopId(product.getUserId())
                .categoryId(categoryId)
                .viewCount(viewCount)
                .source(source)
                .reason(reason)
                .build();
    }
    
    /**
     * Lấy userId hiện tại từ JWT token
     */
    private String getCurrentUserId() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                return jwtUtil.ExtractUserId(request);
            }
        } catch (Exception e) {
            log.debug("Không thể lấy userId: {}", e.getMessage());
        }
        return null;
    }
}
