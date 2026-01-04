package com.example.stockservice.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * DTO tổng hợp analytics cho shop owner
 * Chứa tất cả thông tin analytics về hành vi khách hàng
 * Sử dụng trong Shop Analytics Dashboard (Phase 4)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShopAnalyticsDTO {
    
    // ==================== OVERVIEW STATS (4.1) ====================
    
    /**
     * Tổng số lượt xem sản phẩm
     */
    private Long totalViews;
    
    /**
     * Tổng số lượt thêm vào giỏ hàng
     */
    private Long totalCarts;
    
    /**
     * Tổng số lượt mua hàng
     */
    private Long totalPurchases;
    
    /**
     * Tỷ lệ chuyển đổi tổng thể (purchases / views * 100)
     */
    private Double conversionRate;
    
    // ==================== TOP PRODUCTS (4.2) ====================
    
    /**
     * Danh sách sản phẩm được xem nhiều nhất
     */
    private List<TopProductDTO> topViewedProducts;
    
    // ==================== CONVERSION FUNNEL (4.3) ====================
    
    /**
     * Phễu chuyển đổi (Views → Cart → Purchase)
     */
    private ConversionFunnelDTO conversionFunnel;
    
    // ==================== ABANDONED PRODUCTS (4.4) ====================
    
    /**
     * Danh sách sản phẩm bị bỏ rơi (views cao, purchase thấp)
     */
    private List<AbandonedProductDTO> abandonedProducts;
}
