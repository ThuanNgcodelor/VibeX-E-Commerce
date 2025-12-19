package com.example.orderservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GhnItemDto {
    
    @JsonProperty("name")
    private String name;
    
    @JsonProperty("quantity")
    private Integer quantity;
    
    @JsonProperty("price")
    private Long price; // VNĐ
    
    @JsonProperty("weight")
    private Integer weight; // Gram - Required for service_type_id = 5 (Hàng nặng)
}

