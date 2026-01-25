package com.example.orderservice.request;

import com.example.orderservice.dto.SelectedItemDto;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckOutKafkaRequest {
    private String userId;
    private String tempOrderId; // Temporary order ID for Pre-Reserve Pattern
    private String addressId;
    @NotEmpty(message = "Selected items cannot be empty")
    private List<SelectedItemDto> selectedItems;
    private String cartId;
    private String paymentMethod; // COD, VNPAY, CARD
    private String voucherId;
    private Double voucherDiscount;
    private Map<String, java.math.BigDecimal> shopShippingFees; // Per-shop shipping fees
    private Double shippingFee;

    private boolean useCoin;
    private Long coinsUsed;
    private BigDecimal coinDiscount;

    private String platformVoucherCode;
    private Double platformVoucherDiscount;
}
