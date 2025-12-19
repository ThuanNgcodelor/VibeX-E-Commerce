package com.example.orderservice.controller;

import com.example.orderservice.client.GhnApiClient;
import com.example.orderservice.client.StockServiceClient;
import com.example.orderservice.client.UserServiceClient;
import com.example.orderservice.dto.*;
import com.example.orderservice.jwt.JwtUtil;
import com.example.orderservice.model.Order;
import com.example.orderservice.repository.ShippingOrderRepository;
import com.example.orderservice.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/v1/order")
@RequiredArgsConstructor
@Slf4j
public class OrderController {
    private final OrderService orderService;
    private final com.example.orderservice.service.ShopLedgerService shopLedgerService;
    private final ModelMapper modelMapper;
    private final JwtUtil jwtUtil;
    private final StockServiceClient stockServiceClient;
    private final UserServiceClient userServiceClient;
    private final ShippingOrderRepository shippingOrderRepository;
    private final GhnApiClient ghnApiClient;

    private OrderDto enrichOrderDto(Order order) {
        OrderDto dto = modelMapper.map(order, OrderDto.class);

        // Set addressId from order
        if (order.getAddressId() != null && !order.getAddressId().isBlank()) {
            dto.setAddressId(order.getAddressId());

            // Fetch and enrich address data
            try {
                ResponseEntity<AddressDto> addressResponse = userServiceClient.getAddressById(order.getAddressId());
                if (addressResponse != null && addressResponse.getBody() != null) {
                    AddressDto address = addressResponse.getBody();

                    // Set recipient phone
                    if (address.getRecipientPhone() != null && !address.getRecipientPhone().isBlank()) {
                        dto.setRecipientPhone(address.getRecipientPhone());
                    }

                    // Build full address string
                    StringBuilder fullAddressBuilder = new StringBuilder();
                    if (address.getStreetAddress() != null && !address.getStreetAddress().trim().isEmpty()) {
                        fullAddressBuilder.append(address.getStreetAddress());
                    }
                    // Use provinceName instead of deprecated getProvince()
                    String province = address.getProvinceName() != null ? address.getProvinceName()
                            : (address.getProvince() != null ? address.getProvince() : null);
                    if (province != null && !province.trim().isEmpty()) {
                        if (fullAddressBuilder.length() > 0) {
                            fullAddressBuilder.append(", ");
                        }
                        fullAddressBuilder.append(province);
                    }
                    if (fullAddressBuilder.length() > 0) {
                        dto.setFullAddress(fullAddressBuilder.toString());
                    }

                    // If shippingAddress is not set yet, use fullAddress
                    if ((dto.getShippingAddress() == null || dto.getShippingAddress().isBlank())
                            && dto.getFullAddress() != null) {
                        dto.setShippingAddress(dto.getFullAddress());
                    }
                }
            } catch (Exception e) {
                System.err.println(
                        "Failed to fetch address for addressId: " + order.getAddressId() + " - " + e.getMessage());
            }
        }

        if (order.getOrderItems() != null && !order.getOrderItems().isEmpty()) {
            List<OrderItemDto> enrichedItems = order.getOrderItems().stream()
                    .map(item -> {
                        OrderItemDto itemDto = modelMapper.map(item, OrderItemDto.class);

                        if (item.getProductId() != null && !item.getProductId().isBlank()) {
                            try {
                                ResponseEntity<ProductDto> productResponse = stockServiceClient
                                        .getProductById(item.getProductId());
                                if (productResponse != null && productResponse.getBody() != null) {
                                    ProductDto product = productResponse.getBody();
                                    if (product.getName() != null) {
                                        itemDto.setProductName(product.getName());
                                    }
                                }
                            } catch (Exception e) {
                                System.err.println("Failed to fetch product name for productId: " + item.getProductId()
                                        + " - " + e.getMessage());
                            }
                        }

                        if (item.getSizeId() != null && !item.getSizeId().isBlank()) {
                            try {
                                ResponseEntity<SizeDto> sizeResponse = stockServiceClient.getSizeById(item.getSizeId());
                                if (sizeResponse != null && sizeResponse.getBody() != null) {
                                    SizeDto size = sizeResponse.getBody();
                                    if (size.getName() != null) {
                                        itemDto.setSizeName(size.getName());
                                    }
                                }
                            } catch (Exception e) {
                                // Log error but don't fail the request
                                System.err.println("Failed to fetch size name for sizeId: " + item.getSizeId() + " - "
                                        + e.getMessage());
                            }
                        }

                        return itemDto;
                    })
                    .collect(Collectors.toList());
            dto.setOrderItems(enrichedItems);
        }

        // Fetch shipping fee: ưu tiên từ Order.shippingFee (VNPay đã thanh toán), nếu
        // không có thì lấy từ ShippingOrder (COD)
        if (order.getShippingFee() != null) {
            dto.setShippingFee(order.getShippingFee().doubleValue());
        } else {
            // Fallback: lấy từ ShippingOrder cho COD orders
            try {
                shippingOrderRepository.findByOrderId(order.getId())
                        .ifPresent(shippingOrder -> {
                            if (shippingOrder.getShippingFee() != null) {
                                dto.setShippingFee(shippingOrder.getShippingFee().doubleValue());
                            }
                        });
            } catch (Exception e) {
                System.err
                        .println("Failed to fetch shipping fee for orderId: " + order.getId() + " - " + e.getMessage());
            }
        }

        return dto;
    }

    // Helper method để enrich List<Order>
    private List<OrderDto> enrichOrderDtos(List<Order> orders) {
        return orders.stream()
                .map(this::enrichOrderDto)
                .collect(Collectors.toList());
    }

    // Helper method để enrich Page<Order>
    private Page<OrderDto> enrichOrderDtosPage(Page<Order> ordersPage) {
        return ordersPage.map(this::enrichOrderDto);
    }

    // ========== Existing Endpoints ==========

    @PostMapping("/create-from-cart")
    ResponseEntity<?> createOrderFromCart(@RequestBody FrontendOrderRequest request, HttpServletRequest httpRequest) {
        try {
            String paymentMethod = request.getPaymentMethod();
            // Only COD uses this endpoint; VNPay/Card should go through payment-service
            if ("VNPAY".equalsIgnoreCase(paymentMethod) || "CARD".equalsIgnoreCase(paymentMethod)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "error", "USE_PAYMENT_SERVICE",
                        "message", "For VNPay/Card, please initiate via payment-service."));
            }

            // COD - use async Kafka
            orderService.orderByKafka(request, httpRequest);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "message", "Order has been sent to Kafka.",
                    "status", "PENDING"));
        } catch (RuntimeException e) {
            if (e.getMessage().contains("Insufficient stock")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "error", "INSUFFICIENT_STOCK",
                        "message", e.getMessage(),
                        "details", extractStockDetails(e.getMessage())));
            }
            if (e.getMessage().contains("Address not found")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "error", "ADDRESS_NOT_FOUND",
                        "message", e.getMessage()));
            }
            if (e.getMessage().contains("Cart not found") || e.getMessage().contains("empty")) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "error", "CART_EMPTY",
                        "message", e.getMessage()));
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "ORDER_FAILED",
                    "message", e.getMessage()));
        }
    }

    private Map<String, Object> extractStockDetails(String message) {
        Map<String, Object> details = new HashMap<>();
        if (message.contains("Available:") && message.contains("Requested:")) {
            String[] parts = message.split("Available:|Requested:");
            if (parts.length >= 3) {
                details.put("available", parts[1].trim().replaceAll("[^0-9]", ""));
                details.put("requested", parts[2].trim().replaceAll("[^0-9]", ""));
            }
        }
        return details;
    }

    @GetMapping("/addresses")
    ResponseEntity<List<AddressDto>> getUserAddresses(HttpServletRequest request) {
        List<AddressDto> addresses = orderService.getUserAddresses(request);
        return ResponseEntity.ok(addresses);
    }

    @GetMapping("/addresses/{addressId}")
    ResponseEntity<AddressDto> getAddressById(@PathVariable String addressId) {
        AddressDto address = orderService.getAddressById(addressId);
        return ResponseEntity.ok(address);
    }

    @PutMapping("/cancel/{orderId}")
    ResponseEntity<?> cancelOrder(@PathVariable String orderId,
            @RequestBody(required = false) Map<String, String> payload) {
        try {
            String reason = payload != null ? payload.getOrDefault("reason", null) : null;
            Order cancelled = orderService.cancelOrder(orderId, reason);
            if (reason != null && !reason.isBlank()) {
                log.info("Order {} cancelled. Reason: {}", orderId, reason);
            }
            return ResponseEntity.ok(Map.of(
                    "message", "Order cancelled",
                    "orderId", cancelled.getId(),
                    "status", cancelled.getOrderStatus().name(),
                    "reason", reason));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "CANCEL_FAILED",
                    "message", e.getMessage()));
        }
    }

    @PostMapping("/calculate-shipping-fee")
    ResponseEntity<?> calculateShippingFee(
            @RequestBody com.example.orderservice.dto.CalculateShippingFeeRequest request,
            HttpServletRequest httpRequest) {
        try {
            // 1. Get customer address
            AddressDto customerAddress = userServiceClient.getAddressById(request.getAddressId()).getBody();
            if (customerAddress == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "error", "ADDRESS_NOT_FOUND",
                        "message", "Address not found"));
            }

            // 2. Validate GHN fields
            if (customerAddress.getDistrictId() == null || customerAddress.getWardCode() == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "error", "ADDRESS_MISSING_GHN_FIELDS",
                        "message",
                        "Address missing GHN fields. Please update address with province, district, and ward."));
            }

            // 3. Get shop owner address (FROM address)
            String shopOwnerId = request.getShopOwnerId();

            // If shop owner ID not provided, try to get from first product
            if (shopOwnerId == null || shopOwnerId.isBlank()) {
                if (request.getProductId() != null && !request.getProductId().isBlank()) {
                    try {
                        ResponseEntity<ProductDto> productResponse = stockServiceClient
                                .getProductById(request.getProductId());
                        if (productResponse != null && productResponse.getBody() != null) {
                            shopOwnerId = productResponse.getBody().getUserId();
                        }
                    } catch (Exception e) {
                        System.err.println("Failed to get product: " + e.getMessage());
                    }
                }
            }

            // 4. Get shop owner address
            ShopOwnerDto shopOwner = null;
            if (shopOwnerId != null && !shopOwnerId.isBlank()) {
                try {
                    ResponseEntity<ShopOwnerDto> shopOwnerResponse = userServiceClient
                            .getShopOwnerByUserId(shopOwnerId);
                    if (shopOwnerResponse != null && shopOwnerResponse.getBody() != null) {
                        shopOwner = shopOwnerResponse.getBody();
                    }
                } catch (Exception e) {
                    System.err.println("Failed to get shop owner: " + e.getMessage());
                }
            }

            // If no shop owner, we can't calculate fee
            if (shopOwner == null || shopOwner.getDistrictId() == null || shopOwner.getWardCode() == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "error", "SHOP_OWNER_ADDRESS_NOT_CONFIGURED",
                        "message", "Shop owner address not configured. Please configure shop address in Settings."));
            }

            // 5. Calculate weight from selectedItems (preferred) or fallback to
            // weight/quantity
            int weight = 1000; // Default 1000g
            if (request.getSelectedItems() != null && !request.getSelectedItems().isEmpty()) {
                // Calculate weight from selectedItems
                weight = 0;
                for (com.example.orderservice.dto.SelectedItemDto item : request.getSelectedItems()) {
                    try {
                        // Get size information to get weight
                        ResponseEntity<com.example.orderservice.dto.SizeDto> sizeResponse = stockServiceClient
                                .getSizeById(item.getSizeId());
                        if (sizeResponse != null && sizeResponse.getBody() != null) {
                            com.example.orderservice.dto.SizeDto size = sizeResponse.getBody();
                            int itemWeight = (size.getWeight() != null && size.getWeight() > 0) ? size.getWeight()
                                    : 500; // Default 500g if not set
                            weight += item.getQuantity() * itemWeight;
                        } else {
                            // Fallback to 500g if size not found
                            weight += item.getQuantity() * 500;
                        }
                    } catch (Exception e) {
                        // Fallback to 500g if error
                        weight += item.getQuantity() * 500;
                    }
                }
            } else if (request.getWeight() != null) {
                // Use provided weight (backward compatibility)
                weight = request.getWeight();
            } else if (request.getQuantity() != null) {
                // Calculate from quantity (backward compatibility)
                weight = request.getQuantity() * 500;
            }

            // 6. Get available services from GHN API
            Integer serviceTypeId = 2; // Default: Hàng nhẹ
            try {
                GhnAvailableServicesResponse servicesResponse = ghnApiClient.getAvailableServices(
                        shopOwner.getDistrictId(), 
                        customerAddress.getDistrictId()
                );
                
                if (servicesResponse != null && servicesResponse.getCode() == 200 
                        && servicesResponse.getData() != null && !servicesResponse.getData().isEmpty()) {
                    
                    // Ưu tiên service_type_id = 2 (Hàng nhẹ) nếu có
                    GhnAvailableServicesResponse.ServiceData preferredService = null;
                    GhnAvailableServicesResponse.ServiceData fallbackService = null;
                    
                    for (GhnAvailableServicesResponse.ServiceData service : servicesResponse.getData()) {
                        if (service.getServiceTypeId() == 2) {
                            preferredService = service;
                        } else {
                            fallbackService = service;
                        }
                    }
                    
                    if (preferredService != null) {
                        serviceTypeId = preferredService.getServiceTypeId();
                    } else if (fallbackService != null) {
                        serviceTypeId = fallbackService.getServiceTypeId();
                    }
                }
            } catch (Exception e) {
                log.warn("[GHN] Failed to get available services for fee calculation: {}", e.getMessage());
            }

            // 7. Build GHN fee calculation request
            com.example.orderservice.dto.GhnCalculateFeeRequest ghnRequest = com.example.orderservice.dto.GhnCalculateFeeRequest
                    .builder()
                    .fromDistrictId(shopOwner.getDistrictId())
                    .fromWardCode(shopOwner.getWardCode())
                    .toDistrictId(customerAddress.getDistrictId())
                    .toWardCode(customerAddress.getWardCode())
                    .weight(weight)
                    .length(20) // cm
                    .width(15)
                    .height(10)
                    .serviceTypeId(serviceTypeId) // Use available service type
                    .build();

            // 7. Call GHN API
            com.example.orderservice.dto.GhnCalculateFeeResponse ghnResponse = ghnApiClient.calculateFee(ghnRequest);

            if (ghnResponse == null || ghnResponse.getCode() != 200) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "error", "GHN_API_ERROR",
                        "message",
                        ghnResponse != null ? ghnResponse.getMessage() : "Failed to calculate shipping fee"));
            }

            return ResponseEntity.ok(Map.of(
                    "shippingFee", ghnResponse.getData().getTotal(),
                    "currency", "VND"));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "CALCULATION_FAILED",
                    "message", e.getMessage()));
        }
    }

    // Refactor existing endpoint để dùng enrichOrderDto
    @GetMapping("/getOrderByUserId")
    public ResponseEntity<List<OrderDto>> getOrderByUserId(HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        List<Order> orders = orderService.getUserOrders(userId);

        // Dùng enrichOrderDto để có productName và sizeName
        List<OrderDto> orderDtos = enrichOrderDtos(orders);

        return ResponseEntity.ok(orderDtos);
    }

    // ========== New Shop Owner Endpoints ==========
    @GetMapping("/shop-owner/orders")
    public ResponseEntity<Page<OrderDto>> getOrdersByShopOwner(
            HttpServletRequest request,
            @RequestParam(required = false) List<String> status,
            @RequestParam(defaultValue = "1") Integer pageNo,
            @RequestParam(defaultValue = "10") Integer pageSize) {

        try {
            String shopOwnerId = jwtUtil.ExtractUserId(request);
            // Get orders paginated
            Page<Order> ordersPage = orderService.getOrdersByShopOwner(shopOwnerId, status, pageNo, pageSize);
            // Enrich với productName và sizeName
            Page<OrderDto> orderDtosPage = enrichOrderDtosPage(ordersPage);

            return ResponseEntity.ok(orderDtosPage);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(null);
        }
    }

    @GetMapping("/shop-owner/orders/all")
    public ResponseEntity<List<OrderDto>> getAllOrdersByShopOwner(
            HttpServletRequest request,
            @RequestParam(required = false) String status) {

        try {
            String shopOwnerId = jwtUtil.ExtractUserId(request);
            List<Order> orders = orderService.getOrdersByShopOwner(shopOwnerId, status);

            // với productName và sizeName
            List<OrderDto> orderDtos = enrichOrderDtos(orders);

            return ResponseEntity.ok(orderDtos);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(null);
        }
    }

    @GetMapping("/shop-owner/orders/{orderId}")
    public ResponseEntity<OrderDto> getOrderByIdForShopOwner(
            @PathVariable String orderId,
            HttpServletRequest request) {

        try {
            String shopOwnerId = jwtUtil.ExtractUserId(request);

            // Get order
            Order order = orderService.getOrderById(orderId);

            // Verify this order contains products belonging to this shop owner
            List<String> productIds = stockServiceClient.getProductIdsByShopOwner(shopOwnerId).getBody();

            if (productIds == null || productIds.isEmpty()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
            }

            boolean belongsToShopOwner = order.getOrderItems().stream()
                    .anyMatch(item -> productIds.contains(item.getProductId()));

            if (!belongsToShopOwner) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
            }

            // Enrich với productName và sizeName
            OrderDto dto = enrichOrderDto(order);

            return ResponseEntity.ok(dto);
        } catch (RuntimeException e) {
            if (e.getMessage().contains("not found")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    // ========== Alternative Endpoints (không enrich - nhanh hơn) ==========
    // Nếu cần performance và không cần productName/sizeName, có thể thêm endpoints
    // này:

    /**
     * Get orders for shop owner (paginated) - WITHOUT enrichment (faster)
     * Chỉ dùng ModelMapper trực tiếp, không gọi external service
     */
    @GetMapping("/shop-owner/orders/simple")
    public ResponseEntity<Page<OrderDto>> getOrdersByShopOwnerSimple(
            HttpServletRequest request,
            @RequestParam(required = false) List<String> status,
            @RequestParam(defaultValue = "1") Integer pageNo,
            @RequestParam(defaultValue = "10") Integer pageSize) {

        try {
            String shopOwnerId = jwtUtil.ExtractUserId(request);
            Page<Order> ordersPage = orderService.getOrdersByShopOwner(shopOwnerId, status, pageNo, pageSize);

            // Map trực tiếp bằng ModelMapper - không enrich (nhanh hơn)
            Page<OrderDto> orderDtosPage = ordersPage.map(order -> modelMapper.map(order, OrderDto.class));

            return ResponseEntity.ok(orderDtosPage);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(null);
        }
    }

    @GetMapping("/shop-owner/analytics")
    public ResponseEntity<com.example.orderservice.dto.AnalyticsDto> getAnalytics(HttpServletRequest request) {
        String shopOwnerId = jwtUtil.ExtractUserId(request);
        return ResponseEntity.ok(orderService.getAnalytics(shopOwnerId));
    }

    @PutMapping("/shop-owner/orders/{orderId}/status")
    public ResponseEntity<OrderDto> updateOrderStatusForShopOwner(
            @PathVariable String orderId,
            @RequestParam String status,
            HttpServletRequest request) {

        try {
            String shopOwnerId = jwtUtil.ExtractUserId(request);

            Order order = orderService.getOrderById(orderId);
            List<String> productIds = stockServiceClient.getProductIdsByShopOwner(shopOwnerId).getBody();

            if (productIds == null || productIds.isEmpty()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
            }

            boolean belongsToShopOwner = order.getOrderItems().stream()
                    .anyMatch(item -> productIds.contains(item.getProductId()));

            if (!belongsToShopOwner) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
            }

            // Update order status
            Order updatedOrder = orderService.updateOrderStatus(orderId, status);

            // Trigger Ledger Update if DELIVERED
            if ("DELIVERED".equalsIgnoreCase(status)) {
                try {
                    shopLedgerService.processOrderEarning(updatedOrder);
                } catch (Exception e) {
                    log.error("Failed to process ledger for order {}: {}", orderId, e.getMessage());
                    // Don't fail the request, just log error
                }
            }

            // Return enriched DTO
            OrderDto dto = enrichOrderDto(updatedOrder);

            return ResponseEntity.ok(dto);
        } catch (RuntimeException e) {
            if (e.getMessage().contains("not found")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Update order (full update with UpdateOrderRequest)
     */
    @PutMapping("/shop-owner/orders/{orderId}")
    public ResponseEntity<OrderDto> updateOrderForShopOwner(
            @PathVariable String orderId,
            @RequestBody UpdateOrderRequest request,
            HttpServletRequest httpRequest) {

        try {
            String shopOwnerId = jwtUtil.ExtractUserId(httpRequest);

            // Verify order belongs to shop owner
            Order order = orderService.getOrderById(orderId);
            List<String> productIds = stockServiceClient.getProductIdsByShopOwner(shopOwnerId).getBody();

            if (productIds == null || productIds.isEmpty()) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
            }

            boolean belongsToShopOwner = order.getOrderItems().stream()
                    .anyMatch(item -> productIds.contains(item.getProductId()));

            if (!belongsToShopOwner) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
            }

            // Update order
            Order updatedOrder = orderService.updateOrder(orderId, request);

            // Return enriched DTO
            OrderDto dto = enrichOrderDto(updatedOrder);

            return ResponseEntity.ok(dto);
        } catch (RuntimeException e) {
            if (e.getMessage().contains("not found")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Internal endpoint for payment-service to update order status
     * Should be called when payment succeeds/fails
     * Note: Payment success doesn't change order status to PAID - order stays
     * PENDING for shop confirmation
     */
    @PutMapping("/internal/update-payment-status/{orderId}")
    public ResponseEntity<?> updatePaymentStatus(
            @PathVariable String orderId,
            @RequestParam String paymentStatus) {
        try {
            // Verify internal call (can add header check if needed)
            if ("PAID".equalsIgnoreCase(paymentStatus)) {
                // Payment successful, but order status should remain PENDING (waiting for shop
                // confirmation)
                // Payment status is tracked separately in Payment entity
                Order order = orderService.getOrderById(orderId);
                if (order == null) {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Order not found"));
                }

                // Only log payment success, don't change order status
                // Order should remain PENDING for shop to confirm and process
                return ResponseEntity.ok(Map.of(
                        "message", "Payment successful. Order status remains PENDING for shop confirmation",
                        "orderId", order.getId(),
                        "orderStatus", order.getOrderStatus().name(),
                        "paymentStatus", "PAID"));
            } else if ("FAILED".equalsIgnoreCase(paymentStatus)) {
                // Rollback stock and cancel order when payment fails
                orderService.rollbackOrderStock(orderId);
                return ResponseEntity.ok(Map.of(
                        "message", "Payment failed, order cancelled and stock rolled back",
                        "orderId", orderId));
            }
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid payment status"));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", e.getMessage()));
        }
    }

    /**
     * Rollback order (cancel and restore stock)
     * Can be called manually or by scheduled job for expired payments
     */
    @PutMapping("/internal/rollback/{orderId}")
    public ResponseEntity<?> rollbackOrder(@PathVariable String orderId) {
        try {
            orderService.rollbackOrderStock(orderId);
            return ResponseEntity.ok(Map.of(
                    "message", "Order rolled back successfully",
                    "orderId", orderId));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", e.getMessage()));
        }
    }

    /**
     * Internal endpoint for payment-service to create order after payment success
     * Called when payment succeeds and order doesn't exist yet
     */
    @PostMapping("/internal/create-from-payment")
    public ResponseEntity<?> createOrderFromPayment(@RequestBody Map<String, Object> orderData) {
        try {
            String userId = (String) orderData.get("userId");
            String addressId = (String) orderData.get("addressId");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> selectedItemsRaw = (List<Map<String, Object>>) orderData.get("selectedItems");

            if (userId == null || addressId == null || selectedItemsRaw == null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Missing required fields: userId, addressId, selectedItems"));
            }

            // Get shippingFee from orderData (may be null for old orders)
            java.math.BigDecimal shippingFee = null;
            if (orderData.containsKey("shippingFee")) {
                Object shippingFeeObj = orderData.get("shippingFee");
                if (shippingFeeObj != null) {
                    if (shippingFeeObj instanceof Number) {
                        shippingFee = java.math.BigDecimal.valueOf(((Number) shippingFeeObj).doubleValue());
                    } else if (shippingFeeObj instanceof String) {
                        try {
                            shippingFee = new java.math.BigDecimal((String) shippingFeeObj);
                        } catch (NumberFormatException e) {
                            // Ignore invalid format
                        }
                    }
                }
            }

            // Get voucher data from orderData
            String voucherId = (String) orderData.get("voucherId");
            Double voucherDiscount = null;
            if (orderData.containsKey("voucherDiscount")) {
                Object voucherDiscountObj = orderData.get("voucherDiscount");
                if (voucherDiscountObj instanceof Number) {
                    voucherDiscount = ((Number) voucherDiscountObj).doubleValue();
                }
            }

            // Convert Map to SelectedItemDto
            List<SelectedItemDto> selectedItems = selectedItemsRaw.stream()
                    .map(item -> {
                        SelectedItemDto dto = new SelectedItemDto();
                        dto.setProductId((String) item.get("productId"));
                        dto.setSizeId((String) item.get("sizeId"));
                        dto.setQuantity(((Number) item.get("quantity")).intValue());
                        dto.setUnitPrice(((Number) item.get("unitPrice")).doubleValue());
                        return dto;
                    })
                    .collect(java.util.stream.Collectors.toList());

            Order order = orderService.createOrderFromPayment(userId, addressId, selectedItems, shippingFee, voucherId,
                    voucherDiscount);

            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                    "message", "Order created successfully from payment",
                    "orderId", order.getId(),
                    "status", order.getOrderStatus().name()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "Failed to create order: " + e.getMessage()));
        }
    }

    @PostMapping("/cancel/{orderId}")
    public ResponseEntity<Order> cancelOrder(@PathVariable String orderId,
            @RequestParam(required = false) String reason) {
        Order order = orderService.cancelOrder(orderId, reason);
        if (order != null) {
            // Send notification to user
            try {
                // Notif logic here
            } catch (Exception e) {
                e.printStackTrace();
            }
            return ResponseEntity.ok(order);
        }
        return ResponseEntity.badRequest().build();
    }

    @PostMapping("/return/{orderId}")
    public ResponseEntity<Order> returnOrder(@PathVariable String orderId,
            @RequestParam(required = false) String reason) {
        Order order = orderService.returnOrder(orderId, reason);
        if (order != null) {
            return ResponseEntity.ok(order);
        }
        return ResponseEntity.badRequest().build();
    }

    @GetMapping("/shop-owner/dashboard-stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats(HttpServletRequest request) {
        try {
            String shopOwnerId = jwtUtil.ExtractUserId(request);
            Map<String, Object> stats = orderService.getShopStats(shopOwnerId);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }
}