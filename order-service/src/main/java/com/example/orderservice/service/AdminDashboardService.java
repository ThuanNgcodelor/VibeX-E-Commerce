package com.example.orderservice.service;

import com.example.orderservice.dto.DashboardStatsDto;
import com.example.orderservice.dto.OrderDto;
import com.example.orderservice.dto.CategorySalesDto;
import com.example.orderservice.dto.DailyRevenueDto;

import java.util.List;

public interface AdminDashboardService {
    List<CategorySalesDto> getTopCategories();

    List<CategorySalesDto> getTopCategories(java.time.LocalDateTime startDate, java.time.LocalDateTime endDate);

    List<DailyRevenueDto> getRevenueChartData(int days);

    List<DailyRevenueDto> getRevenueChartData(java.time.LocalDateTime startDate, java.time.LocalDateTime endDate);

    DashboardStatsDto getDashboardStats();

    DashboardStatsDto getDashboardStats(java.time.LocalDateTime startDate, java.time.LocalDateTime endDate);

    List<OrderDto> getRecentOrders();
}
