package com.example.stockservice.service.analytic;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * ===== PHASE 1: REDIS ANALYTICS SERVICE =====
 * quản lý dữ liệu analytics trong Redis
 * CẤU TRÚC DỮ LIỆU REDIS:
 * 1. VIEW COUNTER (String):
 * Key: "analytics:view:{productId}"
 * Value: số lượt xem
 * TTL: 7 ngày
 * 2. SEARCH COUNTER (String):
 * Key: "analytics:search:{keyword}"
 * Value: số lượt tìm kiếm
 * TTL: 7 ngày
 * 3. RECENTLY VIEWED (List):
 * Key: "analytics:recent:{userId}"
 * Value: danh sách productId (mới nhất ở đầu)
 * Max: 20 items, TTL: 30 ngày
 * 4. TRENDING PRODUCTS (Sorted Set):
 * Key: "analytics:trending_products"
 * Value: productId với score = số lượt xem
 * 5. TRENDING KEYWORDS (Sorted Set):
 * Key: "analytics:trending_search"
 * Value: keyword với score = số lượt search
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsRedisService {

    private final RedisTemplate<String, Object> redisTemplate;

    // Key prefixes - tiền tố cho các key Redis
    private static final String VIEW_COUNT_PREFIX = "analytics:view:";
    private static final String SEARCH_COUNT_PREFIX = "analytics:search:";
    private static final String RECENT_VIEWS_PREFIX = "analytics:recent:";
    private static final String TRENDING_SEARCH_KEY = "analytics:trending_search";
    private static final String TRENDING_PRODUCTS_KEY = "analytics:trending_products";

    // System-wide stats keys
    private static final String SYSTEM_VISITS_KEY = "analytics:system:visits";
    private static final String SYSTEM_VIEWS_KEY = "analytics:system:views";
    private static final String SYSTEM_CART_ADDS_KEY = "analytics:system:cart_adds";

    // TTL constants - thời gian sống của dữ liệu
    private static final long VIEW_COUNT_TTL_DAYS = 7; // View count giữ 7 ngày
    private static final long RECENT_VIEWS_TTL_DAYS = 30; // Recently viewed giữ 30 ngày
    private static final int MAX_RECENT_VIEWS = 20; // Tối đa 20 sản phẩm đã xem

    // ==================== VIEW COUNTERS (Đếm lượt xem) ====================

    /**
     * Tăng số lượt xem cho một sản phẩm
     * 
     * Hoạt động:
     * 1. INCR: Tăng counter cho productId
     * 2. EXPIRE: Set TTL 7 ngày
     * 3. ZINCRBY: Tăng score trong Sorted Set trending_products
     * 
     * @param productId ID sản phẩm
     */
    public void incrementViewCount(String productId) {
        try {
            String key = VIEW_COUNT_PREFIX + productId;
            redisTemplate.opsForValue().increment(key);
            redisTemplate.expire(key, VIEW_COUNT_TTL_DAYS, TimeUnit.DAYS);

            // Cập nhật Sorted Set để tracking sản phẩm trending
            redisTemplate.opsForZSet().incrementScore(TRENDING_PRODUCTS_KEY, productId, 1);
            log.debug("Đã tăng view count cho sản phẩm: {}", productId);
        } catch (Exception e) {
            log.warn("Lỗi tăng view count cho {}: {}", productId, e.getMessage());
        }
    }

    /**
     * Lấy số lượt xem của một sản phẩm
     * 
     * @param productId ID sản phẩm
     * @return Số lượt xem (0 nếu không tồn tại)
     */
    public Long getViewCount(String productId) {
        try {
            String key = VIEW_COUNT_PREFIX + productId;
            Object value = redisTemplate.opsForValue().get(key);
            return value != null ? Long.parseLong(value.toString()) : 0L;
        } catch (Exception e) {
            log.warn("Lỗi lấy view count cho {}: {}", productId, e.getMessage());
            return 0L;
        }
    }

    // ==================== SEARCH COUNTERS (Đếm lượt tìm kiếm) ====================

    /**
     * Tăng số lượt tìm kiếm cho một từ khóa
     * Hoạt động:
     * 1. Chuẩn hóa keyword (lowercase, trim)
     * 2. INCR: Tăng counter cho keyword
     * 3. ZINCRBY: Tăng score trong Sorted Set trending_search
     * 
     * @param keyword Từ khóa tìm kiếm
     */
    public void incrementSearchCount(String keyword) {
        try {
            String normalizedKeyword = keyword.toLowerCase().trim();
            String key = SEARCH_COUNT_PREFIX + normalizedKeyword;
            redisTemplate.opsForValue().increment(key);
            redisTemplate.expire(key, VIEW_COUNT_TTL_DAYS, TimeUnit.DAYS);

            // Cập nhật Sorted Set để tracking từ khóa trending
            redisTemplate.opsForZSet().incrementScore(TRENDING_SEARCH_KEY, normalizedKeyword, 1);
            log.debug("Đã tăng search count cho từ khóa: {}", normalizedKeyword);
        } catch (Exception e) {
            log.warn("Lỗi tăng search count cho {}: {}", keyword, e.getMessage());
        }
    }

    /**
     * Lấy số lượt tìm kiếm của một từ khóa
     * 
     * @param keyword Từ khóa tìm kiếm
     * @return Số lượt tìm kiếm
     */
    public Long getSearchCount(String keyword) {
        try {
            String key = SEARCH_COUNT_PREFIX + keyword.toLowerCase().trim();
            Object value = redisTemplate.opsForValue().get(key);
            return value != null ? Long.parseLong(value.toString()) : 0L;
        } catch (Exception e) {
            log.warn("Lỗi lấy search count cho {}: {}", keyword, e.getMessage());
            return 0L;
        }
    }

    // ==================== RECENTLY VIEWED (Sản phẩm đã xem gần đây)
    // ====================

    /**
     * Thêm sản phẩm vào danh sách "đã xem gần đây" của user
     * Hoạt động:
     * 1. LREM: Xóa productId nếu đã tồn tại (để đẩy lên đầu)
     * 2. LPUSH: Thêm vào đầu danh sách
     * 3. LTRIM: Giữ tối đa 20 items
     * 4. EXPIRE: Set TTL 30 ngày
     * 
     * @param userId    ID người dùng
     * @param productId ID sản phẩm
     */
    public void addRecentlyViewed(String userId, String productId) {
        if (userId == null || userId.isEmpty()) {
            return; // Bỏ qua nếu là guest user
        }

        try {
            String key = RECENT_VIEWS_PREFIX + userId;

            // Xóa nếu đã tồn tại (để move lên đầu danh sách)
            redisTemplate.opsForList().remove(key, 1, productId);

            // Thêm vào đầu danh sách (mới nhất ở đầu)
            redisTemplate.opsForList().leftPush(key, productId);

            // Giữ tối đa MAX_RECENT_VIEWS items
            redisTemplate.opsForList().trim(key, 0, MAX_RECENT_VIEWS - 1);

            // Set thời gian hết hạn
            redisTemplate.expire(key, RECENT_VIEWS_TTL_DAYS, TimeUnit.DAYS);

            log.debug("Đã thêm {} vào recent views của user: {}", productId, userId);
        } catch (Exception e) {
            log.warn("Lỗi thêm recent view cho user {}: {}", userId, e.getMessage());
        }
    }

    /**
     * Lấy danh sách sản phẩm đã xem gần đây của user
     * 
     * @param userId ID người dùng
     * @param limit  Số lượng sản phẩm tối đa
     * @return Danh sách productId (mới nhất ở đầu)
     */
    public List<String> getRecentlyViewed(String userId, int limit) {
        if (userId == null || userId.isEmpty()) {
            return Collections.emptyList();
        }

        try {
            String key = RECENT_VIEWS_PREFIX + userId;
            List<Object> result = redisTemplate.opsForList().range(key, 0, limit - 1);
            if (result == null) {
                return Collections.emptyList();
            }
            return result.stream()
                    .map(Object::toString)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            log.warn("Lỗi lấy recent views cho user {}: {}", userId, e.getMessage());
            return Collections.emptyList();
        }
    }

    // ==================== TRENDING (Xu hướng) ====================

    /**
     * Lấy từ khóa tìm kiếm xu hướng (search nhiều nhất)
     * 
     * Sử dụng ZREVRANGE để lấy top từ khóa từ Sorted Set
     * (sắp xếp theo score giảm dần)
     * 
     * @param limit Số lượng từ khóa tối đa
     * @return Set các từ khóa trending
     */
    public Set<String> getTrendingKeywords(int limit) {
        try {
            Set<Object> result = redisTemplate.opsForZSet()
                    .reverseRange(TRENDING_SEARCH_KEY, 0, limit - 1);
            if (result == null) {
                return Collections.emptySet();
            }
            return result.stream()
                    .map(Object::toString)
                    .collect(Collectors.toSet());
        } catch (Exception e) {
            log.warn("Lỗi lấy trending keywords: {}", e.getMessage());
            return Collections.emptySet();
        }
    }

    /**
     * Lấy sản phẩm xu hướng (được xem nhiều nhất)
     * 
     * Sử dụng ZREVRANGE để lấy top sản phẩm từ Sorted Set
     * (sắp xếp theo score = số lượt xem, giảm dần)
     * 
     * @param limit Số lượng sản phẩm tối đa
     * @return Set các productId trending
     */
    public Set<String> getTrendingProducts(int limit) {
        try {
            Set<Object> result = redisTemplate.opsForZSet()
                    .reverseRange(TRENDING_PRODUCTS_KEY, 0, limit - 1);
            if (result == null) {
                return Collections.emptySet();
            }
            return result.stream()
                    .map(Object::toString)
                    .collect(Collectors.toSet());
        } catch (Exception e) {
            log.warn("Lỗi lấy trending products: {}", e.getMessage());
            return Collections.emptySet();
        }
    }

    /**
     * Reset dữ liệu trending (có thể gọi hàng ngày bởi scheduler)
     * Xóa cả trending_search và trending_products
     */
    public void resetTrendingData() {
        try {
            redisTemplate.delete(TRENDING_SEARCH_KEY);
            redisTemplate.delete(TRENDING_PRODUCTS_KEY);
            log.info("Đã reset dữ liệu trending");
        } catch (Exception e) {
            log.error("Lỗi reset trending data: {}", e.getMessage());
        }
    }

    // ==================== SYSTEM ANALYTICS (Thống kê toàn hệ thống)
    // ====================

    public void incrementSystemVisits(String sessionId) {
        try {
            if (sessionId == null || sessionId.isEmpty()) {
                // Fallback: just increment if no session provided (legacy)
                redisTemplate.opsForValue().increment(SYSTEM_VISITS_KEY);
                return;
            }

            // Key to mark this session as "visited"
            String sessionKey = "analytics:session:" + sessionId + ":visited";

            // Try to set key if not exists (SETNX) with TTL 30 minutes
            Boolean isNewVisit = redisTemplate.opsForValue().setIfAbsent(sessionKey, "1", 30, TimeUnit.MINUTES);

            if (Boolean.TRUE.equals(isNewVisit)) {
                redisTemplate.opsForValue().increment(SYSTEM_VISITS_KEY);
                log.debug("New visit recorded for session: {}", sessionId);
            }
        } catch (Exception e) {
            log.warn("Error incrementing system visits: {}", e.getMessage());
        }
    }

    public void incrementSystemViews() {
        try {
            redisTemplate.opsForValue().increment(SYSTEM_VIEWS_KEY);
        } catch (Exception e) {
            log.warn("Error incrementing system views: {}", e.getMessage());
        }
    }

    public void incrementSystemCartAdds() {
        try {
            redisTemplate.opsForValue().increment(SYSTEM_CART_ADDS_KEY);
        } catch (Exception e) {
            log.warn("Error incrementing system cart adds: {}", e.getMessage());
        }
    }

    public Long getSystemVisits() {
        try {
            Object value = redisTemplate.opsForValue().get(SYSTEM_VISITS_KEY);
            return value != null ? Long.parseLong(value.toString()) : 0L;
        } catch (Exception e) {
            return 0L;
        }
    }

    public Long getSystemViews() {
        try {
            Object value = redisTemplate.opsForValue().get(SYSTEM_VIEWS_KEY);
            return value != null ? Long.parseLong(value.toString()) : 0L;
        } catch (Exception e) {
            return 0L;
        }
    }

    public Long getSystemCartAdds() {
        try {
            Object value = redisTemplate.opsForValue().get(SYSTEM_CART_ADDS_KEY);
            return value != null ? Long.parseLong(value.toString()) : 0L;
        } catch (Exception e) {
            return 0L;
        }
    }
}
