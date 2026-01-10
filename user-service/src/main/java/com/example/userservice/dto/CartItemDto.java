package com.example.userservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CartItemDto {
    private String id;
    private int quantity;
    private double unitPrice;
    private double totalPrice;
    private String description;
    private String productId;
    private String productName;
    private String imageId;
    private String cartId;
    private String sizeId;
    private String sizeName;
    // Data sync fields - Refresh on View
    private Boolean priceChanged; // Flag giá đã thay đổi
    private Double oldPrice; // Giá cũ (khi priceChanged = true)
    private Integer availableStock; // Số lượng còn trong kho
    private Boolean productAvailable; // Sản phẩm còn tồn tại không
    private Boolean sizeAvailable; // Size còn tồn tại không

    @com.fasterxml.jackson.annotation.JsonProperty("isFlashSale")
    private Boolean isFlashSale; // Flash Sale flag
}
