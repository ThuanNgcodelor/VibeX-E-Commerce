package com.example.stockservice.request.flashsale;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
public class FlashSaleProductRegistrationRequest {
    private String sessionId;
    private String productId;
    // ShopId will be extracted from token
    private Double originalPrice;
    private double salePrice;
    // PREVIOUS: private int flashSaleStock;
    // NEW: List of sizes
    private List<FlashSaleSizeReq> sizes;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class FlashSaleSizeReq {
        private String sizeId;
        private int quantity;
        private Double salePrice; // Added for Option 3
    }
}
