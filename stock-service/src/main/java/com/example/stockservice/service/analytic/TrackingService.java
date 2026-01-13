package com.example.stockservice.service.analytic;

import com.example.stockservice.dto.analytics.BehaviorEventDto;
import com.example.stockservice.dto.analytics.TrackCartRequest;
import com.example.stockservice.dto.analytics.TrackSearchRequest;
import com.example.stockservice.dto.analytics.TrackViewRequest;
import com.example.stockservice.enums.EventType;
import com.example.stockservice.jwt.JwtUtil;
import com.example.stockservice.model.Product;
import com.example.stockservice.repository.ProductRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * ===== PHASE 1: TRACKING SERVICE =====
 * LUỒNG HOẠT ĐỘNG:
 * 1. User xem sản phẩm/search → Frontend gọi API tracking
 * 2. TrackingService nhận request → Cập nhật Redis ngay lập tức (real-time
 * counters)
 * 3. TrackingService gửi event đến Kafka (async) → Consumer lưu vào MySQL
 * CÁC LOẠI EVENT:
 * - VIEW: Xem sản phẩm (productId, duration, source)
 * - SEARCH: Tìm kiếm (keyword)
 * - ADD_CART: Thêm vào giỏ hàng (productId, quantity)
 * - PURCHASE: Mua hàng (productId, orderId)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TrackingService {

    private final AnalyticsRedisService redisService;
    private final BehaviorKafkaProducer kafkaProducer;
    private final ProductRepository productRepository;
    private final JwtUtil jwtUtil;

    // ==================== TRACKING METHODS ====================

    /**
     * Theo dõi sự kiện XEM SẢN PHẨM
     * Luồng xử lý:
     * 1. Lấy userId từ JWT token
     * 2. Tăng view counter trong Redis (real-time)
     * 3. Thêm vào danh sách "đã xem gần đây" cho user đã đăng nhập
     * 4. Gửi event đến Kafka để lưu vào MySQL (async)
     * 
     * @param request Thông tin tracking: productId, sessionId, source, duration
     */
    public void trackView(TrackViewRequest request) {
        String userId = getCurrentUserId();
        String shopId = getShopIdForProduct(request.getProductId());

        log.info("Tracking view: productId={}, userId={}, source={}",
                request.getProductId(), userId, request.getSource());

        // Bước 1: Cập nhật Redis counters ngay lập tức (real-time)
        redisService.incrementViewCount(request.getProductId());
        redisService.incrementSystemViews(); // Track system-wide view

        // Bước 2: Thêm vào danh sách "đã xem gần đây" cho user đã đăng nhập
        if (userId != null) {
            redisService.addRecentlyViewed(userId, request.getProductId());
        }

        // Bước 3: Gửi đến Kafka để lưu vào MySQL
        BehaviorEventDto event = BehaviorEventDto.builder()
                .eventId(UUID.randomUUID().toString())
                .userId(userId)
                .sessionId(request.getSessionId())
                .eventType(EventType.VIEW)
                .productId(request.getProductId())
                .shopId(shopId)
                .source(request.getSource())
                .duration(request.getDuration())
                .timestamp(LocalDateTime.now())
                .build();

        kafkaProducer.sendEvent(event);
    }

    /**
     * Theo dõi sự kiện TÌM KIẾM
     * Luồng xử lý:
     * 1. Tăng search counter trong Redis
     * 2. Cập nhật danh sách "từ khóa trending"
     * 3. Gửi event đến Kafka để lưu vào MySQL
     * 
     * @param request Thông tin tracking: keyword, sessionId
     */
    public void trackSearch(TrackSearchRequest request) {
        String userId = getCurrentUserId();

        log.info("Tracking search: keyword={}, userId={}", request.getKeyword(), userId);

        // Bước 1: Cập nhật Redis search counter và trending keywords
        redisService.incrementSearchCount(request.getKeyword());

        // Bước 2: Gửi đến Kafka để lưu vào MySQL (async)
        BehaviorEventDto event = BehaviorEventDto.builder()
                .eventId(UUID.randomUUID().toString())
                .userId(userId)
                .sessionId(request.getSessionId())
                .eventType(EventType.SEARCH)
                .keyword(request.getKeyword())
                .timestamp(LocalDateTime.now())
                .build();

        kafkaProducer.sendEvent(event);
    }

    /**
     * Theo dõi sự kiện TRUY CẬP WEBSITE
     */
    public void trackVisit(String sessionId) {
        redisService.incrementSystemVisits(sessionId);
    }

    /**
     * Theo dõi sự kiện ADD TO CART (System-wide only)
     */
    public void trackSystemCartAdd() {
        redisService.incrementSystemCartAdds();
    }

    /**
     * Theo dõi sự kiện THÊM VÀO GIỎ HÀNG
     * 
     * @param request Thông tin tracking: productId, quantity
     */
    public void trackCart(TrackCartRequest request) {
        String userId = getCurrentUserId();
        String shopId = getShopIdForProduct(request.getProductId());

        log.info("Tracking add to cart: productId={}, userId={}, quantity={}",
                request.getProductId(), userId, request.getQuantity());

        redisService.incrementSystemCartAdds(); // Track system-wide cart add

        // Gửi đến Kafka để lưu vào MySQL (async)
        BehaviorEventDto event = BehaviorEventDto.builder()
                .eventId(UUID.randomUUID().toString())
                .userId(userId)
                .eventType(EventType.ADD_CART)
                .productId(request.getProductId())
                .shopId(shopId)
                .quantity(request.getQuantity())
                .timestamp(LocalDateTime.now())
                .build();

        kafkaProducer.sendEvent(event);
    }

    /**
     * Theo dõi sự kiện MUA HÀNG (gọi từ Order Service qua Kafka/Feign)
     * 
     * @param userId    ID người dùng
     * @param productId ID sản phẩm
     * @param shopId    ID cửa hàng
     * @param orderId   ID đơn hàng
     */
    public void trackPurchase(String userId, String productId, String shopId, String orderId) {
        log.info("Tracking purchase: productId={}, userId={}, orderId={}",
                productId, userId, orderId);

        BehaviorEventDto event = BehaviorEventDto.builder()
                .eventId(UUID.randomUUID().toString())
                .userId(userId)
                .eventType(EventType.PURCHASE)
                .productId(productId)
                .shopId(shopId)
                .timestamp(LocalDateTime.now())
                .build();

        kafkaProducer.sendEvent(event);
    }

    /**
     * Theo dõi sự kiện MUA HÀNG từ Frontend
     * Được gọi khi user đặt hàng thành công từ giao diện
     * 
     * @param productId ID sản phẩm
     * @param quantity  Số lượng mua
     */
    public void trackPurchaseFromFrontend(String productId, Integer quantity) {
        String userId = getCurrentUserId();
        String shopId = getShopIdForProduct(productId);

        log.info("Tracking purchase from frontend: productId={}, userId={}, quantity={}",
                productId, userId, quantity);

        BehaviorEventDto event = BehaviorEventDto.builder()
                .eventId(UUID.randomUUID().toString())
                .userId(userId)
                .eventType(EventType.PURCHASE)
                .productId(productId)
                .shopId(shopId)
                .quantity(quantity)
                .timestamp(LocalDateTime.now())
                .build();

        kafkaProducer.sendEvent(event);
    }

    // ==================== QUERY METHODS (Truy vấn dữ liệu) ====================

    /**
     * Lấy danh sách sản phẩm đã xem gần đây của user hiện tại
     * 
     * @param limit Số lượng sản phẩm tối đa
     * @return Danh sách productId
     */
    public List<String> getRecentlyViewed(int limit) {
        String userId = getCurrentUserId();
        if (userId == null) {
            return List.of();
        }
        return redisService.getRecentlyViewed(userId, limit);
    }

    /**
     * Lấy từ khóa tìm kiếm xu hướng (trending)
     * 
     * @param limit Số lượng từ khóa tối đa
     * @return Set các từ khóa trending
     */
    public Set<String> getTrendingKeywords(int limit) {
        return redisService.getTrendingKeywords(limit);
    }

    /**
     * Lấy sản phẩm xu hướng (được xem nhiều nhất)
     * 
     * @param limit Số lượng sản phẩm tối đa
     * @return Set các productId trending
     */
    public Set<String> getTrendingProducts(int limit) {
        return redisService.getTrendingProducts(limit);
    }

    /**
     * Lấy số lượt xem của một sản phẩm
     * 
     * @param productId ID sản phẩm
     * @return Số lượt xem
     */
    public Long getViewCount(String productId) {
        return redisService.getViewCount(productId);
    }

    public Long getSystemVisits() {
        return redisService.getSystemVisits();
    }

    public Long getSystemViews() {
        return redisService.getSystemViews();
    }

    public Long getSystemCartAdds() {
        return redisService.getSystemCartAdds();
    }

    // ==================== HELPER METHODS (Phương thức hỗ trợ) ====================

    /**
     * Lấy userId hiện tại từ JWT token
     * Trả về UUID userId thực thay vì email
     */
    private String getCurrentUserId() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder
                    .getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                return jwtUtil.ExtractUserId(request);
            }
        } catch (Exception e) {
            log.debug("Không thể lấy userId từ JWT: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Lấy shopId (userId của shop owner) từ productId
     */
    private String getShopIdForProduct(String productId) {
        if (productId == null) {
            return null;
        }
        try {
            return productRepository.findById(productId)
                    .map(Product::getUserId)
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Không thể lấy shopId cho sản phẩm {}: {}", productId, e.getMessage());
            return null;
        }
    }
}
