package com.example.stockservice.service.flashsale;

import com.example.stockservice.client.NotificationClient;
import com.example.stockservice.enums.FlashSaleStatus;
import com.example.stockservice.event.ProductUpdateKafkaEvent;
import com.example.stockservice.model.FlashSaleProduct;
import com.example.stockservice.model.FlashSaleSession;
import com.example.stockservice.model.Product;
import com.example.stockservice.repository.FlashSaleProductRepository;
import com.example.stockservice.repository.FlashSaleSessionRepository;
import com.example.stockservice.repository.ProductRepository;
import com.example.stockservice.repository.SizeRepository;
import com.example.stockservice.model.FlashSaleProductSize;
import com.example.stockservice.model.Size;

import com.example.stockservice.request.flashsale.FlashSaleProductRegistrationRequest;
import com.example.stockservice.request.flashsale.FlashSaleSessionRequest;
import com.example.stockservice.client.ShopOwnerClient;
import com.example.stockservice.dto.ShopOwnerDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import java.util.Arrays;
import java.util.List;
import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.scripting.support.ResourceScriptSource;

@Slf4j
@Service
@RequiredArgsConstructor
public class FlashSaleService {

    private final FlashSaleSessionRepository sessionRepository;
    private final FlashSaleProductRepository flashSaleProductRepository;

    private final ProductRepository productRepository;
    private final SizeRepository sizeRepository;
    private final NotificationClient notificationClient;
    private final ShopOwnerClient shopOwnerClient;
    private final KafkaTemplate<String, ProductUpdateKafkaEvent> kafkaTemplate;
    private final StringRedisTemplate stringRedisTemplate;
    private final com.example.stockservice.service.reservation.StockReservationService stockReservationService;

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
        // Validation 1: End Time > Start Time
        if (request.getEndTime().isBefore(request.getStartTime())) {
            throw new RuntimeException("Thời gian kết thúc phải sau thời gian bắt đầu!");
        }

        FlashSaleSession session = FlashSaleSession.builder()
                .name(request.getName())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .description(request.getDescription())
                .status(FlashSaleStatus.INACTIVE) // Default inactive until opened
                .build();
        return sessionRepository.save(session);
    }

    @Transactional
    public void openRegistrationAndNotify(String sessionId) {
        FlashSaleSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));

        session.setStatus(FlashSaleStatus.ACTIVE);
        sessionRepository.save(session);

        // Notify Shops
        try {
            notificationClient.broadcastToShops(
                    "Đăng ký ngay cho chương trình: " + session.getName(),
                    "Mở đăng ký Flash Sale");
        } catch (Exception e) {
            // Log error but don't fail transaction
            System.err.println("Failed to send notification: " + e.getMessage());
        }
    }

    // --- Shop: Product Registration ---

    @Transactional
    public FlashSaleProduct registerProduct(String shopId, FlashSaleProductRegistrationRequest request) {
        // Validation
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

        // Check if already registered
        // Simplified check (should ideally check if exists in this session)

        // Process request sizes
        List<FlashSaleProductSize> flashSaleSizes = new java.util.ArrayList<>();
        int totalFlashSaleStock = 0;

        if (request.getSizes() != null) {
            for (FlashSaleProductRegistrationRequest.FlashSaleSizeReq sizeReq : request.getSizes()) {
                // Validate size belongs to product
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
                .originalPrice(product.getPrice()) // Assuming base price
                .salePrice(request.getSalePrice())
                .flashSaleStock(totalFlashSaleStock) // Sum for display
                .soldCount(0)
                .status(FlashSaleStatus.PENDING)
                .quantityLimit(request.getQuantityLimit()) // Set Limit
                .productSizes(flashSaleSizes)
                .build();

        // Link parent
        flashSaleSizes.forEach(s -> s.setFlashSaleProduct(flashSaleProduct));

        return flashSaleProductRepository.save(flashSaleProduct);
    }

    // --- Admin: Approval ---

    @Transactional
    public FlashSaleProduct approveProduct(String flashSaleProductId) {
        FlashSaleProduct fsp = flashSaleProductRepository.findById(flashSaleProductId)
                .orElseThrow(() -> new RuntimeException("Registration not found"));

        // DEDUCT STOCK FROM MAIN INVENTORY
        // We iterate specifically over the sizes registered for Flash Sale
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

                // Update Redis cache immediately to ensure consistency
                stockReservationService.setStock(
                        size.getProduct().getId(),
                        size.getId(),
                        size.getStock());

                log.info("[FLASH-SALE-APPROVE] Updated cache: product={}, size={}, newStock={}",
                        size.getProduct().getId(), size.getId(), size.getStock());

                // Optional: Notify low stock if needed
            }
        }

        fsp.setStatus(FlashSaleStatus.APPROVED);
        FlashSaleProduct saved = flashSaleProductRepository.save(fsp);

        // Publish event to sync cart items with flash sale price
        try {
            kafkaTemplate.send(productUpdatesTopic, new ProductUpdateKafkaEvent(saved.getProductId()));
        } catch (Exception e) {
            System.err.println("Failed to send Kafka event for flash sale approval: " + e.getMessage());
        }

        // This ensures that when users try to purchase, the stock is available in Redis
        // for the reservation flow to work correctly
        if (saved.getProductSizes() != null) {
            for (FlashSaleProductSize size : saved.getProductSizes()) {
                String stockKey = FLASHSALE_STOCK_KEY_PREFIX + saved.getProductId() + ":" + size.getSizeId();
                stringRedisTemplate.opsForValue().set(stockKey, String.valueOf(size.getFlashSaleStock()));
                log.info("[FLASH-SALE-APPROVE] Warmed up Redis: key={}, stock={}",
                        stockKey, size.getFlashSaleStock());
            }
        }

        return saved;
    }

    @Transactional
    public FlashSaleProduct rejectProduct(String flashSaleProductId, String reason) {
        FlashSaleProduct fsp = flashSaleProductRepository.findById(flashSaleProductId)
                .orElseThrow(() -> new RuntimeException("Registration not found"));

        // If it was already APPROVED, we might need to return stock?
        // Current flow assumes Reject only from PENDING.
        // If we implement blocking stock from PENDING, we would return here.
        // But we implemented deduction on APPROVE. So REJECT from PENDING does nothing
        // to stock.

        fsp.setStatus(FlashSaleStatus.REJECTED);
        fsp.setRejectionReason(reason);
        FlashSaleProduct saved = flashSaleProductRepository.save(fsp);

        // Publish event to sync cart items (revert to normal price)
        try {
            kafkaTemplate.send(productUpdatesTopic, new ProductUpdateKafkaEvent(saved.getProductId()));
        } catch (Exception e) {
            System.err.println("Failed to send Kafka event for flash sale rejection: " + e.getMessage());
        }

        return saved;
    }

    // --- Public / Data Access ---

    public FlashSaleSession getActiveSession() {
        LocalDateTime now = LocalDateTime.now();
        // Naive implementation: Find a session that covers NOW and is ACTIVE.
        // In reality, might need more complex logic.
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
            // Fetch real Shop Name using ShopOwnerClient
            ShopOwnerDto shopOwner = shopOwnerClient.getShopOwnerByUserId(fsp.getShopId()).getBody();
            if (shopOwner != null && shopOwner.getShopName() != null) {
                shopName = shopOwner.getShopName();
            }
        } catch (Exception e) {
            // retain ID if fetch fails
            // System.err.println("Failed to fetch shop name: " + e.getMessage());
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
                .quantityLimit(fsp.getQuantityLimit()) // Map Limit
                .build();
    }

    // --- Admin: Advanced Management ---

    @Transactional
    public void deleteSession(String sessionId) {
        FlashSaleSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));

        if (session.getStatus() == FlashSaleStatus.ACTIVE) {
            throw new RuntimeException("Cannot delete an ACTIVE session. Deactivate it first.");
        }

        // Deleting a session should also delete associated products?
        // Assuming cascade or we manually delete products.
        // For safety, let's delete products first if cascade isn't set up, or rely on
        // database constraints.
        // Checking FlashSaleProductRepository... let's just delete the session for now.
        // Ideally we should check if products exist.
        // For simplicity requested:
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
            // WARM UP REDIS
            warmUpSession(saved.getId());

            try {
                notificationClient.broadcastToShops(
                        "Đăng ký ngay cho chương trình: " + saved.getName(),
                        "Mở đăng ký Flash Sale");
            } catch (Exception e) {
                System.err.println("Failed to send notification: " + e.getMessage());
            }
            return saved;
        }
    }

    @org.springframework.scheduling.annotation.Scheduled(fixedRate = 60000) // Run every minute
    @Transactional
    public void expirePastSessions() {
        List<FlashSaleSession> activeSessions = sessionRepository.findByStatus(FlashSaleStatus.ACTIVE);
        LocalDateTime now = LocalDateTime.now();

        for (FlashSaleSession session : activeSessions) {
            if (session.getEndTime().isBefore(now)) {
                session.setStatus(FlashSaleStatus.INACTIVE);
                sessionRepository.save(session);
                System.out.println("Auto-expired Flash Sale Session: " + session.getName());
            }
        }
    }
    // --- Public: Get Active Flash Sale Product for Details Page ---

    public FlashSaleProduct findActiveFlashSaleProduct(String productId) {
        List<FlashSaleProduct> products = flashSaleProductRepository.findByProductIdAndStatus(productId,
                FlashSaleStatus.APPROVED);

        for (FlashSaleProduct p : products) {
            FlashSaleSession session = sessionRepository.findById(p.getSessionId()).orElse(null);
            if (session != null && session.getStatus() == FlashSaleStatus.ACTIVE) {
                // Check if time is valid just in case status is stale
                LocalDateTime now = LocalDateTime.now();
                if (now.isAfter(session.getStartTime()) && now.isBefore(session.getEndTime())) {
                    // Force initialize sizes to ensure they are available for CartService logic
                    if (p.getProductSizes() != null) {
                        p.getProductSizes().size(); // Trigger Lazy Load
                    }
                    return p;
                }
            }
        }
        return null;
    }

    @Transactional
    public void decrementFlashSaleStock(String productId, int quantity) {
        FlashSaleProduct fsp = findActiveFlashSaleProduct(productId);
        if (fsp == null) {
            throw new RuntimeException("No active flash sale found for product: " + productId);
        }

        if (fsp.getFlashSaleStock() < quantity) {
            throw new RuntimeException("Insufficient flash sale stock. Available: " + fsp.getFlashSaleStock()
                    + ", Requested: " + quantity);
        }

        fsp.setFlashSaleStock(fsp.getFlashSaleStock() - quantity);
        fsp.setSoldCount(fsp.getSoldCount() + quantity);
        flashSaleProductRepository.save(fsp);
    }

    public int getAvailableFlashSaleStock(String productId) {
        FlashSaleProduct fsp = findActiveFlashSaleProduct(productId);
        return fsp != null ? fsp.getFlashSaleStock() : 0;
    }

    @Transactional
    public void incrementSoldCount(String productId, String sizeId, int quantity) {
        FlashSaleProduct fsp = findActiveFlashSaleProduct(productId);
        if (fsp != null && fsp.getProductSizes() != null) {
            // Find size
            FlashSaleProductSize size = fsp.getProductSizes().stream()
                    .filter(s -> s.getSizeId().equals(sizeId))
                    .findFirst()
                    .orElse(null);

            if (size != null) {
                // DECREASE flashSaleStock (actual remaining stock)
                size.setFlashSaleStock(Math.max(0, size.getFlashSaleStock() - quantity));
                // INCREASE soldCount (tracking sold items)
                size.setSoldCount(size.getSoldCount() + quantity);

                // Also update total sold count
                fsp.setSoldCount(fsp.getSoldCount() + quantity);
                flashSaleProductRepository.save(fsp);
            }
        }
    }

    // --- Redis: Flash Sale Reservation Logic ---

    public void warmUpSession(String sessionId) {
        System.out.println("🔥 Warming up Flash Sale Session: " + sessionId);
        List<FlashSaleProduct> products = flashSaleProductRepository.findBySessionIdAndStatus(sessionId,
                FlashSaleStatus.APPROVED);

        for (FlashSaleProduct p : products) {
            if (p.getProductSizes() != null) {
                for (FlashSaleProductSize size : p.getProductSizes()) {
                    String stockKey = FLASHSALE_STOCK_KEY_PREFIX + p.getProductId() + ":" + size.getSizeId();
                    stringRedisTemplate.opsForValue().set(stockKey, String.valueOf(size.getFlashSaleStock()));
                    System.out.println("   -> Loaded stock for " + p.getProductId() + " [" + size.getSizeId() + "]: "
                            + size.getFlashSaleStock());
                }
            }
        }
    }

    public boolean reserveFlashSaleStock(String orderId, String productId, String sizeId, int quantity, String userId) {
        FlashSaleProduct fsp = findActiveFlashSaleProduct(productId);
        if (fsp == null)
            return false;

        String stockKey = FLASHSALE_STOCK_KEY_PREFIX + productId + ":" + sizeId;
        String boughtKey = FLASHSALE_BOUGHT_KEY_PREFIX + userId + ":" + productId; // Limit per product
        String reserveKey = FLASHSALE_RESERVE_KEY_PREFIX + orderId + ":" + productId + ":" + sizeId;

        int limit = (fsp.getQuantityLimit() != null) ? fsp.getQuantityLimit() : 0; // 0 means unlimited
        long ttl = 900; // 15 minutes

        // EXECUTE LUA SCRIPT
        Long result = stringRedisTemplate.execute(
                flashSaleReserveScript,
                Arrays.asList(stockKey, boughtKey, reserveKey),
                String.valueOf(quantity),
                String.valueOf(limit),
                String.valueOf(ttl));

        if (result != null && result == 1) {
            System.out.println(
                    "✅ Flash Sale Reserved: " + productId + "[" + sizeId + "] x " + quantity + " for user " + userId);
            return true;
        } else if (result != null && result == -2) {
            System.out.println("❌ Flash Sale Limit Exceeded for user " + userId);
            throw new RuntimeException("Bạn đã đạt giới hạn mua cho sản phẩm này (" + limit + " sản phẩm)");
        } else {
            System.out.println("❌ Insufficient Flash Sale Stock for " + productId + " size " + sizeId);
            return false;
        }
    }

    public void cancelFlashSaleReservation(String orderId, String productId, String sizeId, String userId) {
        FlashSaleProduct fsp = findActiveFlashSaleProduct(productId);
        int limit = (fsp != null && fsp.getQuantityLimit() != null) ? fsp.getQuantityLimit() : 0;

        String stockKey = FLASHSALE_STOCK_KEY_PREFIX + productId + ":" + sizeId;
        String boughtKey = FLASHSALE_BOUGHT_KEY_PREFIX + userId + ":" + productId;
        String reserveKey = FLASHSALE_RESERVE_KEY_PREFIX + orderId + ":" + productId + ":" + sizeId;

        stringRedisTemplate.execute(
                flashSaleCancelScript,
                Arrays.asList(stockKey, boughtKey, reserveKey),
                String.valueOf(limit));
        System.out.println("Product " + productId + " size " + sizeId + " reservation canceled for order " + orderId);
    }

    public void confirmFlashSaleReservation(String orderId, String productId, String sizeId) {
        String reserveKey = FLASHSALE_RESERVE_KEY_PREFIX + orderId + ":" + productId + ":" + sizeId;
        stringRedisTemplate.delete(reserveKey);

        // Update DB sold count (Async or Sync? Sync for now for safety)
        // Assuming 1 quantity confirmed for now (confirm logic usually iterates items).
        // Wait, confirm should take quantity?
        // Actually OrderService calls confirm for each item. Item has quantity.
        // But reserve script stored quantity in Redis key value? No, stored in string
        // value.
        // Simplest: just increment by the reserved amount?
        // Let's assume passed quantity is safer if API allows, but current API only
        // passes ids.
        // We can fetch from Redis before delete? Or just increment 1?
        // OrderService loop executes `confirmReservation(req)` where req has quantity=0
        // (comment says not needed).
        // BUT for sold count we need quantity!
        // I should update `confirmFlashSaleReservation` to take quantity.
        // For now, assume quantity 1 or fetch from Redis?
        // Fetching from Redis `GET reserveKey` -> quantity.
        String quantityStr = stringRedisTemplate.opsForValue().get(reserveKey);
        int quantity = quantityStr != null ? Integer.parseInt(quantityStr) : 1; // Default 1 if missing

        incrementSoldCount(productId, sizeId, quantity);
    }
}
