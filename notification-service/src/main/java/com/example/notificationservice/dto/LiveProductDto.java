package com.example.notificationservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LiveProductDto {
    private String id;
    private String liveRoomId;
    private String productId;
    private String productName;
    private String productImageUrl;
    private Double originalPrice;
    private Double livePrice;
    private Double discountPercent;
    private Integer quantityLimit;
    private Integer stockAvailable;
    private Integer soldCount;
    private Boolean isFeatured;
    private Integer displayOrder;
    private LocalDateTime createdAt;
}
