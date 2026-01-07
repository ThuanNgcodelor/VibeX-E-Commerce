package com.example.stockservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductSuggestionDto {
    private String id;
    private String name;
    private String description;
    private double price;
    private double originalPrice;
    private double discountPercent;
    private String imageUrl;
    private String status;
}
