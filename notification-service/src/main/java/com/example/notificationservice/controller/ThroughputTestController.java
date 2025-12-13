package com.example.notificationservice.controller;

import com.example.notificationservice.request.SendNotificationRequest;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * ✅ THROUGHPUT TEST CONTROLLER
 * 
 * Controller đơn giản để test throughput của Notification Service
 * Gửi JSON request → Tự động gửi notifications → Trả về kết quả
 * 
 * Endpoints:
 * - POST /v1/test/throughput - Test throughput với số lượng messages tùy chỉnh
 * - GET /v1/test/stats - Xem thống kê notifications đã xử lý
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/v1/test")
public class ThroughputTestController {

    private final KafkaTemplate<String, SendNotificationRequest> kafkaTemplate;
    private final com.example.notificationservice.repository.NotificationRepository notificationRepository;

    // Counter để track số notifications đã được xử lý
    private static final AtomicInteger totalProcessed = new AtomicInteger(0);
    private static long lastTestStartTime = 0;
    private static long lastTestEndTime = 0;
    private static int lastTestTotalMessages = 0;

    /**
     * Test throughput: Gửi nhiều notifications và đo tốc độ xử lý
     * 
     * Request Body:
     * {
     *   "totalMessages": 1000,
     *   "batchSize": 100
     * }
     * 
     * Response:
     * {
     *   "success": true,
     *   "totalMessages": 1000,
     *   "sendTime": 1234,
     *   "processingTime": 6667,
     *   "throughput": 150.00,
     *   "message": "Test completed"
     * }
     */
    //curl.exe -X POST http://localhost:8009/v1/test/throughput/quick
    @PostMapping("/throughput")
    public ResponseEntity<Map<String, Object>> testThroughput(@RequestBody ThroughputTestRequest request) {
        int totalMessages = request.getTotalMessages() != null ? request.getTotalMessages() : 5000;
        int batchSize = request.getBatchSize() != null ? request.getBatchSize() : 500;

        log.info("");
        log.info("╔════════════════════════════════════════════════════════════╗");
        log.info("║              THROUGHPUT TEST (REST API)                  ║");
        log.info("║              Tự động gửi {} notifications                 ║", totalMessages);
        log.info("╚════════════════════════════════════════════════════════════╝");
        log.info("");

        // Reset counter
        totalProcessed.set(0);
        int initialCount = (int) notificationRepository.count();

        // Bước 1: Gửi messages
        log.info("📤 Đang gửi {} messages vào Kafka...", totalMessages);
        long sendStartTime = System.currentTimeMillis();
        lastTestStartTime = sendStartTime;

        // Gửi messages theo batch
        for (int batch = 0; batch < totalMessages / batchSize; batch++) {
            for (int i = 0; i < batchSize; i++) {
                int messageIndex = batch * batchSize + i;
                SendNotificationRequest notificationRequest = SendNotificationRequest.builder()
                        .userId("user-" + (messageIndex % 100))
                        .shopId("shop-" + (messageIndex % 10))
                        .orderId("order-" + messageIndex)
                        .message("Throughput test notification " + messageIndex)
                        .isShopOwnerNotification(messageIndex % 2 == 0)
                        .build();

                String partitionKey = notificationRequest.getUserId();
                kafkaTemplate.send("notification-topic", partitionKey, notificationRequest);
            }
            
            if ((batch + 1) % 10 == 0) {
                log.info("   ✓ Đã gửi {}/{} messages", (batch + 1) * batchSize, totalMessages);
            }
        }

        long sendEndTime = System.currentTimeMillis();
        long sendTime = sendEndTime - sendStartTime;
        log.info("✅ Hoàn thành gửi {} messages trong {} ms", totalMessages, sendTime);
        log.info("");

        // Bước 2: Đợi và đếm messages được xử lý
        log.info("⏳ Đang chờ messages được xử lý...");
        log.info("   (Đang đếm số notifications đã lưu vào database)");
        
        long processStartTime = sendEndTime;
        int processed = 0;
        long timeout = System.currentTimeMillis() + 300000; // 5 phút timeout
        int lastLoggedCount = initialCount;

        while (System.currentTimeMillis() < timeout) {
            processed = (int) notificationRepository.count() - initialCount;
            
            if (processed - lastLoggedCount >= 50) {
                log.info("   📊 Đã xử lý: {}/{} notifications", processed, totalMessages);
                lastLoggedCount = processed;
            }
            
            if (processed >= totalMessages) {
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
        lastTestTotalMessages = totalMessages;
        totalProcessed.set(processed);
        
        // Tính toán metrics
        double throughput = processingTime > 0 ? (processed * 1000.0) / processingTime : 0;
        double sendRate = sendTime > 0 ? (totalMessages * 1000.0) / sendTime : 0;

        // Log kết quả
        logResults(totalMessages, processed, sendTime, processingTime, sendRate, throughput);

        // Build response
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("totalMessages", totalMessages);
        response.put("messagesProcessed", processed);
        response.put("sendTime", sendTime);
        response.put("processingTime", processingTime);
        response.put("sendRate", String.format("%.2f", sendRate));
        response.put("throughput", String.format("%.2f", throughput));
        
        if (throughput < 20) {
            response.put("status", "LOW");
            response.put("message", "⚠️ Throughput is LOW - This is BEFORE optimization (concurrency = 1). Expected: 100-150 after optimization.");
        } else if (throughput >= 100) {
            response.put("status", "EXCELLENT");
            response.put("message", "✅ Throughput is EXCELLENT - This is AFTER optimization (concurrency = 10)");
            response.put("improvement", String.format("%.1fx", throughput / 15));
        } else {
            response.put("status", "MEDIUM");
            response.put("message", "⚠️ Throughput is MEDIUM - Target: 100-150 notifications/sec");
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Xem thống kê notifications đã xử lý
     * 
     * GET /v1/test/stats
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        long totalInDb = notificationRepository.count();
        int processed = totalProcessed.get();
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalNotificationsInDatabase", totalInDb);
        stats.put("lastTestProcessed", processed);
        stats.put("lastTestTotalMessages", lastTestTotalMessages);
        
        if (lastTestStartTime > 0 && lastTestEndTime > 0) {
            long processingTime = lastTestEndTime - lastTestStartTime;
            double throughput = processingTime > 0 ? (processed * 1000.0) / processingTime : 0;
            stats.put("lastTestProcessingTime", processingTime);
            stats.put("lastTestThroughput", String.format("%.2f", throughput));
        }
        
        return ResponseEntity.ok(stats);
    }

    /**
     * Quick test với 100 messages (test nhanh)
     * 
     * POST /v1/test/throughput/quick
     */
    @PostMapping("/throughput/quick")
    public ResponseEntity<Map<String, Object>> testThroughputQuick() {
        ThroughputTestRequest request = new ThroughputTestRequest();
        request.setTotalMessages(100);
        request.setBatchSize(10);
        return testThroughput(request);
    }

    /**
     * Log kết quả
     */
    private void logResults(int totalMessages, int processed, long sendTime, 
                           long processingTime, double sendRate, double throughput) {
        log.info("");
        log.info("═══════════════════════════════════════════════════════════════");
        log.info("              THROUGHPUT TEST RESULTS");
        log.info("═══════════════════════════════════════════════════════════════");
        log.info("Total messages sent:     {}", totalMessages);
        log.info("Messages processed:      {}", processed);
        log.info("Send time:               {} ms", sendTime);
        log.info("Processing time:         {} ms ({} seconds)", 
                 processingTime, processingTime / 1000.0);
        log.info("Send rate:               {:.2f} messages/sec", sendRate);
        log.info("Throughput:              {:.2f} notifications/sec", throughput);
        log.info("═══════════════════════════════════════════════════════════════");
        log.info("");

        if (throughput < 20) {
            log.warn("⚠️  Throughput is LOW: {:.2f} notifications/sec", throughput);
            log.warn("   → Đây là kết quả TRƯỚC TỐI ƯU (concurrency = 1)");
            log.warn("   → Expected: 100-150 notifications/sec SAU TỐI ƯU");
        } else if (throughput >= 100) {
            log.info("✅ Throughput is EXCELLENT: {:.2f} notifications/sec", throughput);
            log.info("   → Đây là kết quả SAU TỐI ƯU (concurrency = 10)");
            log.info("   → Improvement: ~{}x so với trước tối ưu", (int)(throughput / 15));
        } else {
            log.info("⚠️  Throughput is MEDIUM: {:.2f} notifications/sec", throughput);
            log.info("   → Target: 100-150 notifications/sec");
        }
        log.info("");
    }

    /**
     * Request DTO
     */
    @Data
    public static class ThroughputTestRequest {
        private Integer totalMessages = 1000;  // Số messages muốn gửi
        private Integer batchSize = 100;       // Số messages gửi mỗi batch
    }
}

