package com.example.stockservice.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "flash_sale_product_sizes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FlashSaleProductSize extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flash_sale_product_id", nullable = false)
    private FlashSaleProduct flashSaleProduct;

    @Column(nullable = false)
    private String sizeId;

    @Column(nullable = false)
    private int flashSaleStock;

    @Column(nullable = false)
    @Builder.Default
    private int soldCount = 0;

    @Column(nullable = true)
    private Double flashSalePrice;
}
