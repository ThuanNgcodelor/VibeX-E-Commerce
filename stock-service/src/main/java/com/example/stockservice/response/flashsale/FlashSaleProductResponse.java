package com.example.stockservice.response.flashsale;

import com.example.stockservice.enums.FlashSaleStatus;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FlashSaleProductResponse {
    private String id;
    private String sessionId;
    private String productId;
    private String shopId;
    private double originalPrice;
    private double salePrice;
    private int flashSaleStock;
    private int soldCount;
    private FlashSaleStatus status;
    private String rejectionReason;
    private Integer quantityLimit;

    // Enrichment fields
    private String productName;
    private String productImageId; // Main image
    private String shopName;

    private java.util.List<SizeResponse> sizes;

    @Data
    @Builder
    public static class SizeResponse {
        private String sizeId;
        private String sizeName;
        private int flashSaleStock;
        private int soldCount;
        private Double flashSalePrice;
    }
}