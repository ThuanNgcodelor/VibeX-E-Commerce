package com.example.notificationservice.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddLiveProductRequest {
    
    @NotBlank(message = "Product ID is required")
    private String productId;
    
    @Positive(message = "Live price must be positive")
    private Double livePrice;
    
    @Positive(message = "Quantity limit must be positive")
    private Integer quantityLimit;
    
    private Integer displayOrder;
}
