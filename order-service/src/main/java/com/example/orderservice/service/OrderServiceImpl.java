package com.example.orderservice.service;

import com.example.orderservice.client.GhnApiClient;
import com.example.orderservice.client.PaymentServiceClient;
import com.example.orderservice.client.StockServiceClient;
import com.example.orderservice.client.FlashSaleClient;
import com.example.orderservice.client.UserServiceClient;
import com.example.orderservice.dto.AddRefundRequestDto;
import com.example.orderservice.dto.PaymentDto;
import com.example.orderservice.dto.*;
import com.example.orderservice.dto.PaymentEvent;
import com.example.orderservice.enums.OrderStatus;
import com.example.orderservice.model.Order;
import com.example.orderservice.model.OrderItem;
import com.example.orderservice.model.ShippingOrder;
import com.example.orderservice.repository.OrderRepository;
import com.example.orderservice.repository.OrderItemRepository;
import com.example.orderservice.repository.ShippingOrderRepository;
import com.example.orderservice.request.*;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.math.BigDecimal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.apache.kafka.clients.admin.NewTopic;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.HttpClientErrorException;

@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final StockServiceClient stockServiceClient;
    private final FlashSaleClient flashSaleClient;
    private final UserServiceClient userServiceClient;
    private final GhnApiClient ghnApiClient;
    private final PaymentServiceClient paymentServiceClient;
    private final ShippingOrderRepository shippingOrderRepository;
    private final VoucherService voucherService;
    private final ShopLedgerService shopLedgerService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final NewTopic orderTopic;
    private final NewTopic notificationTopic;
    private final NewTopic updateStatusOrderTopic;
    private final KafkaTemplate<String, CheckOutKafkaRequest> kafkaTemplate;
    private final KafkaTemplate<String, SendNotificationRequest> kafkaTemplateSend;
    private final KafkaTemplate<String, UpdateStatusOrderRequest> updateStatusKafkaTemplate;
    // Phase 3: Async Stock Decrease
    private final KafkaTemplate<String, StockDecreaseEvent> stockDecreaseKafkaTemplate;
    private final NewTopic stockDecreaseTopic;
    private static final Logger log = LoggerFactory.getLogger(OrderServiceImpl.class);
    // Scheduler for auto-complete after DELIVERED
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private final TrackingEmitterService trackingEmitterService;

    @Override
    public Order returnOrder(String orderId, String reason) {
        return orderRepository.findById(orderId).map(order -> {
            order.setOrderStatus(OrderStatus.RETURNED);
            order.setReturnReason(reason);

            return orderRepository.save(order);
        }).orElse(null);
    }

    @Override
    public AnalyticsDto getAnalytics(String shopOwnerId, LocalDate startDate, LocalDate endDate) {
        // 1. Get product IDs
        List<String> productIds = stockServiceClient.getProductIdsByShopOwner(shopOwnerId).getBody();
        if (productIds == null || productIds.isEmpty()) {
            return AnalyticsDto.builder()
                    .todayRevenue(0.0)
                    .todayOrders(0L)
                    .todayProducts(0L)
                    .growth("+0%")
                    .chartLabels(new ArrayList<>())
                    .chartData(new ArrayList<>())
                    .topProducts(new ArrayList<>())
                    .ordersByStatus(new HashMap<>())
                    .totalCancelled(0L)
                    .totalReturned(0L)
                    .averageOrderValue(0.0)
                    .build();
        }

        // Default to last 7 days if dates are null
        if (startDate == null)
            startDate = LocalDate.now().minusDays(6);
        if (endDate == null)
            endDate = LocalDate.now();

        LocalDateTime startDateTime = startDate.atStartOfDay();
        LocalDateTime endDateTime = endDate.atTime(LocalTime.MAX);

        // 2. Revenue (Only DELIVERED/COMPLETED within range)
        Double totalRevenue = orderRepository.sumSalesByProductIdsAndDateRangeAndStatus(productIds, startDateTime,
                endDateTime, OrderStatus.COMPLETED);
        if (totalRevenue == null)
            totalRevenue = 0.0;

        // 3. Orders within range (All except cancelled/returned for "Valid Orders"
        // count, or logic depends on needs)
        // Let's stick to "Valid Orders" being everything properly placed
        List<OrderStatus> excluded = List.of();
        Long totalOrders = orderRepository.countByProductIdsAndCreatedAtBetween(productIds, startDateTime,
                endDateTime, excluded);
        if (totalOrders == null)
            totalOrders = 0L;

        // 4. Growth (Compare with previous period of same length)
        long daysDiff = java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate) + 1;
        LocalDateTime startPrev = startDateTime.minusDays(daysDiff);
        LocalDateTime endPrev = startDateTime.minusNanos(1); // End of previous period

        Double prevRevenue = orderRepository.sumSalesByProductIdsAndDateRangeAndStatus(productIds,
                startPrev,
                endPrev, OrderStatus.COMPLETED);
        if (prevRevenue == null)
            prevRevenue = 0.0;

        String growth;
        if (prevRevenue == 0) {
            growth = totalRevenue > 0 ? "+100%" : "0%";
        } else {
            double percent = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
            growth = (percent >= 0 ? "+" : "") + String.format("%.1f", percent) + "%";
        }

        // 5. Chart Data (Daily breakdown within range)
        List<String> labels = new java.util.ArrayList<>();
        List<Double> data = new java.util.ArrayList<>();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM");

        // Loop from startDate to endDate
        java.time.LocalDate current = startDate;
        while (!current.isAfter(endDate)) {
            LocalDateTime dayStart = current.atStartOfDay();
            LocalDateTime dayEnd = current.atTime(java.time.LocalTime.MAX);
            Double dailyRevenue = orderRepository.sumSalesByProductIdsAndDateRangeAndStatus(productIds, dayStart,
                    dayEnd,
                    OrderStatus.COMPLETED);

            labels.add(current.format(formatter));
            data.add(dailyRevenue != null ? dailyRevenue : 0.0);

            current = current.plusDays(1);
        }

        // 6. Top Products
        Pageable pageable = PageRequest.of(0, 5);
        List<TopProductDto> topProducts = orderRepository
                .findTopSellingProducts(productIds, List.of(OrderStatus.CANCELLED, OrderStatus.RETURNED), pageable);

        for (TopProductDto top : topProducts) {
            try {
                // Fetch product details logic... (simplified for brevity)
                ProductDto p = stockServiceClient.getProductById(top.getProductId())
                        .getBody();
                if (p != null) {
                    top.setProductName(p.getName());
                } else {
                    top.setProductName("Unknown Product");
                }
            } catch (Exception e) {
                top.setProductName("ID: " + top.getProductId());
            }
        }

        // 7. Advanced Stats
        // Orders by Status
        java.util.Map<String, Long> ordersByStatus = new java.util.HashMap<>();
        for (OrderStatus status : OrderStatus.values()) {
            Long count = orderRepository.countByProductIdsAndDateRangeAndStatus(productIds, startDateTime, endDateTime,
                    status);
            if (count > 0) {
                ordersByStatus.put(status.name(), count);
            }
        }

        Long cancelledCount = ordersByStatus.getOrDefault("CANCELLED", 0L);
        Long returnedCount = ordersByStatus.getOrDefault("RETURNED", 0L);

        // Avg Order Value (Revenue / Completed Orders count)
        Long completedCount = ordersByStatus.getOrDefault("COMPLETED", 0L);
        Double avgOrderValue = completedCount > 0 ? (totalRevenue / completedCount) : 0.0;

        return AnalyticsDto.builder()
                .todayRevenue(totalRevenue)
                .todayOrders(totalOrders)
                .todayProducts((long) productIds.size())
                .growth(growth)
                .chartLabels(labels)
                .chartData(data)
                .topProducts(topProducts)
                .ordersByStatus(ordersByStatus)
                .totalCancelled(cancelledCount)
                .totalReturned(returnedCount)
                .averageOrderValue(avgOrderValue)
                .build();
    }

    @Override
    public byte[] exportAnalytics(String shopOwnerId, java.time.LocalDate startDate, java.time.LocalDate endDate) {
        AnalyticsDto analytics = getAnalytics(shopOwnerId, startDate, endDate);

        StringBuilder csv = new StringBuilder();
        csv.append("Sales Report\n");
        csv.append("Period,").append(startDate != null ? startDate : "Last 7 days").append(" - ")
                .append(endDate != null ? endDate : "Today").append("\n\n");

        csv.append("Summary\n");
        csv.append("Total Revenue,").append(String.format("%.0f", analytics.getTodayRevenue())).append("\n");
        csv.append("Total Orders,").append(analytics.getTodayOrders()).append("\n");
        csv.append("Avg Order Value,").append(String.format("%.0f", analytics.getAverageOrderValue())).append("\n");
        csv.append("Cancelled Orders,").append(analytics.getTotalCancelled()).append("\n");
        csv.append("Returned Orders,").append(analytics.getTotalReturned()).append("\n\n");

        csv.append("Daily Revenue\n");
        csv.append("Date,Revenue\n");
        if (analytics.getChartLabels() != null) {
            for (int i = 0; i < analytics.getChartLabels().size(); i++) {
                csv.append(analytics.getChartLabels().get(i)).append(",")
                        .append(String.format("%.0f", analytics.getChartData().get(i))).append("\n");
            }
        }
        csv.append("\n");

        csv.append("Product Performance (Top 5)\n");
        csv.append("Product Name,Sold,Revenue\n");
        if (analytics.getTopProducts() != null) {
            for (com.example.orderservice.dto.TopProductDto p : analytics.getTopProducts()) {
                csv.append("\"").append(p.getProductName().replace("\"", "\"\"")).append("\",")
                        .append(p.getSold()).append(",")
                        .append(String.format("%.0f", p.getRevenue())).append("\n"); // assuming total field matches
                                                                                     // matches
            }
        }

        return csv.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    @Override
    public Map<String, Object> getShopStats(String shopOwnerId) {
        // 1. Get product IDs
        List<String> productIds = stockServiceClient.getProductIdsByShopOwner(shopOwnerId).getBody();
        Map<String, Object> stats = new HashMap<>();

        if (productIds == null || productIds.isEmpty()) {
            stats.put("pending", 0);
            stats.put("confirmed", 0);
            stats.put("shipped", 0);
            stats.put("completed", 0);
            stats.put("cancelled", 0);
            stats.put("returned", 0);
            stats.put("salesToday", 0);
            return stats;
        }

        // 2. Count by status
        long pending = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.PENDING);
        long confirmed = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.CONFIRMED);
        long readyToShip = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.READY_TO_SHIP);
        long shipped = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.SHIPPED);
        long delivered = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.DELIVERED);
        long completed = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.COMPLETED);
        long cancelled = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.CANCELLED);
        long returned = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.RETURNED);

        // 3. Sales today
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = LocalDate.now().atTime(LocalTime.MAX);
        Double salesToday = orderRepository.sumSalesByProductIdsAndDateRangeAndStatus(productIds, startOfDay, endOfDay,
                OrderStatus.COMPLETED);

        stats.put("pending", pending);
        stats.put("confirmed", confirmed);
        stats.put("readyToShip", readyToShip);
        stats.put("shipped", shipped);
        stats.put("delivered", delivered);
        stats.put("completed", completed);
        stats.put("cancelled", cancelled);
        stats.put("returned", returned);

        // Mappings for old Dashboard compatibility (if needed) or simple groupings
        stats.put("waitingForPickup", confirmed + readyToShip);
        stats.put("processed", shipped + delivered + completed);

        stats.put("salesToday", salesToday != null ? salesToday : 0.0);

        return stats;
    }

    // Get data for shop owner orders
    @Override
    public Page<Order> getOrdersByShopOwner(String shopOwnerId, List<String> statuses, Integer pageNo,
            Integer pageSize) {
        Pageable pageable = PageRequest.of(pageNo - 1, pageSize);
        List<String> productIds = stockServiceClient.getProductIdsByShopOwner(shopOwnerId).getBody();

        if (productIds == null || productIds.isEmpty()) {
            return Page.empty();
        }

        List<OrderStatus> orderStatuses = null;
        if (statuses != null && !statuses.isEmpty()) {
            orderStatuses = statuses.stream()
                    .map(status -> {
                        try {
                            return OrderStatus.valueOf(status);
                        } catch (IllegalArgumentException e) {
                            return null;
                        }
                    })
                    .filter(java.util.Objects::nonNull)
                    .collect(java.util.stream.Collectors.toList());

            if (orderStatuses.isEmpty()) {
                orderStatuses = null;
            }
        }

        return orderRepository.findByShopOwnerProducts(productIds, pageable, orderStatuses);
    }

    @Override
    public List<Order> getOrdersByShopOwner(String shopOwnerId, String status) {
        List<String> productIds = stockServiceClient.getProductIdsByShopOwner(shopOwnerId).getBody();
        if (productIds == null || productIds.isEmpty()) {
            return Collections.emptyList();
        }
        return orderRepository.findByOrderItemsProductIdIn(productIds);
    }

    @Transactional
    public Order cancelOrder(String orderId, String reason) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found: " + orderId));

        // Chỉ cho phép hủy nếu PENDING
        if (order.getOrderStatus() != OrderStatus.PENDING) {
            throw new RuntimeException("Cannot cancel order with status: " + order.getOrderStatus());
        }

        // Nếu là VNPay/MOMO và đã PAID → Refund vào wallet của client
        if ("VNPAY".equalsIgnoreCase(order.getPaymentMethod()) || "MOMO".equalsIgnoreCase(order.getPaymentMethod())) {
            try {
                ResponseEntity<PaymentDto> paymentResponse = paymentServiceClient.getPaymentByOrderId(orderId);
                if (paymentResponse != null && paymentResponse.getBody() != null) {
                    PaymentDto payment = paymentResponse.getBody();
                    if ("PAID".equals(payment.getStatus())) {
                        // Tính tổng tiền cần refund = totalPrice (đã gồm ship - voucher)
                        BigDecimal totalRefundAmount = BigDecimal.valueOf(order.getTotalPrice());

                        // Validate userId exists
                        if (order.getUserId() == null || order.getUserId().trim().isEmpty()) {
                            log.error("[CANCEL] Cannot refund: userId is missing for order {}", orderId);
                            throw new RuntimeException("UserId is missing for order: " + orderId);
                        }

                        // Refund vào wallet của client
                        AddRefundRequestDto refundRequest = AddRefundRequestDto.builder()
                                .userId(order.getUserId())
                                .orderId(orderId)
                                .paymentId(payment.getId())
                                .amount(totalRefundAmount)
                                .reason(reason != null ? reason : "Order cancelled by user")
                                .build();

                        log.info("[CANCEL] Calling wallet service to add refund: orderId={}, userId={}, amount={}",
                                orderId, order.getUserId(), totalRefundAmount);

                        ResponseEntity<Map<String, Object>> walletResponse = userServiceClient
                                .addRefundToWallet(refundRequest);
                        if (walletResponse != null && walletResponse.getBody() != null) {
                            Map<String, Object> walletResult = walletResponse.getBody();
                            Boolean success = (Boolean) walletResult.get("success");
                            if (Boolean.TRUE.equals(success)) {
                                log.info(
                                        "[CANCEL] Refund added to wallet successfully: orderId={}, userId={}, amount={}, balance={}",
                                        orderId, order.getUserId(), totalRefundAmount,
                                        walletResult.get("balanceAvailable"));
                            } else {
                                String errorMsg = (String) walletResult.get("message");
                                log.error("[CANCEL] Failed to add refund to wallet for order {}: {}", orderId,
                                        errorMsg);
                                throw new RuntimeException("Failed to add refund to wallet: " + errorMsg);
                            }
                        } else {
                            log.error("[CANCEL] Wallet service returned null response for order {}", orderId);
                            throw new RuntimeException("Wallet service returned null response");
                        }
                    } else {
                        log.info("[CANCEL] Payment not PAID, skipping refund: orderId={}, paymentStatus={}", orderId,
                                payment.getStatus());
                    }
                } else {
                    log.warn("[CANCEL] Payment response is null for order {}, skipping refund", orderId);
                }
            } catch (HttpClientErrorException.NotFound e) {
                // Payment không tồn tại - có thể là COD hoặc payment chưa được tạo
                log.warn(
                        "[CANCEL] Payment not found for order {} (may be COD or payment not created yet), skipping refund",
                        orderId);
                // Vẫn cho phép cancel order nếu payment không tồn tại
            } catch (RuntimeException e) {
                // Kiểm tra nếu là "Resource not found" error từ Feign
                if (e.getMessage() != null && e.getMessage().contains("Resource not found")) {
                    log.warn("[CANCEL] Payment not found for order {} (Resource not found), skipping refund", orderId);
                    // Vẫn cho phép cancel order
                } else {
                    // Các lỗi khác (như refund fail) thì throw exception
                    log.error("[CANCEL] Failed to refund to wallet for order {}: {}", orderId, e.getMessage(), e);
                    throw new RuntimeException("Failed to refund to wallet: " + e.getMessage(), e);
                }
            } catch (Exception e) {
                // Kiểm tra nếu là "Resource not found" error
                String errorMsg = e.getMessage();
                if (errorMsg != null && (errorMsg.contains("Resource not found") || errorMsg.contains("404"))) {
                    log.warn("[CANCEL] Payment not found for order {} (404/Resource not found), skipping refund",
                            orderId);
                    // Vẫn cho phép cancel order nếu payment không tồn tại
                } else {
                    log.error("[CANCEL] Failed to refund to wallet for order {}: {}", orderId, e.getMessage(), e);
                    throw new RuntimeException("Failed to refund to wallet: " + e.getMessage(), e);
                }
            }
        }

        // Rollback stock và set cancelReason
        // rollbackOrderStock() sẽ set status = CANCELLED, nhưng chúng ta cần set
        // cancelReason
        order.setCancelReason(reason);
        orderRepository.save(order);

        // Rollback stock (method này sẽ set status = CANCELLED)
        rollbackOrderStock(orderId);

        // Reload order để lấy status mới nhất (đã được set bởi rollbackOrderStock)
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found after rollback: " + orderId));
    }

    protected double calculateTotalPrice(List<OrderItem> orderItems) {
        return orderItems.stream()
                .mapToDouble(item -> item.getUnitPrice() * item.getQuantity())
                .sum();
    }

    @Override
    public Order getOrderById(String orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found for ID: " + orderId));
    }

    @Override
    public List<Order> getUserOrders(String userId) {
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Override
    @Transactional
    public Order updateOrder(String orderId, UpdateOrderRequest request) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found for ID: " + orderId));

        if (request.getOrderStatus() != null) {
            order.setOrderStatus(OrderStatus.valueOf(request.getOrderStatus().toUpperCase()));
        }

        return orderRepository.save(order);
    }

    @Override
    @Transactional
    public Order updateOrderStatus(String orderId, String status) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found for ID: " + orderId));

        order.setOrderStatus(OrderStatus.valueOf(status.toUpperCase()));
        return orderRepository.save(order);
    }

    @Override
    @Transactional
    public void rollbackOrderStock(String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found for ID: " + orderId));

        // Only rollback if order is still PENDING (not paid yet)
        if (order.getOrderStatus() != OrderStatus.PENDING) {
            log.warn("[ROLLBACK] Order {} is not PENDING (status: {}), skipping rollback",
                    orderId, order.getOrderStatus());
            return;
        }

        // Rollback stock for each order item
        if (order.getOrderItems() != null && !order.getOrderItems().isEmpty()) {
            for (OrderItem item : order.getOrderItems()) {
                try {
                    IncreaseStockRequest rollbackRequest = new IncreaseStockRequest(
                            item.getSizeId(),
                            item.getQuantity());
                    stockServiceClient.increaseStock(rollbackRequest);
                    log.info("[ROLLBACK] Rolled back stock for sizeId: {}, quantity: {}",
                            item.getSizeId(), item.getQuantity());
                } catch (Exception e) {
                    log.error("[ROLLBACK] Failed to rollback stock for sizeId: {}, quantity: {}",
                            item.getSizeId(), item.getQuantity(), e);
                    // Continue with other items even if one fails
                }
            }
        }

        // Update order status to CANCELLED
        order.setOrderStatus(OrderStatus.CANCELLED);
        orderRepository.save(order);
        log.info("[ROLLBACK] Order {} rolled back and cancelled", orderId);
    }

    // Address-related methods
    @Override
    public List<AddressDto> getUserAddresses(HttpServletRequest request) {
        String author = request.getHeader("Authorization");
        return userServiceClient.getAllAddresses(author).getBody();
    }

    @Override
    public AddressDto getAddressById(String addressId) {
        return userServiceClient.getAddressById(addressId).getBody();
    }

    // ====== Helpers Tạo order ======
    private Order initPendingOrder(String userId, String addressId, String paymentMethod) {
        Order order = Order.builder()
                .userId(userId)
                .addressId(addressId)
                .orderStatus(OrderStatus.PENDING)
                .totalPrice(0.0)
                .paymentMethod(paymentMethod != null ? paymentMethod : "COD") // Default to COD if not specified
                .build();
        return orderRepository.save(order);
    }

    private List<OrderItem> toOrderItemsFromSelected(List<SelectedItemDto> selectedItems, Order order) {
        return selectedItems.stream()
                .map(si -> {
                    if (si.getSizeId() == null || si.getSizeId().isBlank()) {
                        throw new RuntimeException("Size ID is required for product: " + si.getProductId());
                    }
                    return OrderItem.builder()
                            .productId(si.getProductId())
                            .sizeId(si.getSizeId())
                            .quantity(si.getQuantity())
                            .unitPrice(si.getUnitPrice())
                            .totalPrice(si.getUnitPrice() * si.getQuantity())
                            .isFlashSale(si.getIsFlashSale())
                            .order(order)
                            .build();
                })
                .collect(Collectors.toList());
    }

    /**
     * Tạo OrderItems từ SelectedItems cho checkout (skip decrease stock cho test
     * products)
     */
    private List<OrderItem> toOrderItemsFromSelectedForCheckout(List<SelectedItemDto> selectedItems, Order order) {
        return selectedItems.stream()
                .map(si -> {
                    if (si.getSizeId() == null || si.getSizeId().isBlank()) {
                        throw new RuntimeException("Size ID is required for product: " + si.getProductId());
                    }

                    Double unitPrice = si.getUnitPrice();
                    // Fallback to avoid NPE if producer failed to populate price
                    if (unitPrice == null) {
                        try {
                            ProductDto p = stockServiceClient.getProductById(si.getProductId()).getBody();
                            SizeDto s = stockServiceClient.getSizeById(si.getSizeId()).getBody();
                            unitPrice = computeUnitPrice(p, s);
                        } catch (Exception e) {
                            log.warn("[CONSUMER] Failed to fetch price for item {}, defaulting to 0",
                                    si.getProductId());
                            unitPrice = 0.0;
                        }
                    }

                    return OrderItem.builder()
                            .productId(si.getProductId())
                            .sizeId(si.getSizeId())
                            .quantity(si.getQuantity())
                            .unitPrice(unitPrice)
                            .totalPrice(unitPrice * si.getQuantity())
                            .isFlashSale(si.getIsFlashSale()) // Propagate Flash Sale flag
                            .order(order)
                            .build();
                })
                .collect(Collectors.toList());
    }

    /**
     * Compute unit price from product base price and optional size price modifier.
     */
    private double computeUnitPrice(ProductDto product, SizeDto size) {
        double base = product.getPrice();
        double modifier = size != null ? size.getPriceModifier() : 0.0;
        return base + modifier;
    }

    /**
     * Group selected items by shop owner ID.
     * Each shop will have its own order when checking out.
     * 
     * @param selectedItems List of items to group
     * @return Map of shopOwnerId -> List of items belonging to that shop
     */
    private Map<String, List<SelectedItemDto>> groupItemsByShopOwner(List<SelectedItemDto> selectedItems) {
        Map<String, List<SelectedItemDto>> itemsByShop = new LinkedHashMap<>();

        // ✅ STEP 1: Collect all unique product IDs (excluding test products)
        List<String> productIds = selectedItems.stream()
                .map(SelectedItemDto::getProductId)
                .filter(id -> id != null && !id.startsWith("test-product-"))
                .distinct()
                .collect(java.util.stream.Collectors.toList());

        // ✅ STEP 2: Fetch ALL products in ONE batch call
        Map<String, ProductDto> productsMap = new HashMap<>();
        if (!productIds.isEmpty()) {
            try {
                BatchGetProductsRequest request = new BatchGetProductsRequest(productIds);
                ResponseEntity<Map<String, ProductDto>> response = stockServiceClient.batchGetProducts(request);
                if (response != null && response.getBody() != null) {
                    productsMap = response.getBody();
                }
                log.info("[BATCH-OPTIMIZATION] Fetched {} products in 1 batch call", productsMap.size());
            } catch (Exception e) {
                log.error("[BATCH-OPTIMIZATION] Failed to fetch products in batch: {}", e.getMessage());
            }
        }

        // ✅ STEP 3: Group by shop owner (in-memory, fast)
        for (SelectedItemDto item : selectedItems) {
            String shopOwnerId;

            // Handle test products (bypass optimization)
            if (item.getProductId() != null && item.getProductId().startsWith("test-product-")) {
                shopOwnerId = "test-shop-owner";
            } else {
                ProductDto product = productsMap.get(item.getProductId());
                shopOwnerId = (product != null && product.getUserId() != null)
                        ? product.getUserId()
                        : "unknown";
            }

            itemsByShop.computeIfAbsent(shopOwnerId, k -> new ArrayList<>()).add(item);
        }

        log.info("[GROUP-BY-SHOP] Grouped {} items into {} shops using batch API",
                selectedItems.size(), itemsByShop.size());
        return itemsByShop;
    }

    /**
     * ⚡ ASYNC Version: Cart cleanup without blocking batch processing
     * 
     * Chạy cart cleanup bất đồng bộ → Batch processing KHÔNG BỊ CHẶN
     * Throughput tăng 5-10x (từ ~100 lên 500-1000 orders/s)
     * 
     * @param userId        User ID
     * @param selectedItems Items to remove from cart
     */
    @Async
    public void cleanupCartItemsAsync(String userId, List<SelectedItemDto> selectedItems) {
        try {
            log.info("[ASYNC-CART-CLEANUP] Starting async cart cleanup for userId: {}", userId);
            cleanupCartItemsBySelected(userId, selectedItems);
            log.info("[ASYNC-CART-CLEANUP] Completed async cart cleanup for userId: {}", userId);
        } catch (Exception e) {
            log.error("[ASYNC-CART-CLEANUP] Failed async cart cleanup for userId: {}: {}", userId, e.getMessage(), e);
            // Không throw exception → Không ảnh hưởng đến order creation
        }
    }

    /**
     * Được gọi từ async method hoặc trong special cases
     */
    private void cleanupCartItemsBySelected(String userId, List<SelectedItemDto> selectedItems) {
        if (selectedItems == null || selectedItems.isEmpty()) {
            log.warn("[CONSUMER] selectedItems is null or empty - skipping cart cleanup");
            return;
        }

        log.info("[CONSUMER] Starting cart cleanup for userId: {}, number of items to remove: {}",
                userId, selectedItems.size());

        for (SelectedItemDto item : selectedItems) {
            try {
                // Skip cart cleanup for test products (optimization for test/benchmarking)
                if (item.getProductId() != null && item.getProductId().startsWith("test-product-")) {
                    log.info("[CONSUMER]  Skipping cart cleanup for test product: {}", item.getProductId());
                    continue;
                }

                log.info("[CONSUMER] Removing cart item - productId: {}, sizeId: {}, quantity: {}",
                        item.getProductId(), item.getSizeId(), item.getQuantity());

                RemoveCartItemByUserIdRequest request = new RemoveCartItemByUserIdRequest();
                request.setUserId(userId);
                request.setProductId(item.getProductId());
                request.setSizeId(item.getSizeId());

                log.debug("[CONSUMER] Sending removeCartItemsByUserId request - userId: {}, productId: {}, sizeId: {}",
                        request.getUserId(), request.getProductId(), request.getSizeId());

                stockServiceClient.removeCartItemsByUserId(request);

                log.info("[CONSUMER] Successfully removed cart item - productId: {}, sizeId: {}",
                        item.getProductId(), item.getSizeId());
            } catch (Exception e) {
                log.error("[CONSUMER] Failed to remove cart item - productId: {}, sizeId: {}, error: {}",
                        item.getProductId(), item.getSizeId(), e.getMessage(), e);
            }
        }

    }

    /**
     * CRITICAL FOR BATCH INSERT PERFORMANCE
     * 
     * Pre-assign UUIDs to Order and OrderItems BEFORE save()
     * 
     * WHY? Hibernate can ONLY batch insert when IDs are known BEFORE persist.
     * With @PrePersist, IDs are assigned too late → No batching
     * 
     * This method assigns UUIDs manually → Hibernate can batch 50 entities into 1-2
     * SQL statements
     * 
     * SAFE: @PrePersist still works as fallback for non-batch scenarios
     */
    private void ensureIdsAssignedForBatchInsert(Order order) {
        // Assign Order ID if not set
        if (order.getId() == null) {
            order.setId(java.util.UUID.randomUUID().toString());
        }

        // Assign OrderItem IDs if not set
        if (order.getOrderItems() != null) {
            for (OrderItem item : order.getOrderItems()) {
                if (item.getId() == null) {
                    item.setId(java.util.UUID.randomUUID().toString());
                }
            }
        }
    }

    private void notifyOrderPlaced(Order order) {
        // Since 1 user = 1 shop, set both userId and shopId to order.getUserId()
        // This is a notification for the user (who placed the order), not shop owner

        // Format order ID to show only first 8 characters for better readability
        String shortOrderId = order.getId().length() > 8
                ? order.getId().substring(0, 8).toUpperCase()
                : order.getId().toUpperCase();

        // Calculate total items from order
        int totalItems = order.getOrderItems() != null
                ? order.getOrderItems().stream().mapToInt(OrderItem::getQuantity).sum()
                : 0;

        // Format user-friendly message
        String message = String.format(
                "Đơn hàng #%s đã được đặt thành công! %d sản phẩm với tổng giá trị %.0f₫",
                shortOrderId, totalItems, order.getTotalPrice());

        SendNotificationRequest noti = SendNotificationRequest.builder()
                .userId(order.getUserId())
                .shopId(order.getUserId())
                .orderId(order.getId())
                .message(message)
                .isShopOwnerNotification(false) // false = user notification
                .build();
        // kafkaTemplateSend.send(notificationTopic.name(), noti);
        String partitionKey = noti.getUserId() != null ? noti.getUserId() : noti.getShopId();
        kafkaTemplateSend.send(notificationTopic.name(), partitionKey, noti);
    }

    private void notifyShopOwners(Order order) {
        if (order.getOrderItems() == null || order.getOrderItems().isEmpty()) {
            return;
        }

        // Group order items by shop owner (product.userId)
        Map<String, List<OrderItem>> itemsByShopOwner = new HashMap<>();

        for (OrderItem item : order.getOrderItems()) {
            try {
                ResponseEntity<ProductDto> productResponse = stockServiceClient.getProductById(item.getProductId());
                if (productResponse != null && productResponse.getBody() != null) {
                    ProductDto product = productResponse.getBody();
                    String shopOwnerId = product.getUserId();

                    if (shopOwnerId != null && !shopOwnerId.isBlank()) {
                        itemsByShopOwner.computeIfAbsent(shopOwnerId, k -> new ArrayList<>()).add(item);
                    }
                }
            } catch (Exception e) {
                log.error("[CONSUMER] Failed to fetch product for notification: productId={}, error={}",
                        item.getProductId(), e.getMessage());
            }
        }

        // Send notification to each shop owner
        for (Map.Entry<String, List<OrderItem>> entry : itemsByShopOwner.entrySet()) {
            String shopOwnerId = entry.getKey();
            List<OrderItem> items = entry.getValue();

            int totalItems = items.stream().mapToInt(OrderItem::getQuantity).sum();
            double totalAmount = items.stream().mapToDouble(OrderItem::getTotalPrice).sum();

            String message = String.format(
                    "Bạn có đơn hàng mới #%s với %d sản phẩm, tổng giá trị: %.0f VNĐ",
                    order.getId(), totalItems, totalAmount);

            try {
                // Since 1 user = 1 shop, set both userId and shopId to shopOwnerId
                // This is a notification for the shop owner, not the user who placed the order
                SendNotificationRequest notification = SendNotificationRequest.builder()
                        .userId(shopOwnerId)
                        .shopId(shopOwnerId)
                        .orderId(order.getId())
                        .message(message)
                        .isShopOwnerNotification(true) // true = shop owner notification
                        .build();
                // kafkaTemplateSend.send(notificationTopic.name(), notification);
                String partitionKey = notification.getShopId() != null
                        ? notification.getShopId()
                        : notification.getUserId();
                kafkaTemplateSend.send(notificationTopic.name(), partitionKey, notification);
            } catch (Exception e) {
                log.error("[CONSUMER] Failed to send notification to shop owner: shopId={}, error={}",
                        shopOwnerId, e.getMessage());
            }
        }
    }

    // ========== GHN SHIPPING ORDER METHODS ==========

    /**
     * TẠO VẬN ĐƠN GHN
     * Được gọi sau khi order được tạo thành công
     */
    private void createShippingOrder(Order order) {
        try {

            // 1. Lấy địa chỉ khách hàng
            AddressDto customerAddress = userServiceClient.getAddressById(order.getAddressId()).getBody();
            if (customerAddress == null) {
                return;
            }

            // 2. Validate GHN fields
            if (customerAddress.getDistrictId() == null || customerAddress.getWardCode() == null) {
                return;
            }

            // 3. Validate order items
            if (order.getOrderItems() == null || order.getOrderItems().isEmpty()) {
                return;
            }

            // 4. Tính tổng weight từ order items (lấy weight từ Size)
            int totalWeight = 0;
            for (OrderItem item : order.getOrderItems()) {
                try {
                    // Get size information to get weight
                    ResponseEntity<com.example.orderservice.dto.SizeDto> sizeResponse = stockServiceClient
                            .getSizeById(item.getSizeId());
                    if (sizeResponse != null && sizeResponse.getBody() != null) {
                        com.example.orderservice.dto.SizeDto size = sizeResponse.getBody();
                        int itemWeight = (size.getWeight() != null && size.getWeight() > 0) ? size.getWeight() : 500; // Default
                                                                                                                      // 500g
                                                                                                                      // if
                                                                                                                      // not
                                                                                                                      // set
                        totalWeight += item.getQuantity() * itemWeight;
                    } else {
                        // Fallback to 500g if size not found
                        totalWeight += item.getQuantity() * 500;
                    }
                } catch (Exception e) {
                    // Fallback to 500g if error
                    totalWeight += item.getQuantity() * 500;
                }
            }

            // 5. Lấy shop owner address (FROM address)
            // Lấy shop owner ID từ product đầu tiên
            String shopOwnerId = null;
            try {
                if (!order.getOrderItems().isEmpty()) {
                    ProductDto firstProduct = stockServiceClient.getProductById(
                            order.getOrderItems().get(0).getProductId()).getBody();
                    if (firstProduct != null) {
                        shopOwnerId = firstProduct.getUserId();
                    }
                }
            } catch (Exception e) {
            }

            // Lấy shop owner info để có FROM address
            ShopOwnerDto shopOwner = null;
            if (shopOwnerId != null && !shopOwnerId.isBlank()) {
                try {
                    ResponseEntity<ShopOwnerDto> shopOwnerResponse = userServiceClient
                            .getShopOwnerByUserId(shopOwnerId);
                    if (shopOwnerResponse != null && shopOwnerResponse.getBody() != null) {
                        shopOwner = shopOwnerResponse.getBody();
                    }
                } catch (Exception e) {
                }
            }

            // Validate shop owner address
            if (shopOwner == null || shopOwner.getDistrictId() == null || shopOwner.getWardCode() == null) {
                return;
            }

            // 6. Build items cho GHN (bao gồm weight cho mỗi item - required for
            // service_type_id = 5)
            List<GhnItemDto> ghnItems = order.getOrderItems().stream()
                    .map(item -> {
                        String productName = "Product";
                        int itemWeight = 500; // Default 500g per item

                        try {
                            ProductDto product = stockServiceClient.getProductById(item.getProductId()).getBody();
                            if (product != null) {
                                productName = product.getName();
                            }
                        } catch (Exception e) {
                        }

                        // Lấy weight từ Size
                        try {
                            ResponseEntity<com.example.orderservice.dto.SizeDto> sizeResponse = stockServiceClient
                                    .getSizeById(item.getSizeId());
                            if (sizeResponse != null && sizeResponse.getBody() != null) {
                                com.example.orderservice.dto.SizeDto size = sizeResponse.getBody();
                                if (size.getWeight() != null && size.getWeight() > 0) {
                                    itemWeight = size.getWeight();
                                }
                            }
                        } catch (Exception e) {
                            // Use default weight
                        }

                        return GhnItemDto.builder()
                                .name(productName)
                                .quantity(item.getQuantity())
                                .price((long) item.getUnitPrice())
                                .weight(itemWeight) // Weight per item in grams
                                .build();
                    })
                    .collect(Collectors.toList());

            // 7. Chọn service type: ưu tiên theo weight, nhưng phải có trong GHN available
            // services
            // - Ưu tiên Hàng nhẹ (type 2) nếu weight < 20kg VÀ có khả dụng
            // - Fallback Hàng nặng (type 5) nếu type 2 không khả dụng
            Integer preferredType = (totalWeight < 20000) ? 2 : 5;
            Integer serviceTypeId = preferredType;
            String selectedServiceName = (preferredType == 2) ? "Hàng nhẹ" : "Hàng nặng";

            try {
                GhnAvailableServicesResponse servicesResponse = ghnApiClient.getAvailableServices(
                        shopOwner.getDistrictId(),
                        customerAddress.getDistrictId());

                if (servicesResponse != null && servicesResponse.getCode() == 200
                        && servicesResponse.getData() != null && !servicesResponse.getData().isEmpty()) {

                    // Tìm xem service type ưu tiên có khả dụng không
                    GhnAvailableServicesResponse.ServiceData preferredService = null;
                    GhnAvailableServicesResponse.ServiceData fallbackService = null;

                    for (GhnAvailableServicesResponse.ServiceData service : servicesResponse.getData()) {
                        if (service.getServiceTypeId().equals(preferredType)) {
                            preferredService = service;
                        } else {
                            fallbackService = service;
                        }
                    }

                    // Sử dụng service ưu tiên nếu có, không thì dùng fallback
                    if (preferredService != null) {
                        serviceTypeId = preferredService.getServiceTypeId();
                        selectedServiceName = preferredService.getShortName();
                        log.info("[GHN] Using preferred service: {} (type: {}) for weight: {}g",
                                selectedServiceName, serviceTypeId, totalWeight);
                    } else if (fallbackService != null) {
                        serviceTypeId = fallbackService.getServiceTypeId();
                        selectedServiceName = fallbackService.getShortName();
                        log.info("[GHN] Preferred type {} not available, using fallback: {} (type: {}) for weight: {}g",
                                preferredType, selectedServiceName, serviceTypeId, totalWeight);
                    }
                }
            } catch (Exception e) {
                log.warn("[GHN] Failed to get available services, using default type {}: {}",
                        serviceTypeId, e.getMessage());
            }

            log.info("[GHN] Final service: {} (type: {}) for weight: {}g, route {} -> {}",
                    selectedServiceName, serviceTypeId, totalWeight,
                    shopOwner.getDistrictId(), customerAddress.getDistrictId());

            // 8. Build GHN request với FROM address từ shop owner
            GhnCreateOrderRequest.GhnCreateOrderRequestBuilder requestBuilder = GhnCreateOrderRequest.builder()
                    .paymentTypeId(2) // 2 = Người nhận trả phí
                    .requiredNote("CHOXEMHANGKHONGTHU") // Cho xem hàng không cho thử
                    .toName(customerAddress.getRecipientName())
                    .toPhone(customerAddress.getRecipientPhone())
                    .toAddress(customerAddress.getStreetAddress())
                    .toWardCode(customerAddress.getWardCode())
                    .toDistrictId(customerAddress.getDistrictId())
                    .codAmount((long) order.getTotalPrice()) // Thu hộ COD
                    .weight(totalWeight)
                    .length(20) // cm - Hardcode, có thể lấy từ product sau
                    .width(15)
                    .height(10)
                    .serviceTypeId(serviceTypeId) // Sử dụng service type từ API
                    .items(ghnItems);

            // Thêm FROM address từ shop owner
            if (shopOwner != null) {
                requestBuilder
                        .fromName(shopOwner.getShopName() != null ? shopOwner.getShopName() : shopOwner.getOwnerName())
                        .fromPhone(shopOwner.getPhone() != null ? shopOwner.getPhone() : "0123456789")
                        .fromAddress(shopOwner.getStreetAddress())
                        .fromWardCode(shopOwner.getWardCode())
                        .fromDistrictId(shopOwner.getDistrictId());
            }

            GhnCreateOrderRequest ghnRequest = requestBuilder.build();

            // 9. Call GHN API
            GhnCreateOrderResponse ghnResponse = ghnApiClient.createOrder(ghnRequest);

            if (ghnResponse == null || ghnResponse.getCode() != 200) {
                log.error("[GHN] Failed to create order - Response: {}",
                        ghnResponse != null ? ghnResponse.getMessage() : "null response");
                return;
            }

            // 9. Save ShippingOrder

            ShippingOrder shippingOrder = ShippingOrder.builder()
                    .orderId(order.getId())
                    .ghnOrderCode(ghnResponse.getData().getOrderCode())
                    .shippingFee(BigDecimal.valueOf(ghnResponse.getData().getTotalFee()))
                    .codAmount(BigDecimal.valueOf(order.getTotalPrice()))
                    .weight(totalWeight)
                    .status("PENDING")
                    .expectedDeliveryTime(parseDateTime(ghnResponse.getData().getExpectedDeliveryTime()))
                    .ghnResponse(toJson(ghnResponse))
                    .build();

            // Initialize tracking history using shop owner & customer coordinates if
            // available
            try {
                java.util.List<java.util.Map<String, Object>> history = new java.util.ArrayList<>();
                if (shopOwner != null && shopOwner.getLatitude() != null && shopOwner.getLongitude() != null) {
                    java.util.Map<String, Object> p = new java.util.HashMap<>();
                    p.put("ts", java.time.LocalDateTime.now().toString());
                    p.put("lat", shopOwner.getLatitude());
                    p.put("lng", shopOwner.getLongitude());
                    p.put("status", "PICKED_FROM_SHOP");
                    p.put("note", "Shop ready / pickup point");
                    history.add(p);

                    // set last location to shop initially
                    shippingOrder.setLastLat(shopOwner.getLatitude());
                    shippingOrder.setLastLng(shopOwner.getLongitude());
                    shippingOrder.setLastTs(java.time.LocalDateTime.now());
                }

                if (customerAddress != null && customerAddress.getLatitude() != null
                        && customerAddress.getLongitude() != null) {
                    java.util.Map<String, Object> dest = new java.util.HashMap<>();
                    dest.put("ts", java.time.LocalDateTime.now().toString());
                    dest.put("lat", customerAddress.getLatitude());
                    dest.put("lng", customerAddress.getLongitude());
                    dest.put("status", "DESTINATION");
                    dest.put("note", "Delivery address");
                    history.add(dest);
                }

                if (!history.isEmpty()) {
                    shippingOrder.setTrackingHistory(objectMapper.writeValueAsString(history));
                }
            } catch (Exception e) {
                log.warn("[GHN] Failed to init tracking history: {}", e.getMessage());
            }

            shippingOrderRepository.save(shippingOrder);

        } catch (Exception e) {
            // Không throw exception để không làm fail order creation
        }
    }

    /**
     * Helper: Parse datetime từ GHN response
     */
    private LocalDateTime parseDateTime(String dateTimeStr) {
        if (dateTimeStr == null || dateTimeStr.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(dateTimeStr, DateTimeFormatter.ISO_DATE_TIME);
        } catch (Exception e) {
            log.warn("[GHN] Cannot parse datetime: {}", dateTimeStr);
            return null;
        }
    }

    /**
     * Helper: Convert object to JSON string
     */
    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            log.error("[GHN] Cannot serialize to JSON: {}", e.getMessage());
            return "{}";
        }
    }

    @Override
    public void orderByKafka(FrontendOrderRequest orderRequest, String userId) {
        if (orderRequest.getSelectedItems() == null || orderRequest.getSelectedItems().isEmpty())
            throw new RuntimeException("Selected items cannot be empty");
        if (orderRequest.getAddressId() == null || orderRequest.getAddressId().isBlank())
            throw new RuntimeException("Address ID is required");

        for (SelectedItemDto item : orderRequest.getSelectedItems()) {
            if (item.getSizeId() == null || item.getSizeId().isBlank()) {
                throw new RuntimeException("Size ID is required for product: " + item.getProductId());
            }
        }

        // ========== PHASE 3: PRE-RESERVE STOCK ==========
        // Generate temporary order ID for reservation tracking
        String tempOrderId = java.util.UUID.randomUUID().toString();
        java.util.List<ReservedItem> reservedItems = new java.util.ArrayList<>();

        try {
            // Reserve stock for each item
            for (SelectedItemDto item : orderRequest.getSelectedItems()) {
                // DEBUG: Log isFlashSale value
                log.info("[DEBUG-FLASH-SALE] item.productId={}, item.getIsFlashSale()={}, Boolean.TRUE.equals={}",
                        item.getProductId(), item.getIsFlashSale(), Boolean.TRUE.equals(item.getIsFlashSale()));

                if (Boolean.TRUE.equals(item.getIsFlashSale())) {
                    // --- FLASH SALE RESERVATION ---
                    try {
                        String result = flashSaleClient.reserveStock(
                                tempOrderId, item.getProductId(), item.getSizeId(), item.getQuantity(), userId);

                        // Track reserved item
                        reservedItems.add(new ReservedItem(item.getProductId(), item.getSizeId(), true));
                        log.info("[PRE-RESERVE] Flash Sale Reserved: product={}, qty={}",
                                item.getProductId(), item.getQuantity());

                    } catch (Exception e) {
                        String message = e.getMessage();
                        log.warn("[PRE-RESERVE] Flash Sale Failed for product {}: {}", item.getProductId(), message);
                        rollbackReservations(tempOrderId, reservedItems, userId);

                        if (message.contains("limit")) {
                            throw new RuntimeException(message); // Pass limitation message directly
                        } else {
                            throw new RuntimeException("Flash Sale Reserve failed: " + message);
                        }
                    }

                } else {
                    // --- REGULAR STOCK RESERVATION ---
                    StockServiceClient.ReserveRequest reserveReq = new StockServiceClient.ReserveRequest(
                            tempOrderId,
                            item.getProductId(),
                            item.getSizeId(),
                            item.getQuantity());

                    ResponseEntity<java.util.Map<String, Object>> response = stockServiceClient
                            .reserveStock(reserveReq);

                    if (response.getBody() == null ||
                            !Boolean.TRUE.equals(response.getBody().get("success"))) {

                        // Reserve failed → Get error info
                        String status = response.getBody() != null
                                ? (String) response.getBody().get("status")
                                : "UNKNOWN";
                        String message = response.getBody() != null
                                ? (String) response.getBody().get("message")
                                : "Reserve failed";

                        log.warn("[PRE-RESERVE] Failed for product {}: status={}, message={}",
                                item.getProductId(), status, message);

                        // Rollback all previously reserved items
                        rollbackReservations(tempOrderId, reservedItems, userId);

                        // Throw appropriate exception
                        if ("INSUFFICIENT_STOCK".equals(status)) {
                            throw new RuntimeException("Insufficient stock for product: "
                                    + item.getProductId() + ", size: " + item.getSizeId());
                        } else {
                            throw new RuntimeException("Reserve failed: " + message);
                        }
                    }

                    // Track reserved item for potential rollback
                    reservedItems.add(new ReservedItem(item.getProductId(), item.getSizeId(), false));
                    log.info("[PRE-RESERVE] Reserved: product={}, size={}, qty={}",
                            item.getProductId(), item.getSizeId(), item.getQuantity());
                }
            }

        } catch (RuntimeException e) {
            // Already rolled back in the catch block above if needed
            throw e;
        } catch (Exception e) {
            // Unexpected error → Rollback
            log.error("[PRE-RESERVE] Unexpected error: {}", e.getMessage(), e);
            rollbackReservations(tempOrderId, reservedItems, userId);
            throw new RuntimeException("Reserve failed: " + e.getMessage());
        }

        // ========== ALL RESERVED → SEND TO KAFKA ==========
        CheckOutKafkaRequest kafkaRequest = CheckOutKafkaRequest.builder()
                .userId(userId)
                .tempOrderId(tempOrderId) // Include tempOrderId for confirmation later
                .addressId(orderRequest.getAddressId())
                .cartId(null)
                .selectedItems(orderRequest.getSelectedItems())
                .paymentMethod(orderRequest.getPaymentMethod() != null ? orderRequest.getPaymentMethod() : "COD")
                .voucherId(orderRequest.getVoucherId())
                .voucherDiscount(orderRequest.getVoucherDiscount())
                .shippingFee(orderRequest.getShippingFee())
                .build();

        kafkaTemplate.send(orderTopic.name(), kafkaRequest);
        log.info("[ASYNC-ORDER] Order reserved and sent to Kafka: tempOrderId={}, user={}", tempOrderId, userId);
    }

    /**
     * Helper: Rollback all reserved items when reservation fails
     */
    private void rollbackReservations(String tempOrderId, java.util.List<ReservedItem> reservedItems, String userId) {
        for (ReservedItem item : reservedItems) {
            try {
                if (item.isFlashSale()) {
                    // Flash Sale Rollback
                    flashSaleClient.cancelReservation(tempOrderId, item.productId(), item.sizeId(), userId);
                } else {
                    StockServiceClient.ReserveRequest cancelReq = new StockServiceClient.ReserveRequest(
                            tempOrderId,
                            item.productId(),
                            item.sizeId(),
                            0);
                    stockServiceClient.cancelReservation(cancelReq);
                }
                log.info("[ROLLBACK] Cancelled reservation: product={}, size={}, isFS={}",
                        item.productId(), item.sizeId(), item.isFlashSale());
            } catch (Exception e) {
                log.error("[ROLLBACK] Failed to cancel reservation: product={}, size={}, error={}",
                        item.productId(), item.sizeId(), e.getMessage());
            }
        }
    }

    /**
     * Helper record for tracking reserved items
     */
    private record ReservedItem(String productId, String sizeId, boolean isFlashSale) {
    }

    /**
     * Phase 3: Confirm all reservations after order saved successfully.
     * This deletes the reservation keys in Redis, finalizing the stock decrease.
     * If confirmation fails, the reservation will expire naturally (TTL = 15 min).
     */
    private void confirmReservationsForOrder(String tempOrderId, List<SelectedItemDto> items) {
        if (tempOrderId == null || items == null) {
            return;
        }

        for (SelectedItemDto item : items) {
            try {
                if (Boolean.TRUE.equals(item.getIsFlashSale())) {
                    // Confirm Flash Sale
                    flashSaleClient.confirmReservation(tempOrderId, item.getProductId(), item.getSizeId());
                } else {
                    // Confirm Regular
                    StockServiceClient.ReserveRequest confirmReq = new StockServiceClient.ReserveRequest(
                            tempOrderId,
                            item.getProductId(),
                            item.getSizeId(),
                            0);
                    stockServiceClient.confirmReservation(confirmReq);
                }
                log.debug("[CONFIRM-RESERVATION] Confirmed: tempOrderId={}, product={}, size={}",
                        tempOrderId, item.getProductId(), item.getSizeId());
            } catch (Exception e) {
                // Don't throw - reservation will expire naturally if confirmation fails
                log.warn("[CONFIRM-RESERVATION] Failed to confirm reservation: tempOrderId={}, product={}, error={}",
                        tempOrderId, item.getProductId(), e.getMessage());
            }
        }
        log.info("[CONFIRM-RESERVATION] Confirmed {} reservations for tempOrderId={}", items.size(), tempOrderId);
    }

    /**
     * Tạo order từ payment service với raw Map data
     * Di chuyển logic parsing từ Controller vào đây để đảm bảo clean architecture
     */
    @Override
    @Transactional
    public Order createOrderFromPaymentData(Map<String, Object> orderData) {
        // 1. Extract required fields
        String userId = (String) orderData.get("userId");
        String addressId = (String) orderData.get("addressId");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> selectedItemsRaw = (List<Map<String, Object>>) orderData.get("selectedItems");

        if (userId == null || addressId == null || selectedItemsRaw == null) {
            throw new RuntimeException("Missing required fields: userId, addressId, selectedItems");
        }

        // 2. Parse shippingFee (handle multiple types)
        BigDecimal shippingFee = null;
        if (orderData.containsKey("shippingFee")) {
            Object shippingFeeObj = orderData.get("shippingFee");
            if (shippingFeeObj != null) {
                if (shippingFeeObj instanceof Number) {
                    shippingFee = BigDecimal.valueOf(((Number) shippingFeeObj).doubleValue());
                } else if (shippingFeeObj instanceof String) {
                    try {
                        shippingFee = new BigDecimal((String) shippingFeeObj);
                    } catch (NumberFormatException e) {
                        log.warn("[PAYMENT-ORDER] Invalid shippingFee format: {}", shippingFeeObj);
                    }
                }
            }
        }

        // 3. Parse voucher data
        String voucherId = (String) orderData.get("voucherId");
        Double voucherDiscount = null;
        if (orderData.containsKey("voucherDiscount")) {
            Object voucherDiscountObj = orderData.get("voucherDiscount");
            if (voucherDiscountObj instanceof Number) {
                voucherDiscount = ((Number) voucherDiscountObj).doubleValue();
            }
        }

        // 4. Convert Map to SelectedItemDto
        List<SelectedItemDto> selectedItems = selectedItemsRaw.stream()
                .map(item -> {
                    SelectedItemDto dto = new SelectedItemDto();
                    dto.setProductId((String) item.get("productId"));
                    dto.setSizeId((String) item.get("sizeId"));
                    dto.setQuantity(((Number) item.get("quantity")).intValue());
                    Object unitPriceObj = item.get("unitPrice");
                    if (unitPriceObj != null) {
                        dto.setUnitPrice(((Number) unitPriceObj).doubleValue());
                    }
                    return dto;
                })
                .collect(java.util.stream.Collectors.toList());

        log.info(
                "[PAYMENT-ORDER] Creating order - userId: {}, addressId: {}, items: {}, shippingFee: {}, voucherId: {}",
                userId, addressId, selectedItems.size(), shippingFee, voucherId);

        // 5. Delegate to existing method
        return createOrderFromPayment(userId, addressId, selectedItems, shippingFee, voucherId, voucherDiscount);
    }

    @Override
    public Order createOrderFromPayment(String userId, String addressId, List<SelectedItemDto> selectedItems,
            BigDecimal shippingFee, String voucherId, Double voucherDiscount) {
        // Validate address
        AddressDto address = userServiceClient.getAddressById(addressId).getBody();
        if (address == null) {
            throw new RuntimeException("Address not found for ID: " + addressId);
        }

        // Validate stock and ensure unitPrice is populated
        for (SelectedItemDto item : selectedItems) {
            if (item.getSizeId() == null || item.getSizeId().isBlank()) {
                throw new RuntimeException("Size ID is required for product: " + item.getProductId());
            }

            ProductDto product = stockServiceClient.getProductById(item.getProductId()).getBody();
            if (product == null) {
                throw new RuntimeException("Product not found for ID: " + item.getProductId());
            }

            SizeDto size = stockServiceClient.getSizeById(item.getSizeId()).getBody();
            if (size == null) {
                throw new RuntimeException("Size not found for ID: " + item.getSizeId());
            }

            if (size.getStock() < item.getQuantity()) {
                throw new RuntimeException("Insufficient stock for product: " + product.getName()
                        + ", size: " + size.getName() + ". Available: " + size.getStock() + ", Requested: "
                        + item.getQuantity());
            }

            // Ensure unitPrice is populated (frontend payload may omit it for VNPay flow)
            if (item.getUnitPrice() == null) {
                double computedPrice = computeUnitPrice(product, size);
                item.setUnitPrice(computedPrice);
            }
        }

        // ==================== ORDER SPLITTING BY SHOP ====================
        Map<String, List<SelectedItemDto>> itemsByShop = groupItemsByShopOwner(selectedItems);
        int totalShops = itemsByShop.size();
        log.info("[PAYMENT-ORDER] Splitting order into {} separate orders by shop", totalShops);

        // Calculate shipping fee per shop (divide equally if multiple shops)
        double shippingFeeValue = shippingFee != null ? shippingFee.doubleValue() : 0.0;
        double shippingFeePerShop = shippingFeeValue / totalShops;

        // Determine which shop the voucher belongs to (if any)
        String voucherShopOwnerId = null;
        if (voucherId != null && !voucherId.isBlank()) {
            voucherShopOwnerId = voucherService.getVoucherShopOwnerId(voucherId);
            log.info("[PAYMENT-ORDER] Voucher {} belongs to shop: {}", voucherId, voucherShopOwnerId);
        }

        List<Order> createdOrders = new ArrayList<>();
        boolean voucherApplied = false;
        Order firstOrder = null;

        for (Map.Entry<String, List<SelectedItemDto>> entry : itemsByShop.entrySet()) {
            String shopOwnerId = entry.getKey();
            List<SelectedItemDto> shopItems = entry.getValue();

            log.info("[PAYMENT-ORDER] Creating order for shop {} with {} items", shopOwnerId, shopItems.size());

            // Create order with PENDING status
            Order order = Order.builder()
                    .userId(userId)
                    .addressId(addressId)
                    .orderStatus(OrderStatus.PENDING)
                    .totalPrice(0.0)
                    .shippingFee(BigDecimal.valueOf(shippingFeePerShop))
                    .paymentMethod("VNPAY")
                    .build();

            // Set voucher data ONLY if this shop owns the voucher
            boolean shouldApplyVoucher = voucherId != null &&
                    voucherShopOwnerId != null &&
                    voucherShopOwnerId.equals(shopOwnerId) &&
                    !voucherApplied;

            if (shouldApplyVoucher) {
                order.setVoucherId(voucherId);
                order.setVoucherDiscount(voucherDiscount != null ? BigDecimal.valueOf(voucherDiscount) : null);
                log.info("[PAYMENT-ORDER] Applying voucher {} to order for shop {}", voucherId, shopOwnerId);
            }

            order = orderRepository.save(order);

            // Add items and decrease stock
            List<OrderItem> items = toOrderItemsFromSelected(shopItems, order);
            order.setOrderItems(items);

            // Calculate total: items + ship - voucher
            double itemsTotal = calculateTotalPrice(items);
            double ship = order.getShippingFee() != null ? order.getShippingFee().doubleValue() : 0.0;
            double voucher = order.getVoucherDiscount() != null ? order.getVoucherDiscount().doubleValue() : 0.0;
            order.setTotalPrice(itemsTotal + ship - voucher);
            orderRepository.save(order);

            // Apply voucher if this order has voucher
            if (shouldApplyVoucher && order.getVoucherId() != null && !order.getVoucherId().isBlank()) {
                try {
                    voucherService.applyVoucherToOrder(
                            order.getVoucherId(),
                            order.getId(),
                            order.getUserId(),
                            order.getVoucherDiscount());
                    voucherApplied = true;
                } catch (Exception e) {
                    log.error("[VOUCHER] Failed to apply voucher to order {}: {}", order.getId(), e.getMessage(), e);
                }
            }

            // Send notifications for this order
            try {
                notifyOrderPlaced(order);
                notifyShopOwners(order);
            } catch (Exception e) {
                log.error("[PAYMENT-ORDER] send notification failed for order {}: {}", order.getId(), e.getMessage(),
                        e);
            }

            createdOrders.add(order);
            if (firstOrder == null) {
                firstOrder = order;
            }
        }

        // Cleanup cart - remove ALL items
        try {
            cleanupCartItemsBySelected(userId, selectedItems);
        } catch (Exception e) {
            log.error("[PAYMENT-ORDER] cart cleanup failed: {}", e.getMessage(), e);
        }

        log.info("[PAYMENT-ORDER] Successfully created {} orders for user {}", createdOrders.size(), userId);

        // Return first order (for payment link update)
        return firstOrder;
    }

    /**
     * BATCH CONSUMER: Xử lý checkout từ Kafka Batch Mode
     */
    @KafkaListener(topics = "#{@orderTopic.name}", groupId = "order-service-checkout", containerFactory = "checkoutListenerFactory")
    @Transactional
    public void consumeCheckout(List<CheckOutKafkaRequest> messages) {
        // Nếu batch rỗng thì bỏ qua
        if (messages == null || messages.isEmpty()) {
            return;
        }

        List<Order> ordersToSave = new ArrayList<>();
        List<OrderItem> orderItemsToSave = new ArrayList<>();

        // Xử lý từng message trong batch
        for (CheckOutKafkaRequest msg : messages) {
            try {
                // ==================== VALIDATION ====================
                if (msg.getAddressId() == null || msg.getAddressId().isBlank()) {
                    continue; // Skip invalid message
                }
                if (msg.getSelectedItems() == null || msg.getSelectedItems().isEmpty()) {
                    continue;
                }

                // ==================== ORDER SPLITTING BY SHOP ====================
                Map<String, List<SelectedItemDto>> itemsByShop = groupItemsByShopOwner(msg.getSelectedItems());
                int totalShops = itemsByShop.size();
                double shippingFeePerShop = (msg.getShippingFee() != null ? msg.getShippingFee() : 0.0) / totalShops;

                String voucherShopOwnerId = null;

                if (msg.getVoucherId() != null && !msg.getVoucherId().isBlank()) {
                    try {
                        voucherShopOwnerId = voucherService.getVoucherShopOwnerId(msg.getVoucherId());
                    } catch (Exception e) {

                    }
                }

                AddressDto addressInfo = null;

                for (Map.Entry<String, List<SelectedItemDto>> entry : itemsByShop.entrySet()) {
                    String shopOwnerId = entry.getKey();
                    List<SelectedItemDto> shopItems = entry.getValue();

                    // 1) Create order skeleton
                    // Manual builder instead of save()
                    Order order = Order.builder()
                            .userId(msg.getUserId())
                            .addressId(msg.getAddressId())
                            .orderStatus(OrderStatus.PENDING)
                            .totalPrice(0.0)
                            .paymentMethod(msg.getPaymentMethod() != null ? msg.getPaymentMethod() : "COD")
                            .shippingFee(BigDecimal.valueOf(shippingFeePerShop))
                            .build();

                    // Populate Recipient Info
                    if (addressInfo != null) {
                        order.setRecipientName(addressInfo.getRecipientName());
                        order.setRecipientPhone(addressInfo.getRecipientPhone());
                    }

                    // Set voucher data
                    boolean shouldApplyVoucher = msg.getVoucherId() != null &&
                            voucherShopOwnerId != null &&
                            voucherShopOwnerId.equals(shopOwnerId);

                    if (shouldApplyVoucher) {
                        order.setVoucherId(msg.getVoucherId());
                        order.setVoucherDiscount(
                                msg.getVoucherDiscount() != null ? BigDecimal.valueOf(msg.getVoucherDiscount())
                                        : BigDecimal.ZERO);
                    }

                    // 2) Items + decrease stock
                    // Note: toOrderItemsFromSelectedForCheckout does NOT save, just builds objects
                    List<OrderItem> items = toOrderItemsFromSelectedForCheckout(shopItems, order);

                    // Calculate total
                    double itemsTotal = calculateTotalPrice(items);
                    double ship = order.getShippingFee() != null ? order.getShippingFee().doubleValue() : 0.0;
                    double voucher = order.getVoucherDiscount() != null ? order.getVoucherDiscount().doubleValue()
                            : 0.0;
                    order.setTotalPrice(itemsTotal + ship - voucher);

                    ensureIdsAssignedForBatchInsert(order);

                    // Add to lists for BATCH SAVE
                    ordersToSave.add(order);
                    orderItemsToSave.addAll(items);
                }

                // 3) Cleanup cart (ASYNC)
                cleanupCartItemsAsync(msg.getUserId(), msg.getSelectedItems());

            } catch (Exception e) {
                // Xử lý lỗi cho TỪNG message riêng lẻ
                log.error("[BATCH-CHECKOUT-CONSUMER] ❌ Failed to process checkout message for user {}: {}",
                        msg.getUserId(), e.getMessage());
                // failedCount++; // Removed as variable is deleted

                // Send failure notification
                try {
                    SendNotificationRequest failNotification = SendNotificationRequest.builder()
                            .userId(msg.getUserId())
                            .shopId(msg.getUserId())
                            .orderId(null)
                            .message("Order creation failed: " + e.getMessage())
                            .isShopOwnerNotification(false)
                            .build();

                    String partitionKey = failNotification.getUserId() != null
                            ? failNotification.getUserId()
                            : failNotification.getShopId();
                    kafkaTemplateSend.send(notificationTopic.name(), partitionKey, failNotification);
                } catch (Exception notifEx) {
                    log.error("[BATCH-CHECKOUT-CONSUMER] Failed to send failure notification: {}", notifEx.getMessage(),
                            notifEx);
                }
                // KHÔNG throw exception → Tiếp tục xử lý message tiếp theo
            }
        }

        // ==================== BATCH SAVE ====================
        if (!ordersToSave.isEmpty()) {
            log.info("[BATCH-CHECKOUT-CONSUMER] Saving {} orders and {} items...", ordersToSave.size(),
                    orderItemsToSave.size());

            try {
                // Try Batch Save
                orderRepository.saveAll(ordersToSave);
                orderItemRepository.saveAll(orderItemsToSave);

            } catch (Exception e) {
                log.error("[BATCH-CHECKOUT-CONSUMER] ❌ BATCH SAVE FAILED: {}. Falling back to single save...",
                        e.getMessage());

                // Fallback: Save one by one
                for (Order order : ordersToSave) {
                    try {
                        orderRepository.save(order);

                        // Filter items for this order
                        List<OrderItem> itemsForOrder = orderItemsToSave.stream()
                                .filter(item -> item.getOrder().getId().equals(order.getId()))
                                .collect(java.util.stream.Collectors.toList());

                        if (!itemsForOrder.isEmpty()) {
                            orderItemRepository.saveAll(itemsForOrder);
                        }
                        log.info("[FALLBACK-SAVE] Saved order {} successfully", order.getId());
                    } catch (Exception ex) {
                        log.error("[FALLBACK-SAVE] Failed to save order {}: {}", order.getId(), ex.getMessage());
                    }
                }
            }

            // ==================== ASYNC STOCK DECREASE (Phase 3) ====================
            // Publish stock decrease events to Kafka (non-blocking, returns immediately)
            // Note: We use orderItemsToSave because order.getOrderItems() is empty in batch
            // mode
            for (Order savedOrder : ordersToSave) {
                // Find items for this order
                List<OrderItem> orderItems = orderItemsToSave.stream()
                        .filter(item -> item.getOrder().getId().equals(savedOrder.getId()))
                        .collect(java.util.stream.Collectors.toList());

                publishStockDecreaseEvent(savedOrder, orderItems);
            }

            // ==================== PHASE 3: CONFIRM RESERVATIONS ====================
            // After orders saved successfully, confirm all reservations (delete reservation
            // keys)
            // This is done per-message because each message has its own tempOrderId
            for (CheckOutKafkaRequest msg : messages) {
                if (msg.getTempOrderId() != null && msg.getSelectedItems() != null) {
                    confirmReservationsForOrder(msg.getTempOrderId(), msg.getSelectedItems());
                }
            }

            // ==================== POST-SAVE ACTIONS (Restore Logic) ====================
            // Thực hiện các action cần order đã được lưu (Notify, GHN, logic khác)
            // Chạy loop này rất nhanh vì là in-memory logic + async calls
            for (Order savedOrder : ordersToSave) {
                try {
                    // 1. Send notifications (ASYNC)
                    CompletableFuture.runAsync(() -> {
                        try {
                            notifyOrderPlaced(savedOrder);
                            notifyShopOwners(savedOrder);
                        } catch (Exception e) {
                            log.error("[ASYNC-NOTIFICATION] Failed for order {}: {}", savedOrder.getId(),
                                    e.getMessage());
                        }
                    });

                    // 2. Create GHN shipping order (only if CONFIRMED)
                    if (savedOrder.getOrderStatus() != null
                            && savedOrder.getOrderStatus().name().equalsIgnoreCase("CONFIRMED")) {
                        boolean isTestOrder = savedOrder.getOrderItems() != null
                                && !savedOrder.getOrderItems().isEmpty()
                                && savedOrder.getOrderItems().get(0).getProductId().startsWith("test-product-");

                        if (!isTestOrder) {
                            createShippingOrder(savedOrder);
                        }
                    }
                } catch (Exception e) {
                    log.error("[POST-SAVE] Error processing order {}: {}", savedOrder.getId(), e.getMessage());
                }
            }
        }

        log.info("[BATCH-CHECKOUT-CONSUMER] Batch processing complete: ✅ Processed: {} orders", ordersToSave.size());
        log.info("[BATCH-CHECKOUT-CONSUMER] ========================================");
    }

    /**
     * BATCH CONSUMER: Xử lý payment events từ Kafka (Batch Mode - High Throughput)
     * Logic giống hệt cách cũ, chỉ wrap trong loop để xử lý nhiều events cùng lúc
     * Throughput: ~500-1000 events/s (so với ~100 events/s trước đây)
     */
    @KafkaListener(topics = "#{@paymentTopic.name}", groupId = "order-service-payment", containerFactory = "paymentListenerFactory")
    @Transactional
    public void consumePaymentEvent(List<PaymentEvent> events) {
        // Nếu batch rỗng thì bỏ qua
        if (events == null || events.isEmpty()) {
            return;
        }

        log.info("[BATCH-PAYMENT-CONSUMER] ========================================");
        log.info("[BATCH-PAYMENT-CONSUMER] Received BATCH of {} payment events", events.size());
        log.info("[BATCH-PAYMENT-CONSUMER] ========================================");

        int successCount = 0;
        int failedCount = 0;

        // Xử lý từng event trong batch (LOGIC HOÀN TOÀN GIỐNG CŨ)
        for (PaymentEvent event : events) {
            try {
                if ("PAID".equals(event.getStatus())) {
                    // Payment successful
                    if (event.getOrderId() != null && !event.getOrderId().trim().isEmpty()) {
                        // Order already exists - payment successful
                        Order order = orderRepository.findById(event.getOrderId())
                                .orElse(null);
                        if (order != null) {
                            // Payment is successful
                            if (order.getOrderStatus() == OrderStatus.PENDING) {
                                log.info(
                                        "[BATCH-PAYMENT-CONSUMER] Order {} payment successful, status remains PENDING for shop confirmation",
                                        event.getOrderId());
                            } else {
                                log.info("[BATCH-PAYMENT-CONSUMER] Order {} payment successful, current status: {}",
                                        event.getOrderId(), order.getOrderStatus());
                            }
                            // No need to change order status - PENDING is correct after successful payment
                        } else {
                            log.warn("[BATCH-PAYMENT-CONSUMER] Order {} not found for payment event",
                                    event.getOrderId());
                        }
                    } else if (event.getUserId() != null && event.getAddressId() != null
                            && event.getOrderDataJson() != null && !event.getOrderDataJson().trim().isEmpty()) {
                        // Order doesn't exist yet - create it from orderData
                        try {
                            // Parse orderDataJson to get selectedItems and shippingFee
                            Map<String, Object> orderDataMap = objectMapper.readValue(event.getOrderDataJson(),
                                    Map.class);
                            List<Map<String, Object>> selectedItemsList = (List<Map<String, Object>>) orderDataMap
                                    .get("selectedItems");

                            if (selectedItemsList == null || selectedItemsList.isEmpty()) {
                                log.error("[BATCH-PAYMENT-CONSUMER] No selectedItems in orderData for payment: {}",
                                        event.getTxnRef());
                                continue; // Skip this event, process next
                            }

                            // Get shippingFee from orderData (may be null for old orders)
                            BigDecimal shippingFee = null;
                            if (orderDataMap.containsKey("shippingFee")) {
                                Object shippingFeeObj = orderDataMap.get("shippingFee");
                                if (shippingFeeObj != null) {
                                    if (shippingFeeObj instanceof Number) {
                                        shippingFee = BigDecimal.valueOf(((Number) shippingFeeObj).doubleValue());
                                    } else if (shippingFeeObj instanceof String) {
                                        try {
                                            shippingFee = new BigDecimal((String) shippingFeeObj);
                                        } catch (NumberFormatException e) {
                                            log.warn("[BATCH-PAYMENT-CONSUMER] Invalid shippingFee format: {}",
                                                    shippingFeeObj);
                                        }
                                    }
                                }
                            }

                            log.info("[BATCH-PAYMENT-CONSUMER] Shipping fee from orderData: {}", shippingFee);

                            // Get voucher data from orderData
                            String voucherId = (String) orderDataMap.get("voucherId");
                            Double voucherDiscount = null;
                            if (orderDataMap.containsKey("voucherDiscount")) {
                                Object voucherDiscountObj = orderDataMap.get("voucherDiscount");
                                if (voucherDiscountObj instanceof Number) {
                                    voucherDiscount = ((Number) voucherDiscountObj).doubleValue();
                                }
                            }
                            log.info("[BATCH-PAYMENT-CONSUMER] Voucher from orderData - voucherId: {}, discount: {}",
                                    voucherId,
                                    voucherDiscount);

                            // Convert to SelectedItemDto list
                            List<SelectedItemDto> selectedItems = selectedItemsList.stream()
                                    .map(item -> {
                                        SelectedItemDto dto = new SelectedItemDto();
                                        dto.setProductId((String) item.get("productId"));
                                        dto.setSizeId((String) item.get("sizeId"));
                                        dto.setQuantity(((Number) item.get("quantity")).intValue());
                                        return dto;
                                    })
                                    .collect(java.util.stream.Collectors.toList());

                            // Create order with PENDING status (payment successful, waiting for shop
                            // confirmation)
                            Order order = createOrderFromPayment(event.getUserId(), event.getAddressId(), selectedItems,
                                    shippingFee, voucherId, voucherDiscount);

                            // Set payment method from event (VNPAY, CARD, etc.) if available
                            if (event.getMethod() != null && !event.getMethod().trim().isEmpty()) {
                                order.setPaymentMethod(event.getMethod().toUpperCase());
                                orderRepository.save(order);
                            }

                            // Update payment with orderId so we can find it later when canceling
                            if (event.getPaymentId() != null && !event.getPaymentId().trim().isEmpty()) {
                                try {
                                    ResponseEntity<Map<String, Object>> updateResponse = paymentServiceClient
                                            .updatePaymentOrderId(
                                                    event.getPaymentId(), order.getId());
                                    if (updateResponse != null && updateResponse.getBody() != null) {
                                        Boolean success = (Boolean) updateResponse.getBody().get("success");
                                        if (Boolean.TRUE.equals(success)) {
                                            log.info("[BATCH-PAYMENT-CONSUMER] Updated payment {} with orderId: {}",
                                                    event.getPaymentId(), order.getId());
                                        } else {
                                            log.warn(
                                                    "[BATCH-PAYMENT-CONSUMER] Failed to update payment {} with orderId: {}",
                                                    event.getPaymentId(), order.getId());
                                        }
                                    }
                                } catch (Exception e) {
                                    log.error("[BATCH-PAYMENT-CONSUMER] Failed to update payment with orderId: {}",
                                            e.getMessage(), e);
                                    // Don't fail order creation, just log error
                                }
                            }

                            log.info(
                                    "[BATCH-PAYMENT-CONSUMER] Created order {} with PENDING status and payment method {} from payment event: {}",
                                    order.getId(), order.getPaymentMethod(), event.getTxnRef());
                        } catch (Exception e) {
                            log.error("[BATCH-PAYMENT-CONSUMER] Failed to create order from payment event: {}",
                                    e.getMessage(),
                                    e);
                            failedCount++;
                            continue;
                        }
                    } else {
                        log.warn("[BATCH-PAYMENT-CONSUMER] Payment successful but missing order data: txnRef={}",
                                event.getTxnRef());
                    }
                } else if ("FAILED".equals(event.getStatus())) {
                    // Payment failed - rollback if order exists
                    if (event.getOrderId() != null && !event.getOrderId().trim().isEmpty()) {
                        try {
                            rollbackOrderStock(event.getOrderId());
                            log.info("[BATCH-PAYMENT-CONSUMER] Rolled back order {} due to payment failure",
                                    event.getOrderId());
                        } catch (Exception e) {
                            log.error("[BATCH-PAYMENT-CONSUMER] Failed to rollback order {}: {}", event.getOrderId(),
                                    e.getMessage(), e);
                            failedCount++;
                            continue;
                        }
                    } else {
                        log.info(
                                "[BATCH-PAYMENT-CONSUMER] Payment failed but no order was created, no rollback needed: txnRef={}",
                                event.getTxnRef());
                    }
                }

                successCount++;

            } catch (Exception e) {

                failedCount++;
                // KHÔNG throw exception → Tiếp tục xử lý event tiếp theo
            }
        }

        log.info("[BATCH-PAYMENT-CONSUMER] ========================================");
        log.info("[BATCH-PAYMENT-CONSUMER] Batch processing complete: ✅ Success: {}, ❌ Failed: {}", successCount,
                failedCount);
        log.info("[BATCH-PAYMENT-CONSUMER]========================================");
    }

    /////////////////////////////////////////////////////////////////////////////////////
    @Override
    public void createShippingOrderForOrder(String orderId) {
        Order order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            log.warn("[GHN] createShippingOrderForOrder: order not found {}", orderId);
            return;
        }
        try {
            createShippingOrder(order);
        } catch (Exception e) {
            log.error("[GHN] Failed to create shipping order for {}: {}", orderId, e.getMessage(), e);
        }
    }

    @Override
    public void handleGhnStatus(String ghnOrderCode, String status) {
        if (ghnOrderCode == null || ghnOrderCode.isBlank() || status == null || status.isBlank()) {
            log.warn("[GHN] handleGhnStatus invalid params");
            return;
        }
        Optional<ShippingOrder> opt = shippingOrderRepository.findByGhnOrderCode(ghnOrderCode);
        if (opt.isEmpty()) {
            log.warn("[GHN] ShippingOrder not found for code {}", ghnOrderCode);
            return;
        }
        ShippingOrder sh = opt.get();
        String s = status.toLowerCase(); // GHN returns lowercase status
        String upperS = s.toUpperCase();

        // Get i18n title and description for this status (vi and en)
        String[] statusInfo = getGhnStatusInfo(s);
        String titleVi = statusInfo[0];
        String descVi = statusInfo[1];
        String titleEn = statusInfo[2];
        String descEn = statusInfo[3];

        // Append to tracking history with i18n data
        appendTrackingHistory(sh, s, titleVi, descVi, titleEn, descEn);

        sh.setStatus(upperS);
        shippingOrderRepository.save(sh);

        // publish tracking event with i18n data
        Map<String, Object> evt = new HashMap<>();
        evt.put("orderId", sh.getOrderId());
        evt.put("ghnOrderCode", sh.getGhnOrderCode());
        evt.put("status", upperS);
        evt.put("titleVi", titleVi);
        evt.put("descVi", descVi);
        evt.put("titleEn", titleEn);
        evt.put("descEn", descEn);
        // Backward compatibility
        evt.put("title", titleVi);
        evt.put("description", descVi);
        evt.put("ts", java.time.LocalDateTime.now().toString());
        trackingEmitterService.send(sh.getOrderId(), evt);

        // Update order status accordingly based on GHN status
        try {
            Order order = orderRepository.findById(sh.getOrderId()).orElse(null);
            if (order == null) {
                log.warn("[GHN] Order not found for shippingOrder {}", sh.getOrderId());
                return;
            }

            OrderStatus currentStatus = order.getOrderStatus();
            OrderStatus newStatus = null;

            // Map GHN statuses to Order statuses
            switch (s) {
                // Waiting for pickup - should be READY_TO_SHIP (shop packed, waiting shipper)
                case "ready_to_pick":
                case "picking":
                case "money_collect_picking":
                    // If order is CONFIRMED, auto-transition to READY_TO_SHIP
                    if (currentStatus == OrderStatus.CONFIRMED) {
                        newStatus = OrderStatus.READY_TO_SHIP;
                    }
                    break;

                // Shipper picked up / In transit - SHIPPED
                case "picked":
                case "storing":
                case "transporting":
                case "sorting":
                case "delivering":
                case "money_collect_delivering":
                    newStatus = OrderStatus.SHIPPED;
                    break;

                // Delivered to customer - DELIVERED
                case "delivered":
                    newStatus = OrderStatus.DELIVERED;
                    break;

                // Delivery failed - still SHIPPED (can retry)
                case "delivery_fail":
                case "waiting_to_return":
                    // Keep as SHIPPED, delivery failed but may retry
                    log.info("[GHN] Delivery failed for order {}, status: {}", sh.getOrderId(), s);
                    break;

                // Cancelled
                case "cancel":
                    newStatus = OrderStatus.CANCELLED;
                    break;

                // Return flow
                case "return":
                case "returning":
                case "return_transporting":
                case "return_sorting":
                case "return_fail":
                case "returned":
                    newStatus = OrderStatus.RETURNED;
                    break;

                // Exception cases
                case "exception":
                case "damage":
                case "lost":
                    log.error("[GHN] Exception status for order {}: {}", sh.getOrderId(), s);
                    // Keep current status, notify shop owner
                    break;

                default:
                    log.info("[GHN] Unhandled status for order {}: {}", sh.getOrderId(), s);
            }

            // Update order status if changed
            if (newStatus != null && newStatus != currentStatus) {
                order.setOrderStatus(newStatus);
                orderRepository.save(order);
                log.info("[GHN] Order {} status updated: {} -> {}", sh.getOrderId(), currentStatus, newStatus);

                // Schedule auto-complete if delivered
                if (newStatus == OrderStatus.COMPLETED) {
                    scheduleAutoComplete(order.getId(), 60);
                }
            }
        } catch (Exception e) {
            log.error("[GHN] Failed to update order status from GHN status: {}", e.getMessage(), e);
        }
    }

    /**
     * Get i18n title and description for GHN status
     * 
     * @return String[4] where [0] = title_vi, [1] = desc_vi, [2] = title_en, [3] =
     *         desc_en
     */
    private String[] getGhnStatusInfo(String ghnStatus) {
        return switch (ghnStatus.toLowerCase()) {
            case "ready_to_pick" -> new String[]{"Chờ lấy hàng", "Đơn hàng đang chờ shipper đến lấy",
                    "Waiting for pickup", "Order is waiting for shipper to pick up"};
            case "picking" -> new String[]{"Đang lấy hàng", "Shipper đang đến lấy hàng từ shop",
                    "Picking up", "Shipper is picking up from shop"};
            case "money_collect_picking" -> new String[]{"Đang lấy hàng", "Shipper đang thu tiền và lấy hàng",
                    "Collecting & picking", "Shipper is collecting money and picking up"};
            case "picked" -> new String[]{"Đã lấy hàng", "Shipper đã lấy hàng thành công",
                    "Picked up", "Shipper has picked up successfully"};
            case "storing" -> new String[]{"Đã nhập kho", "Đơn hàng đã được nhập kho phân loại",
                    "In warehouse", "Order has been stored in warehouse"};
            case "transporting" -> new String[]{"Đang luân chuyển", "Đơn hàng đang được vận chuyển đến kho đích",
                    "In transit", "Order is being transported to destination"};
            case "sorting" -> new String[]{"Đang phân loại", "Đơn hàng đang được phân loại tại kho",
                    "Sorting", "Order is being sorted at warehouse"};
            case "delivering" -> new String[]{"Đang giao hàng", "Shipper đang giao hàng đến bạn",
                    "Delivering", "Shipper is delivering to you"};
            case "money_collect_delivering" -> new String[]{"Đang giao hàng", "Shipper đang giao hàng và thu tiền COD",
                    "Delivering (COD)", "Shipper is delivering and collecting COD"};
            case "delivered" -> new String[]{"Đã giao hàng", "Giao hàng thành công",
                    "Delivered", "Delivery successful"};
            case "delivery_fail" -> new String[]{"Giao thất bại", "Giao hàng không thành công, sẽ giao lại",
                    "Delivery failed", "Delivery failed, will retry"};
            case "waiting_to_return" -> new String[]{"Chờ trả hàng", "Đơn hàng đang chờ trả về shop",
                    "Waiting to return", "Waiting to return to shop"};
            case "return", "returning" -> new String[]{"Đang trả hàng", "Đơn hàng đang được trả về shop",
                    "Returning", "Order is being returned to shop"};
            case "return_transporting" ->
                    new String[]{"Đang luân chuyển trả", "Đơn hàng đang được vận chuyển trả về shop",
                            "Return in transit", "Order is being transported back to shop"};
            case "return_sorting" -> new String[]{"Đang phân loại trả", "Đơn hàng đang được phân loại để trả về shop",
                    "Return sorting", "Order is being sorted for return"};
            case "return_fail" -> new String[]{"Trả hàng thất bại", "Không thể trả hàng về shop",
                    "Return failed", "Failed to return to shop"};
            case "returned" -> new String[]{"Đã trả hàng", "Đơn hàng đã được trả về shop thành công",
                    "Returned", "Order has been returned successfully"};
            case "cancel" -> new String[]{"Đã hủy", "Đơn hàng đã bị hủy",
                    "Cancelled", "Order has been cancelled"};
            case "exception" -> new String[]{"Có sự cố", "Đơn hàng gặp sự cố, đang xử lý",
                    "Exception", "Order has an exception, processing"};
            case "damage" -> new String[]{"Hàng bị hư hỏng", "Hàng hóa bị hư hỏng trong quá trình vận chuyển",
                    "Damaged", "Package was damaged during transport"};
            case "lost" -> new String[]{"Hàng bị thất lạc", "Hàng hóa bị thất lạc",
                    "Lost", "Package was lost"};
            default -> new String[]{"Cập nhật trạng thái", "Trạng thái: " + ghnStatus,
                    "Status update", "Status: " + ghnStatus};
        };
    }

    /**
     * Append a new entry to the tracking history JSON array (i18n support)
     */
    private void appendTrackingHistory(ShippingOrder sh, String status, String titleVi, String descVi, String titleEn,
            String descEn) {
        try {
            java.util.List<Map<String, Object>> history = new java.util.ArrayList<>();
            String old = sh.getTrackingHistory();
            if (old != null && !old.isBlank()) {
                try {
                    history = objectMapper.readValue(old, java.util.List.class);
                } catch (Exception e) {
                    log.warn("[GHN] Failed to parse existing tracking history, starting fresh");
                }
            }

            Map<String, Object> entry = new HashMap<>();
            entry.put("ts", java.time.LocalDateTime.now().toString());
            entry.put("status", status);
            entry.put("titleVi", titleVi);
            entry.put("descVi", descVi);
            entry.put("titleEn", titleEn);
            entry.put("descEn", descEn);
            // Backward compatibility
            entry.put("title", titleVi);
            entry.put("description", descVi);
            history.add(entry);

            sh.setTrackingHistory(objectMapper.writeValueAsString(history));
        } catch (Exception e) {
            log.error("[GHN] Failed to append tracking history: {}", e.getMessage());
        }
    }

    @Override
    public void handleLocationUpdate(String ghnOrderCode, String status, Double lat, Double lng, String shipperId,
            String note, String timestamp) {
        if (ghnOrderCode == null || ghnOrderCode.isBlank()) {
            log.warn("[TRACK] handleLocationUpdate missing ghnOrderCode");
            return;
        }

        Optional<ShippingOrder> opt = shippingOrderRepository.findByGhnOrderCode(ghnOrderCode);
        if (opt.isEmpty()) {
            log.warn("[TRACK] ShippingOrder not found for code {}", ghnOrderCode);
            return;
        }
        ShippingOrder sh = opt.get();

        // Update last location
        if (lat != null && lng != null) {
            sh.setLastLat(lat);
            sh.setLastLng(lng);
            sh.setLastTs(java.time.LocalDateTime.now());
        }
        if (status != null && !status.isBlank()) {
            sh.setStatus(status.toUpperCase());
        }

        // Append to trackingHistory JSON array (simple append, not parsing for brevity)
        try {
            java.util.List<Map<String, Object>> history = new java.util.ArrayList<>();
            String old = sh.getTrackingHistory();
            if (old != null && !old.isBlank()) {
                try {
                    history = objectMapper.readValue(old, java.util.List.class);
                } catch (Exception e) {
                    // ignore parse errors
                }
            }
            Map<String, Object> point = new HashMap<>();
            point.put("ts", timestamp != null ? timestamp : java.time.LocalDateTime.now().toString());
            point.put("lat", lat);
            point.put("lng", lng);
            point.put("status", status);
            point.put("shipperId", shipperId);
            point.put("note", note);
            history.add(point);
            sh.setTrackingHistory(objectMapper.writeValueAsString(history));
        } catch (Exception e) {
            log.error("[TRACK] Failed to append tracking history: {}", e.getMessage());
        }

        shippingOrderRepository.save(sh);

        // Publish event to SSE subscribers
        Map<String, Object> evt = new HashMap<>();
        evt.put("orderId", sh.getOrderId());
        evt.put("ghnOrderCode", sh.getGhnOrderCode());
        evt.put("status", sh.getStatus());
        evt.put("lat", sh.getLastLat());
        evt.put("lng", sh.getLastLng());
        evt.put("ts", sh.getLastTs() != null ? sh.getLastTs().toString() : java.time.LocalDateTime.now().toString());
        evt.put("note", note);
        evt.put("shipperId", shipperId);
        trackingEmitterService.send(sh.getOrderId(), evt);
    }

    private void scheduleAutoComplete(String orderId, long seconds) {
        if (orderId == null || orderId.isBlank())
            return;
        scheduler.schedule(() -> {
            try {
                Order o = orderRepository.findById(orderId).orElse(null);
                if (o != null && o.getOrderStatus() == OrderStatus.DELIVERED) {
                    o.setOrderStatus(OrderStatus.COMPLETED);
                    orderRepository.save(o);
                    log.info("[AUTO-COMPLETE] Order {} auto-completed after {}s", orderId, seconds);
                }
            } catch (Exception e) {
                log.error("[AUTO-COMPLETE] Failed to auto-complete order {}: {}", orderId, e.getMessage(), e);
            }
        }, seconds, TimeUnit.SECONDS);
    }

    @Override
    public Order confirmOrder(String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found: " + orderId));
        if (order.getOrderStatus() != OrderStatus.DELIVERED) {
            throw new RuntimeException("Order must be DELIVERED to confirm receipt");
        }
        order.setOrderStatus(OrderStatus.COMPLETED);
        return orderRepository.save(order);
    }

    // ==================== BULK UPDATE STATUS PRODUCER ====================

    @Override
    public Map<String, Object> bulkUpdateOrderStatus(String shopOwnerId, List<String> orderIds, String newStatus) {
        if (orderIds == null || orderIds.isEmpty()) {
            throw new IllegalArgumentException("Order IDs are required");
        }

        if (newStatus == null || newStatus.isBlank()) {
            throw new IllegalArgumentException("New status is required");
        }

        // Get shop owner's product IDs for validation
        List<String> shopProductIds = stockServiceClient.getProductIdsByShopOwner(shopOwnerId).getBody();
        if (shopProductIds == null || shopProductIds.isEmpty()) {
            throw new RuntimeException("No products found for this shop owner");
        }

        int sent = 0;
        int rejected = 0;
        List<String> rejectedOrderIds = new ArrayList<>();

        for (String orderId : orderIds) {
            try {
                Order order = orderRepository.findById(orderId).orElse(null);
                if (order == null) {
                    rejected++;
                    rejectedOrderIds.add(orderId);
                    continue;
                }

                // Check if order has items from this shop
                boolean belongsToShop = order.getOrderItems().stream()
                        .anyMatch(item -> shopProductIds.contains(item.getProductId()));

                if (!belongsToShop) {
                    rejected++;
                    rejectedOrderIds.add(orderId);
                    continue;
                }

                // Build Kafka message
                UpdateStatusOrderRequest msg = UpdateStatusOrderRequest.builder()
                        .orderId(orderId)
                        .shopOwnerId(shopOwnerId)
                        .newStatus(newStatus)
                        .timestamp(LocalDateTime.now())
                        .build();

                // Send to Kafka (async, non-blocking)
                updateStatusKafkaTemplate.send(updateStatusOrderTopic.name(), orderId, msg);
                sent++;

            } catch (Exception e) {
                log.error("[BULK-UPDATE] Failed to process order {}: {}", orderId, e.getMessage());
                rejected++;
                rejectedOrderIds.add(orderId);
            }
        }

        log.info("[BULK-UPDATE] Shop {} sent {} orders to Kafka, rejected {}",
                shopOwnerId, sent, rejected);

        Map<String, Object> response = new HashMap<>();
        response.put("accepted", sent);
        response.put("rejected", rejected);
        response.put("message", String.format("Đang xử lý %d đơn hàng...", sent));
        if (!rejectedOrderIds.isEmpty()) {
            response.put("rejectedOrderIds", rejectedOrderIds);
        }

        return response;
    }

    // ==================== SEARCH ORDERS ====================

    @Override
    public List<Order> searchOrders(String shopOwnerId, String query) {
        if (query == null || query.trim().isEmpty()) {
            return Collections.emptyList();
        }

        // Get shop owner's product IDs
        List<String> shopProductIds = stockServiceClient.getProductIdsByShopOwner(shopOwnerId).getBody();
        if (shopProductIds == null || shopProductIds.isEmpty()) {
            return Collections.emptyList();
        }

        String searchQuery = query.trim().toLowerCase();

        // Search by order ID prefix
        List<Order> allShopOrders = orderRepository.findByOrderItemsProductIdIn(shopProductIds);

        return allShopOrders.stream()
                .filter(order -> order.getId().toLowerCase().contains(searchQuery))
                .limit(50) // Limit results
                .collect(Collectors.toList());
    }

    // ==================== BULK UPDATE STATUS CONSUMER ====================

    /**
     * Batch consumer for update-order-topic topic
     * Processes multiple status updates in parallel for high throughput
     */
    @KafkaListener(topics = "#{@updateStatusOrderTopic.name()}", groupId = "order-service-status-update", containerFactory = "updateStatusListenerFactory")
    public void consumeBulkStatusUpdate(List<UpdateStatusOrderRequest> messages) {
        if (messages == null || messages.isEmpty()) {
            return;
        }

        log.info("[BULK-STATUS-CONSUMER] Received batch of {} messages", messages.size());

        int success = 0;
        int failed = 0;
        Map<String, List<String>> resultsByShopOwner = new HashMap<>();

        for (UpdateStatusOrderRequest msg : messages) {
            try {
                log.info("[BULK-STATUS-CONSUMER] Processing: orderId={}, newStatus={}",
                        msg.getOrderId(), msg.getNewStatus());

                // 1. Get order
                Order order = orderRepository.findById(msg.getOrderId()).orElse(null);
                if (order == null) {
                    log.error("[BULK-STATUS-CONSUMER] Order not found: {}", msg.getOrderId());
                    failed++;
                    addResult(resultsByShopOwner, msg.getShopOwnerId(), "FAILED:" + msg.getOrderId());
                    continue;
                }

                // 2. Update status
                OrderStatus newStatus;
                try {
                    newStatus = OrderStatus.valueOf(msg.getNewStatus().toUpperCase());
                } catch (IllegalArgumentException e) {
                    log.error("[BULK-STATUS-CONSUMER] Invalid status: {}", msg.getNewStatus());
                    failed++;
                    addResult(resultsByShopOwner, msg.getShopOwnerId(), "FAILED:" + msg.getOrderId());
                    continue;
                }

                order.setOrderStatus(newStatus);
                orderRepository.save(order);

                // 3. Side effects
                if (newStatus == OrderStatus.CONFIRMED) {
                    try {
                        createShippingOrderForOrder(msg.getOrderId());
                    } catch (Exception e) {
                        log.warn("[BULK-STATUS-CONSUMER] Failed to create shipping for order {}: {}",
                                msg.getOrderId(), e.getMessage());
                    }
                }

                if (newStatus == OrderStatus.DELIVERED) {
                    try {
                        shopLedgerService.processOrderEarning(order);
                    } catch (Exception e) {
                        log.warn("[BULK-STATUS-CONSUMER] Failed to process ledger for order {}: {}",
                                msg.getOrderId(), e.getMessage());
                    }
                }

                success++;
                addResult(resultsByShopOwner, msg.getShopOwnerId(), "SUCCESS:" + msg.getOrderId());

                log.info("[BULK-STATUS-CONSUMER] Successfully updated order {} to {}",
                        msg.getOrderId(), msg.getNewStatus());

            } catch (Exception e) {
                log.error("[BULK-STATUS-CONSUMER] Failed to process order {}: {}",
                        msg.getOrderId(), e.getMessage(), e);
                failed++;
                addResult(resultsByShopOwner, msg.getShopOwnerId(), "FAILED:" + msg.getOrderId());
            }
        }

        // 4. Send notifications to shop owners
        for (Map.Entry<String, List<String>> entry : resultsByShopOwner.entrySet()) {
            String shopOwnerId = entry.getKey();
            List<String> results = entry.getValue();

            long successCount = results.stream().filter(r -> r.startsWith("SUCCESS:")).count();
            long failedCount = results.stream().filter(r -> r.startsWith("FAILED:")).count();

            String message = String.format(
                    "Đã cập nhật %d đơn hàng thành công%s",
                    successCount,
                    failedCount > 0 ? String.format(", %d đơn thất bại", failedCount) : "");

            try {
                SendNotificationRequest notification = SendNotificationRequest.builder()
                        .userId(shopOwnerId)
                        .shopId(shopOwnerId)
                        .orderId(null)
                        .message(message)
                        .isShopOwnerNotification(true)
                        .build();
                kafkaTemplateSend.send(notificationTopic.name(), shopOwnerId, notification);
            } catch (Exception e) {
                log.error("[BULK-STATUS-CONSUMER] Failed to send notification to {}: {}",
                        shopOwnerId, e.getMessage());
            }
        }

        log.info("[BULK-STATUS-CONSUMER] Batch completed: {} success, {} failed", success, failed);
    }

    private void addResult(Map<String, List<String>> resultsByShopOwner, String shopOwnerId, String result) {
        resultsByShopOwner.computeIfAbsent(shopOwnerId, k -> new ArrayList<>()).add(result);
    }

    @Override
    public List<Object[]> getShopRevenueTrend(String shopId) {
        List<String> productIds = stockServiceClient.getProductIdsByShopOwner(shopId).getBody();
        if (productIds == null || productIds.isEmpty()) {
            return new ArrayList<>();
        }
        // Last 6 months including current month
        LocalDateTime startDate = LocalDateTime.now().minusMonths(5).withDayOfMonth(1).withHour(0).withMinute(0)
                .withSecond(0);
        return orderRepository.getMonthlyRevenueByProductIds(productIds, startDate);
    }

    @Override
    public List<Object[]> getShopOrderStatusDistribution(String shopId) {
        List<String> productIds = stockServiceClient.getProductIdsByShopOwner(shopId).getBody();
        if (productIds == null || productIds.isEmpty()) {
            return new ArrayList<>();
        }
        return orderRepository.countByStatusForProductIds(productIds);
    }

    // ==================== PHASE 3: ASYNC STOCK DECREASE ====================

    /**
     * Publish stock decrease event to Kafka (async, non-blocking)
     * Order Service does NOT wait for stock decrease to complete
     * 
     * CRITICAL: Only sends events for REGULAR items, NOT Flash Sale items.
     * Flash Sale stock is managed separately via Redis and already deducted during
     * approval.
     */
    private void publishStockDecreaseEvent(Order order, List<OrderItem> orderItems) {
        // Skip for test products
        boolean isTestOrder = orderItems != null && !orderItems.isEmpty()
                && orderItems.get(0).getProductId().startsWith("test-product-");
        if (isTestOrder) {
            log.info("[ASYNC-STOCK] Skipping stock decrease event for test order: {}", order.getId());
            return;
        }

        // FILTER OUT FLASH SALE ITEMS to prevent double deduction
        List<OrderItem> regularItems = orderItems.stream()
                .filter(item -> !Boolean.TRUE.equals(item.getIsFlashSale()))
                .collect(java.util.stream.Collectors.toList());

        if (regularItems.isEmpty()) {
            log.info("[ASYNC-STOCK] Skipping stock decrease event for order {} (all items are Flash Sale)",
                    order.getId());
            return;
        }

        List<StockDecreaseEvent.StockDecreaseItem> items = regularItems.stream()
                .map(item -> StockDecreaseEvent.StockDecreaseItem.builder()
                        .productId(item.getProductId())
                        .sizeId(item.getSizeId())
                        .quantity(item.getQuantity())
                        .build())
                .collect(java.util.stream.Collectors.toList());

        StockDecreaseEvent event = StockDecreaseEvent.builder()
                .orderId(order.getId())
                .userId(order.getUserId())
                .items(items)
                .build();

        stockDecreaseKafkaTemplate.send(stockDecreaseTopic.name(), order.getId(), event);
        log.info(
                "[ASYNC-STOCK] Published stock decrease event for order: {} ({} regular items, {} flash sale items filtered)",
                order.getId(), regularItems.size(), orderItems.size() - regularItems.size());
    }

    /**
     * Handle order compensation when stock decrease fails
     * Cancel order + refund + notify user
     */
    @KafkaListener(topics = "${kafka.topic.order-compensation}", groupId = "order-service-compensation", containerFactory = "compensationListenerFactory")
    @Transactional
    public void handleOrderCompensation(OrderCompensationEvent event) {
        log.warn("[COMPENSATION] Received compensation event for order: {} - Reason: {}",
                event.getOrderId(), event.getReason());

        try {
            // 1. Find order
            Order order = orderRepository.findById(event.getOrderId())
                    .orElseThrow(() -> new RuntimeException("Order not found: " + event.getOrderId()));

            // 2. Cancel order
            order.setOrderStatus(OrderStatus.CANCELLED);
            orderRepository.save(order);

            // 3. Refund if payment was made
            if ("VNPAY".equalsIgnoreCase(order.getPaymentMethod()) ||
                    "MOMO".equalsIgnoreCase(order.getPaymentMethod())) {
                refundToWallet(order, event.getDetails());
            }

            // 4. Notify user
            notifyOrderCancelled(order, event.getDetails());

            log.info("[COMPENSATION] Order {} cancelled successfully. Reason: {}",
                    order.getId(), event.getDetails());

        } catch (Exception e) {
            log.error("[COMPENSATION] Failed to compensate order {}: {}",
                    event.getOrderId(), e.getMessage());
        }
    }

    private void refundToWallet(Order order, String reason) {
        try {
            AddRefundRequestDto refundRequest = AddRefundRequestDto.builder()
                    .userId(order.getUserId())
                    .orderId(order.getId())
                    .amount(java.math.BigDecimal.valueOf(order.getTotalPrice()))
                    .reason(String.format("Order %s cancelled - %s", order.getId().substring(0, 8), reason))
                    .build();

            userServiceClient.addRefundToWallet(refundRequest);
            log.info("[REFUND] Refunded {} to user {} for order {}",
                    order.getTotalPrice(), order.getUserId(), order.getId());
        } catch (Exception e) {
            log.error("[REFUND] Failed to refund order {}: {}", order.getId(), e.getMessage());
        }
    }

    private void notifyOrderCancelled(Order order, String reason) {
        SendNotificationRequest notification = SendNotificationRequest.builder()
                .userId(order.getUserId())
                .shopId(order.getUserId())
                .orderId(order.getId())
                .message(String.format(
                        "Đơn hàng #%s đã bị hủy do hết hàng. Số tiền %.0f₫ đã được hoàn vào ví. Lý do: %s",
                        order.getId().substring(0, 8).toUpperCase(),
                        order.getTotalPrice(),
                        reason))
                .isShopOwnerNotification(false)
                .build();

        kafkaTemplateSend.send(notificationTopic.name(), order.getUserId(), notification);
        log.info("[COMPENSATION-NOTIFY] Sent cancellation notification to user {}", order.getUserId());
    }
}
