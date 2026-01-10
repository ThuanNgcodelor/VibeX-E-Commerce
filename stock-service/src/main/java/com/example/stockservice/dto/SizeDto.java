package com.example.stockservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SizeDto {
    private String id;
    private String name;
    private String description;
    private int stock;
    private double priceModifier;
    private Double flashSalePrice; // Added for Option 3
    private Integer flashSaleStock; // Flash Sale stock for this size (if active)
    private Integer weight; // Trọng lượng tính bằng gram (g)
}
