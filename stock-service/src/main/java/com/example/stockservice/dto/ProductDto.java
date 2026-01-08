package com.example.stockservice.dto;

import com.example.stockservice.enums.ProductStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProductDto {
    private String id;
    private String name;
    private String description;
    private double price;
    private double originalPrice;
    private double discountPercent;
    private ProductStatus status;
    private String imageId;
    private List<String> imageIds;
    private String userId;
    private CategoryDto category;

    // Flattened Category Info
    private String categoryName;
    private String categoryId;

    private List<SizeDto> sizes;
    private int totalStock;

    private String attributeJson;
    private java.util.Map<String, String> attributes;

    // Flash Sale Info
    private Integer flashSaleRemaining;
    
    private Integer soldCount;
    private Double averageRating;

    private LocalDateTime createdDate;
    private LocalDateTime createdAt; // Maps to createdTimestamp in controller usage
    private LocalDateTime lastModifiedDate;
    private String createdBy;
    private String lastModifiedBy;
}
