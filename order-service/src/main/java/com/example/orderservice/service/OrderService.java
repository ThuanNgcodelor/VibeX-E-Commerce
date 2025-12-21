package com.example.orderservice.service;

import org.springframework.data.domain.Page;
import com.example.orderservice.dto.AddressDto;
import com.example.orderservice.dto.FrontendOrderRequest;
import com.example.orderservice.dto.UpdateOrderRequest;
import com.example.orderservice.model.Order;
import jakarta.servlet.http.HttpServletRequest;

import java.util.List;

public interface OrderService {
    com.example.orderservice.dto.AnalyticsDto getAnalytics(String shopOwnerId); //
    Order returnOrder(String orderId, String reason);//

    java.util.Map<String, Object> getShopStats(String shopOwnerId);//


    Page<Order> getOrdersByShopOwner(String shopOwnerId, List<String> status, Integer pageNo, Integer pageSize);
    List<Order> getOrdersByShopOwner(String shopOwnerId, String status);

    Order getOrderById(String orderId);
    List<Order> getUserOrders(String userId);
    // CRUD methods
    List<Order> getAllOrders(String status);
    Order updateOrder(String orderId, UpdateOrderRequest request);
    Order updateOrderStatus(String orderId, String status);
    void deleteOrder(String orderId);
    List<Order> searchOrders(String userId, String status, String startDate, String endDate);
    // Address methods
    List<AddressDto> getUserAddresses(HttpServletRequest request);
    AddressDto getAddressById(String addressId);
    // Frontend order creation
    void orderByKafka(FrontendOrderRequest orderRequest, HttpServletRequest request);
    Order createOrderFromPayment(String userId, String addressId, List<com.example.orderservice.dto.SelectedItemDto> selectedItems, java.math.BigDecimal shippingFee, String voucherId, Double voucherDiscount);
    Order cancelOrder(String orderId,String reason);
    void rollbackOrderStock(String orderId);
    // Create shipping order via GHN when shop owner confirms
    void createShippingOrderForOrder(String orderId);
    // Handle GHN status update (simulate / webhook)
    void handleGhnStatus(String ghnOrderCode, String status);
    // Handle location+status updates (dev webhook / carrier)
    void handleLocationUpdate(String ghnOrderCode, String status, Double lat, Double lng, String shipperId, String note, String timestamp);
    // Client confirms receipt -> COMPLETE
    Order confirmOrder(String orderId);
}