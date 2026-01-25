package com.example.orderservice.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FrontendOrderRequest {
    @NotEmpty(message = "Selected items cannot be empty")
    private List<SelectedItemDto> selectedItems;

    @NotNull(message = "Address ID is required")
    private String addressId;

    private String paymentMethod; // VNPAY, CARD, COD

    // Voucher fields
    private String voucherId;
    private Double voucherDiscount;

    // Platform voucher fields
    private String platformVoucherCode;
    private Double platformVoucherDiscount;

    // Shipping fee
    private Double shippingFee;

    // Per-shop shipping fees (NEW for accurate multi-shop shipping)
    private Map<String, BigDecimal> shopShippingFees;

    // Temporary order ID for confirming Flash Sale reservations
    private String tempOrderId;

    private boolean useCoin;
}