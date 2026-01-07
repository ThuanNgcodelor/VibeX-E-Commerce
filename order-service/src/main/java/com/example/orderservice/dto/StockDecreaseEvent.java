package com.example.orderservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class StockDecreaseEvent {
    private String orderId;
    private String userId;
    private List<StockDecreaseItem> items;
    
    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class StockDecreaseItem {
        private String productId;
        private String sizeId;
        private int quantity;
    }
}
