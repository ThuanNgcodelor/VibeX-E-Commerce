package com.example.orderservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutPreviewRequest {

    private String userId;
    private String addressId;
    private List<CheckoutItemDto> selectedItems;
    private List<String> voucherCodes; // Platform or Shop vouchers
    private boolean useCoin;
    
    // Optional: for manual triggers or specific contexts
    private String paymentMethod; 

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CheckoutItemDto {
        private String productId;
        private String sizeId; // or variantId
        private Integer quantity;
        private Double unitPrice;
        private Double totalPrice;
        private String shopOwnerId;
        private String shopName;
        private Double weight; // for shipping calculation
        private boolean isFlashSale;
    }
}
