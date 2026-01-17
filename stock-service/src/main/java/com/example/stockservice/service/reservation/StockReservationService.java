package com.example.stockservice.service.reservation;

import com.example.stockservice.model.Size;
import com.example.stockservice.repository.SizeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scripting.support.ResourceScriptSource;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;

/**
 * Service xử lý Pre-Reserve Pattern cho stock management.
 * Flow:
 * 1. RESERVE: Trừ stock trong Redis và tạo reservation key với TTL
 * 2. CONFIRM: Xóa reservation key (stock đã trừ rồi)
 * 3. CANCEL: Rollback stock và xóa reservation key
 * Lua scripts đảm bảo atomic operations để tránh race condition.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StockReservationService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final StringRedisTemplate stringRedisTemplate;
    private final SizeRepository sizeRepository;

    // Lua scripts
    private DefaultRedisScript<Long> reserveScript;
    private DefaultRedisScript<Long> cancelScript;

    // Key prefixes
    private static final String STOCK_KEY_PREFIX = "stock:";
    private static final String RESERVE_KEY_PREFIX = "reserve:";

    // Default TTL: 15 minutes (900 seconds)
    private static final long RESERVE_TTL_SECONDS = 900;

    /**
     * Load Lua scripts khi service khởi động
     */
    @PostConstruct
    public void init() {
        loadScripts();
    }

    private void loadScripts() {
        // Load reserve script
        reserveScript = new DefaultRedisScript<>();
        reserveScript.setScriptSource(new ResourceScriptSource(
                new ClassPathResource("scripts/reserve_stock.lua")));
        reserveScript.setResultType(Long.class);

        // Load cancel script
        cancelScript = new DefaultRedisScript<>();
        cancelScript.setScriptSource(new ResourceScriptSource(
                new ClassPathResource("scripts/cancel_reservation.lua")));
        cancelScript.setResultType(Long.class);

        log.info("[RESERVATION] Lua scripts loaded successfully");
    }

    /**
     * Build stock key from productId and sizeId
     * Format: stock:{productId}:{sizeId}
     */
    private String buildStockKey(String productId, String sizeId) {
        return STOCK_KEY_PREFIX + productId + ":" + sizeId;
    }

    /**
     * Build reservation key from orderId, productId and sizeId
     * Format: reserve:{orderId}:{productId}:{sizeId}
     */
    private String buildReserveKey(String orderId, String productId, String sizeId) {
        return RESERVE_KEY_PREFIX + orderId + ":" + productId + ":" + sizeId;
    }

    // ==================== MAIN OPERATIONS ====================

    /**
     * RESERVE: Giữ chỗ stock cho một order
     * 
     * @param orderId   ID của order (tạm thời hoặc thật)
     * @param productId ID của product
     * @param sizeId    ID của size
     * @param quantity  Số lượng cần reserve
     * @return ReservationResult với status và message
     */
    public ReservationResult reserveStock(String orderId, String productId, String sizeId, int quantity) {
        String stockKey = buildStockKey(productId, sizeId);
        String reserveKey = buildReserveKey(orderId, productId, sizeId);

        log.info("[RESERVE] Attempting: orderId={}, product={}, size={}, qty={}",
                orderId, productId, sizeId, quantity);

        try {
            // Execute Lua script atomically using StringRedisTemplate
            // This ensures arguments are passed as plain strings, not JSON
            Long result = stringRedisTemplate.execute(
                    reserveScript,
                    Arrays.asList(stockKey, reserveKey),
                    String.valueOf(quantity),
                    String.valueOf(RESERVE_TTL_SECONDS));

            switch (result.intValue()) {
                case 1:
                    log.info("[RESERVE] Success: orderId={}, product={}, size={}, qty={}",
                            orderId, productId, sizeId, quantity);
                    return ReservationResult.success(quantity);

                case 0:
                    log.warn("[RESERVE] Insufficient stock: product={}, size={}",
                            productId, sizeId);
                    return ReservationResult.insufficientStock();

                case -1:
                    log.warn("[RESERVE] Stock key not found: {}. Warming up...", stockKey);
                    // Try to warm up from DB
                    if (warmUpSingleStock(productId, sizeId)) {
                        // Retry reserve
                        return reserveStock(orderId, productId, sizeId, quantity);
                    }
                    return ReservationResult.stockNotFound();

                default:
                    return ReservationResult.error("Unknown result: " + result);
            }

        } catch (Exception e) {
            log.error("[RESERVE] Error: {}", e.getMessage(), e);
            return ReservationResult.error(e.getMessage());
        }
    }

    /**
     * CONFIRM: Xác nhận reservation (sau khi payment/order thành công)
     * Chỉ cần xóa reserve key, stock đã được trừ sẵn
     * 
     * @param orderId   ID của order
     * @param productId ID của product
     * @param sizeId    ID của size
     */
    public void confirmReservation(String orderId, String productId, String sizeId) {
        String reserveKey = buildReserveKey(orderId, productId, sizeId);

        Boolean deleted = redisTemplate.delete(reserveKey);
        log.info("[CONFIRM] orderId={}, product={}, size={}, deleted={}",
                orderId, productId, sizeId, deleted);
    }

    /**
     * CANCEL: Hủy reservation và rollback stock
     * 
     * @param orderId   ID của order
     * @param productId ID của product
     * @param sizeId    ID của size
     * @return Số lượng đã rollback (0 nếu reservation không tồn tại)
     */
    public int cancelReservation(String orderId, String productId, String sizeId) {
        String stockKey = buildStockKey(productId, sizeId);
        String reserveKey = buildReserveKey(orderId, productId, sizeId);

        try {
            Long rolledBack = stringRedisTemplate.execute(
                    cancelScript,
                    Arrays.asList(stockKey, reserveKey));

            int result = rolledBack != null ? rolledBack.intValue() : 0;
            log.info("[CANCEL] orderId={}, product={}, size={}, rolledBack={}",
                    orderId, productId, sizeId, result);
            return result;

        } catch (Exception e) {
            log.error("[CANCEL] Error: {}", e.getMessage(), e);
            return 0;
        }
    }

    // ==================== CACHE OPERATIONS ====================

    /**
     * GET STOCK: Lấy stock hiện tại từ Redis cache
     * 
     * @return stock value, hoặc -1 nếu không tìm thấy
     */
    public int getStock(String productId, String sizeId) {
        String stockKey = buildStockKey(productId, sizeId);
        String value = stringRedisTemplate.opsForValue().get(stockKey);

        if (value == null) {
            return -1; // Not found in cache
        }

        return Integer.parseInt(value);
    }

    /**
     * SET STOCK: Set stock trong Redis cache
     * Uses StringRedisTemplate for consistency with Lua scripts
     */
    public void setStock(String productId, String sizeId, int stock) {
        String stockKey = buildStockKey(productId, sizeId);
        stringRedisTemplate.opsForValue().set(stockKey, String.valueOf(stock));
        log.debug("[CACHE] Set stock: {}={}", stockKey, stock);
    }

    /**
     * Warm-up single stock entry from DB
     */
    private boolean warmUpSingleStock(String productId, String sizeId) {
        try {
            Size size = sizeRepository.findById(sizeId).orElse(null);
            if (size != null && size.getProduct() != null
                    && size.getProduct().getId().equals(productId)) {
                setStock(productId, sizeId, size.getStock());
                return true;
            }
            return false;
        } catch (Exception e) {
            log.error("[CACHE] Single warm-up failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Result class for reservation operations
     */
    public static class ReservationResult {
        private final boolean success;
        private final String status;
        private final String message;
        private final int reservedQuantity;

        private ReservationResult(boolean success, String status,
                String message, int reservedQuantity) {
            this.success = success;
            this.status = status;
            this.message = message;
            this.reservedQuantity = reservedQuantity;
        }

        public static ReservationResult success(int quantity) {
            return new ReservationResult(true, "RESERVED",
                    "Stock reserved successfully", quantity);
        }

        public static ReservationResult insufficientStock() {
            return new ReservationResult(false, "INSUFFICIENT_STOCK",
                    "Not enough stock available", 0);
        }

        public static ReservationResult stockNotFound() {
            return new ReservationResult(false, "STOCK_NOT_FOUND",
                    "Stock not found in cache or database", 0);
        }

        public static ReservationResult error(String message) {
            return new ReservationResult(false, "ERROR", message, 0);
        }

        // Getters
        public boolean isSuccess() {
            return success;
        }

        public String getStatus() {
            return status;
        }

        public String getMessage() {
            return message;
        }

        public int getReservedQuantity() {
            return reservedQuantity;
        }
    }
}
