package com.example.notificationservice.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "live_products", indexes = {
    @Index(name = "idx_live_room", columnList = "live_room_id"),
    @Index(name = "idx_featured", columnList = "is_featured")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class    LiveProduct {
    
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private String id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "live_room_id", nullable = false)
    private LiveRoom liveRoom;
    
    @Column(name = "product_id", nullable = false)
    private String productId;
    
    // Cached product info from stock-service
    @Column(name = "product_name", length = 500)
    private String productName;
    
    @Column(name = "product_image_url", length = 500)
    private String productImageUrl;
    
    @Column(name = "original_price")
    private Double originalPrice;
    
    @Column(name = "live_price")
    private Double livePrice;
    
    @Column(name = "discount_percent")
    @Builder.Default
    private Double discountPercent = 0.0;
    
    @Column(name = "quantity_limit")
    private Integer quantityLimit;
    
    @Column(name = "stock_available")
    private Integer stockAvailable;
    
    @Column(name = "sold_count")
    @Builder.Default
    private Integer soldCount = 0;
    
    @Column(name = "is_featured")
    @Builder.Default
    private Boolean isFeatured = false;
    
    @Column(name = "display_order")
    @Builder.Default
    private Integer displayOrder = 0;
    
    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
