package com.example.stockservice.request.product;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DecreaseStockRequest {
    @NotBlank(message = "Size ID is required")
    private String sizeId;

    @NotNull(message = "Quantity is required")
    @Min(value = 1, message = "Quantity must be at least 1")
    private Integer quantity;

    @com.fasterxml.jackson.annotation.JsonProperty("isFlashSale")
    private Boolean isFlashSale;
}
