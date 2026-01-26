package com.example.orderservice.service;

import com.example.orderservice.dto.SelectedItemDto;
import org.springframework.data.domain.Page;
import com.example.orderservice.dto.AddressDto;
import com.example.orderservice.dto.FrontendOrderRequest;
import com.example.orderservice.dto.UpdateOrderRequest;
import com.example.orderservice.model.Order;
import jakarta.servlet.http.HttpServletRequest;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public interface OrderService {
        com.example.orderservice.dto.AnalyticsDto getAnalytics(String shopOwnerId, java.time.LocalDate startDate,
                        java.time.LocalDate endDate);

        byte[] exportAnalytics(String shopOwnerId, java.time.LocalDate startDate, java.time.LocalDate endDate);

        Order returnOrder(String orderId, String reason);

        java.util.Map<String, Object> getShopStats(String shopOwnerId);

        java.util.Map<String, Object> getShopStats(String shopOwnerId, java.time.LocalDate startDate,
                        java.time.LocalDate endDate);

        Page<Order> getOrdersByShopOwner(String shopOwnerId, List<String> status, Integer pageNo, Integer pageSize);

        List<Order> getOrdersByShopOwner(String shopOwnerId, String status);

        Order getOrderById(String orderId);

        List<Order> getUserOrders(String userId);

        Order updateOrder(String orderId, UpdateOrderRequest request);

        Order updateOrderStatus(String orderId, String status);

        // Address methods
        List<AddressDto> getUserAddresses(HttpServletRequest request);

        AddressDto getAddressById(String addressId);

        // Frontend order creation
        void orderByKafka(FrontendOrderRequest orderRequest, String userId);

        /**
         * Tạo order từ payment service với raw Map data
         * Xử lý parsing và conversion trong Service thay vì Controller
         */
        Order createOrderFromPaymentData(Map<String, Object> orderData);

        Order createOrderFromPayment(String userId, String addressId,
                        List<SelectedItemDto> selectedItems, BigDecimal shippingFee,
                        String voucherId, Double voucherDiscount,
                        String platformVoucherCode, Double platformVoucherDiscount,
                        boolean useCoin);

        Order createOrderFromWallet(FrontendOrderRequest request, String userId);

        Order cancelOrder(String orderId, String reason);

        void rollbackOrderStock(String orderId);

        // Create shipping order via GHN when shop owner confirms
        void createShippingOrderForOrder(String orderId);

        // Handle GHN status update (simulate / webhook)
        void handleGhnStatus(String ghnOrderCode, String status);

        // Handle location+status updates (dev webhook / carrier)
        void handleLocationUpdate(String ghnOrderCode, String status, Double lat, Double lng, String shipperId,
                        String note,
                        String timestamp);

        // Client confirms receipt -> COMPLETE
        Order confirmOrder(String orderId);

        /**
         * Bulk update order status via Kafka (async processing)
         * 
         * @param shopOwnerId ID của shop owner
         * @param orderIds    Danh sách order IDs cần update
         * @param newStatus   Trạng thái mới
         * @return Map chứa accepted, rejected counts và message
         */
        Map<String, Object> bulkUpdateOrderStatus(String shopOwnerId, List<String> orderIds, String newStatus, String token);

        /**
         * Search orders by query (order ID, customer name, etc.)
         * 
         * @param shopOwnerId ID của shop owner
         * @param query       Search query
         * @return List of matching orders
         */
        List<Order> searchOrders(String shopOwnerId, String query);

        List<Object[]> getShopRevenueTrend(String shopId);

        List<Object[]> getShopOrderStatusDistribution(String shopId);

        com.example.orderservice.dto.UserOrderStatsDto getUserOrderStats(String userId);
}
