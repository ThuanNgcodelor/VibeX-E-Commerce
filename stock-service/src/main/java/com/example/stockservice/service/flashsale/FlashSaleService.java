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
import com.example.stockservice.request.flashsale.FlashSaleProductRegistrationRequest;
import com.example.stockservice.request.flashsale.FlashSaleSessionRequest;
import com.example.stockservice.client.ShopOwnerClient;
import com.example.stockservice.dto.ShopOwnerDto;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FlashSaleService {

    private final FlashSaleSessionRepository sessionRepository;
    private final FlashSaleProductRepository flashSaleProductRepository;
    private final ProductRepository productRepository;
    private final NotificationClient notificationClient;
    private final ShopOwnerClient shopOwnerClient;
    private final KafkaTemplate<String, ProductUpdateKafkaEvent> kafkaTemplate;

    @org.springframework.beans.factory.annotation.Value("${kafka.topic.product-updates}")
    private String productUpdatesTopic;

    // --- Admin: Session Management ---

    @Transactional
    public FlashSaleSession createSession(FlashSaleSessionRequest request) {
        // Validation 1: End Time > Start Time
        if (request.getEndTime().isBefore(request.getStartTime())) {
            throw new RuntimeException("Thời gian kết thúc phải sau thời gian bắt đầu!");
        }
        // Validation 2: Check for overlaps
        // List<FlashSaleSession> overlaps =
        // sessionRepository.findOverlappingSessions(request.getStartTime(),
        // request.getEndTime());
        // if (!overlaps.isEmpty()) {
        // throw new RuntimeException(
        // "Thời gian bị trùng với phiên Flash Sale khác! (" + overlaps.get(0).getName()
        // + ")");
        // }

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

        FlashSaleProduct flashSaleProduct = FlashSaleProduct.builder()
                .sessionId(request.getSessionId())
                .productId(request.getProductId())
                .shopId(shopId)
                .originalPrice(product.getPrice()) // Assuming base price
                .salePrice(request.getSalePrice())
                .flashSaleStock(
                        product.getSizes().stream().mapToInt(com.example.stockservice.model.Size::getStock).sum())
                .soldCount(0)
                .status(FlashSaleStatus.PENDING)
                .build();

        // Thêm hàm sendMessage giống bên 273 ProductServiceImpl
        //

        return flashSaleProductRepository.save(flashSaleProduct);
    }

    // --- Admin: Approval ---

    @Transactional
    public FlashSaleProduct approveProduct(String flashSaleProductId) {
        FlashSaleProduct fsp = flashSaleProductRepository.findById(flashSaleProductId)
                .orElseThrow(() -> new RuntimeException("Registration not found"));
        fsp.setStatus(FlashSaleStatus.APPROVED);
        FlashSaleProduct saved = flashSaleProductRepository.save(fsp);

        // Publish event to sync cart items with flash sale price
        try {
            kafkaTemplate.send(productUpdatesTopic, new ProductUpdateKafkaEvent(saved.getProductId()));
        } catch (Exception e) {
            System.err.println("Failed to send Kafka event for flash sale approval: " + e.getMessage());
        }

        return saved;
    }

    @Transactional
    public FlashSaleProduct rejectProduct(String flashSaleProductId, String reason) {
        FlashSaleProduct fsp = flashSaleProductRepository.findById(flashSaleProductId)
                .orElseThrow(() -> new RuntimeException("Registration not found"));
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
    public void incrementSoldCount(String productId, int quantity) {
        FlashSaleProduct fsp = findActiveFlashSaleProduct(productId);
        if (fsp != null) {
            System.out.println("Incrementing Sold Count for FlashSaleProduct: " + fsp.getId() + ", current sold: "
                    + fsp.getSoldCount() + ", adding: " + quantity);
            fsp.setSoldCount(fsp.getSoldCount() + quantity);
            flashSaleProductRepository.save(fsp);
        } else {
            System.out.println("Active Flash Sale Product NOT FOUND for productId: " + productId);
        }
    }
}
