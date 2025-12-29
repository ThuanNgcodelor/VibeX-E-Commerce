package com.example.stockservice.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.List;

@Entity(name = "sizes")
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class Size extends BaseEntity {
    private String name;
    private String description;
    private int stock;
    private double priceModifier;
    @Builder.Default
    private Integer weight = 500; // Trọng lượng tính bằng gram (g), mặc định 500g
    
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    // Do NOT cascade to cartItems - we don't want to delete cart items when size is deleted
    // Instead, cart items with deleted sizes will show as unavailable (sizeAvailable=false)
    @JsonIgnore
    @OneToMany(mappedBy = "size")
    private List<CartItem> cartItems;
}

