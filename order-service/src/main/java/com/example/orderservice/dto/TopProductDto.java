package com.example.orderservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class TopProductDto {
    private String productId;
    private String productName;
    private Long sold;
    private Double revenue;

    // Constructor for JPQL query
    public TopProductDto(String productId, Long sold, Double revenue) {
        this.productId = productId;
        this.sold = sold;
        this.revenue = revenue;
    }
}