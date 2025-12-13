package com.example.orderservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AnalyticsDto {
    private Double todayRevenue;
    private Long todayOrders;
    private Long todayProducts; // Can be passed from frontend or fetched
    private String growth; // e.g. "+12.5%"

    // Chart data
    private List<String> chartLabels; // ["Mon", "Tue", ...]
    private List<Double> chartData; // [1000, 2000, ...]

    private List<TopProductDto> topProducts;
}