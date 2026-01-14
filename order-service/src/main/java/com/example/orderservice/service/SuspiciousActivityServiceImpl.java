package com.example.orderservice.service;

import com.example.orderservice.client.NotificationServiceClient;
import com.example.orderservice.client.StockServiceClient;
import com.example.orderservice.client.UserServiceClient;
import com.example.orderservice.dto.ProductDto;
import com.example.orderservice.dto.ShopOwnerDto;
import com.example.orderservice.dto.SuspiciousProductDto;
import com.example.orderservice.repository.OrderRepository;
import com.example.orderservice.request.SendNotificationRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SuspiciousActivityServiceImpl implements SuspiciousActivityService {

    private final OrderRepository orderRepository;
    private final StockServiceClient stockServiceClient;
    private final UserServiceClient userServiceClient;
    private final NotificationServiceClient notificationServiceClient;

    @Override
    public List<SuspiciousProductDto> getSuspiciousProducts() {
        LocalDateTime threeDaysAgo = LocalDateTime.now().minusDays(3);
        Long minOrders = 5L; // Configurable threshold

        // 1. Get raw stats for Cancellation Check
        List<SuspiciousProductDto> rawList = orderRepository.findSuspiciousProductsRaw(threeDaysAgo, minOrders);
        List<SuspiciousProductDto> result = new ArrayList<>();

        // Helper to check if product already in result
        List<String> addedProductIds = new ArrayList<>();

        // --- CHECK 1: High Cancellation Rate ---
        for (SuspiciousProductDto dto : rawList) {
            long total = dto.getTotalOrders();
            long cancelled = dto.getCancelledOrders();

            if (total == 0)
                continue;

            double rate = (double) cancelled / total * 100;
            dto.setCancellationRate(rate);

            if (rate > 80.0) {
                dto.setReason("High Cancellation Rate");
                enrichProductInfo(dto);
                result.add(dto);
                addedProductIds.add(dto.getProductId());
            }
        }

        // --- CHECK 2: Order Fraud (Brushing) ---
        // Logic: Distinct Buyers / Total Orders < 20% (Concentrated buyers)
        List<SuspiciousProductDto> brushingList = orderRepository.findBrushingProductsRaw(threeDaysAgo, minOrders);
        for (SuspiciousProductDto dto : brushingList) {
            if (addedProductIds.contains(dto.getProductId()))
                continue;

            long total = dto.getTotalOrders();
            long uniqueBuyers = dto.getCancelledOrders(); // Reused field for distinct buyers

            if (total == 0)
                continue;

            double buyerRatio = (double) uniqueBuyers / total;

            if (buyerRatio < 0.2) { // Less than 20% unique buyers
                dto.setReason("Potential Brushing (Buyer Concentration)");
                // Reset cancelled orders to 0 or null to avoid confusion, or keep typical
                // values
                dto.setCancelledOrders(0L);
                dto.setCancellationRate(0.0);

                enrichProductInfo(dto);
                result.add(dto);
                addedProductIds.add(dto.getProductId());
            }
        }

        // --- CHECK 3: Price Manipulation ---
        // Logic: Current Price > 5x Avg Sold Price OR (Price < 3000 AND Sold > 20)
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        List<SuspiciousProductDto> priceList = orderRepository.findProductAveragePriceRaw(thirtyDaysAgo);

        for (SuspiciousProductDto dto : priceList) {
            if (addedProductIds.contains(dto.getProductId()))
                continue;

            try {
                // We need current price
                ProductDto product = stockServiceClient.getProductById(dto.getProductId()).getBody();
                if (product != null) {
                    double currentPrice = product.getPrice();
                    double avgSoldPrice = dto.getAverageSoldPrice() != null ? dto.getAverageSoldPrice() : 0;

                    boolean priceJump = avgSoldPrice > 0 && currentPrice > (avgSoldPrice * 5);
                    boolean fakePrice = currentPrice < 3000 && product.getStatus() != null; // Simple check, ideally
                                                                                            // check sold count from
                                                                                            // product but DTO might not
                                                                                            // have it aggregated

                    if (priceJump) {
                        dto.setReason("Price Jump (> 500% Avg)");
                        dto.setProductName(product.getName());
                        dto.setShopId(product.getUserId());
                        dto.setCancellationRate(0.0);
                        result.add(dto);
                        addedProductIds.add(dto.getProductId());
                    } else if (fakePrice) {
                        dto.setReason("Abnormally Low Price (< 3k)");
                        dto.setProductName(product.getName());
                        dto.setShopId(product.getUserId());
                        dto.setCancellationRate(0.0);
                        result.add(dto);
                        addedProductIds.add(dto.getProductId());
                    }
                }
            } catch (Exception e) {
                log.error("Failed handling price check for product {}", dto.getProductId(), e);
            }
        }

        // Populate Shop Names
        populateShopNames(result);

        return result;
    }

    private void populateShopNames(List<SuspiciousProductDto> dtos) {
        java.util.Map<String, String> shopNameCache = new java.util.HashMap<>();

        for (SuspiciousProductDto dto : dtos) {
            String shopId = dto.getShopId();
            if (shopId != null && !shopId.isEmpty()) {
                if (shopNameCache.containsKey(shopId)) {
                    dto.setShopName(shopNameCache.get(shopId));
                } else {
                    try {
                        org.springframework.http.ResponseEntity<ShopOwnerDto> response = userServiceClient
                                .getShopOwnerByUserId(shopId);
                        if (response.getBody() != null) {
                            String name = response.getBody().getShopName();
                            dto.setShopName(name);
                            shopNameCache.put(shopId, name);
                        } else {
                            // Try fetching as regular user if shop owner not found (fallback)
                            // or just mark unknown
                            shopNameCache.put(shopId, "Unknown Shop");
                        }
                    } catch (Exception e) {
                        log.warn("Failed to fetch shop name for id: {}", shopId);
                        shopNameCache.put(shopId, "Unknown Shop");
                    }
                }
            }
        }
    }

    private void enrichProductInfo(SuspiciousProductDto dto) {
        try {
            ProductDto product = stockServiceClient.getProductById(dto.getProductId()).getBody();
            if (product != null) {
                dto.setProductName(product.getName());
                dto.setShopId(product.getUserId());
            }
        } catch (Exception e) {
            log.error("Failed to fetch product details for ID: {}", dto.getProductId(), e);
            dto.setProductName("Unknown Product");
        }

    }

    @Override
    public void warnShop(String shopId) {
        try {
            log.info("Sending warning notification to shop: {}", shopId);

            SendNotificationRequest request = SendNotificationRequest.builder()
                    .userId(shopId) // notification-service logic might route based on this
                    .shopId(shopId)
                    .isShopOwnerNotification(true)
                    .message(
                            "System has detected suspicious activity from your shop (High cancellation rate/Suspected fake orders). Please review your operational processes.") // English
                                                                                                                                                                                // warning
                                                                                                                                                                                // message
                    .build();

            notificationServiceClient.sendNotification(request);
            log.info("Warning sent successfully to shop {}", shopId);
        } catch (Exception e) {
            log.error("Failed to send warning to shop {}", shopId, e);
            throw new RuntimeException("Failed to send warning notification");
        }
    }
}
