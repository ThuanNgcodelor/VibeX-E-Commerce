package com.example.stockservice.service.ai;

import com.example.stockservice.client.OrderServiceClient;
import com.example.stockservice.dto.OrderDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Description;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Order Tools cho AI Function Calling
 * Cho phép AI tra cứu đơn hàng của người dùng
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OrderTools {

    private final OrderServiceClient orderServiceClient;

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    // ============ Request/Response Records ============

    public record GetMyOrdersRequest(String userId) {
    }

    public record GetMyOrdersResponse(List<OrderSummary> orders, int total, String message) {
    }

    public record GetOrderStatusRequest(String orderId) {
    }

    public record GetOrderStatusResponse(OrderDetail order, boolean found, String message) {
    }

    public record OrderSummary(
            String orderId,
            String status,
            String statusDisplay,
            String totalAmount,
            String createdAt,
            int itemCount) {
    }

    public record OrderDetail(
            String orderId,
            String status,
            String statusDisplay,
            String totalAmount,
            String shippingFee,
            String createdAt,
            String address,
            String phone,
            List<OrderItemInfo> items) {
    }

    public record OrderItemInfo(
            String productName,
            String sizeName,
            int quantity,
            String unitPrice) {
    }

    // ============ Tool Functions ============

    /**
     * Lấy danh sách đơn hàng của user
     */
    @Description("Get list of user's orders. Use when user asks about their orders, order history.")
    public Function<GetMyOrdersRequest, GetMyOrdersResponse> getMyOrders() {
        return request -> {
            log.info("Tool called: getMyOrders(userId={})", request.userId());

            if (request.userId() == null || request.userId().isBlank()) {
                return new GetMyOrdersResponse(List.of(), 0,
                        "Bạn cần đăng nhập để xem đơn hàng.");
            }

            try {
                ResponseEntity<List<OrderDto>> response = orderServiceClient.getOrdersByUserId(request.userId());

                if (response.getBody() == null || response.getBody().isEmpty()) {
                    return new GetMyOrdersResponse(List.of(), 0,
                            "Bạn chưa có đơn hàng nào.");
                }

                List<OrderSummary> summaries = response.getBody().stream()
                        .limit(20) // Chỉ lấy 20 đơn gần nhất
                        .map(this::toOrderSummary)
                        .collect(Collectors.toList());

                // Build formatted message with full details
                StringBuilder message = new StringBuilder();
                message.append("📦 **Đơn hàng của bạn** (").append(response.getBody().size()).append(" đơn):\n\n");
                for (OrderSummary order : summaries) {
                    message.append("• Đơn hàng: **").append(order.orderId()).append("**\n");
                    message.append("  - Trạng thái: ").append(order.statusDisplay()).append("\n");
                    message.append("  - Tổng tiền: **").append(order.totalAmount()).append("**\n");
                    message.append("  - Số sản phẩm: ").append(order.itemCount()).append("\n");
                    message.append("  - Ngày đặt: ").append(order.createdAt()).append("\n\n");
                }

                return new GetMyOrdersResponse(
                        summaries,
                        response.getBody().size(),
                        message.toString());

            } catch (Exception e) {
                log.error("Error getting orders: ", e);
                return new GetMyOrdersResponse(List.of(), 0,
                        "Không thể lấy danh sách đơn hàng. Vui lòng thử lại sau.");
            }
        };
    }

    /**
     * Lấy chi tiết trạng thái đơn hàng
     */
    @Description("Get order status and details by order ID. Use when user asks about a specific order status.")
    public Function<GetOrderStatusRequest, GetOrderStatusResponse> getOrderStatus() {
        return request -> {
            log.info("Tool called: getOrderStatus(orderId={})", request.orderId());

            if (request.orderId() == null || request.orderId().isBlank()) {
                return new GetOrderStatusResponse(null, false,
                        "Vui lòng cung cấp mã đơn hàng.");
            }

            try {
                ResponseEntity<OrderDto> response = orderServiceClient.getOrderById(request.orderId());

                if (response.getBody() == null) {
                    return new GetOrderStatusResponse(null, false,
                            "Không tìm thấy đơn hàng với mã: " + request.orderId());
                }

                OrderDetail detail = toOrderDetail(response.getBody());
                return new GetOrderStatusResponse(detail, true,
                        "Đã tìm thấy đơn hàng");

            } catch (Exception e) {
                log.error("Error getting order: ", e);
                return new GetOrderStatusResponse(null, false,
                        "Không tìm thấy đơn hàng hoặc có lỗi xảy ra.");
            }
        };
    }

    // ============ NEW: Filter Orders by Payment Method ============

    public record GetOrdersByPaymentRequest(String userId, String paymentMethod) {
    }

    public record GetOrdersByPaymentResponse(List<OrderSummary> orders, int total, String message) {
    }

    /**
     * Lọc đơn hàng theo phương thức thanh toán
     */
    @Description("Filter orders by payment method (VNPAY, COD, WALLET). Use when user asks about orders paid with specific method.")
    public Function<GetOrdersByPaymentRequest, GetOrdersByPaymentResponse> getOrdersByPayment() {
        return request -> {
            log.info("=== Tool called: getOrdersByPayment(userId={}, paymentMethod={}) ===",
                    request.userId(), request.paymentMethod());

            if (request.userId() == null || request.userId().isBlank()) {
                return new GetOrdersByPaymentResponse(List.of(), 0,
                        "Bạn cần đăng nhập để xem đơn hàng.");
            }

            try {
                ResponseEntity<List<OrderDto>> response = orderServiceClient.getOrdersByUserId(request.userId());

                if (response.getBody() == null || response.getBody().isEmpty()) {
                    return new GetOrdersByPaymentResponse(List.of(), 0,
                            "Bạn chưa có đơn hàng nào.");
                }

                String paymentFilter = request.paymentMethod() != null ? request.paymentMethod().toUpperCase() : "";

                List<OrderDto> filteredOrders = response.getBody().stream()
                        .filter(order -> {
                            if (paymentFilter.isEmpty())
                                return true;
                            String pm = order.getPaymentMethod();
                            return pm != null && pm.toUpperCase().contains(paymentFilter);
                        })
                        .limit(10)
                        .collect(Collectors.toList());

                List<OrderSummary> summaries = filteredOrders.stream()
                        .map(this::toOrderSummary)
                        .collect(Collectors.toList());

                // Build formatted message
                StringBuilder message = new StringBuilder();
                String paymentDisplay = translatePaymentMethod(paymentFilter);
                if (summaries.isEmpty()) {
                    message.append("Không tìm thấy đơn hàng thanh toán bằng ").append(paymentDisplay);
                } else {
                    message.append("Tìm thấy ").append(summaries.size())
                            .append(" đơn hàng thanh toán bằng ").append(paymentDisplay).append(":\n\n");
                    for (OrderSummary s : summaries) {
                        message.append("• Đơn hàng: ").append(s.orderId()).append("\n");
                        message.append("  - Trạng thái: ").append(s.statusDisplay()).append("\n");
                        message.append("  - Tổng tiền: ").append(s.totalAmount()).append("\n");
                        message.append("  - Ngày đặt: ").append(s.createdAt()).append("\n\n");
                    }
                }

                return new GetOrdersByPaymentResponse(summaries, summaries.size(), message.toString());

            } catch (Exception e) {
                log.error("Error filtering orders: ", e);
                return new GetOrdersByPaymentResponse(List.of(), 0,
                        "Không thể lọc đơn hàng. Vui lòng thử lại sau.");
            }
        };
    }

    // ============ NEW: Spending Statistics ============

    public record GetSpendingStatsRequest(String userId, String period) {
    } // period: "week", "month", "all"

    public record GetSpendingStatsResponse(
            String totalSpent,
            int orderCount,
            String avgOrderValue,
            String period,
            String message) {
    }

    /**
     * Tính tổng chi tiêu theo thời gian
     */
    @Description("Calculate spending statistics. Use when user asks about total spent, chi tiêu tháng này, tuần này, tổng đã chi.")
    public Function<GetSpendingStatsRequest, GetSpendingStatsResponse> getSpendingStats() {
        return request -> {
            log.info("=== Tool called: getSpendingStats(userId={}, period={}) ===",
                    request.userId(), request.period());

            if (request.userId() == null || request.userId().isBlank()) {
                return new GetSpendingStatsResponse("0₫", 0, "0₫", request.period(),
                        "Bạn cần đăng nhập để xem thống kê chi tiêu.");
            }

            try {
                ResponseEntity<List<OrderDto>> response = orderServiceClient.getOrdersByUserId(request.userId());

                if (response.getBody() == null || response.getBody().isEmpty()) {
                    return new GetSpendingStatsResponse("0₫", 0, "0₫", request.period(),
                            "Bạn chưa có đơn hàng nào.");
                }

                java.time.LocalDateTime now = java.time.LocalDateTime.now();
                String period = request.period() != null ? request.period().toLowerCase() : "all";

                List<OrderDto> filteredOrders = response.getBody().stream()
                        .filter(order -> {
                            // Only count completed/delivered orders
                            String status = order.getOrderStatus();
                            if (status == null)
                                return false;
                            status = status.toUpperCase();
                            if (!status.equals("COMPLETED") && !status.equals("DELIVERED"))
                                return false;

                            if (order.getCreatedAt() == null)
                                return false;

                            switch (period) {
                                case "week":
                                    return order.getCreatedAt().isAfter(now.minusWeeks(1));
                                case "month":
                                    return order.getCreatedAt().isAfter(now.minusMonths(1));
                                default: // "all"
                                    return true;
                            }
                        })
                        .collect(Collectors.toList());

                double totalSpent = filteredOrders.stream()
                        .mapToDouble(o -> o.getTotalAmount() != null ? o.getTotalAmount() : 0)
                        .sum();

                int orderCount = filteredOrders.size();
                double avgValue = orderCount > 0 ? totalSpent / orderCount : 0;

                String periodDisplay = switch (period) {
                    case "week" -> "tuần này";
                    case "month" -> "tháng này";
                    default -> "tất cả thời gian";
                };

                StringBuilder message = new StringBuilder();
                message.append("📊 **Thống kê chi tiêu ").append(periodDisplay).append(":**\n\n");
                message.append("• Tổng chi tiêu: **").append(formatPrice(totalSpent)).append("**\n");
                message.append("• Số đơn hàng: **").append(orderCount).append(" đơn**\n");
                message.append("• Trung bình mỗi đơn: **").append(formatPrice(avgValue)).append("**\n");

                return new GetSpendingStatsResponse(
                        formatPrice(totalSpent),
                        orderCount,
                        formatPrice(avgValue),
                        periodDisplay,
                        message.toString());

            } catch (Exception e) {
                log.error("Error calculating spending stats: ", e);
                return new GetSpendingStatsResponse("0₫", 0, "0₫", request.period(),
                        "Không thể tính thống kê chi tiêu. Vui lòng thử lại sau.");
            }
        };
    }

    // ============ Helper Methods ============

    private OrderSummary toOrderSummary(OrderDto order) {
        return new OrderSummary(
                order.getId(),
                order.getOrderStatus(),
                translateStatus(order.getOrderStatus()),
                formatPrice(order.getTotalAmount()),
                order.getCreatedAt() != null ? order.getCreatedAt().format(DATE_FORMAT) : "N/A",
                order.getOrderItems() != null ? order.getOrderItems().size() : 0);
    }

    private OrderDetail toOrderDetail(OrderDto order) {
        List<OrderItemInfo> items = order.getOrderItems() != null
                ? order.getOrderItems().stream()
                        .map(item -> new OrderItemInfo(
                                item.getProductName() != null ? item.getProductName() : "Sản phẩm",
                                item.getSizeName(),
                                item.getQuantity(),
                                formatPrice(item.getUnitPrice())))
                        .collect(Collectors.toList())
                : List.of();

        return new OrderDetail(
                order.getId(),
                order.getOrderStatus(),
                translateStatus(order.getOrderStatus()),
                formatPrice(order.getTotalAmount()),
                formatPrice(order.getShippingFee()),
                order.getCreatedAt() != null ? order.getCreatedAt().format(DATE_FORMAT) : "N/A",
                order.getFullAddress(),
                order.getRecipientPhone(),
                items);
    }

    private String translateStatus(String status) {
        if (status == null)
            return "Không xác định";
        return switch (status.toUpperCase()) {
            case "PENDING" -> "Chờ xác nhận";
            case "CONFIRMED" -> "Đã xác nhận";
            case "PROCESSING" -> "Đang xử lý";
            case "SHIPPED" -> "Đang giao hàng";
            case "DELIVERED" -> "Đã giao hàng";
            case "COMPLETED" -> "Hoàn thành";
            case "CANCELLED" -> "Đã hủy";
            case "RETURNED" -> "Trả hàng/Hoàn tiền";
            default -> status;
        };
    }

    private String translatePaymentMethod(String method) {
        if (method == null)
            return "Không xác định";
        return switch (method.toUpperCase()) {
            case "VNPAY" -> "VNPay";
            case "COD" -> "Thanh toán khi nhận hàng (COD)";
            case "WALLET" -> "Ví điện tử";
            case "BANK_TRANSFER" -> "Chuyển khoản";
            default -> method;
        };
    }

    private String formatPrice(Double price) {
        if (price == null || price == 0)
            return "0₫";
        return String.format("%,.0f₫", price);
    }
}
