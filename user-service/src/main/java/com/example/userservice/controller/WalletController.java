package com.example.userservice.controller;

import com.example.userservice.dto.AddRefundRequest;
import com.example.userservice.jwt.JwtUtil;
import com.example.userservice.model.UserWallet;
import com.example.userservice.model.UserWalletEntry;
import com.example.userservice.dto.AddDepositRequest;
import com.example.userservice.dto.WithdrawRequest;
import com.example.userservice.service.wallet.UserWalletService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;

import java.util.Map;

@RestController
@RequestMapping("/v1/user/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final UserWalletService walletService;
    private final com.example.userservice.service.wallet.AdminWalletService adminWalletService;
    private final JwtUtil jwtUtil;

    @GetMapping("/balance")
    public ResponseEntity<Map<String, Object>> getWalletBalance(HttpServletRequest request) {
        String userId = getUserIdFromRequest(request);
        UserWallet wallet = walletService.getOrCreateWallet(userId);

        Map<String, Object> response = new HashMap<>();
        response.put("balanceAvailable", wallet.getBalanceAvailable());
        response.put("balancePending", wallet.getBalancePending());
        response.put("totalDeposits", wallet.getTotalDeposits());
        response.put("totalWithdrawals", wallet.getTotalWithdrawals());
        response.put("totalRefunds", wallet.getTotalRefunds());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/withdraw")
    public ResponseEntity<Map<String, Object>> withdraw(@RequestBody WithdrawRequest request,
            HttpServletRequest httpRequest) {
        String userId = getUserIdFromRequest(httpRequest);
        UserWallet wallet = walletService.withdraw(
                userId,
                request.getAmount(),
                request.getBankAccount(),
                request.getBankName(),
                request.getAccountHolder());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("balanceAvailable", wallet.getBalanceAvailable());
        response.put("message", "Withdrawal successful");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refund")
    public ResponseEntity<Map<String, Object>> addRefund(
            @RequestBody AddRefundRequest request,
            HttpServletRequest httpRequest) {
        String userId = getUserIdFromRequest(httpRequest);

        UserWallet wallet = walletService.addRefund(
                userId,
                request.getOrderId(),
                request.getPaymentId(),
                request.getAmount(),
                request.getReason());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("walletId", wallet.getId());
        response.put("balanceAvailable", wallet.getBalanceAvailable());
        response.put("message", "Refund added to wallet successfully");

        return ResponseEntity.ok(response);
    }

    @GetMapping("/entries")
    public ResponseEntity<org.springframework.data.domain.Page<UserWalletEntry>> getWalletEntries(
            HttpServletRequest request,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        String userId = getUserIdFromRequest(request);
        return ResponseEntity.ok(walletService.getEntries(userId, page, size));
    }

    // Internal API for order-service
    @PostMapping("/internal/refund")
    public ResponseEntity<Map<String, Object>> addRefundInternal(@RequestBody AddRefundRequest request) {
        // Validate userId is provided
        if (request.getUserId() == null || request.getUserId().trim().isEmpty()) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "UserId is required");
            return ResponseEntity.badRequest().body(errorResponse);
        }

        try {
            UserWallet wallet = walletService.addRefund(
                    request.getUserId(),
                    request.getOrderId(),
                    request.getPaymentId(),
                    request.getAmount(),
                    request.getReason());

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("walletId", wallet.getId());
            response.put("balanceAvailable", wallet.getBalanceAvailable());
            response.put("message", "Refund added to wallet successfully");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Failed to add refund: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    @PostMapping("/internal/payment")
    public ResponseEntity<Map<String, Object>> processPaymentInternal(@RequestBody AddRefundRequest request) {
        // Reusing AddRefundRequest for simplicity (userId, amount, orderId)
        if (request.getUserId() == null || request.getUserId().trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "UserId is required"));
        }

        try {
            UserWallet wallet = walletService.payOrder(
                    request.getUserId(),
                    request.getAmount(),
                    request.getOrderId() // Can be null/temp if order not created yet, but preferred to have it
            );

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("walletId", wallet.getId());
            response.put("balanceAvailable", wallet.getBalanceAvailable());
            response.put("message", "Payment successful");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", e.getMessage()); // Likely insufficient balance
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }

    @PostMapping("/deposit/direct")
    public ResponseEntity<Map<String, Object>> depositDirect(@RequestBody AddDepositRequest request,
            HttpServletRequest httpRequest) {
        String userId = getUserIdFromRequest(httpRequest);
        UserWallet wallet = walletService.depositDirect(userId, request.getAmount());

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("balanceAvailable", wallet.getBalanceAvailable());
        response.put("message", "Direct deposit successful");
        return ResponseEntity.ok(response);
    }

    // ============ ADMIN WALLET APIs ============

    @PostMapping("/internal/admin/commission")
    public ResponseEntity<Map<String, Object>> addAdminCommission(@RequestBody AddRefundRequest request) {
        System.out.println("Received Admin Commission Deposit Request: " + request);

        // We reuse AddRefundRequest or create a new DTO. Reusing for simplicity as it
        // has userId (can be orderId), amount, reason.
        // Actually, let's look at the request param. It expects AddRefundRequest?
        // Let's create a specific DTO for clarity or use Map if lazy, but DTO is
        // better.
        // For now, I'll use AddRefundRequest but map fields: orderId -> orderId, amount
        // -> amount, reason -> description.

        try {
            com.example.userservice.model.AdminWallet wallet;
            if ("SUBSCRIPTION".equalsIgnoreCase(request.getPaymentId())) {
                wallet = adminWalletService.depositSubscription(
                        request.getOrderId(),
                        request.getAmount(),
                        request.getReason());
            } else {
                wallet = adminWalletService.depositCommission(
                        request.getOrderId(),
                        request.getAmount(),
                        request.getReason());
            }

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("adminWalletId", wallet.getId());
            response.put("newBalance", wallet.getBalance());
            response.put("message", "Deposit successful");

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "Failed to deposit commission: " + e.getMessage());
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }

    @GetMapping("/admin/balance")
    public ResponseEntity<com.example.userservice.model.AdminWallet> getAdminWalletBalance() {
        // TODO: Add proper Role check (ROLE_ADMIN) here or in SecurityConfig
        return ResponseEntity.ok(adminWalletService.getWallet());
    }

    @GetMapping("/admin/entries")
    public ResponseEntity<org.springframework.data.domain.Page<com.example.userservice.model.AdminWalletEntry>> getAdminWalletEntries(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        // TODO: Add proper Role check (ROLE_ADMIN)
        return ResponseEntity.ok(adminWalletService.getEntries(page, size));
    }

    private String getUserIdFromRequest(HttpServletRequest request) {
        // Check if internal call (from order-service)
        if ("true".equals(request.getHeader("X-Internal-Call"))) {
            // For internal calls, userId should be in request body or header
            return request.getHeader("X-User-Id");
        }
        // Extract from JWT token for external calls
        return jwtUtil.ExtractUserId(request);
    }
}
