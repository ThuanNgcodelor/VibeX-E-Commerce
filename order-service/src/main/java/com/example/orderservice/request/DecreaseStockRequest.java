package com.example.orderservice.request;

import lombok.Data;

@Data
public class DecreaseStockRequest {
    private String sizeId;
    private int quantity;
    @com.fasterxml.jackson.annotation.JsonProperty("isFlashSale")
    private Boolean isFlashSale;
}