package com.example.orderservice.service;

import com.example.orderservice.client.GhnApiClient;
import com.example.orderservice.client.StockServiceClient;
import com.example.orderservice.client.UserServiceClient;
import com.example.orderservice.dto.*;
import com.example.orderservice.dto.PaymentEvent;
import com.example.orderservice.enums.OrderStatus;
import com.example.orderservice.model.Order;
import com.example.orderservice.model.OrderItem;
import com.example.orderservice.model.ShippingOrder;
import com.example.orderservice.repository.OrderRepository;
import com.example.orderservice.repository.ShippingOrderRepository;
import com.example.orderservice.request.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
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
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;

@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {
    @Override
    public Order returnOrder(String orderId, String reason) {
        return orderRepository.findById(orderId).map(order -> {
            order.setOrderStatus(OrderStatus.RETURNED);
            order.setReturnReason(reason);

            return orderRepository.save(order);
        }).orElse(null);
    }

    @Override
    public AnalyticsDto getAnalytics(String shopOwnerId) {
        // 1. Get product IDs
        List<String> productIds = stockServiceClient.getProductIdsByShopOwner(shopOwnerId).getBody();
        if (productIds == null || productIds.isEmpty()) {
            return com.example.orderservice.dto.AnalyticsDto.builder()
                    .todayRevenue(0.0)
                    .todayOrders(0L)
                    .todayProducts(0L)
                    .growth("+0%")
                    .chartLabels(new ArrayList<>())
                    .chartData(new ArrayList<>())
                    .topProducts(new ArrayList<>())
                    .build();
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfToday = now.toLocalDate().atStartOfDay();
        LocalDateTime endOfToday = now.toLocalDate().atTime(java.time.LocalTime.MAX);

        // 2. Today's Revenue & Orders
        List<OrderStatus> excluded = List.of(OrderStatus.CANCELLED, OrderStatus.RETURNED);
        Double todayRevenue = orderRepository.sumSalesByProductIdsAndDateRange(productIds, startOfToday, endOfToday,
                excluded);
        if (todayRevenue == null)
            todayRevenue = 0.0;

        Long todayOrders = orderRepository.countByProductIdsAndCreationTimestampBetween(productIds, startOfToday,
                endOfToday, excluded);
        if (todayOrders == null)
            todayOrders = 0L;

        // 3. Yesterday's Revenue for Growth
        LocalDateTime startOfYesterday = startOfToday.minusDays(1);
        LocalDateTime endOfYesterday = endOfToday.minusDays(1);
        Double yesterdayRevenue = orderRepository.sumSalesByProductIdsAndDateRange(productIds, startOfYesterday,
                endOfYesterday, excluded);
        if (yesterdayRevenue == null)
            yesterdayRevenue = 0.0;

        String growth;
        if (yesterdayRevenue == 0) {
            growth = todayRevenue > 0 ? "+100%" : "0%";
        } else {
            double percent = ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100;
            growth = (percent >= 0 ? "+" : "") + String.format("%.1f", percent) + "%";
        }

        // 4. Revenue Chart (Last 7 Days)
        List<String> labels = new ArrayList<>();
        List<Double> data = new ArrayList<>();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM");

        for (int i = 6; i >= 0; i--) {
            LocalDateTime start = now.minusDays(i).toLocalDate().atStartOfDay();
            LocalDateTime end = now.minusDays(i).toLocalDate().atTime(java.time.LocalTime.MAX);
            Double dailyRevenue = orderRepository.sumSalesByProductIdsAndDateRange(productIds, start, end, excluded);

            labels.add(start.format(formatter));
            data.add(dailyRevenue != null ? dailyRevenue : 0.0);
        }

        // 5. Top Products (Limit 5)
        Pageable pageable = PageRequest.of(0, 5);
        List<com.example.orderservice.dto.TopProductDto> topProducts = orderRepository
                .findTopSellingProducts(productIds, excluded, pageable);

        // Populate product names for top products
        for (com.example.orderservice.dto.TopProductDto top : topProducts) {
            try {
                ProductDto p = stockServiceClient.getProductById(top.getProductId()).getBody();
                if (p != null) {
                    top.setProductName(p.getName());
                } else {
                    top.setProductName("Unknown Product");
                }
            } catch (Exception e) {
                top.setProductName("Product #" + top.getProductId());
            }
        }

        return AnalyticsDto.builder()
                .todayRevenue(todayRevenue)
                .todayOrders(todayOrders)
                .todayProducts((long) productIds.size())
                .growth(growth)
                .chartLabels(labels)
                .chartData(data)
                .topProducts(topProducts)
                .build();
    }

    @Override
    public java.util.Map<String, Object> getShopStats(String shopOwnerId) {
        // 1. Get product IDs
        List<String> productIds = stockServiceClient.getProductIdsByShopOwner(shopOwnerId).getBody();
        java.util.Map<String, Object> stats = new java.util.HashMap<>();

        if (productIds == null || productIds.isEmpty()) {
            stats.put("pending", 0);
            stats.put("processing", 0);
            stats.put("shipped", 0);
            stats.put("delivered", 0);
            stats.put("cancelled", 0);
            stats.put("returned", 0);
            stats.put("salesToday", 0);
            return stats;
        }

        // 2. Count by status
        long pending = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.PENDING);
        long processing = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.PROCESSING);
        long shipped = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.SHIPPED);
        long delivered = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.DELIVERED);
        long cancelled = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.CANCELLED);
        long returned = orderRepository.countByProductIdsAndStatus(productIds, OrderStatus.RETURNED);

        // 3. Sales today
        LocalDateTime startOfDay = java.time.LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = java.time.LocalDate.now().atTime(java.time.LocalTime.MAX);
        Double salesToday = orderRepository.sumSalesByProductIdsAndDateRange(productIds, startOfDay, endOfDay,
                List.of(OrderStatus.CANCELLED, OrderStatus.RETURNED));

        stats.put("pending", pending);
        stats.put("processing", processing);
        stats.put("shipped", shipped);
        stats.put("delivered", delivered);
        stats.put("cancelled", cancelled);
        stats.put("returned", returned);

        // Mappings for old Dashboard compatibility (if needed) or simple groupings
        stats.put("waitingForPickup", pending + processing);
        stats.put("processed", shipped + delivered);

        stats.put("salesToday", salesToday != null ? salesToday : 0.0);

        return stats;
    }

    private final OrderRepository orderRepository;
    private final StockServiceClient stockServiceClient;
    private final UserServiceClient userServiceClient;
    private final GhnApiClient ghnApiClient;
    private final ShippingOrderRepository shippingOrderRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final NewTopic orderTopic;
    private final NewTopic notificationTopic;
    private final KafkaTemplate<String, CheckOutKafkaRequest> kafkaTemplate;
    private final KafkaTemplate<String, SendNotificationRequest> kafkaTemplateSend;
    private static final Logger log = LoggerFactory.getLogger(OrderServiceImpl.class);

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
                orderStatuses = null; // Return all if filtering resulted in empty valid statuses? Or return empty?
                // If user provided statuses but all were invalid, likely return empty/all.
                // Here treating as "ignore filter" if all invalid, or we usually assume valid
                // enum.
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

    public Order cancelOrder(String orderId, String reason) {
        return orderRepository.findById(orderId).map(order -> {
            order.setOrderStatus(OrderStatus.CANCELLED);
            order.setCancelReason(reason);
            orderRepository.save(order);
            // Re-add stock (Commented out as productService is not injected)
            /*
             * for (OrderItem item : order.getOrderItems()) {
             * // productService.addProductQuantity(item.getProductId(),
             * item.getQuantity());
             * }
             */
            return order;
        }).orElse(null);
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
        return orderRepository.findByUserIdOrderByCreationTimestampDesc(userId);
    }

    // CRUD Implementation
    @Override
    public List<Order> getAllOrders(String status) {
        if (status != null && !status.isEmpty()) {
            OrderStatus orderStatus = OrderStatus.valueOf(status.toUpperCase());
            return orderRepository.findByOrderStatus(orderStatus);
        }
        return orderRepository.findAll();
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
    public void deleteOrder(String orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new RuntimeException("Order not found for ID: " + orderId));
        orderRepository.delete(order);
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
                    com.example.orderservice.request.IncreaseStockRequest rollbackRequest = 
                            new com.example.orderservice.request.IncreaseStockRequest(
                                    item.getSizeId(), 
                                    item.getQuantity()
                            );
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

    @Override
    public List<Order> searchOrders(String userId, String status, String startDate, String endDate) {
        if (userId != null && !userId.isEmpty()) {
            return orderRepository.findByUserIdOrderByCreationTimestampDesc (userId);
        }

        if (status != null && !status.isEmpty()) {
            OrderStatus orderStatus = OrderStatus.valueOf(status.toUpperCase());
            return orderRepository.findByOrderStatus(orderStatus);
        }

        return orderRepository.findAll();
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
                    
                    DecreaseStockRequest dec = new DecreaseStockRequest();
                    dec.setSizeId(si.getSizeId());
                    dec.setQuantity(si.getQuantity());
                    stockServiceClient.decreaseStock(dec);

                    return OrderItem.builder()
                            .productId(si.getProductId())
                            .sizeId(si.getSizeId())
                            .quantity(si.getQuantity())
                            .unitPrice(si.getUnitPrice())
                            .totalPrice(si.getUnitPrice() * si.getQuantity())
                            .order(order)
                            .build();
                })
                .collect(Collectors.toList());
    }

    /**
     * Tạo OrderItems từ SelectedItems cho checkout (skip decrease stock cho test products)
     */
    private List<OrderItem> toOrderItemsFromSelectedForCheckout(List<SelectedItemDto> selectedItems, Order order) {
        return selectedItems.stream()
                .map(si -> {
                    if (si.getSizeId() == null || si.getSizeId().isBlank()) {
                        throw new RuntimeException("Size ID is required for product: " + si.getProductId());
                    }
                    
                    // ✅ SKIP decrease stock cho test products
                    if (si.getProductId() == null || !si.getProductId().startsWith("test-product-")) {
                        DecreaseStockRequest dec = new DecreaseStockRequest();
                        dec.setSizeId(si.getSizeId());
                        dec.setQuantity(si.getQuantity());
                        try {
                            stockServiceClient.decreaseStock(dec);
                        } catch (Exception e) {
                            log.warn("[CONSUMER] Failed to decrease stock for product {}: {}", si.getProductId(), e.getMessage());
                            // Continue anyway for test purposes
                        }
                    } else {
                        log.info("[CONSUMER] Skipping stock decrease for test product: {}", si.getProductId());
                    }

                    return OrderItem.builder()
                            .productId(si.getProductId())
                            .sizeId(si.getSizeId())
                            .quantity(si.getQuantity())
                            .unitPrice(si.getUnitPrice())
                            .totalPrice(si.getUnitPrice() * si.getQuantity())
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

    private void cleanupCartItemsBySelected(String userId, List<SelectedItemDto> selectedItems) {
        if (selectedItems == null || selectedItems.isEmpty()) {
            log.warn("[CONSUMER] selectedItems is null or empty - skipping cart cleanup");
            return;
        }
        
        log.info("[CONSUMER] Starting cart cleanup for userId: {}, number of items to remove: {}", 
            userId, selectedItems.size());
        
        for (SelectedItemDto item : selectedItems) {
            try {
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

    private void notifyOrderPlaced(Order order) {
        // Since 1 user = 1 shop, set both userId and shopId to order.getUserId()
        // This is a notification for the user (who placed the order), not shop owner
        SendNotificationRequest noti = SendNotificationRequest.builder()
                .userId(order.getUserId())
                .shopId(order.getUserId())
                .orderId(order.getId())
                .message("Order placed successfully with ID: " + order.getId())
                .isShopOwnerNotification(false) // false = user notification
                .build();
//        kafkaTemplateSend.send(notificationTopic.name(), noti);
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
                order.getId(), totalItems, totalAmount
            );
            
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
//                kafkaTemplateSend.send(notificationTopic.name(), notification);
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
            log.info("[GHN] ========== CREATING SHIPPING ORDER ==========");
            log.info("[GHN] Order ID: {}", order.getId());
            
            // 1. Lấy địa chỉ khách hàng
            AddressDto customerAddress = userServiceClient.getAddressById(order.getAddressId()).getBody();
            if (customerAddress == null) {
                log.error("[GHN] Customer address not found: {}", order.getAddressId());
                return;
            }
            
            log.info("[GHN] Customer: {}, Phone: {}", 
                customerAddress.getRecipientName(), 
                customerAddress.getRecipientPhone());
            
            // 2. Validate GHN fields
            if (customerAddress.getDistrictId() == null || customerAddress.getWardCode() == null) {
                log.warn("[GHN] ⚠️  Address missing GHN fields!");
                log.warn("[GHN] District ID: {}, Ward Code: {}", 
                    customerAddress.getDistrictId(), customerAddress.getWardCode());
                log.warn("[GHN] SKIPPING GHN order creation - address needs update with GHN data");
                return;
            }
            
            // 3. Validate order items
            if (order.getOrderItems() == null || order.getOrderItems().isEmpty()) {
                log.error("[GHN] Order has no items!");
                return;
            }
            
            log.info("[GHN] Order has {} items", order.getOrderItems().size());
            
            // 4. Tính tổng weight (500g mỗi item - có thể điều chỉnh)
            int totalWeight = order.getOrderItems().stream()
                .mapToInt(item -> item.getQuantity() * 500)
                .sum();
            
            log.info("[GHN] Total weight: {}g", totalWeight);
            
            // 5. Lấy shop owner address (FROM address)
            // Lấy shop owner ID từ product đầu tiên
            String shopOwnerId = null;
            try {
                if (!order.getOrderItems().isEmpty()) {
                    ProductDto firstProduct = stockServiceClient.getProductById(
                        order.getOrderItems().get(0).getProductId()
                    ).getBody();
                    if (firstProduct != null) {
                        shopOwnerId = firstProduct.getUserId();
                    }
                }
            } catch (Exception e) {
                log.warn("[GHN] Cannot get shop owner ID: {}", e.getMessage());
            }
            
            // Lấy shop owner info để có FROM address
            ShopOwnerDto shopOwner = null;
            if (shopOwnerId != null && !shopOwnerId.isBlank()) {
                try {
                    ResponseEntity<ShopOwnerDto> shopOwnerResponse = userServiceClient.getShopOwnerByUserId(shopOwnerId);
                    if (shopOwnerResponse != null && shopOwnerResponse.getBody() != null) {
                        shopOwner = shopOwnerResponse.getBody();
                        log.info("[GHN] Shop Owner: {}, Address: {}", shopOwner.getShopName(), shopOwner.getStreetAddress());
                    }
                } catch (Exception e) {
                    log.warn("[GHN] Cannot get shop owner address: {}", e.getMessage());
                }
            }
            
            // Validate shop owner address
            if (shopOwner == null || shopOwner.getDistrictId() == null || shopOwner.getWardCode() == null) {
                log.warn("[GHN] ⚠️  Shop owner address missing GHN fields!");
                log.warn("[GHN] Shop Owner ID: {}, District ID: {}, Ward Code: {}", 
                    shopOwnerId, 
                    shopOwner != null ? shopOwner.getDistrictId() : "null",
                    shopOwner != null ? shopOwner.getWardCode() : "null");
                log.warn("[GHN] SKIPPING GHN order creation - shop owner needs to configure GHN address in Settings");
                return;
            }
            
            // 6. Build items cho GHN
            List<GhnItemDto> ghnItems = order.getOrderItems().stream()
                .map(item -> {
                    String productName = "Product";
                    try {
                        ProductDto product = stockServiceClient.getProductById(item.getProductId()).getBody();
                        if (product != null) {
                            productName = product.getName();
                        }
                    } catch (Exception e) {
                        log.warn("[GHN] Cannot get product name for: {}", item.getProductId());
                    }
                    
                    return GhnItemDto.builder()
                        .name(productName)
                        .quantity(item.getQuantity())
                        .price((long) item.getUnitPrice())
                        .build();
                })
                .collect(Collectors.toList());
            
            // 7. Build GHN request với FROM address từ shop owner
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
                .serviceTypeId(2) // 2 = Standard (rẻ hơn), 5 = Express
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
            
            log.info("[GHN] Request Details:");
            log.info("[GHN]   FROM - Shop: {}, District ID: {}, Ward Code: {}", 
                shopOwner != null ? shopOwner.getShopName() : "N/A",
                ghnRequest.getFromDistrictId(),
                ghnRequest.getFromWardCode());
            log.info("[GHN]   TO - Customer: {}, District ID: {}, Ward Code: {}", 
                customerAddress.getRecipientName(),
                ghnRequest.getToDistrictId(),
                ghnRequest.getToWardCode());
            log.info("[GHN]   COD Amount: {} VNĐ", ghnRequest.getCodAmount());
            log.info("[GHN]   Weight: {}g", ghnRequest.getWeight());
            
            // 8. Call GHN API
            log.info("[GHN] Calling GHN API...");
            GhnCreateOrderResponse ghnResponse = ghnApiClient.createOrder(ghnRequest);
            
            if (ghnResponse == null || ghnResponse.getCode() != 200) {
                log.error("[GHN] GHN API returned error!");
                log.error("[GHN] Code: {}, Message: {}", 
                    ghnResponse != null ? ghnResponse.getCode() : "null",
                    ghnResponse != null ? ghnResponse.getMessage() : "null");
                return;
            }
            
            // 9. Save ShippingOrder
            log.info("[GHN] Saving shipping order to database...");
            
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
            
            shippingOrderRepository.save(shippingOrder);

            log.info("[GHN] SUCCESS!");
            log.info("[GHN] GHN Order Code: {}", ghnResponse.getData().getOrderCode());
            log.info("[GHN] Shipping Fee: {} VNĐ", ghnResponse.getData().getTotalFee());
            log.info("[GHN] Expected Delivery: {}", ghnResponse.getData().getExpectedDeliveryTime());
            log.info("[GHN] ===============================================");

        } catch (Exception e) {
            log.error("[GHN] Exception occurred: {}", e.getMessage(), e);
            log.error("[GHN] Order creation continues, but shipping order failed");
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

    ///////////////////////////////////////////////////////////////////////////////////
    @Override
    @Transactional
    public void orderByKafka(FrontendOrderRequest orderRequest, HttpServletRequest request){
        String author = request.getHeader("Authorization");
        CartDto cartDto = stockServiceClient.getCart(author).getBody();
        AddressDto address = userServiceClient.getAddressById(orderRequest.getAddressId()).getBody();
        if (address == null)
            throw new RuntimeException("Address not found for ID: " + orderRequest.getAddressId());
        if(cartDto == null || cartDto.getItems().isEmpty())
            throw new RuntimeException("Cart not found or empty");

        for (SelectedItemDto item : orderRequest.getSelectedItems()) {
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
                        + ", size: " + size.getName() + ". Available: " + size.getStock() + ", Requested: " + item.getQuantity());
            }
        }

        CheckOutKafkaRequest kafkaRequest = CheckOutKafkaRequest.builder()
                .userId(cartDto.getUserId())
                .addressId(orderRequest.getAddressId())
                .cartId(cartDto.getId())
                .selectedItems(orderRequest.getSelectedItems())
                .paymentMethod(orderRequest.getPaymentMethod() != null ? orderRequest.getPaymentMethod() : "COD") // Default to COD
                .build();

        kafkaTemplate.send(orderTopic.name(), kafkaRequest);
    }

    @Override
    @Transactional
    public Order createOrderFromPayment(String userId, String addressId, List<SelectedItemDto> selectedItems) {
        // Validate address
        AddressDto address = userServiceClient.getAddressById(addressId).getBody();
        if (address == null) {
            throw new RuntimeException("Address not found for ID: " + addressId);
        }

        // Validate stock
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
                        + ", size: " + size.getName() + ". Available: " + size.getStock() + ", Requested: " + item.getQuantity());
            }

            // Ensure unitPrice is populated (frontend payload may omit it for VNPay flow)
            if (item.getUnitPrice() == null) {
                double computedPrice = computeUnitPrice(product, size);
                item.setUnitPrice(computedPrice);
            }
        }

        // Create order with PENDING status (payment is successful, but order needs shop confirmation)
        Order order = Order.builder()
                .userId(userId)
                .addressId(addressId)
                .orderStatus(OrderStatus.PENDING) // Payment successful, but order pending shop confirmation
                .totalPrice(0.0)
                .paymentMethod("VNPAY") // Orders created from payment are VNPay
                .build();
        order = orderRepository.save(order);

        // Add items and decrease stock
        List<OrderItem> items = toOrderItemsFromSelected(selectedItems, order);
        order.setOrderItems(items);
        order.setTotalPrice(calculateTotalPrice(items));
        orderRepository.save(order);

        // Cleanup cart
        try {
            cleanupCartItemsBySelected(userId, selectedItems);
        } catch (Exception e) {
            log.error("[PAYMENT-ORDER] cart cleanup failed: {}", e.getMessage(), e);
        }

        // Send notifications
        try {
            notifyOrderPlaced(order);
            notifyShopOwners(order);
        } catch (Exception e) {
            log.error("[PAYMENT-ORDER] send notification failed: {}", e.getMessage(), e);
        }

        return order;
    }

    @KafkaListener(topics = "#{@orderTopic.name}", groupId = "order-service-checkout", containerFactory = "checkoutListenerFactory")
    @Transactional
    public void consumeCheckout(CheckOutKafkaRequest msg) {
        if (msg.getAddressId() == null || msg.getAddressId().isBlank()) {
            throw new RuntimeException("addressId is required in message");
        }
        if (msg.getSelectedItems() == null || msg.getSelectedItems().isEmpty()) {
            return;
        }
        try {
            for (SelectedItemDto item : msg.getSelectedItems()) {
                if (item.getSizeId() == null || item.getSizeId().isBlank()) {
                    throw new RuntimeException("Size ID is required for product: " + item.getProductId());
                }

                // ✅ SKIP VALIDATION cho test products (bắt đầu với "test-product-")
                // Để test throughput mà không cần gọi Stock Service
                if (item.getProductId() != null && item.getProductId().startsWith("test-product-")) {
                    log.info("[CONSUMER] Skipping validation for test product: {}", item.getProductId());
                    continue; // Skip validation, tiếp tục với product tiếp theo
                }

                ProductDto product = stockServiceClient.getProductById(item.getProductId()).getBody();
                if (product == null) {
                    log.error("[CONSUMER] Product not found: {}", item.getProductId());
                    throw new RuntimeException("Product not found for ID: " + item.getProductId());
                }

                SizeDto size = stockServiceClient.getSizeById(item.getSizeId()).getBody();
                if (size == null) {
                    log.error("[CONSUMER] Size not found: {}", item.getSizeId());
                    throw new RuntimeException("Size not found for ID: " + item.getSizeId());
                }

                if (size.getStock() < item.getQuantity()) {
                    log.error("[CONSUMER] Insufficient stock for product {} size {}. Available: {}, Requested: {}",
                            item.getProductId(), size.getName(), size.getStock(), item.getQuantity());
                    throw new RuntimeException("Insufficient stock for product: " + product.getName()
                            + ", size: " + size.getName() + ". Available: " + size.getStock() + ", Requested: " + item.getQuantity());
                }
            }
        } catch (Exception e) {
            try {
                // Since 1 user = 1 shop, set both userId and shopId to msg.getUserId()
                // This is a notification for the user (order failed), not shop owner
                SendNotificationRequest failNotification = SendNotificationRequest.builder()
                        .userId(msg.getUserId())
                        .shopId(msg.getUserId())
                        .orderId(null)
                        .message("Order creation failed: " + e.getMessage())
                        .isShopOwnerNotification(false) // false = user notification
                        .build();
//                kafkaTemplateSend.send(notificationTopic.name(), failNotification);

                String partitionKey = failNotification.getUserId() != null
                        ? failNotification.getUserId()
                        : failNotification.getShopId();
                kafkaTemplateSend.send(notificationTopic.name(), partitionKey, failNotification);
            } catch (Exception notifEx) {
                log.error("[CONSUMER] Failed to send failure notification: {}", notifEx.getMessage(), notifEx);
            }
            throw e;
        }

        // 1) Create order skeleton
        Order order = initPendingOrder(msg.getUserId(), msg.getAddressId(), 
                msg.getPaymentMethod() != null ? msg.getPaymentMethod() : "COD");

        // 2) Items + decrease stock (skip decrease stock cho test products)
        List<OrderItem> items = toOrderItemsFromSelectedForCheckout(msg.getSelectedItems(), order);
        order.setOrderItems(items);
        order.setTotalPrice(calculateTotalPrice(items));
        orderRepository.save(order);

        // 3) Cleanup cart - remove items that were added to order
        try {
            if (msg.getSelectedItems() != null && !msg.getSelectedItems().isEmpty()) {
                log.info("[CONSUMER] Starting cart cleanup for userId: {}, items count: {}",
                        msg.getUserId(), msg.getSelectedItems().size());
                cleanupCartItemsBySelected(msg.getUserId(), msg.getSelectedItems());
            } else {
                log.warn("[CONSUMER] selectedItems is null or empty -> skip cart cleanup");
            }
        } catch (Exception e) {
            log.error("[CONSUMER] cart cleanup failed: {}", e.getMessage(), e);
        }

        try {
            notifyOrderPlaced(order);
            notifyShopOwners(order);
        } catch (Exception e) {
            log.error("[CONSUMER] send notification failed: {}", e.getMessage(), e);
        }

        // 4) Create GHN shipping order
        try {
            createShippingOrder(order);
        } catch (Exception e) {
            log.error("[CONSUMER] Failed to create GHN shipping order: {}", e.getMessage(), e);
            // Don't throw - order is already created, just log the error
        }
    }

    @KafkaListener(topics = "#{@paymentTopic.name}", groupId = "order-service-payment", containerFactory = "paymentListenerFactory")
    @Transactional
    public void consumePaymentEvent(PaymentEvent event) {
        log.info("[PAYMENT-CONSUMER] Received payment event: txnRef={}, status={}, orderId={}",
                event.getTxnRef(), event.getStatus(), event.getOrderId());

        try {
            if ("PAID".equals(event.getStatus())) {
                // Payment successful
                if (event.getOrderId() != null && !event.getOrderId().trim().isEmpty()) {
                    // Order already exists - payment successful, keep order status as PENDING (waiting for shop confirmation)
                    Order order = orderRepository.findById(event.getOrderId())
                            .orElse(null);
                    if (order != null) {
                        // Payment is successful, but order status should remain PENDING for shop to confirm
                        // Only update if order was in a different state (e.g., if it was created before payment)
                        if (order.getOrderStatus() == OrderStatus.PENDING) {
                            log.info("[PAYMENT-CONSUMER] Order {} payment successful, status remains PENDING for shop confirmation", event.getOrderId());
                        } else {
                            log.info("[PAYMENT-CONSUMER] Order {} payment successful, current status: {}", event.getOrderId(), order.getOrderStatus());
                        }
                        // No need to change order status - PENDING is correct after successful payment
                    } else {
                        log.warn("[PAYMENT-CONSUMER] Order {} not found for payment event", event.getOrderId());
                    }
                } else if (event.getUserId() != null && event.getAddressId() != null
                        && event.getOrderDataJson() != null && !event.getOrderDataJson().trim().isEmpty()) {
                    // Order doesn't exist yet - create it from orderData
                    try {
                        // Parse orderDataJson to get selectedItems
                        Map<String, Object> orderDataMap = objectMapper.readValue(event.getOrderDataJson(), Map.class);
                        List<Map<String, Object>> selectedItemsList = (List<Map<String, Object>>) orderDataMap.get("selectedItems");

                        if (selectedItemsList == null || selectedItemsList.isEmpty()) {
                            log.error("[PAYMENT-CONSUMER] No selectedItems in orderData for payment: {}", event.getTxnRef());
                            return;
                        }

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

                        // Create order with PENDING status (payment successful, waiting for shop confirmation)
                        Order order = createOrderFromPayment(event.getUserId(), event.getAddressId(), selectedItems);
                        
                        // Set payment method from event (VNPAY, CARD, etc.) if available
                        if (event.getMethod() != null && !event.getMethod().trim().isEmpty()) {
                            order.setPaymentMethod(event.getMethod().toUpperCase());
                            orderRepository.save(order);
                        }
                        
                        log.info("[PAYMENT-CONSUMER] Created order {} with PENDING status and payment method {} from payment event: {}", 
                                order.getId(), order.getPaymentMethod(), event.getTxnRef());
                    } catch (Exception e) {
                        log.error("[PAYMENT-CONSUMER] Failed to create order from payment event: {}", e.getMessage(), e);
                        // Note: Payment is already successful, but order creation failed
                        // In production, you might want to implement retry mechanism or manual intervention
                    }
                } else {
                    log.warn("[PAYMENT-CONSUMER] Payment successful but missing order data: txnRef={}", event.getTxnRef());
                }
            } else if ("FAILED".equals(event.getStatus())) {
                // Payment failed - rollback if order exists
                if (event.getOrderId() != null && !event.getOrderId().trim().isEmpty()) {
                    try {
                        rollbackOrderStock(event.getOrderId());
                        log.info("[PAYMENT-CONSUMER] Rolled back order {} due to payment failure", event.getOrderId());
                    } catch (Exception e) {
                        log.error("[PAYMENT-CONSUMER] Failed to rollback order {}: {}", event.getOrderId(), e.getMessage(), e);
                    }
                } else {
                    log.info("[PAYMENT-CONSUMER] Payment failed but no order was created, no rollback needed: txnRef={}",
                            event.getTxnRef());
                }
            }
        } catch (Exception e) {
            log.error("[PAYMENT-CONSUMER] Error processing payment event: {}", e.getMessage(), e);
        }
    }
    /////////////////////////////////////////////////////////////////////////////////////
}
