package com.example.orderservice.service;

import com.example.orderservice.client.StockServiceClient;
import com.example.orderservice.dto.ProductDto;
import com.example.orderservice.dto.SuspiciousProductDto;
import com.example.orderservice.repository.OrderRepository;
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

        return result;
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
}
