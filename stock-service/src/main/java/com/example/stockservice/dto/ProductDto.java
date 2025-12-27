package com.example.stockservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.time.LocalDateTime;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductDto {
    private String id;
    private String name;
    private String description;
    private double price;
    private double originalPrice;
    private double discountPercent;
    private String imageId; // Main image (backward compatibility)
    private List<String> imageIds; // Multiple images/videos
    private String status;
    private String categoryName;
    private String categoryId;
    private String userId;
    private List<SizeDto> sizes;
    private Integer totalStock;
    private LocalDateTime createdAt;
    private java.util.Map<String, String> attributes;
}