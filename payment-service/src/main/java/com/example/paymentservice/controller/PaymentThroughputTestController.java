package com.example.paymentservice.controller;

import com.example.paymentservice.dto.CreateVnpayPaymentRequest;
import com.example.paymentservice.repository.PaymentRepository;
import com.example.paymentservice.service.VnpayPaymentService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * ✅ PAYMENT THROUGHPUT TEST CONTROLLER
 * 
 * Controller để test throughput của Payment Service
 * Gửi JSON request → Tự động tạo payment requests → Trả về kết quả
 * 
 * Endpoints:
 * - POST /v1/test/payment/throughput - Test payment throughput với số lượng tùy chỉnh
 * - GET /v1/test/payment/stats - Xem thống kê payments đã xử lý
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/v1/test/payment")
public class PaymentThroughputTestController {

    private final VnpayPaymentService vnpayPaymentService;
    private final PaymentRepository paymentRepository;
    private final HttpServletRequest httpServletRequest;

    // Counter để track số payments đã được xử lý
    private static final AtomicInteger totalProcessed = new AtomicInteger(0);
    private static long lastTestStartTime = 0;
    private static long lastTestEndTime = 0;
    private static int lastTestTotalPayments = 0;

    /**
     * Test payment throughput: Tạo nhiều payment requests và đo tốc độ xử lý
     * 
     * Request Body:
     * {
     *   "totalPayments": 1000,
     *   "batchSize": 100,
     *   "amount": 100000
     * }
     * 
     * Response:
     * {
     *   "success": true,
     *   "totalPayments": 1000,
     *   "paymentsProcessed": 1000,
     *   "sendTime": 1234,
     *   "processingTime": 6667,
     *   "throughput": 150.00,
     *   "message": "Test completed"
     * }
     */
    @PostMapping("/throughput")
    public ResponseEntity<Map<String, Object>> testPaymentThroughput(@RequestBody PaymentTestRequest request) {
        int totalPayments = request.getTotalPayments() != null ? request.getTotalPayments() : 1000;
        int batchSize = request.getBatchSize() != null ? request.getBatchSize() : 100;
        Long amount = request.getAmount() != null ? request.getAmount() : 100000L; // 100k VND

        log.info("");
        log.info("╔════════════════════════════════════════════════════════════╗");
        log.info("║         PAYMENT THROUGHPUT TEST (REST API)               ║");
        log.info("║         Tự động tạo {} payment requests                  ║", totalPayments);
        log.info("╚════════════════════════════════════════════════════════════╝");
        log.info("");

        // Reset counter
        totalProcessed.set(0);
        int initialCount = (int) paymentRepository.count();

        // Bước 1: Tạo payment requests
        log.info("📤 Đang tạo {} payment requests...", totalPayments);
        long sendStartTime = System.currentTimeMillis();
        lastTestStartTime = sendStartTime;

        int successCount = 0;
        int failCount = 0;

        // Tạo payments theo batch
        for (int batch = 0; batch < totalPayments / batchSize; batch++) {
            for (int i = 0; i < batchSize; i++) {
                int paymentIndex = batch * batchSize + i;
                
                try {
                    CreateVnpayPaymentRequest paymentRequest = new CreateVnpayPaymentRequest();
                    paymentRequest.setAmount(amount + (paymentIndex % 10) * 10000); // Vary amount
                    paymentRequest.setOrderInfo("Test payment " + paymentIndex);
                    paymentRequest.setOrderId("order-" + paymentIndex);
                    paymentRequest.setLocale("vn");
                    paymentRequest.setReturnUrl("http://localhost:5173/payment/vnpay/return");

                    // Tạo payment (sẽ lưu vào database)
                    vnpayPaymentService.createPayment(paymentRequest, httpServletRequest);
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    log.warn("Failed to create payment {}: {}", paymentIndex, e.getMessage());
                }
            }
            
            if ((batch + 1) % 10 == 0) {
                log.info("   ✓ Đã tạo {}/{} payment requests (Success: {}, Failed: {})", 
                        (batch + 1) * batchSize, totalPayments, successCount, failCount);
            }
        }

        long sendEndTime = System.currentTimeMillis();
        long sendTime = sendEndTime - sendStartTime;
        log.info("✅ Hoàn thành tạo {} payment requests trong {} ms (Success: {}, Failed: {})", 
                totalPayments, sendTime, successCount, failCount);
        log.info("");

        // Bước 2: Đợi và đếm payments được lưu vào database
        log.info("⏳ Đang đếm payments đã được lưu vào database...");
        
        long processStartTime = sendEndTime;
        int processed = 0;
        long timeout = System.currentTimeMillis() + 60000; // 1 phút timeout
        int lastLoggedCount = initialCount;

        while (System.currentTimeMillis() < timeout) {
            processed = (int) paymentRepository.count() - initialCount;
            
            if (processed - lastLoggedCount >= 50) {
                log.info("   📊 Đã lưu: {}/{} payments", processed, totalPayments);
                lastLoggedCount = processed;
            }
            
            if (processed >= totalPayments) {
                break;
            }
            
            try {
                Thread.sleep(500); // Check mỗi 0.5 giây
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        long processEndTime = System.currentTimeMillis();
        long processingTime = processEndTime - processStartTime;
        lastTestEndTime = processEndTime;
        lastTestTotalPayments = totalPayments;
        totalProcessed.set(processed);
        
        // Tính toán metrics
        double throughput = processingTime > 0 ? (processed * 1000.0) / processingTime : 0;
        double sendRate = sendTime > 0 ? (totalPayments * 1000.0) / sendTime : 0;

        // Log kết quả
        logResults(totalPayments, processed, sendTime, processingTime, sendRate, throughput, successCount, failCount);

        // Build response
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("totalPayments", totalPayments);
        response.put("paymentsProcessed", processed);
        response.put("paymentsCreated", successCount);
        response.put("paymentsFailed", failCount);
        response.put("sendTime", sendTime);
        response.put("processingTime", processingTime);
        response.put("sendRate", String.format("%.2f", sendRate));
        response.put("throughput", String.format("%.2f", throughput));
        
        if (throughput < 10) {
            response.put("status", "LOW");
            response.put("message", "⚠️ Throughput is LOW - Check database performance and service configuration");
        } else if (throughput >= 50) {
            response.put("status", "EXCELLENT");
            response.put("message", "✅ Throughput is EXCELLENT - System is handling payments efficiently");
            response.put("improvement", String.format("%.1fx", throughput / 10));
        } else {
            response.put("status", "MEDIUM");
            response.put("message", "⚠️ Throughput is MEDIUM - Target: 50-100 payments/sec");
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Quick test với 100 payments (test nhanh)
     * 
     * POST /v1/test/payment/throughput/quick
     */
    @PostMapping("/throughput/quick")
    public ResponseEntity<Map<String, Object>> testPaymentThroughputQuick() {
        PaymentTestRequest request = new PaymentTestRequest();
        request.setTotalPayments(100);
        request.setBatchSize(10);
        request.setAmount(100000L);
        return testPaymentThroughput(request);
    }

    /**
     * Xem thống kê payments đã xử lý
     * 
     * GET /v1/test/payment/stats
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        long totalInDb = paymentRepository.count();
        int processed = totalProcessed.get();
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalPaymentsInDatabase", totalInDb);
        stats.put("lastTestProcessed", processed);
        stats.put("lastTestTotalPayments", lastTestTotalPayments);
        
        if (lastTestStartTime > 0 && lastTestEndTime > 0) {
            long processingTime = lastTestEndTime - lastTestStartTime;
            double throughput = processingTime > 0 ? (processed * 1000.0) / processingTime : 0;
            stats.put("lastTestProcessingTime", processingTime);
            stats.put("lastTestThroughput", String.format("%.2f", throughput));
        }
        
        return ResponseEntity.ok(stats);
    }

    /**
     * Log kết quả
     */
    private void logResults(int totalPayments, int processed, long sendTime, 
                           long processingTime, double sendRate, double throughput,
                           int successCount, int failCount) {
        log.info("");
        log.info("═══════════════════════════════════════════════════════════════");
        log.info("              PAYMENT THROUGHPUT TEST RESULTS");
        log.info("═══════════════════════════════════════════════════════════════");
        log.info("Total payments requested:   {}", totalPayments);
        log.info("Payments created:          {} (Failed: {})", successCount, failCount);
        log.info("Payments processed:        {}", processed);
        log.info("Send time:                 {} ms", sendTime);
        log.info("Processing time:            {} ms ({} seconds)", 
                 processingTime, processingTime / 1000.0);
        log.info("Send rate:                 {:.2f} payments/sec", sendRate);
        log.info("Throughput:                {:.2f} payments/sec", throughput);
        log.info("═══════════════════════════════════════════════════════════════");
        log.info("");

        if (throughput < 10) {
            log.warn("⚠️  Throughput is LOW: {:.2f} payments/sec", throughput);
            log.warn("   → Check database performance");
            log.warn("   → Check service configuration");
        } else if (throughput >= 50) {
            log.info("✅ Throughput is EXCELLENT: {:.2f} payments/sec", throughput);
            log.info("   → System is handling payments efficiently");
        } else {
            log.info("⚠️  Throughput is MEDIUM: {:.2f} payments/sec", throughput);
            log.info("   → Target: 50-100 payments/sec");
        }
        log.info("");
    }

    /**
     * Request DTO
     */
    @Data
    public static class PaymentTestRequest {
        private Integer totalPayments = 1000;  // Số payment requests muốn tạo
        private Integer batchSize = 100;       // Số requests tạo mỗi batch
        private Long amount = 100000L;        // Số tiền (VND) - mặc định 100k
    }
}

