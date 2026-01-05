package com.example.orderservice.service;

import com.example.orderservice.dto.DashboardStatsDto;
import com.example.orderservice.dto.OrderDto;
import com.example.orderservice.dto.CategorySalesDto;
import com.example.orderservice.dto.DailyRevenueDto;

import java.util.List;

public interface AdminDashboardService {
    DashboardStatsDto getDashboardStats();

    List<CategorySalesDto> getTopCategories();

    List<DailyRevenueDto> getRevenueChartData(int days);

    List<OrderDto> getRecentOrders();
}
