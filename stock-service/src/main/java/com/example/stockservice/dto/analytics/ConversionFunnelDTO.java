package com.example.stockservice.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO cho phễu chuyển đổi (Conversion Funnel)
 * Hiển thị luồng: Views → Add to Cart → Purchase
 * Sử dụng trong Shop Analytics Dashboard (Phase 4.3)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversionFunnelDTO {
    
    /**
     * Tổng số lượt xem sản phẩm
     */
    private Long views;
    
    /**
     * Tổng số lượt thêm vào giỏ hàng
     */
    private Long carts;
    
    /**
     * Tổng số lượt mua hàng
     */
    private Long purchases;
    
    /**
     * Tỷ lệ chuyển đổi từ View sang Cart (carts / views * 100)
     */
    private Double viewToCartRate;
    
    /**
     * Tỷ lệ chuyển đổi từ Cart sang Purchase (purchases / carts * 100)
     */
    private Double cartToPurchaseRate;
    
    /**
     * Tỷ lệ chuyển đổi tổng thể (purchases / views * 100)
     */
    private Double overallConversionRate;
}
