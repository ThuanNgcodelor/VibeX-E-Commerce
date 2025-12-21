package com.example.orderservice.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class OrderDto {
    private String id;
    private String userId;
    private String addressId;
    private Double totalPrice;
    private Double shippingFee; // Phí ship từ GHN
    private String orderStatus;
    private String notes;
    private String shippingAddress;
    private String recipientPhone;
    private String fullAddress;
    private String paymentMethod;
    private LocalDateTime createdAt;
    private LocalDateTime updateTimestamp;
    private List<OrderItemDto> orderItems;

    private String cancelReason;
    private String returnReason;
    
    // Voucher fields
    private String voucherId;
    private Double voucherDiscount;
}