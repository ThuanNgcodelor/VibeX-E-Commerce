package com.example.stockservice.service.analytics;

import com.example.stockservice.model.analytics.ProductAnalytics;
import com.example.stockservice.repository.ProductAnalyticsRepository;
import com.example.stockservice.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class RedisAnalyticsService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final ProductAnalyticsRepository analyticsRepository;
    private final ProductRepository productRepository;

    private static final String VIEW_KEY_PREFIX = "analytics:product:views:";
    private static final String CART_KEY_PREFIX = "analytics:product:cart:";
    private static final String PENDING_SYNC_KEY = "analytics:pending:sync";
    private static final String SITE_VISIT_KEY = "analytics:system:site_visits";
    private static final String SYSTEM_CART_KEY = "analytics:system:add_to_cart";

    /**
     * Increment site visit count in Redis
     */
    public void incrementSiteVisit() {
        try {
            redisTemplate.opsForValue().increment(SITE_VISIT_KEY);
        } catch (Exception e) {
            log.error("Failed to increment site visits", e);
        }
    }

    /**
     * Increment add to cart count in Redis (System wide)
     */
    public void incrementAddToCart() {
        try {
            redisTemplate.opsForValue().increment(SYSTEM_CART_KEY);
        } catch (Exception e) {
            log.error("Failed to increment add to cart", e);
        }
    }

    /**
     * Increment add to cart count in Redis (Product specific)
     */
    public void incrementAddToCart(String productId) {
        if (productId == null || productId.isEmpty())
            return;

        // Also increment system wide
        incrementAddToCart();

        String key = CART_KEY_PREFIX + productId;
        try {
            redisTemplate.opsForValue().increment(key);
            // Add to set of products that need syncing
            redisTemplate.opsForSet().add(PENDING_SYNC_KEY, productId);
        } catch (Exception e) {
            log.error("Failed to increment cart count in Redis for product: " + productId, e);
        }
    }

    // Getters for system stats
    public Long getSiteVisits() {
        Object val = redisTemplate.opsForValue().get(SITE_VISIT_KEY);
        return val != null ? Long.parseLong(val.toString()) : 0L;
    }

    public Long getAddToCartCount() {
        Object val = redisTemplate.opsForValue().get(SYSTEM_CART_KEY);
        return val != null ? Long.parseLong(val.toString()) : 0L;
    }

    /**
     * Increment view count in Redis
     * Key pattern: analytics:product:views:{productId}
     */
    public void incrementView(String productId) {
        if (productId == null || productId.isEmpty())
            return;

        String key = VIEW_KEY_PREFIX + productId;
        try {
            redisTemplate.opsForValue().increment(key);
            // Add to set of products that need syncing
            redisTemplate.opsForSet().add(PENDING_SYNC_KEY, productId);
        } catch (Exception e) {
            log.error("Failed to increment view count in Redis for product: " + productId, e);
        }
    }

    /**
     * Get real-time view count (Redis + DB fallback)
     */
    public Long getViewCount(String productId) {
        String key = VIEW_KEY_PREFIX + productId;
        Object cachedValue = redisTemplate.opsForValue().get(key);

        if (cachedValue != null) {
            return Long.parseLong(cachedValue.toString());
        }

        // Fallback to DB if not in Redis (and warm up Redis)
        return analyticsRepository.findById(productId)
                .map(analytics -> {
                    Long views = analytics.getViewCount();
                    redisTemplate.opsForValue().set(key, views.toString());
                    return views;
                })
                .orElse(0L);
    }

    public Long getTotalShopViews(String shopId) {
        // For shop level, we query DB directly as it's an aggregate
        // Assuming sync happens frequently enough
        Long dbViews = analyticsRepository.countTotalViewsByShopId(shopId);
        return dbViews != null ? dbViews : 0L;
    }

    public Long getTotalSystemViews() {
        Long dbViews = analyticsRepository.countTotalSystemViews();
        return dbViews != null ? dbViews : 0L;
    }

    /**
     * Scheduled task to sync Redis counters to MySQL
     * Runs every 1 minute
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void syncViewsToDatabase() {
        Set<Object> pendingProducts = redisTemplate.opsForSet().members(PENDING_SYNC_KEY);
        if (pendingProducts == null || pendingProducts.isEmpty()) {
            return;
        }

        log.info("Syncing analytics for {} products", pendingProducts.size());

        for (Object obj : pendingProducts) {
            String productId = (String) obj;
            String viewKey = VIEW_KEY_PREFIX + productId;
            String cartKey = CART_KEY_PREFIX + productId;

            try {
                // Fetch values from Redis
                Object viewVal = redisTemplate.opsForValue().get(viewKey);
                Object cartVal = redisTemplate.opsForValue().get(cartKey);

                // If both are null, nothing to sync really (though it was in pending set)
                if (viewVal == null && cartVal == null) {
                    redisTemplate.opsForSet().remove(PENDING_SYNC_KEY, productId);
                    continue;
                }

                ProductAnalytics analytics = analyticsRepository.findById(productId)
                        .orElseGet(() -> createNewAnalytics(productId));

                boolean updated = false;

                // Update View Count
                if (viewVal != null) {
                    Long currentRedisViews = Long.parseLong(viewVal.toString());
                    if (analytics.getViewCount() < currentRedisViews) {
                        analytics.setViewCount(currentRedisViews);
                        updated = true;
                    }
                }

                // Update Cart Count
                if (cartVal != null) {
                    Long currentRedisCart = Long.parseLong(cartVal.toString());
                    if (analytics.getCartCount() < currentRedisCart) {
                        analytics.setCartCount(currentRedisCart);
                        updated = true;
                    }
                }

                if (updated) {
                    analytics.setUpdatedAt(LocalDateTime.now());
                    analyticsRepository.save(analytics);
                }

                // Remove from pending set
                redisTemplate.opsForSet().remove(PENDING_SYNC_KEY, productId);

            } catch (Exception e) {
                log.error("Failed to sync product analytics: " + productId, e);
            }
        }
    }

    private ProductAnalytics createNewAnalytics(String productId) {
        // Fetch product to get shopId
        String shopId = productRepository.findById(productId)
                .map(p -> p.getUserId()) // Assuming userId in Product is shopId (based on analysis)
                .orElse("UNKNOWN");

        return ProductAnalytics.builder()
                .productId(productId)
                .shopId(shopId)
                .viewCount(0L)
                .cartCount(0L)
                .purchaseCount(0L)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }
}
