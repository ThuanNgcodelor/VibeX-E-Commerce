package com.example.stockservice.controller;

import com.example.stockservice.service.reservation.StockReservationService;
import com.example.stockservice.service.reservation.StockReservationService.ReservationResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST Controller cho Stock Reservation operations.
 * Chỉ cho phép internal calls (từ order-service).
 */
@RestController
@RequestMapping("/v1/stock/reservation")
@RequiredArgsConstructor
@Slf4j
public class ReservationController {
    private final StockReservationService reservationService;
    private final com.example.stockservice.service.flashsale.FlashSaleService flashSaleService;
    private final com.example.stockservice.repository.FlashSaleProductRepository flashSaleProductRepository;
    private final org.springframework.data.redis.core.StringRedisTemplate stringRedisTemplate;

    /**
     * Reserve stock for an order
     * POST /v1/stock/reservation/reserve
     * Request body: { orderId, productId, sizeId, quantity }
     * Response: { success: true/false, status, reservedQuantity/message }
     */
    @PostMapping("/reserve")
    public ResponseEntity<?> reserveStock(@RequestBody ReserveRequest request) {
        log.info("[API] Reserve request: orderId={}, product={}, size={}, qty={}",
                request.orderId(), request.productId(), request.sizeId(), request.quantity());

        // CHECK if this is a Flash Sale item
        boolean isFlashSale = isFlashSaleProduct(request.productId());

        if (isFlashSale) {
            // Route to Flash Sale Service
            log.info("[API] Routing to Flash Sale service for product={}", request.productId());
            try {
                boolean reserved = flashSaleService.reserveFlashSaleStock(
                        request.orderId(),
                        request.productId(),
                        request.sizeId(),
                        request.quantity(),
                        "system" // userId - can be extracted from context if needed
                );

                if (reserved) {
                    return ResponseEntity.ok(Map.of(
                            "success", true,
                            "status", "FLASH_SALE_RESERVED",
                            "reservedQuantity", request.quantity()));
                } else {
                    return ResponseEntity.badRequest().body(Map.of(
                            "success", false,
                            "status", "FLASH_SALE_SOLD_OUT",
                            "message", "Flash Sale item is sold out or limit reached"));
                }
            } catch (Exception e) {
                log.error("[API] Flash Sale reservation failed: {}", e.getMessage());
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "status", "FLASH_SALE_ERROR",
                        "message", e.getMessage()));
            }
        }

        // Regular reservation for non-Flash Sale items
        ReservationResult result = reservationService.reserveStock(
                request.orderId(),
                request.productId(),
                request.sizeId(),
                request.quantity());

        if (result.isSuccess()) {
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "status", result.getStatus(),
                    "reservedQuantity", result.getReservedQuantity()));
        } else {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "status", result.getStatus(),
                    "message", result.getMessage()));
        }
    }

    /**
     * Check if product is currently in an active Flash Sale
     * Simply check if product has APPROVED Flash Sale registration
     */
    private boolean isFlashSaleProduct(String productId) {
        try {
            java.util.List<com.example.stockservice.model.FlashSaleProduct> flashSaleProducts = flashSaleProductRepository
                    .findByProductIdAndStatus(
                            productId,
                            com.example.stockservice.enums.FlashSaleStatus.APPROVED);

            boolean isFlashSale = !flashSaleProducts.isEmpty();
            log.debug("[API] Flash Sale check for product {}: {}", productId, isFlashSale);
            return isFlashSale;
        } catch (Exception e) {
            log.warn("[API] Failed to check Flash Sale status for product {}: {}", productId, e.getMessage());
            return false;
        }
    }

    /**
     * Confirm reservation (after payment/order success)
     * POST /v1/stock/reservation/confirm
     * Request body: { orderId, productId, sizeId }
     */
    @PostMapping("/confirm")
    public ResponseEntity<?> confirmReservation(@RequestBody ReserveRequest request) {
        log.info("[API] Confirm request: orderId={}, product={}, size={}",
                request.orderId(), request.productId(), request.sizeId());

        reservationService.confirmReservation(
                request.orderId(),
                request.productId(),
                request.sizeId());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Reservation confirmed"));
    }

    /**
     * Cancel reservation and rollback stock
     * POST /v1/stock/reservation/cancel
     * Request body: { orderId, productId, sizeId }
     * Response: { success: true, rolledBackQuantity }
     */
    @PostMapping("/cancel")
    public ResponseEntity<?> cancelReservation(@RequestBody ReserveRequest request) {
        log.info("[API] Cancel request: orderId={}, product={}, size={}",
                request.orderId(), request.productId(), request.sizeId());

        int rolledBack = reservationService.cancelReservation(
                request.orderId(),
                request.productId(),
                request.sizeId());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "rolledBackQuantity", rolledBack));
    }

    /**
     * Get current stock from cache
     * GET /v1/stock/reservation/stock/{productId}/{sizeId}
     */
    @GetMapping("/stock/{productId}/{sizeId}")
    public ResponseEntity<?> getStock(
            @PathVariable String productId,
            @PathVariable String sizeId) {

        int stock = reservationService.getStock(productId, sizeId);

        if (stock < 0) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(Map.of(
                "productId", productId,
                "sizeId", sizeId,
                "stock", stock));
    }

    /**
     * Request DTO for reservation operations
     */
    public record ReserveRequest(
            String orderId,
            String productId,
            String sizeId,
            int quantity) {
    }
}
