package com.example.userservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShopOwnerStatsDto {
    private String userId;
    private String shopName;
    private String ownerName;
    private String email;
    private String phone;
    private Long totalProducts;
    private Long totalOrders;
    private Double totalRevenue;
    private Integer totalRatings;
    private Double averageRating;
    private String status; // ACTIVE, BANNED, etc.
    private Boolean verified;
    private java.time.LocalDateTime createdAt;
    private java.util.List<java.util.Map<String, Object>> revenueTrend;
    private java.util.List<java.util.Map<String, Object>> productCategoryStats;
    private java.util.List<java.util.Map<String, Object>> orderStatusDistribution;
}
