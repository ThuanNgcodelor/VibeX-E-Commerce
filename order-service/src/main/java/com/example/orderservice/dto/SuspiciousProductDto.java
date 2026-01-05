package com.example.orderservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SuspiciousProductDto {
    private String productId;
    private String productName;
    private String shopId; // Owner ID (userId from ProductDto)
    private String shopName; // Optional, if we fetch user details
    private Long totalOrders;
    private Long cancelledOrders;
    private Double cancellationRate; // In percentage (e.g., 85.5)
    private String reason; // "High Cancellation", "Brushing", "Price Manipulation", "Fake Price"
    private Double averageSoldPrice; // For reference

    public SuspiciousProductDto(String productId, String productName, String shopId, String shopName, Long totalOrders,
            Long cancelledOrders, Double cancellationRate) {
        this.productId = productId;
        this.productName = productName;
        this.shopId = shopId;
        this.shopName = shopName;
        this.totalOrders = totalOrders;
        this.cancelledOrders = cancelledOrders;
        this.cancellationRate = cancellationRate;
    }

    // Constructor for Brushing Check (distinctBuyers stored in cancelledOrders for
    // reuse/simplicity in JPQL)
    public SuspiciousProductDto(String productId, Long totalOrders, Long distinctBuyers) {
        this.productId = productId;
        this.totalOrders = totalOrders;
        // We reuse 'cancelledOrders' field to initially store 'distinctBuyers' count
        // from the query
        // This is a temporary hack to avoid creating a new DTO just for the query
        // result
        this.cancelledOrders = distinctBuyers;
        this.reason = "Brushing Check";
    }

    // Constructor for Price Check
    public SuspiciousProductDto(String productId, Double averageSoldPrice) {
        this.productId = productId;
        this.averageSoldPrice = averageSoldPrice;
        this.reason = "Price Check";
    }
}
