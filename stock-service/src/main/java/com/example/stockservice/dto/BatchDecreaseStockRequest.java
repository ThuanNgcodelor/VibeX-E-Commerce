package com.example.stockservice.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class BatchDecreaseStockRequest {
    private List<DecreaseStockItem> items;
    
    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class DecreaseStockItem {
        private String productId;
        private String sizeId;
        private int quantity;
    }
}
