package com.example.orderservice.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.modelmapper.ModelMapper;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.example.orderservice.client.GhnApiClient;
import com.example.orderservice.client.StockServiceClient;
import com.example.orderservice.client.UserServiceClient;
import com.example.orderservice.dto.AddressDto;
import com.example.orderservice.dto.BulkUpdateStatusRequest;
import com.example.orderservice.dto.CalculateShippingFeeRequest;
import com.example.orderservice.dto.FrontendOrderRequest;
import com.example.orderservice.dto.GhnAvailableServicesResponse;
import com.example.orderservice.dto.OrderDto;
import com.example.orderservice.dto.OrderItemDto;
import com.example.orderservice.dto.ProductDto;
import com.example.orderservice.dto.ShopOwnerDto;
import com.example.orderservice.dto.SizeDto;
import com.example.orderservice.dto.UpdateOrderRequest;
import com.example.orderservice.jwt.JwtUtil;
import com.example.orderservice.model.Order;
import com.example.orderservice.repository.ShippingOrderRepository;
import com.example.orderservice.service.OrderService;

import jakarta.servlet.http.HttpServletRequest;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

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
    private final com.example.orderservice.service.TrackingEmitterService trackingEmitterService;

    private OrderDto enrichOrderDto(Order order) {
        OrderDto dto = modelMapper.map(order, OrderDto.class);

        // CRITICAL FIX: Explicit Enum to String conversion for orderStatus
        // ModelMapper may not correctly convert OrderStatus Enum to String
        if (order.getOrderStatus() != null) {
            dto.setOrderStatus(order.getOrderStatus().name());
        }

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

                    // Set recipient name - FIX UNKNOWN
                    if (address.getRecipientName() != null && !address.getRecipientName().isBlank()) {
                        dto.setRecipientName(address.getRecipientName());
                    } else if (order.getRecipientName() != null) {
                        // Fallback to Order entity if address fetch fails or has no name
                        dto.setRecipientName(order.getRecipientName());
                    }

                    // Build full address string
                    StringBuilder fullAddressBuilder = new StringBuilder();
                    if (address.getStreetAddress() != null && !address.getStreetAddress().trim().isEmpty()) {
                        fullAddressBuilder.append(address.getStreetAddress());
                    }

                    if (address.getWardName() != null && !address.getWardName().trim().isEmpty()) {
                        if (fullAddressBuilder.length() > 0)
                            fullAddressBuilder.append(", ");
                        fullAddressBuilder.append(address.getWardName());
                    }

                    // Add District
                    if (address.getDistrictName() != null && !address.getDistrictName().trim().isEmpty()) {
                        if (fullAddressBuilder.length() > 0)
                            fullAddressBuilder.append(", ");
                        fullAddressBuilder.append(address.getDistrictName());
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

        // Map voucher discount from BigDecimal to Double
        if (order.getVoucherDiscount() != null) {
            dto.setVoucherDiscount(order.getVoucherDiscount().doubleValue());
        }
        if (order.getVoucherId() != null) {
            dto.setVoucherId(order.getVoucherId());
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
            // Only COD and WALLET use this endpoint; VNPay/Card should go through
            // payment-service
            if ("VNPAY".equalsIgnoreCase(paymentMethod) || "CARD".equalsIgnoreCase(paymentMethod)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                        "error", "USE_PAYMENT_SERVICE",
                        "message", "For VNPay/Card, please initiate via payment-service."));
            }

            // Extract UserID here to avoid Service having to call StockService
            String userId = jwtUtil.ExtractUserId(httpRequest);

            if ("WALLET".equalsIgnoreCase(paymentMethod)) {
                // Synchronous wallet payment
                Order order = orderService.createOrderFromWallet(request, userId);

                // Return success with Order ID (as it's already PAID)
                return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                        "message", "Order paid via Wallet successfully.",
                        "status", "CONFIRMED", // or PAID
                        "orderId", order.getId()));
            }

            // Default COD path (Async via Kafka)
            orderService.orderByKafka(request, userId);

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

    @GetMapping("/internal/stats/shop/{shopId}")
    public ResponseEntity<Map<String, Object>> getShopOrderStats(@PathVariable String shopId) {
        return ResponseEntity.ok(orderService.getShopStats(shopId));
    }

    @GetMapping("/internal/revenue-trend/shop/{shopId}")
    public ResponseEntity<List<java.util.Map<String, Object>>> getShopRevenueTrend(@PathVariable String shopId) {
        List<Object[]> stats = orderService.getShopRevenueTrend(shopId);
        List<java.util.Map<String, Object>> result = stats.stream().map(row -> {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("month", row[0]);
            map.put("year", row[1]);
            map.put("revenue", row[2]);
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/internal/status-distribution/shop/{shopId}")
    public ResponseEntity<List<java.util.Map<String, Object>>> getShopOrderStatusDistribution(
            @PathVariable String shopId) {
        List<Object[]> stats = orderService.getShopOrderStatusDistribution(shopId);
        List<java.util.Map<String, Object>> result = stats.stream().map(row -> {
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("status", row[0]);
            map.put("count", row[1]);
            return map;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
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
            @RequestBody CalculateShippingFeeRequest request) {
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

            // 3. Get shop owner address
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
            Integer serviceId = null; // NEW: Capture serviceId

            try {
                GhnAvailableServicesResponse servicesResponse = ghnApiClient.getAvailableServices(
                        shopOwner.getDistrictId(),
                        customerAddress.getDistrictId());

                if (servicesResponse != null && servicesResponse.getCode() == 200
                        && servicesResponse.getData() != null && !servicesResponse.getData().isEmpty()) {

                    // Ưu tiên service_type_id = 2 (Hàng nhẹ)
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
                        serviceId = preferredService.getServiceId();
                    } else if (fallbackService != null) {
                        serviceTypeId = fallbackService.getServiceTypeId();
                        serviceId = fallbackService.getServiceId();
                    }
                }
            } catch (Exception e) {
                log.warn("[GHN] Failed to get available services for fee calculation: {}", e.getMessage());
            }

            // Calculate total value for insurance (Required by GHN)
            int insuranceValue = 0;
            if (request.getSelectedItems() != null) {
                for (com.example.orderservice.dto.SelectedItemDto item : request.getSelectedItems()) {
                    if (item.getUnitPrice() != null) {
                        insuranceValue += item.getUnitPrice() * item.getQuantity();
                    }
                }
            }
            
            // GHN require insurance_value <= 5000000 for some services, but let's pass real value first
            // If > 5000000, maybe capped or handled by specific service types, but 0 or null is invalid.
            // Note: max insurance value depends on contract, but typically < 5000000 is safe for basic accounts.
            
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
                    .serviceId(serviceId) // NEW: Required field
                    .serviceTypeId(serviceTypeId) // Use available service type
                    .insuranceValue(insuranceValue) // NEW: Required field
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
            log.error("Calculate shipping fee error: {}", e.getMessage());
            
            // Check if it's a GHN API error (which wraps 400 Bad Request)
            if (e.getMessage() != null && e.getMessage().contains("GHN")) {
               return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "GHN_API_ERROR",
                    "message", e.getMessage()));
            }
            
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
    public ResponseEntity<com.example.orderservice.dto.AnalyticsDto> getAnalytics(
            HttpServletRequest request,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate startDate,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate endDate) {
        String shopOwnerId = jwtUtil.ExtractUserId(request);
        return ResponseEntity.ok(orderService.getAnalytics(shopOwnerId, startDate, endDate));
    }

    @GetMapping("/shop-owner/analytics/export")
    public ResponseEntity<byte[]> exportAnalytics(
            HttpServletRequest request,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate startDate,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate endDate) {
        String shopOwnerId = jwtUtil.ExtractUserId(request);
        byte[] csvData = orderService.exportAnalytics(shopOwnerId, startDate, endDate);

        return ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=sales_report.csv")
                .header(org.springframework.http.HttpHeaders.CONTENT_TYPE, "text/csv")
                .body(csvData);
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

            // If shop owner confirms, create GHN shipping order
            if ("CONFIRMED".equalsIgnoreCase(status)) {
                try {
                    orderService.createShippingOrderForOrder(orderId);
                } catch (Exception e) {
                    log.error("Failed to create shipping order on CONFIRMED: {}", e.getMessage());
                }
            }

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
     * Search orders by query (order ID)
     */
    @GetMapping("/shop-owner/orders/search")
    public ResponseEntity<List<OrderDto>> searchOrders(
            @RequestParam String query,
            HttpServletRequest request) {
        try {
            String shopOwnerId = jwtUtil.ExtractUserId(request);
            List<Order> orders = orderService.searchOrders(shopOwnerId, query);
            List<OrderDto> orderDtos = enrichOrderDtos(orders);
            return ResponseEntity.ok(orderDtos);
        } catch (Exception e) {
            log.error("[SEARCH] Error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Get all order IDs matching filter (for Select All Across Pages)
     */
    @GetMapping("/shop-owner/orders/all-ids")
    public ResponseEntity<List<String>> getAllOrderIds(
            @RequestParam(required = false) List<String> status,
            HttpServletRequest request) {
        try {
            String shopOwnerId = jwtUtil.ExtractUserId(request);
            // Use existing method with large page size
            Page<Order> ordersPage = orderService.getOrdersByShopOwner(shopOwnerId, status, 1, 10000);
            List<String> orderIds = ordersPage.getContent().stream()
                    .map(Order::getId)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(orderIds);
        } catch (Exception e) {
            log.error("[GET-ALL-IDS] Error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Bulk update order status via Kafka (async processing)
     * Delegate to service for business logic
     */
    @PostMapping("/shop-owner/orders/bulk-update-status")
    public ResponseEntity<?> bulkUpdateOrderStatus(
            @RequestBody BulkUpdateStatusRequest request,
            HttpServletRequest httpRequest) {
        try {
            String shopOwnerId = jwtUtil.ExtractUserId(httpRequest);

            Map<String, Object> result = orderService.bulkUpdateOrderStatus(
                    shopOwnerId,
                    request.getOrderIds(),
                    request.getNewStatus());

            return ResponseEntity.accepted().body(result);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            if (e.getMessage().contains("No products found")) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
            }
            log.error("[BULK-UPDATE] Error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "error", "Failed to process bulk update: " + e.getMessage()));
        }
    }

    /**
     * Simulate GHN status update (DEV only)
     */
    @PostMapping("/simulate-ghn-status/{ghnOrderCode}")
    public ResponseEntity<?> simulateGhnStatus(@PathVariable String ghnOrderCode,
            @RequestBody Map<String, String> payload) {
        try {
            String status = payload != null ? payload.get("status") : null;
            if (status == null || status.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "status is required"));
            }
            orderService.handleGhnStatus(ghnOrderCode, status);
            return ResponseEntity
                    .ok(Map.of("message", "GHN status updated", "ghnOrderCode", ghnOrderCode, "status", status));
        } catch (Exception e) {
            log.error("simulateGhnStatus error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get tracking info by GHN order code
     */
    @GetMapping("/tracking/{ghnOrderCode}")
    public ResponseEntity<?> getTrackingByGhnCode(@PathVariable String ghnOrderCode) {
        try {
            return ResponseEntity.ok(shippingOrderRepository.findByGhnOrderCode(ghnOrderCode).orElse(null));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Client confirms receipt -> set order to COMPLETED (only if DELIVERED)
     */
    @PostMapping("/confirm/{orderId}")
    public ResponseEntity<?> confirmReceipt(@PathVariable String orderId) {
        try {
            Order updated = orderService.confirmOrder(orderId);
            OrderDto dto = enrichOrderDto(updated);
            return ResponseEntity.ok(dto);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
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
            Order order = orderService.createOrderFromPaymentData(orderData);

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

    /**
     * SSE stream for order tracking. Client opens EventSource to receive tracking
     * events.
     */
    @GetMapping("/track/{orderId}/stream")
    public SseEmitter streamOrderTracking(@PathVariable String orderId) {
        return trackingEmitterService.subscribe(orderId);
    }

    /**
     * Get ShippingOrder by orderId (dev convenience)
     */
    @GetMapping("/shipping/{orderId}")
    public ResponseEntity<?> getShippingByOrderId(@PathVariable String orderId) {
        try {
            return ResponseEntity.ok(shippingOrderRepository.findByOrderId(orderId).orElse(null));
        } catch (Exception e) {
            log.error("getShippingByOrderId error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get enriched Order by ID for client view
     */
    @GetMapping("/{orderId}")
    public ResponseEntity<OrderDto> getOrderByIdForClient(@PathVariable String orderId) {
        return getOrderDtoResponseEntity(orderId);
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

    // ============ Internal Endpoints for AI Chat Service ============

    /**
     * Get orders by userId - for AI chat to query user's orders
     * Internal endpoint - no authentication required (called from stock-service)
     */
    @GetMapping("/internal/user-orders/{userId}")
    public ResponseEntity<List<OrderDto>> getOrdersByUserIdInternal(@PathVariable String userId) {
        try {
            List<Order> orders = orderService.getUserOrders(userId);
            List<OrderDto> orderDtos = enrichOrderDtos(orders);
            return ResponseEntity.ok(orderDtos);
        } catch (Exception e) {
            log.error("Error getting orders for userId {}: {}", userId, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Get order by ID - for AI chat to query order details
     * Internal endpoint - no authentication required (called from stock-service)
     */
    @GetMapping("/internal/orders/{orderId}")
    public ResponseEntity<OrderDto> getOrderByIdInternal(@PathVariable String orderId) {
        return getOrderDtoResponseEntity(orderId);
    }

    @NonNull
    private ResponseEntity<OrderDto> getOrderDtoResponseEntity(@PathVariable String orderId) {
        try {
            Order order = orderService.getOrderById(orderId);
            OrderDto dto = enrichOrderDto(order);
            return ResponseEntity.ok(dto);
        } catch (RuntimeException e) {
            if (e.getMessage().toLowerCase().contains("not found")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    // ==================== INTERNAL SHOP OWNER ENDPOINTS (for AI Chat)
    // ====================

    /**
     * Get shop owner orders (internal)
     */
    @GetMapping("/internal/shop-owner/{shopOwnerId}/orders")
    public ResponseEntity<List<OrderDto>> getShopOwnerOrdersInternal(
            @PathVariable String shopOwnerId,
            @RequestParam(required = false) String status) {
        try {
            List<Order> orders = orderService.getOrdersByShopOwner(shopOwnerId, status);
            List<OrderDto> dtos = orders.stream()
                    .map(this::enrichOrderDto)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(dtos);
        } catch (Exception e) {
            log.error("Error getting shop owner orders: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Get shop owner order statistics (internal)
     */
    @GetMapping("/internal/shop-owner/{shopOwnerId}/order-stats")
    public ResponseEntity<Map<String, Object>> getShopOwnerOrderStatsInternal(
            @PathVariable String shopOwnerId) {
        try {
            Map<String, Object> stats = orderService.getShopStats(shopOwnerId);

            // Build statusCounts map
            Map<String, Long> statusCounts = new HashMap<>();
            statusCounts.put("PENDING", ((Number) stats.getOrDefault("pending", 0)).longValue());
            statusCounts.put("CONFIRMED", ((Number) stats.getOrDefault("processing", 0)).longValue());
            statusCounts.put("SHIPPED", ((Number) stats.getOrDefault("shipped", 0)).longValue());
            statusCounts.put("COMPLETED", ((Number) stats.getOrDefault("completed", 0)).longValue());
            statusCounts.put("CANCELLED", ((Number) stats.getOrDefault("cancelled", 0)).longValue());
            statusCounts.put("RETURNED", ((Number) stats.getOrDefault("returned", 0)).longValue());

            long total = statusCounts.values().stream().mapToLong(Long::longValue).sum();

            Map<String, Object> result = new HashMap<>();
            result.put("statusCounts", statusCounts);
            result.put("total", total);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error getting shop owner order stats: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    /**
     * Bulk confirm all pending orders (internal)
     */
    @PostMapping("/internal/shop-owner/{shopOwnerId}/bulk-confirm")
    public ResponseEntity<Map<String, Object>> bulkConfirmPendingOrdersInternal(
            @PathVariable String shopOwnerId) {
        try {
            // Get all pending orders
            List<Order> pendingOrders = orderService.getOrdersByShopOwner(shopOwnerId, "PENDING");
            int totalPending = pendingOrders.size();

            if (totalPending == 0) {
                return ResponseEntity.ok(Map.of(
                        "totalPending", 0,
                        "successCount", 0,
                        "failCount", 0,
                        "message", "Không có đơn hàng nào đang chờ xác nhận."));
            }

            // Use bulk update via Kafka
            List<String> orderIds = pendingOrders.stream()
                    .map(Order::getId)
                    .collect(Collectors.toList());

            Map<String, Object> result = orderService.bulkUpdateOrderStatus(
                    shopOwnerId, orderIds, "CONFIRMED");

            result.put("totalPending", totalPending);
            result.put("successCount", result.get("accepted"));
            result.put("failCount", result.get("rejected"));

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Error bulk confirming orders: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "totalPending", 0,
                    "successCount", 0,
                    "failCount", 0,
                    "message", "Lỗi: " + e.getMessage()));
        }
    }
}
