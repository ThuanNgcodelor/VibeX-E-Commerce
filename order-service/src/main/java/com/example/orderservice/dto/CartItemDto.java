package com.example.orderservice.dto;

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
    private String imageId;
    private String cartId;
    private String sizeId;
    private String sizeName;

    private ProductDto product;
    private SizeDto size;
    private Boolean isFlashSale;
}