package com.example.orderservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckoutPreviewResponse {

    private BigDecimal subtotal;
    private BigDecimal totalShippingFee;
    private BigDecimal totalShopVoucherDiscount;
    private BigDecimal totalPlatformVoucherDiscount;
    private BigDecimal totalCoinDiscount;
    private BigDecimal finalAmount;

    // Coins
    private Long availableCoins;
    private Long coinsUsed;

    // Platform Voucher Info
    private String platformVoucherCode;
    private BigDecimal platformVoucherValue;
    
    // Breakdown per Shop
    private List<ShopBreakdown> shops;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ShopBreakdown {
        private String shopOwnerId;
        private String shopName;
        private BigDecimal itemSubtotal;
        
        // Shipping
        private BigDecimal shippingFee;
        private BigDecimal shippingDiscount; // From Shop Subscription (FreeShip Xtra)
        private boolean isFreeShipXtra;
        
        // Shop Voucher
        private String shopVoucherCode;
        private BigDecimal shopVoucherDiscount;
        
        // Final for Shop (before platform & coin)
        private BigDecimal shopFinalAmount; 
    }
}
