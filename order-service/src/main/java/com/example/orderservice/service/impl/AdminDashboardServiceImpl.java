package com.example.orderservice.service.impl;

import com.example.orderservice.client.StockServiceClient;
import com.example.orderservice.client.UserServiceClient;
import com.example.orderservice.dto.CategorySalesDto;
import com.example.orderservice.dto.DailyRevenueDto;
import com.example.orderservice.dto.ConversionTrendDto;
import com.example.orderservice.dto.SystemAnalyticsTrendDto;
import com.example.orderservice.dto.UserLocationStatDto;
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

        // Calculate Growth Metrics
        Double salesGrowth = 0.0;
        Double ordersGrowth = 0.0;
        Double usersGrowth = 0.0; // Currently no historical user data available

        try {
            long daysBetween = java.time.Duration.between(startDate, endDate).toDays();
            if (daysBetween <= 0)
                daysBetween = 1; // Avoid zero division/issues

            // Previous Period: Same duration before start date
            LocalDateTime prevStartDate = startDate.minusDays(daysBetween);
            LocalDateTime prevEndDate = startDate.minusSeconds(1); // Right before current start

            Double prevTotalSales = orderRepository.sumTotalRevenueBetween(prevStartDate, prevEndDate);
            if (prevTotalSales == null)
                prevTotalSales = 0.0;

            Long prevTotalOrders = orderRepository.countValidOrdersBetween(prevStartDate, prevEndDate);
            if (prevTotalOrders == null)
                prevTotalOrders = 0L;

            if (prevTotalSales > 0) {
                salesGrowth = ((totalSales - prevTotalSales) / prevTotalSales) * 100;
            } else if (totalSales > 0) {
                salesGrowth = 100.0; // 0 -> something
            }

            if (prevTotalOrders > 0) {
                ordersGrowth = ((double) (totalOrders - prevTotalOrders) / prevTotalOrders) * 100;
            } else if (totalOrders > 0) {
                ordersGrowth = 100.0;
            }

        } catch (Exception e) {
            log.error("Error calculating growth metrics", e);
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
                .salesGrowth(salesGrowth)
                .ordersGrowth(ordersGrowth)
                .usersGrowth(usersGrowth)
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
        return getRecentOrders(null);
    }

    @Override
    public List<OrderDto> getRecentOrders(String category) {
        Pageable pageable = PageRequest.of(0, 10, Sort.by("createdAt").descending());
        Page<Order> orderPage;

        if (category != null && !category.isEmpty() && !category.equalsIgnoreCase("All")) {
            try {
                ResponseEntity<List<String>> response = stockServiceClient.getProductIdsByCategoryName(category);
                List<String> productIds = response.getBody();

                if (productIds == null || productIds.isEmpty()) {
                    return new ArrayList<>();
                }

                // Using findByOrderItemsProductIdIn from repository
                orderPage = orderRepository.findByOrderItemsProductIdIn(productIds, pageable);

            } catch (Exception e) {
                log.error("Failed to fetch product IDs for category: " + category, e);
                // Fallback to empty list or all orders? Empty list seems safer for a filter.
                return new ArrayList<>();
            }
        } else {
            orderPage = orderRepository.findAll(pageable);
        }

        return orderPage.getContent().stream()
                .map(order -> {
                    OrderDto dto = modelMapper.map(order, OrderDto.class);
                    if (order.getUserId() != null) {
                        try {
                            // Fetch user name
                            ResponseEntity<com.example.orderservice.dto.UserDto> userResp = userServiceClient
                                    .getUserById(order.getUserId());
                            if (userResp.getBody() != null) {
                                dto.setCustomerName(userResp.getBody().getUsername()); // Or getFullName() if available
                            }
                        } catch (Exception e) {
                            log.error("Failed to fetch user info for order " + order.getId(), e);
                            dto.setCustomerName("Unknown User");
                        }
                    } else {
                        dto.setCustomerName("Guest");
                    }
                    return dto;
                })
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
        List<String> distinctProductIds = new ArrayList<>();
        List<Object[]> limitedSales = new ArrayList<>();

        for (int i = 0; i < Math.min(productSales.size(), limit); i++) {
            Object[] row = productSales.get(i);
            String productId = (String) row[0];
            Double sales = (Double) row[1];
            if (sales != null) {
                distinctProductIds.add(productId);
                limitedSales.add(row);
                totalSales += sales;
            }
        }

        // Batch fetch products to avoid N+1
        Map<String, com.example.orderservice.dto.ProductDto> productMap = new HashMap<>();
        if (!distinctProductIds.isEmpty()) {
            try {
                com.example.orderservice.dto.BatchGetProductsRequest batchRequest = new com.example.orderservice.dto.BatchGetProductsRequest();
                batchRequest.setProductIds(distinctProductIds);
                ResponseEntity<Map<String, com.example.orderservice.dto.ProductDto>> response = stockServiceClient
                        .batchGetProducts(batchRequest);
                if (response.getBody() != null) {
                    productMap = response.getBody();
                }
            } catch (Exception e) {
                log.error("Failed to batch fetch products for top categories", e);
            }
        }

        for (Object[] row : limitedSales) {
            String productId = (String) row[0];
            Double sales = (Double) row[1];

            // Get product info from batch map
            com.example.orderservice.dto.ProductDto product = productMap.get(productId);
            String category = "Unknown";

            if (product != null && product.getCategoryName() != null && !product.getCategoryName().isEmpty()) {
                category = product.getCategoryName();
            } else if (product == null) {
                // Fallback or retry? For performance, we skip retry for individual logic here
                // if batch failed partially.
                // "Unknown" is fine.
            }

            categorySalesMap.put(category, categorySalesMap.getOrDefault(category, 0.0) + sales);
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

    @Override
    public List<ConversionTrendDto> getConversionTrend(LocalDateTime startDate, LocalDateTime endDate) {
        // 1. Get Daily Orders from DB
        List<DailyRevenueDto> dailyOrders = orderRepository.getDailyRevenueBetween(startDate, endDate);

        // 2. Get Daily Visits from Stock Service
        List<SystemAnalyticsTrendDto> dailyVisits = new ArrayList<>();
        try {
            ResponseEntity<List<SystemAnalyticsTrendDto>> response = stockServiceClient.getSystemAnalyticsTrend(
                    startDate.toLocalDate().toString(),
                    endDate.toLocalDate().toString());
            if (response.getBody() != null) {
                dailyVisits = response.getBody();
            }
        } catch (Exception e) {
            log.error("Failed to fetch system analytics trend", e);
        }

        // 3. Merge Data
        Map<String, ConversionTrendDto> trendMap = new HashMap<>();

        // Initialize with visits data
        for (SystemAnalyticsTrendDto visitData : dailyVisits) {
            String dateKey = visitData.getDate().toString();
            trendMap.put(dateKey, ConversionTrendDto.builder()
                    .date(visitData.getDate())
                    .visits(visitData.getVisits())
                    .orders(0L)
                    .conversionRate(0.0)
                    .build());
        }

        // Merge orders data
        for (DailyRevenueDto orderData : dailyOrders) {
            String dateKey = orderData.getDate().toString();
            ConversionTrendDto dto = trendMap.get(dateKey);

            if (dto == null) {
                dto = ConversionTrendDto.builder()
                        .date(orderData.getDate())
                        .visits(0L) // No visit data found (maybe before tracking started)
                        .orders(orderData.getOrderCount())
                        .conversionRate(0.0)
                        .build();
                trendMap.put(dateKey, dto);
            } else {
                dto.setOrders(orderData.getOrderCount());
            }

            // Calculate Rate
            if (dto.getVisits() > 0) {
                double rate = (double) dto.getOrders() / dto.getVisits() * 100;
                dto.setConversionRate(Math.round(rate * 100.0) / 100.0); // Round to 2 decimals
            } else if (dto.getOrders() > 0) {
                dto.setConversionRate(100.0); // Edge case: orders but no visits recorded
            }
        }

        // Sort by Date
        List<ConversionTrendDto> result = new ArrayList<>(trendMap.values());
        result.sort((a, b) -> a.getDate().compareTo(b.getDate()));

        return result;
    }

    @Override
    public List<UserLocationStatDto> getUserLocationStats() {
        try {
            ResponseEntity<List<UserLocationStatDto>> response = userServiceClient.getUserLocationStats();
            if (response.getBody() != null) {
                return response.getBody();
            }
        } catch (Exception e) {
            log.error("Failed to fetch user location stats", e);
        }
        return new ArrayList<>();
    }
}
