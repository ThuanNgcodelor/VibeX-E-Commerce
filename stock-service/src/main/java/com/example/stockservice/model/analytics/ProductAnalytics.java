package com.example.stockservice.model.analytics;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Entity to store aggregated analytics data per product
 * Updated by Kafka consumer when events are processed
 */
@Entity(name = "product_analytics")
@Table(name = "product_analytics", indexes = {
    @Index(name = "idx_pa_shop_id", columnList = "shopId"),
    @Index(name = "idx_pa_view_count", columnList = "viewCount")
})
@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProductAnalytics {
    
    /**
     * Product ID - Primary key (one record per product)
     */
    @Id
    @Column(length = 144)
    private String productId;
    
    /**
     * Shop ID - Owner of the product
     */
    @Column(length = 36)
    private String shopId;
    
    /**
     * Total number of views
     */
    @Builder.Default
    private Long viewCount = 0L;
    
    /**
     * Total number of add to cart actions
     */
    @Builder.Default
    private Long cartCount = 0L;
    
    /**
     * Total number of purchases
     */
    @Builder.Default
    private Long purchaseCount = 0L;
    
    /**
     * Number of unique users who viewed this product
     */
    @Builder.Default
    private Long uniqueViewers = 0L;
    
    /**
     * Conversion rate (purchases / views * 100)
     */
    @Builder.Default
    private Double conversionRate = 0.0;
    
    /**
     * Last time this product was viewed
     */
    private LocalDateTime lastViewedAt;
    
    /**
     * Record creation timestamp
     */
    @Column(updatable = false)
    private LocalDateTime createdAt;
    
    /**
     * Record update timestamp
     */
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        // Recalculate conversion rate
        if (viewCount > 0) {
            conversionRate = (purchaseCount * 100.0) / viewCount;
        }
    }
}
