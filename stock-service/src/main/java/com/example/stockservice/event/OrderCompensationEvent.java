package com.example.stockservice.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class OrderCompensationEvent {
    private String orderId;
    private String userId;
    private CompensationReason reason;
    private String details;
    
    public enum CompensationReason {
        INSUFFICIENT_STOCK,
        PRODUCT_NOT_FOUND,
        SIZE_NOT_FOUND
    }
}
