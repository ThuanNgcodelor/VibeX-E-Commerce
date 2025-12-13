package com.example.orderservice.controller;

import com.example.orderservice.dto.SelectedItemDto;
import com.example.orderservice.repository.OrderRepository;
import com.example.orderservice.request.CheckOutKafkaRequest;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * ✅ ORDER THROUGHPUT TEST CONTROLLER
 * 
 * Controller để test throughput của Order Service
 * Gửi JSON request → Tự động gửi checkout requests vào Kafka → Trả về kết quả
 * 
 * Endpoints:
 * - POST /v1/test/checkout/throughput - Test checkout throughput với số lượng tùy chỉnh
 * - GET /v1/test/checkout/stats - Xem thống kê orders đã xử lý
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/v1/test/checkout")
public class OrderThroughputTestController {

    private final KafkaTemplate<String, CheckOutKafkaRequest> kafkaTemplate;
    private final OrderRepository orderRepository;

    @Value("${kafka.topic.order}")
    private String orderTopic;

    // Counter để track số orders đã được xử lý
    private static final AtomicInteger totalProcessed = new AtomicInteger(0);
    private static long lastTestStartTime = 0;
    private static long lastTestEndTime = 0;
    private static int lastTestTotalOrders = 0;

    /**
     * Test checkout throughput: Gửi nhiều checkout requests và đo tốc độ xử lý
     * 
     * Request Body:
     * {
     *   "totalOrders": 1000,
     *   "batchSize": 100,
     *   "addressId": "address-1",
     *   "paymentMethod": "COD"
     * }
     * 
     * Response:
     * {
     *   "success": true,
     *   "totalOrders": 1000,
     *   "ordersProcessed": 1000,
     *   "sendTime": 1234,
     *   "processingTime": 6667,
     *   "throughput": 150.00,
     *   "message": "Test completed"
     * }
     */
    @PostMapping("/throughput")
    public ResponseEntity<Map<String, Object>> testCheckoutThroughput(@RequestBody CheckoutTestRequest request) {
        int totalOrders = request.getTotalOrders() != null ? request.getTotalOrders() : 1000;
        int batchSize = request.getBatchSize() != null ? request.getBatchSize() : 100;
        String addressId = request.getAddressId() != null ? request.getAddressId() : "test-address-1";
        String paymentMethod = request.getPaymentMethod() != null ? request.getPaymentMethod() : "COD";

        log.info("");
        log.info("╔════════════════════════════════════════════════════════════╗");
        log.info("║         CHECKOUT THROUGHPUT TEST (REST API)              ║");
        log.info("║         Tự động gửi {} checkout requests                 ║", totalOrders);
        log.info("╚════════════════════════════════════════════════════════════╝");
        log.info("");

        // Reset counter
        totalProcessed.set(0);
        int initialCount = (int) orderRepository.count();

        // Bước 1: Gửi checkout requests vào Kafka
        log.info("📤 Đang gửi {} checkout requests vào Kafka...", totalOrders);
        long sendStartTime = System.currentTimeMillis();
        lastTestStartTime = sendStartTime;

        // Gửi requests theo batch
        for (int batch = 0; batch < totalOrders / batchSize; batch++) {
            for (int i = 0; i < batchSize; i++) {
                int orderIndex = batch * batchSize + i;
                String userId = "user-" + (orderIndex % 100);
                
                // Tạo selected items (test data với prefix "test-product-" để skip validation)
                List<SelectedItemDto> selectedItems = new ArrayList<>();
                SelectedItemDto item = new SelectedItemDto();
                // ✅ Sử dụng prefix "test-product-" để consumer skip validation
                item.setProductId("test-product-" + (orderIndex % 50));
                item.setSizeId("test-size-" + (orderIndex % 10));
                item.setQuantity(1 + (orderIndex % 3)); // 1-3 items
                item.setUnitPrice(100000.0 + (orderIndex % 10) * 10000); // 100k - 190k
                selectedItems.add(item);

                CheckOutKafkaRequest checkoutRequest = CheckOutKafkaRequest.builder()
                        .userId(userId)
                        .addressId(addressId)
                        .cartId("cart-" + orderIndex)
                        .selectedItems(selectedItems)
                        .paymentMethod(paymentMethod)
                        .build();

                String partitionKey = userId;
                kafkaTemplate.send(orderTopic, partitionKey, checkoutRequest);
            }
            
            if ((batch + 1) % 10 == 0) {
                log.info("   ✓ Đã gửi {}/{} checkout requests", (batch + 1) * batchSize, totalOrders);
            }
        }

        long sendEndTime = System.currentTimeMillis();
        long sendTime = sendEndTime - sendStartTime;
        log.info("✅ Hoàn thành gửi {} checkout requests trong {} ms", totalOrders, sendTime);
        log.info("");

        // Bước 2: Đợi và đếm orders được xử lý
        log.info("⏳ Đang chờ orders được xử lý...");
        log.info("   (Đang đếm số orders đã được tạo trong database)");
        log.info("   ✅ Sử dụng test products (prefix 'test-product-') - validation sẽ được skip");
        
        long processStartTime = sendEndTime;
        int processed = 0;
        long timeout = System.currentTimeMillis() + 600000; // 10 phút timeout
        int lastLoggedCount = initialCount;

        while (System.currentTimeMillis() < timeout) {
            processed = (int) orderRepository.count() - initialCount;
            
            if (processed - lastLoggedCount >= 50) {
                log.info("   📊 Đã xử lý: {}/{} orders", processed, totalOrders);
                lastLoggedCount = processed;
            }
            
            if (processed >= totalOrders) {
                break;
            }
            
            try {
                Thread.sleep(1000); // Check mỗi 1 giây
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }

        long processEndTime = System.currentTimeMillis();
        long processingTime = processEndTime - processStartTime;
        lastTestEndTime = processEndTime;
        lastTestTotalOrders = totalOrders;
        totalProcessed.set(processed);
        
        // Tính toán metrics
        double throughput = processingTime > 0 ? (processed * 1000.0) / processingTime : 0;
        double sendRate = sendTime > 0 ? (totalOrders * 1000.0) / sendTime : 0;

        // Log kết quả
        logResults(totalOrders, processed, sendTime, processingTime, sendRate, throughput);

        // Build response
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("totalOrders", totalOrders);
        response.put("ordersProcessed", processed);
        response.put("sendTime", sendTime);
        response.put("processingTime", processingTime);
        response.put("sendRate", String.format("%.2f", sendRate));
        response.put("throughput", String.format("%.2f", throughput));
        
        if (throughput < 5) {
            response.put("status", "LOW");
            response.put("message", "⚠️ Throughput is LOW - Check Kafka consumer concurrency and database performance");
        } else if (throughput >= 20) {
            response.put("status", "EXCELLENT");
            response.put("message", "✅ Throughput is EXCELLENT - System is handling orders efficiently");
            response.put("improvement", String.format("%.1fx", throughput / 5));
        } else {
            response.put("status", "MEDIUM");
            response.put("message", "⚠️ Throughput is MEDIUM - Target: 20-30 orders/sec");
        }

        return ResponseEntity.ok(response);
    }

    /**
     * Quick test với 100 orders (test nhanh)
     * 
     * POST /v1/test/checkout/throughput/quick
     */
    @PostMapping("/throughput/quick")
    public ResponseEntity<Map<String, Object>> testCheckoutThroughputQuick() {
        CheckoutTestRequest request = new CheckoutTestRequest();
        request.setTotalOrders(100);
        request.setBatchSize(10);
        request.setAddressId("test-address-1");
        request.setPaymentMethod("COD");
        return testCheckoutThroughput(request);
    }

    /**
     * Xem thống kê orders đã xử lý
     * 
     * GET /v1/test/checkout/stats
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        long totalInDb = orderRepository.count();
        int processed = totalProcessed.get();
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalOrdersInDatabase", totalInDb);
        stats.put("lastTestProcessed", processed);
        stats.put("lastTestTotalOrders", lastTestTotalOrders);
        
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
    private void logResults(int totalOrders, int processed, long sendTime, 
                           long processingTime, double sendRate, double throughput) {
        log.info("");
        log.info("═══════════════════════════════════════════════════════════════");
        log.info("              CHECKOUT THROUGHPUT TEST RESULTS");
        log.info("═══════════════════════════════════════════════════════════════");
        log.info("Total orders sent:        {}", totalOrders);
        log.info("Orders processed:         {}", processed);
        log.info("Send time:                {} ms", sendTime);
        log.info("Processing time:          {} ms ({} seconds)", 
                 processingTime, String.format("%.3f", processingTime / 1000.0));
        log.info("Send rate:                {} orders/sec", String.format("%.2f", sendRate));
        log.info("Throughput:               {} orders/sec", String.format("%.2f", throughput));
        log.info("═══════════════════════════════════════════════════════════════");
        log.info("");

        if (throughput < 5) {
            log.warn("⚠️  Throughput is LOW: {} orders/sec", String.format("%.2f", throughput));
            log.warn("   → Check Kafka consumer concurrency (should be 10)");
            log.warn("   → Check database performance");
            log.warn("   → Check stock service availability");
        } else if (throughput >= 20) {
            log.info("✅ Throughput is EXCELLENT: {} orders/sec", String.format("%.2f", throughput));
            log.info("   → System is handling orders efficiently");
        } else {
            log.info("⚠️  Throughput is MEDIUM: {} orders/sec", String.format("%.2f", throughput));
            log.info("   → Target: 20-30 orders/sec");
        }
        log.info("");
    }

    /**
     * Request DTO
     */
    @Data
    public static class CheckoutTestRequest {
        private Integer totalOrders = 1000;  // Số checkout requests muốn gửi
        private Integer batchSize = 100;     // Số requests gửi mỗi batch
        private String addressId = "test-address-1";  // Address ID để test
        private String paymentMethod = "COD";  // Payment method (COD, VNPAY, CARD)
    }
}

