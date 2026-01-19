package com.example.stockservice.service.flashsale;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scripting.support.ResourceScriptSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.stockservice.client.NotificationServiceClient;
import com.example.stockservice.client.ShopOwnerClient;
import com.example.stockservice.dto.ShopOwnerDto;
import com.example.stockservice.enums.FlashSaleStatus;
import com.example.stockservice.event.ProductUpdateKafkaEvent;
import com.example.stockservice.model.FlashSaleProduct;
import com.example.stockservice.model.FlashSaleProductSize;
import com.example.stockservice.model.FlashSaleSession;
import com.example.stockservice.model.Product;
import com.example.stockservice.model.Size;
import com.example.stockservice.repository.FlashSaleProductRepository;
import com.example.stockservice.repository.FlashSaleSessionRepository;
import com.example.stockservice.repository.ProductRepository;
import com.example.stockservice.repository.SizeRepository;
import com.example.stockservice.request.flashsale.FlashSaleProductRegistrationRequest;
import com.example.stockservice.request.flashsale.FlashSaleSessionRequest;
import com.example.stockservice.service.cache.RedisLockService;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class FlashSaleService {

    private final FlashSaleSessionRepository sessionRepository;
    private final FlashSaleProductRepository flashSaleProductRepository;

    private final ProductRepository productRepository;
    private final SizeRepository sizeRepository;
    private final NotificationServiceClient notificationClient;
    private final ShopOwnerClient shopOwnerClient;
    private final KafkaTemplate<String, ProductUpdateKafkaEvent> kafkaTemplate;
    private final StringRedisTemplate stringRedisTemplate;
    private final com.example.stockservice.service.reservation.StockReservationService stockReservationService;
    private final RedisLockService redisLockService;
    private final StockPersistenceService stockPersistenceService;

    @org.springframework.beans.factory.annotation.Value("${kafka.topic.product-updates}")
    private String productUpdatesTopic;

    // Lua Scripts & Keys
    private DefaultRedisScript<Long> flashSaleReserveScript;
    private DefaultRedisScript<Long> flashSaleCancelScript;
    private static final String FLASHSALE_STOCK_KEY_PREFIX = "flashsale:stock:";
    private static final String FLASHSALE_BOUGHT_KEY_PREFIX = "flashsale:bought:";
    private static final String FLASHSALE_RESERVE_KEY_PREFIX = "flashsale:reserve:";

    @PostConstruct
    public void init() {
        // Load reserve script
        flashSaleReserveScript = new DefaultRedisScript<>();
        flashSaleReserveScript.setScriptSource(new ResourceScriptSource(
                new ClassPathResource("scripts/flashsale_reserve.lua")));
        flashSaleReserveScript.setResultType(Long.class);

        // Load cancel script
        flashSaleCancelScript = new DefaultRedisScript<>();
        flashSaleCancelScript.setScriptSource(new ResourceScriptSource(
                new ClassPathResource("scripts/flashsale_cancel.lua")));
        flashSaleCancelScript.setResultType(Long.class);
    }

    // --- Admin: Session Management ---

    @Transactional
    public FlashSaleSession createSession(FlashSaleSessionRequest request) {
        if (request.getEndTime().isBefore(request.getStartTime())) {
            throw new RuntimeException("Thời gian kết thúc phải sau thời gian bắt đầu!");
        }

        FlashSaleSession session = FlashSaleSession.builder()
                .name(request.getName())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .description(request.getDescription())
                .status(FlashSaleStatus.INACTIVE)
                .build();
        return sessionRepository.save(session);
    }

    @Transactional
    public void openRegistrationAndNotify(String sessionId) {
        FlashSaleSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));

        session.setStatus(FlashSaleStatus.ACTIVE);
        sessionRepository.save(session);

        try {
            notificationClient.broadcastToShops(
                    "Đăng ký ngay cho chương trình: " + session.getName(),
                    "Mở đăng ký Flash Sale");
        } catch (Exception e) {
            log.error("Failed to send notification: {}", e.getMessage());
        }
    }

    // --- Shop: Product Registration ---

    @Transactional
    public FlashSaleProduct registerProduct(String shopId, FlashSaleProductRegistrationRequest request) {
        FlashSaleSession session = sessionRepository.findById(request.getSessionId())
                .orElseThrow(() -> new RuntimeException("Session not found"));

        if (session.getStatus() != FlashSaleStatus.ACTIVE) {
            throw new RuntimeException("Session is not active for registration");
        }

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new RuntimeException("Product not found"));

        if (!product.getUserId().equals(shopId)) {
            throw new RuntimeException("Product does not belong to this shop");
        }

        List<FlashSaleProductSize> flashSaleSizes = new java.util.ArrayList<>();
        int totalFlashSaleStock = 0;

        if (request.getSizes() != null) {
            for (FlashSaleProductRegistrationRequest.FlashSaleSizeReq sizeReq : request.getSizes()) {
                boolean validSize = product.getSizes().stream()
                        .anyMatch(s -> s.getId().equals(sizeReq.getSizeId()));
                if (!validSize) {
                    throw new RuntimeException(
                            "Size ID " + sizeReq.getSizeId() + " does not belong to product " + product.getId());
                }

                totalFlashSaleStock += sizeReq.getQuantity();

                flashSaleSizes.add(FlashSaleProductSize.builder()
                        .sizeId(sizeReq.getSizeId())
                        .flashSaleStock(sizeReq.getQuantity())
                        .soldCount(0)
                        .flashSalePrice(sizeReq.getSalePrice())
                        .build());
            }
        }

        FlashSaleProduct flashSaleProduct = FlashSaleProduct.builder()
                .sessionId(request.getSessionId())
                .productId(request.getProductId())
                .shopId(shopId)
                .originalPrice(product.getPrice())
                .salePrice(request.getSalePrice())
                .flashSaleStock(totalFlashSaleStock)
                .soldCount(0)
                .status(FlashSaleStatus.PENDING)
                .status(FlashSaleStatus.PENDING)
                .productSizes(flashSaleSizes)
                .build();

        flashSaleSizes.forEach(s -> s.setFlashSaleProduct(flashSaleProduct));

        return flashSaleProductRepository.save(flashSaleProduct);
    }

    // --- Admin: Approval ---

    @Transactional
    public FlashSaleProduct approveProduct(String flashSaleProductId) {
        FlashSaleProduct fsp = flashSaleProductRepository.findById(flashSaleProductId)
                .orElseThrow(() -> new RuntimeException("Registration not found"));

        if (fsp.getProductSizes() != null) {
            for (FlashSaleProductSize fsSize : fsp.getProductSizes()) {
                Size size = sizeRepository.findById(fsSize.getSizeId())
                        .orElseThrow(() -> new RuntimeException("Size not found: " + fsSize.getSizeId()));

                int deducted = fsSize.getFlashSaleStock();
                if (size.getStock() < deducted) {
                    throw new RuntimeException("Insufficient stock in main inventory for size " + size.getName()
                            + ". Required: " + deducted + ", Available: " + size.getStock());
                }

                size.setStock(size.getStock() - deducted);
                sizeRepository.save(size);

                stockReservationService.setStock(
                        size.getProduct().getId(),
                        size.getId(),
                        size.getStock());

                log.info("[FLASH-SALE-APPROVE] Updated regular cache: product={}, size={}, newStock={}",
                        size.getProduct().getId(), size.getId(), size.getStock());
            }
        }

        fsp.setStatus(FlashSaleStatus.APPROVED);
        FlashSaleProduct saved = flashSaleProductRepository.save(fsp);

        try {
            kafkaTemplate.send(productUpdatesTopic, new ProductUpdateKafkaEvent(saved.getProductId()));
        } catch (Exception e) {
            log.error("Failed to send Kafka event for flash sale approval: {}", e.getMessage());
        }

        // EVENT-DRIVEN WARM-UP: Immediately warm up this single product
        warmUpSingleProduct(saved);

        return saved;
    }

    @Transactional
    public FlashSaleProduct rejectProduct(String flashSaleProductId, String reason) {
        FlashSaleProduct fsp = flashSaleProductRepository.findById(flashSaleProductId)
                .orElseThrow(() -> new RuntimeException("Registration not found"));

        fsp.setStatus(FlashSaleStatus.REJECTED);
        fsp.setRejectionReason(reason);
        FlashSaleProduct saved = flashSaleProductRepository.save(fsp);

        try {
            kafkaTemplate.send(productUpdatesTopic, new ProductUpdateKafkaEvent(saved.getProductId()));
        } catch (Exception e) {
            log.error("Failed to send Kafka event for flash sale rejection: {}", e.getMessage());
        }

        return saved;
    }

    // --- Public / Data Access ---

    public FlashSaleSession getActiveSession() {
        LocalDateTime now = LocalDateTime.now();
        List<FlashSaleSession> sessions = sessionRepository.findByStatus(FlashSaleStatus.ACTIVE);
        return sessions.stream()
                .filter(s -> s.getStartTime().isBefore(now) && s.getEndTime().isAfter(now))
                .findFirst()
                .orElse(null);
    }

    public List<FlashSaleSession> getComingSessions() {
        LocalDateTime now = LocalDateTime.now();
        List<FlashSaleSession> sessions = sessionRepository.findByStatus(FlashSaleStatus.ACTIVE);
        return sessions.stream()
                .filter(s -> s.getEndTime().isAfter(now))
                .sorted((s1, s2) -> s1.getStartTime().compareTo(s2.getStartTime()))
                .collect(java.util.stream.Collectors.toList());
    }

    public List<FlashSaleSession> getAllSessions() {
        return sessionRepository.findAll();
    }

    public List<com.example.stockservice.response.flashsale.FlashSaleProductResponse> getProductsBySession(
            String sessionId) {
        List<FlashSaleProduct> products = flashSaleProductRepository.findBySessionId(sessionId);
        return products.stream().map(this::mapToResponse).collect(java.util.stream.Collectors.toList());
    }

    public List<com.example.stockservice.response.flashsale.FlashSaleProductResponse> getApprovedProductsBySession(
            String sessionId) {
        List<FlashSaleProduct> products = flashSaleProductRepository.findBySessionIdAndStatus(sessionId,
                FlashSaleStatus.APPROVED);
        return products.stream().map(this::mapToResponse).collect(java.util.stream.Collectors.toList());
    }

    public List<com.example.stockservice.response.flashsale.FlashSaleProductResponse> getMyRegistrations(
            String shopId) {
        List<FlashSaleProduct> products = flashSaleProductRepository.findByShopId(shopId);
        return products.stream().map(this::mapToResponse).collect(java.util.stream.Collectors.toList());
    }

    private com.example.stockservice.response.flashsale.FlashSaleProductResponse mapToResponse(FlashSaleProduct fsp) {
        Product product = productRepository.findById(fsp.getProductId()).orElse(null);
        String shopName = fsp.getShopId();
        try {
            ShopOwnerDto shopOwner = shopOwnerClient.getShopOwnerByUserId(fsp.getShopId()).getBody();
            if (shopOwner != null && shopOwner.getShopName() != null) {
                shopName = shopOwner.getShopName();
            }
        } catch (Exception e) {
        }

        return com.example.stockservice.response.flashsale.FlashSaleProductResponse.builder()
                .id(fsp.getId())
                .sessionId(fsp.getSessionId())
                .productId(fsp.getProductId())
                .shopId(fsp.getShopId())
                .originalPrice(fsp.getOriginalPrice())
                .salePrice(fsp.getSalePrice())
                .flashSaleStock(fsp.getFlashSaleStock())
                .soldCount(fsp.getSoldCount())
                .status(fsp.getStatus())
                .rejectionReason(fsp.getRejectionReason())
                .productName(product != null ? product.getName() : "Unknown Product")
                .productImageId(product != null ? product.getImageId() : null)
                .shopName(shopName)
                .build();
    }

    @Transactional
    public void deleteSession(String sessionId) {
        FlashSaleSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));

        if (session.getStatus() == FlashSaleStatus.ACTIVE) {
            throw new RuntimeException("Cannot delete an ACTIVE session. Deactivate it first.");
        }
        sessionRepository.delete(session);
    }

    @Transactional
    public FlashSaleSession toggleSessionStatus(String sessionId) {
        FlashSaleSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));

        if (session.getStatus() == FlashSaleStatus.ACTIVE) {
            session.setStatus(FlashSaleStatus.INACTIVE);
            return sessionRepository.save(session);
        } else {
            session.setStatus(FlashSaleStatus.ACTIVE);
            FlashSaleSession saved = sessionRepository.save(session);
            // JUST-IN-TIME WARM UP (Only if session is starting soon or active)
            warmUpSession(saved.getId());

            try {
                notificationClient.broadcastToShops(
                        "Đăng ký ngay cho chương trình: " + saved.getName(),
                        "Mở đăng ký Flash Sale");
            } catch (Exception e) {
                log.error("Failed to send notification: {}", e.getMessage());
            }
            return saved;
        }
    }

    public FlashSaleProduct findActiveFlashSaleProduct(String productId) {
        List<FlashSaleProduct> products = flashSaleProductRepository.findByProductIdAndStatus(productId,
                FlashSaleStatus.APPROVED);

        for (FlashSaleProduct p : products) {
            FlashSaleSession session = sessionRepository.findById(p.getSessionId()).orElse(null);
            if (session != null && session.getStatus() == FlashSaleStatus.ACTIVE) {
                LocalDateTime now = LocalDateTime.now();
                if (now.isAfter(session.getStartTime()) && now.isBefore(session.getEndTime())) {
                    if (p.getProductSizes() != null) {
                        p.getProductSizes().size(); // Trigger Lazy Load
                    }
                    return p;
                }
            }
        }
        return null;
    }

    // --- Redis: SMART Cache Strategy ---

    /**
     * Helper to warm up a list of products in a session.
     * NOW OPTIMIZED: Uses setIfAbsent (NX) to avoid overwriting existing cache.
     */
    @Transactional
    public void warmUpSession(String sessionId) {
        List<FlashSaleProduct> products = flashSaleProductRepository.findBySessionIdAndStatus(sessionId,
                FlashSaleStatus.APPROVED);
        for (FlashSaleProduct p : products) {
            warmUpSingleProduct(p);
        }
    }

    /**
     * Event-Driven Warm-up: Warm up a single product immediately.
     */
    public void warmUpSingleProduct(FlashSaleProduct p) {
        if (p.getProductSizes() != null) {
            FlashSaleSession session = sessionRepository.findById(p.getSessionId()).orElse(null);
            if (session != null) {
                long ttl = Duration.between(LocalDateTime.now(), session.getEndTime()).getSeconds();
                if (ttl < 0)
                    ttl = 3600;

                for (FlashSaleProductSize size : p.getProductSizes()) {
                    String stockKey = FLASHSALE_STOCK_KEY_PREFIX + p.getProductId() + ":" + size.getSizeId();

                    // Only set if not exists (NX) to prevent overwriting active stock
                    Boolean set = stringRedisTemplate.opsForValue().setIfAbsent(stockKey,
                            String.valueOf(size.getFlashSaleStock()), ttl, TimeUnit.SECONDS);

                    if (Boolean.TRUE.equals(set)) {
                        log.info("[SMART-WARMUP] Cached {} = {}", stockKey, size.getFlashSaleStock());
                    }
                }
            }
        }
    }

    /**
     * HIGH-PERFORMANCE CHECKOUT: Cache-Aside with Distributed Lock
     */
    public boolean reserveFlashSaleStock(String orderId, String productId, String sizeId, int quantity, String userId) {
        String stockKey = FLASHSALE_STOCK_KEY_PREFIX + productId + ":" + sizeId;
        String boughtKey = FLASHSALE_BOUGHT_KEY_PREFIX + userId + ":" + productId;
        String reserveKey = FLASHSALE_RESERVE_KEY_PREFIX + orderId + ":" + productId + ":" + sizeId;

        // 1. FAST PATH: Check Cache Existence
        if (!Boolean.TRUE.equals(stringRedisTemplate.hasKey(stockKey))) {
            // 2. CACHE MISS: Handle Stampede with Distributed Lock
            handleCacheMissWithLock(stockKey, productId, sizeId);
        }

//        3. THỰC THI KỊCH BẢN LUA
//        Bây giờ bộ nhớ cache được đảm bảo tồn tại (trừ khi sản phẩm không hợp lệ)
//        FlashSaleProduct fsp = findActiveFlashSaleProduct(productId);
        int limit = 0; // Đã loại bỏ tính năng giới hạn số lượng
        long ttl = 900; // Thời gian đặt chỗ

        Long result = stringRedisTemplate.execute(
                flashSaleReserveScript,
                Arrays.asList(stockKey, boughtKey, reserveKey),
                String.valueOf(quantity),
                String.valueOf(limit),
                String.valueOf(ttl));

        if (result != null && result == 1) {
            log.info(" Flash Sale Reserved: {}[{}] x {} for user {}", productId, sizeId, quantity, userId);

            // 4. ASYNC PERSISTENCE (Write-Behind)
            stockPersistenceService.asyncDecrementFlashSaleStock(productId, sizeId, quantity);
            return true;
        } else if (result != null && result == -2) {
            throw new RuntimeException("Bạn đã đạt giới hạn mua cho sản phẩm này (" + limit + " sản phẩm)");
        } else {
            return false;
        }
    }

    /**
     * Handle Cache Miss using Distributed Lock
     * Only ONE thread queries DB, others wait.
     */
    private void handleCacheMissWithLock(String stockKey, String productId, String sizeId) {
        String lockKey = "lock:" + stockKey;
        try {
            // Try acquire lock, wait up to 2s
            redisLockService.executeWithLock(lockKey, 2, () -> {
                // Double check inside lock
                if (!Boolean.TRUE.equals(stringRedisTemplate.hasKey(stockKey))) {
                    log.warn("[CACHE-MISS] Loading {} from DB", stockKey);
                    FlashSaleProduct fsp = findActiveFlashSaleProduct(productId);
                    if (fsp != null && fsp.getProductSizes() != null) {
                        FlashSaleProductSize size = fsp.getProductSizes().stream()
                                .filter(s -> s.getSizeId().equals(sizeId))
                                .findFirst().orElse(null);

                        if (size != null) {
                            FlashSaleSession session = sessionRepository.findById(fsp.getSessionId()).orElse(null);
                            long ttl = (session != null)
                                    ? Duration.between(LocalDateTime.now(), session.getEndTime()).getSeconds()
                                    : 3600;
                            if (ttl < 0)
                                ttl = 300; // Fallback

                            stringRedisTemplate.opsForValue().set(stockKey, String.valueOf(size.getFlashSaleStock()),
                                    ttl, TimeUnit.SECONDS);
                        }
                    }
                }
                return null;
            });
        } catch (Exception e) {
            log.error("Error handling cache miss for {}: {}", stockKey, e.getMessage());
        }
    }

    public void cancelFlashSaleReservation(String orderId, String productId, String sizeId, String userId) {
        // FlashSaleProduct fsp = findActiveFlashSaleProduct(productId);
        int limit = 0; // Removed quantity limit feature

        String stockKey = FLASHSALE_STOCK_KEY_PREFIX + productId + ":" + sizeId;
        String boughtKey = FLASHSALE_BOUGHT_KEY_PREFIX + userId + ":" + productId;
        String reserveKey = FLASHSALE_RESERVE_KEY_PREFIX + orderId + ":" + productId + ":" + sizeId;

        // DEBUG: Check if reservation key exists
        String reservedQty = stringRedisTemplate.opsForValue().get(reserveKey);
        log.info("[CANCEL-DEBUG] orderId={}, reserveKey={}, reservedQty={}", orderId, reserveKey, reservedQty);

        Long result = stringRedisTemplate.execute(
                flashSaleCancelScript,
                Arrays.asList(stockKey, boughtKey, reserveKey),
                String.valueOf(limit));

        log.info("[CANCEL-DEBUG] Lua script result={} for orderId={}", result, orderId);

        if (result != null && result == 1) {
            log.info("✅ Product {} size {} reservation canceled for order {} - Stock restored in Redis",
                    productId, sizeId, orderId);

            // IMPORTANT: Also restore stock in DB (async) to keep DB in sync
            if (reservedQty != null) {
                int quantity = Integer.parseInt(reservedQty);
                stockPersistenceService.asyncIncrementFlashSaleStock(productId, sizeId, quantity);
                log.info("📤 Async DB rollback queued for productId={}, sizeId={}, qty={}", productId, sizeId,
                        quantity);
            }
        } else {
            log.warn("⚠️ Failed to cancel reservation for order {} - Reservation key not found or already expired",
                    orderId);
        }
    }

    public void confirmFlashSaleReservation(String orderId, String productId, String sizeId) {
        String reserveKey = FLASHSALE_RESERVE_KEY_PREFIX + orderId + ":" + productId + ":" + sizeId;
        stringRedisTemplate.delete(reserveKey);
    }

    // Add missing public method for decrement if used elsewhere
    @Transactional
    public void decrementFlashSaleStock(String productId, int quantity) {
        // Legacy method, might be used by order service direct call?
        // Kept for compatibility but logic updated
        FlashSaleProduct fsp = findActiveFlashSaleProduct(productId);
        if (fsp != null) {
            fsp.setFlashSaleStock(Math.max(0, fsp.getFlashSaleStock() - quantity));
            fsp.setSoldCount(fsp.getSoldCount() + quantity);
            flashSaleProductRepository.save(fsp);
        }
    }

    public int getAvailableFlashSaleStock(String productId) {
        FlashSaleProduct fsp = findActiveFlashSaleProduct(productId);
        return fsp != null ? fsp.getFlashSaleStock() : 0;
    }

    /**
     * Restore flash sale stock for cancelled order
     * Only restores if flashsale session is still ACTIVE or COMING (not
     * ENDED/INACTIVE)
     * 
     * @param productId Product ID
     * @param sizeId    Size ID
     * @param quantity  Quantity to restore
     * @return true if restored to flash sale stock, false if session ended (should
     *         restore to regular stock instead)
     */
    public boolean restoreFlashSaleStock(String productId, String sizeId, int quantity) {
        log.info("[RESTORE-FS] Attempting to restore flash sale stock: product={}, size={}, qty={}",
                productId, sizeId, quantity);

        // 1. Find active flash sale for this product
        FlashSaleProduct fsp = findActiveFlashSaleProduct(productId);

        if (fsp == null) {
            log.warn("[RESTORE-FS] No active flash sale found for product: {}", productId);
            return false; // Session ended or product not in flash sale, restore to regular stock
        }

        // 2. Check session status
        FlashSaleSession session = sessionRepository.findById(fsp.getSessionId())
                .orElse(null);

        if (session == null) {
            log.warn("[RESTORE-FS] Session not found for flash sale product: {}", fsp.getId());
            return false;
        }

        // Only restore if session is still ACTIVE (includes COMING sessions that are
        // approved)
        if (session.getStatus() != FlashSaleStatus.ACTIVE) {
            log.warn("[RESTORE-FS] Session {} status is {} (not ACTIVE), cannot restore to flash sale",
                    fsp.getSessionId(), session.getStatus());
            return false; // Session ended, restore to regular stock instead
        }

        // Check if session time has passed
        LocalDateTime now = LocalDateTime.now();
        if (now.isAfter(session.getEndTime())) {
            log.warn("[RESTORE-FS] Session {} has ended (endTime={}), cannot restore to flash sale",
                    fsp.getSessionId(), session.getEndTime());
            return false;
        }

        // 3. Find the specific size
        FlashSaleProductSize fsSize = fsp.getProductSizes() != null
                ? fsp.getProductSizes().stream()
                        .filter(s -> s.getSizeId().equals(sizeId))
                        .findFirst()
                        .orElse(null)
                : null;

        if (fsSize == null) {
            log.warn("[RESTORE-FS] Size {} not found in flash sale product {}", sizeId, productId);
            return false;
        }

        // 4. Restore Redis cache
        String stockKey = FLASHSALE_STOCK_KEY_PREFIX + productId + ":" + sizeId;
        try {
            stringRedisTemplate.opsForValue().increment(stockKey, quantity);
            log.info("[RESTORE-FS] ✅ Redis restored: {} +{}", stockKey, quantity);
        } catch (Exception e) {
            log.error("[RESTORE-FS] ❌ Failed to restore Redis: {}", e.getMessage());
        }

        // 5. Restore DB (async)
        stockPersistenceService.asyncIncrementFlashSaleStock(productId, sizeId, quantity);
        log.info("[RESTORE-FS] ✅ DB restore queued: product={}, size={}, qty={}",
                productId, sizeId, quantity);

        return true; // Successfully restored to flash sale stock
    }
}
