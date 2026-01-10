package com.example.stockservice.controller;

import com.example.stockservice.jwt.JwtUtil;
import com.example.stockservice.model.FlashSaleProduct;
import com.example.stockservice.model.FlashSaleSession;
import com.example.stockservice.request.flashsale.FlashSaleProductRegistrationRequest;
import com.example.stockservice.request.flashsale.FlashSaleSessionRequest;
import com.example.stockservice.service.flashsale.FlashSaleService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/v1/stock/flash-sale")
@RequiredArgsConstructor
public class FlashSaleController {

    private final FlashSaleService flashSaleService;
    private final JwtUtil jwtUtil;

    // --- Admin Endpoints ---
    @PostMapping("/session")
    public ResponseEntity<FlashSaleSession> createSession(@RequestBody FlashSaleSessionRequest request) {
        // Ideally check if user is ADMIN using PreAuthorize or Role check
        return ResponseEntity.ok(flashSaleService.createSession(request));
    }

    @PostMapping("/session/{id}/open")
    public ResponseEntity<Void> openSession(@PathVariable String id) {
        flashSaleService.openRegistrationAndNotify(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/session/{id}")
    public ResponseEntity<Void> deleteSession(@PathVariable String id) {
        flashSaleService.deleteSession(id);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/session/{id}/status")
    public ResponseEntity<FlashSaleSession> toggleSessionStatus(@PathVariable String id) {
        return ResponseEntity.ok(flashSaleService.toggleSessionStatus(id));
    }

    @PostMapping("/approve/{id}")
    public ResponseEntity<FlashSaleProduct> approveProduct(@PathVariable String id) {
        return ResponseEntity.ok(flashSaleService.approveProduct(id));
    }

    @PostMapping("/reject/{id}")
    public ResponseEntity<FlashSaleProduct> rejectProduct(@PathVariable String id, @RequestParam String reason) {
        return ResponseEntity.ok(flashSaleService.rejectProduct(id, reason));
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<FlashSaleSession>> getAllSessions() {
        return ResponseEntity.ok(flashSaleService.getAllSessions());
    }

    @GetMapping("/session/{id}/products")
    public ResponseEntity<List<com.example.stockservice.response.flashsale.FlashSaleProductResponse>> getSessionProducts(
            @PathVariable String id) {
        return ResponseEntity.ok(flashSaleService.getProductsBySession(id));
    }

    // --- Shop Owner Endpoints ---

    @PostMapping("/register")
    public ResponseEntity<FlashSaleProduct> registerProduct(@RequestBody FlashSaleProductRegistrationRequest request,
            HttpServletRequest httpRequest) {
        String shopId = jwtUtil.ExtractUserId(httpRequest);
        return ResponseEntity.ok(flashSaleService.registerProduct(shopId, request));
    }

    @GetMapping("/my-registrations")
    public ResponseEntity<List<com.example.stockservice.response.flashsale.FlashSaleProductResponse>> getMyRegistrations(
            HttpServletRequest httpRequest) {
        String shopId = jwtUtil.ExtractUserId(httpRequest);
        return ResponseEntity.ok(flashSaleService.getMyRegistrations(shopId));
    }

    // --- Public / User Endpoints ---

    @GetMapping("/public/current")
    public ResponseEntity<FlashSaleSession> getCurrentSession() {
        return ResponseEntity.ok(flashSaleService.getActiveSession());
    }

    @GetMapping("/public/sessions")
    public ResponseEntity<List<FlashSaleSession>> getAllPublicSessions() {
        return ResponseEntity.ok(flashSaleService.getComingSessions());
    }

    @GetMapping("/public/session/{id}/products")
    public ResponseEntity<List<com.example.stockservice.response.flashsale.FlashSaleProductResponse>> getPublicSessionProducts(
            @PathVariable String id) {
        return ResponseEntity.ok(flashSaleService.getApprovedProductsBySession(id));
    }

    // --- Internal Endpoint for Order Service ---

    @GetMapping(value = "/available-stock/{productId}", headers = "X-Internal-Call=true")
    public int getAvailableFlashSaleStock(@PathVariable String productId) {
        return flashSaleService.getAvailableFlashSaleStock(productId);
    }

    @PostMapping("/reserve")
    public ResponseEntity<String> reserveStock(
            @RequestParam("orderId") String orderId,
            @RequestParam("productId") String productId,
            @RequestParam("sizeId") String sizeId,
            @RequestParam("quantity") int quantity,
            @RequestParam("userId") String userId) {
        try {
            boolean success = flashSaleService.reserveFlashSaleStock(orderId, productId, sizeId, quantity, userId);
            if (success) {
                return ResponseEntity.ok("Reserved");
            } else {
                return ResponseEntity.badRequest().body("Insufficient stock");
            }
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/confirm")
    public ResponseEntity<String> confirmReservation(
            @RequestParam("orderId") String orderId,
            @RequestParam("productId") String productId,
            @RequestParam("sizeId") String sizeId) {
        flashSaleService.confirmFlashSaleReservation(orderId, productId, sizeId);
        return ResponseEntity.ok("Confirmed");
    }
}
