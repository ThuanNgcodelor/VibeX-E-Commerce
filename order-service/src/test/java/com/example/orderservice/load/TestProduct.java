package com.example.orderservice.load;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Test product with size
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestProduct {
    private String productId;
    private String sizeId;
    private int availableStock;
    private String productName;
}
