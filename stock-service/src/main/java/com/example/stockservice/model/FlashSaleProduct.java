package com.example.stockservice.model;

import com.example.stockservice.enums.FlashSaleStatus;
import jakarta.persistence.*;
import lombok.*;
import java.util.List;

@Entity
@Table(name = "flash_sale_products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FlashSaleProduct extends BaseEntity {

    @Column(nullable = false)
    private String sessionId;

    @Column(nullable = false)
    private String productId;

    // Storing basic product info for quick access if needed, though product service
    // has it
    private String shopId;

    @Column(nullable = false)
    private double originalPrice;

    @Column(nullable = false)
    private double salePrice;

    @Column(nullable = false)
    private int flashSaleStock;

    @Column(nullable = false)
    private int soldCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FlashSaleStatus status;

    // Optional: rejection reason
    private String rejectionReason;

    // Optional: limit per user (null means unlimited/default to high)
    private Integer quantityLimit;

    @OneToMany(mappedBy = "flashSaleProduct", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<FlashSaleProductSize> productSizes;
}
