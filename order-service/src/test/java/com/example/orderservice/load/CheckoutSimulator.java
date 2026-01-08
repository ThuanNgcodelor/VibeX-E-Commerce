package com.example.orderservice.load;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Simulates checkout for one user
 */
@Slf4j
@RequiredArgsConstructor
public class CheckoutSimulator implements Runnable {
    private final TestUser user;
    private final List<TestProduct> availableProducts;
    private final LoadTestConfig config;
    private final MetricsCollector metrics;
    private final int ordersToCreate;
    
    @Override
    public void run() {
        RestTemplate restTemplate = new RestTemplate();
        
        for (int i = 0; i < ordersToCreate; i++) {
            try {
                // Random delay to simulate user behavior
                Thread.sleep(ThreadLocalRandom.current().nextInt(100, 500));
                
                // Select random product
                TestProduct product = availableProducts.get(
                    ThreadLocalRandom.current().nextInt(availableProducts.size())
                );
                
                // Select random payment method based on distribution
                String paymentMethod = selectPaymentMethod();
                
                // Build checkout request
                Map<String, Object> request = buildCheckoutRequest(user, product, paymentMethod);
                
                // Call API through gateway
                long start = System.currentTimeMillis();
                try {
                    ResponseEntity<String> response = restTemplate.postForEntity(
                        config.getGatewayUrl() + "/order-service/v1/order/create-from-cart",
                        createHttpEntity(request),
                        String.class
                    );
                    
                    long latency = System.currentTimeMillis() - start;
                    
                    if (response.getStatusCode().is2xxSuccessful()) {
                        metrics.recordSuccess(latency);
                        log.debug("[{}] Order {} created successfully in {}ms", 
                            user.getUsername(), i + 1, latency);
                    } else {
                        metrics.recordFailure(latency);
                        log.warn("[{}] Order {} failed with status: {}", 
                            user.getUsername(), i + 1, response.getStatusCode());
                    }
                    
                } catch (Exception e) {
                    long latency = System.currentTimeMillis() - start;
                    metrics.recordFailure(latency);
                    log.error("[{}] Order {} failed: {}", user.getUsername(), i + 1, e.getMessage());
                }
                
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        
        log.info("[{}] Completed {} orders", user.getUsername(), ordersToCreate);
    }
    
    private String selectPaymentMethod() {
        int random = ThreadLocalRandom.current().nextInt(100);
        if (random < config.getCodPercent()) {
            return "COD";
        } else if (random < config.getCodPercent() + config.getVnpayPercent()) {
            return "VNPAY";
        } else {
            return "MOMO";
        }
    }
    
    private Map<String, Object> buildCheckoutRequest(TestUser user, TestProduct product, String paymentMethod) {
        Map<String, Object> request = new HashMap<>();
        request.put("userId", user.getUserId());
        request.put("paymentMethod", paymentMethod);
        request.put("addressId", user.getAddressId());
        
        // Selected items
        List<Map<String, Object>> items = new ArrayList<>();
        Map<String, Object> item = new HashMap<>();
        item.put("productId", product.getProductId());
        item.put("sizeId", product.getSizeId());
        item.put("quantity", ThreadLocalRandom.current().nextInt(1, 4)); // 1-3 items
        items.add(item);
        
        request.put("selectedItems", items);
        
        // Optional: voucherId (10% chance)
        if (ThreadLocalRandom.current().nextInt(100) < 10) {
            request.put("voucherId", "test-voucher-id");
        }
        
        return request;
    }
    
    private HttpEntity<Map<String, Object>> createHttpEntity(Map<String, Object> request) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        // If you need auth token:
        // headers.set("Authorization", "Bearer " + user.getToken());
        return new HttpEntity<>(request, headers);
    }
}
