package com.example.orderservice.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.*;

@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Table(name = "order_items")
@Entity
public class OrderItem extends BaseEntity {
    private String productId;
    private int quantity;
    private double unitPrice;
    private double totalPrice;
    private String sizeId;
    private Boolean isFlashSale; // Track if this item is from Flash Sale

    @ManyToOne
    @JoinColumn(name = "order_id")
    @JsonBackReference
    private Order order;
}
