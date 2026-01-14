package com.example.orderservice.service.impl;

import com.example.orderservice.client.StockServiceClient;
import com.example.orderservice.client.UserServiceClient;
import com.example.orderservice.dto.CategorySalesDto;
import com.example.orderservice.dto.DailyRevenueDto;
import com.example.orderservice.dto.DashboardStatsDto;
import com.example.orderservice.dto.OrderDto;
import com.example.orderservice.model.Order;
import com.example.orderservice.repository.OrderItemRepository;
import com.example.orderservice.repository.OrderRepository;
import com.example.orderservice.service.AdminDashboardService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminDashboardServiceImpl implements AdminDashboardService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final UserServiceClient userServiceClient;
    private final StockServiceClient stockServiceClient;
    private final ModelMapper modelMapper;

    @Override
    public DashboardStatsDto getDashboardStats() {
        // Default to all time (or a very long period if needed, but current logic
        // mimics "all time" by not filtering)
        // However, existing logic was "All Time".
        return getDashboardStats(LocalDateTime.of(2000, 1, 1, 0, 0), LocalDateTime.now());
    }

    @Override
    public DashboardStatsDto getDashboardStats(LocalDateTime startDate, LocalDateTime endDate) {
        Double totalSales = orderRepository.sumTotalRevenueBetween(startDate, endDate);
        if (totalSales == null)
            totalSales = 0.0;

        Long totalOrders = orderRepository.countValidOrdersBetween(startDate, endDate);
        if (totalOrders == null)
            totalOrders = 0L;

        // Fetch user count (Active Users is usually "Current State", not historical, so
        // keep as is)
        Long totalUsers = 0L;
        try {
            ResponseEntity<Long> response = userServiceClient.countActiveUsers();
            if (response.getBody() != null)
                totalUsers = response.getBody();
        } catch (Exception e) {
            log.error("Failed to fetch user count", e);
        }

        Long totalProducts = 0L;
        Long totalViews = 0L;
        Long totalSiteVisits = 0L;
        Long totalAddToCart = 0L;

        Double conversionRate = 0.0;
        Double productViewRate = 0.0;
        Double addToCartRate = 0.0;
        Double orderCompletionRate = 0.0;

        try {
            // Note: External service stats (Views, Visits) might not support date filtering
            // in current API.
            // We use system totals for now, or would need to update StockService API to
            // support ranges.
            // For now, we'll use the existing endpoints but be aware they are "All Time".
            // Ideally, we should implement date filtering in StockService too.
            ResponseEntity<Long> viewsResponse = stockServiceClient.getSystemTotalViews();
            if (viewsResponse.getBody() != null)
                totalViews = viewsResponse.getBody();

            ResponseEntity<Long> visitsResponse = stockServiceClient.getSystemSiteVisits();
            if (visitsResponse.getBody() != null)
                totalSiteVisits = visitsResponse.getBody();

            ResponseEntity<Long> cartAddsResponse = stockServiceClient.getSystemAddToCart();
            if (cartAddsResponse.getBody() != null)
                totalAddToCart = cartAddsResponse.getBody();

            if (totalSiteVisits > 0) {
                productViewRate = (totalViews * 100.0) / totalSiteVisits;
                addToCartRate = (totalAddToCart * 100.0) / totalSiteVisits;
                // Use the filtered orders count for the rate within this period
                // Note: Mixing "Period Orders" with "All Time Visits" skews this rate if Visits
                // aren't filtered.
                // But without StockService update, this is the best partial fix.
                orderCompletionRate = (totalOrders * 100.0) / totalSiteVisits;

                if (productViewRate > 100)
                    productViewRate = 100.0;
                if (addToCartRate > 100)
                    addToCartRate = 100.0;
                if (orderCompletionRate > 100)
                    orderCompletionRate = 100.0;
            }
        } catch (Exception e) {
            log.error("Failed to fetch analytics stats", e);
        }

        return DashboardStatsDto.builder()
                .totalSales(totalSales)
                .totalOrders(totalOrders.doubleValue())
                .totalUsers(totalUsers)
                .totalProducts(totalProducts)
                .totalViews(totalViews)
                .totalSiteVisits(totalSiteVisits)
                .totalAddToCart(totalAddToCart)
                .conversionRate(conversionRate)
                .productViewRate(productViewRate)
                .addToCartRate(addToCartRate)
                .orderCompletionRate(orderCompletionRate)
                .build();
    }

    @Override
    public List<DailyRevenueDto> getRevenueChartData(int days) {
        LocalDateTime startDate = LocalDateTime.now().minusDays(days);
        // Default behavior: implies end date is now
        return getRevenueChartData(startDate, LocalDateTime.now());
    }

    @Override
    public List<DailyRevenueDto> getRevenueChartData(LocalDateTime startDate, LocalDateTime endDate) {
        return orderRepository.getDailyRevenueBetween(startDate, endDate);
    }

    @Override
    public List<OrderDto> getRecentOrders() {
        Pageable pageable = PageRequest.of(0, 10, Sort.by("createdAt").descending());
        Page<Order> orderPage = orderRepository.findAll(pageable);

        return orderPage.getContent().stream()
                .map(order -> modelMapper.map(order, OrderDto.class))
                .collect(Collectors.toList());
    }

    @Override
    public List<CategorySalesDto> getTopCategories() {
        return getTopCategories(LocalDateTime.of(2000, 1, 1, 0, 0), LocalDateTime.now());
    }

    @Override
    public List<CategorySalesDto> getTopCategories(LocalDateTime startDate, LocalDateTime endDate) {
        List<Object[]> productSales = orderItemRepository.findTopSellingProductsBetween(startDate, endDate);

        // Map to aggregate by category
        Map<String, Double> categorySalesMap = new HashMap<>();
        double totalSales = 0;

        // Limit to top 50 products to avoid too many external calls
        int limit = 50;
        int count = 0;

        for (Object[] row : productSales) {
            if (count >= limit)
                break;

            String productId = (String) row[0];
            Double sales = (Double) row[1];

            if (sales == null)
                continue;

            totalSales += sales;

            try {
                // Fetch product info to get category
                ResponseEntity<com.example.orderservice.dto.ProductDto> response = stockServiceClient
                        .getProductById(productId);
                if (response.getBody() != null) {
                    String category = response.getBody().getCategoryName();
                    if (category == null || category.isEmpty())
                        category = "Uncategorized";
                    categorySalesMap.put(category, categorySalesMap.getOrDefault(category, 0.0) + sales);
                }
            } catch (Exception e) {
                log.error("Failed to fetch product info for id: " + productId, e);
                categorySalesMap.put("Unknown", categorySalesMap.getOrDefault("Unknown", 0.0) + sales);
            }
            count++;
        }

        // Convert map to DTO list
        List<CategorySalesDto> result = new ArrayList<>();
        String[] colors = { "#FF6B35", "#F7931E", "#FDC830", "#37B7C3", "#4ade80", "#60a5fa", "#a78bfa", "#f472b6" };
        int colorIndex = 0;

        for (Map.Entry<String, Double> entry : categorySalesMap.entrySet()) {
            double percentage = totalSales > 0 ? (entry.getValue() / totalSales) * 100 : 0;
            result.add(CategorySalesDto.builder()
                    .name(entry.getKey())
                    .value(entry.getValue())
                    .percentage(Math.round(percentage * 10.0) / 10.0)
                    .color(colors[colorIndex % colors.length])
                    .build());
            colorIndex++;
        }

        // Sort by value descending
        result.sort((a, b) -> Double.compare(b.getValue(), a.getValue()));

        // Return top 4
        return result.stream().limit(4).collect(Collectors.toList());
    }
}
