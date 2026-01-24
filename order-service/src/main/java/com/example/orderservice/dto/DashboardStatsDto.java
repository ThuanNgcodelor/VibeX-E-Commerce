package com.example.orderservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DashboardStatsDto {
    private Double totalSales;
    private Double totalOrders;
    private Long totalProducts; // Can be fetched from Product Service or count distinct products in orders
    private Long totalUsers; // Fetched from User Service
    private Double conversionRate;
    private Long totalViews;
    private Long totalSiteVisits;
    private Long totalAddToCart;

    // Rates based on Site Visits
    private Double productViewRate; // (Product Views / Site Visits) * 100
    private Double addToCartRate; // (Add To Cart / Site Visits) * 100
    private Double orderCompletionRate; // (Orders / Site Visits) * 100

    // Growth Metrics (Comparison with previous period)
    private Double salesGrowth;
    private Double ordersGrowth;
    private Double usersGrowth;
}
