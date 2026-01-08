package com.example.orderservice.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

@Data
public class SelectedItemDto {
    @NotBlank(message = "Product ID is required")
    private String productId;

    @NotNull(message = "Quantity is required")
    @Positive(message = "Quantity must be positive")
    private Integer quantity;

    @NotNull(message = "Unit price is required")
    private Double unitPrice;

    @NotNull
    private String sizeId;

    @com.fasterxml.jackson.annotation.JsonProperty("isFlashSale")
    private Boolean isFlashSale;
}
