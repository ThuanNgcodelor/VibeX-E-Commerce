package com.example.orderservice.controller;

import com.example.orderservice.dto.SuspiciousProductDto;
import com.example.orderservice.service.SuspiciousActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

import com.example.orderservice.dto.ConversionTrendDto;
import com.example.orderservice.dto.UserLocationStatDto;

@RestController
@RequestMapping("/v1/order/admin/analytics")
@RequiredArgsConstructor
public class AdminAnalyticsController {

    private final SuspiciousActivityService suspiciousActivityService;
    private final com.example.orderservice.service.AdminDashboardService adminDashboardService;

    @GetMapping("/suspicious")
    public ResponseEntity<List<SuspiciousProductDto>> getSuspiciousProducts() {
        return ResponseEntity.ok(suspiciousActivityService.getSuspiciousProducts());
    }

    @GetMapping("/dashboard")
    public ResponseEntity<com.example.orderservice.dto.DashboardStatsDto> getDashboardStats(
            @org.springframework.web.bind.annotation.RequestParam(required = false) java.time.LocalDate startDate,
            @org.springframework.web.bind.annotation.RequestParam(required = false) java.time.LocalDate endDate) {

        if (startDate != null && endDate != null) {
            return ResponseEntity
                    .ok(adminDashboardService.getDashboardStats(startDate.atStartOfDay(), endDate.atTime(23, 59, 59)));
        }
        return ResponseEntity.ok(adminDashboardService.getDashboardStats());
    }

    @GetMapping("/revenue-chart")
    public ResponseEntity<List<com.example.orderservice.dto.DailyRevenueDto>> getRevenueChartData(
            @org.springframework.web.bind.annotation.RequestParam(required = false) java.time.LocalDate startDate,
            @org.springframework.web.bind.annotation.RequestParam(required = false) java.time.LocalDate endDate) {

        if (startDate != null && endDate != null) {
            return ResponseEntity.ok(
                    adminDashboardService.getRevenueChartData(startDate.atStartOfDay(), endDate.atTime(23, 59, 59)));
        }
        return ResponseEntity.ok(adminDashboardService.getRevenueChartData(30)); // Default 30 days
    }

    @GetMapping("/recent-orders")
    public ResponseEntity<List<com.example.orderservice.dto.OrderDto>> getRecentOrders(
            @org.springframework.web.bind.annotation.RequestParam(required = false) String category) {
        return ResponseEntity.ok(adminDashboardService.getRecentOrders(category));
    }

    @GetMapping("/top-categories")
    public ResponseEntity<List<com.example.orderservice.dto.CategorySalesDto>> getTopCategories(
            @org.springframework.web.bind.annotation.RequestParam(required = false) java.time.LocalDate startDate,
            @org.springframework.web.bind.annotation.RequestParam(required = false) java.time.LocalDate endDate) {

        if (startDate != null && endDate != null) {
            return ResponseEntity
                    .ok(adminDashboardService.getTopCategories(startDate.atStartOfDay(), endDate.atTime(23, 59, 59)));
        }
        return ResponseEntity.ok(adminDashboardService.getTopCategories());
    }

    @PostMapping("/warn-shop/{shopId}")
    public ResponseEntity<Void> warnShop(@PathVariable String shopId) {
        suspiciousActivityService.warnShop(shopId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/conversion-trend")
    public ResponseEntity<List<ConversionTrendDto>> getConversionTrend(
            @org.springframework.web.bind.annotation.RequestParam(required = false) LocalDate startDate,
            @org.springframework.web.bind.annotation.RequestParam(required = false) LocalDate endDate) {

        if (startDate == null)
            startDate = LocalDate.now().minusDays(30);
        if (endDate == null)
            endDate = LocalDate.now();

        return ResponseEntity
                .ok(adminDashboardService.getConversionTrend(startDate.atStartOfDay(), endDate.atTime(23, 59, 59)));
    }

    @GetMapping("/user-locations")
    public ResponseEntity<List<UserLocationStatDto>> getUserLocationStats() {
        return ResponseEntity.ok(adminDashboardService.getUserLocationStats());
    }
}
