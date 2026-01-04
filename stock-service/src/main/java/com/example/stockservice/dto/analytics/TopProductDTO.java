package com.example.stockservice.dto.analytics;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO cho sản phẩm top (được xem nhiều nhất)
 * Sử dụng trong Shop Analytics Dashboard (Phase 4.2)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopProductDTO {
    
    /**
     * ID sản phẩm
     */
    private String productId;
    
    /**
     * Tên sản phẩm
     */
    private String productName;
    
    /**
     * ID hình ảnh sản phẩm
     */
    private String imageId;
    
    /**
     * Giá sản phẩm
     */
    private Double price;
    
    /**
     * Số lượt xem
     */
    private Long viewCount;
    
    /**
     * Số lượt thêm vào giỏ hàng
     */
    private Long cartCount;
    
    /**
     * Số lượt mua hàng
     */
    private Long purchaseCount;
    
    /**
     * Tỷ lệ chuyển đổi (purchases / views * 100)
     */
    private Double conversionRate;
}
