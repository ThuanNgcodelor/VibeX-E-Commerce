package com.example.paymentservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentEvent {
    private String paymentId;
    private String txnRef;
    private String orderId; // May be null if order not created yet
    private String status; // PAID, FAILED
    private BigDecimal amount;
    private String currency;
    private String method; // VNPAY, CARD, etc.
    private String bankCode;
    private String cardType;
    private String gatewayTxnNo;
    private String responseCode;
    
    // Order data for creating order after payment success (if orderId is null)
    private String userId;
    private String addressId;
    private String orderDataJson; // JSON string of selectedItems
    
    // Platform voucher fields
    private String platformVoucherCode;
    private Double platformVoucherDiscount;
    
    private Instant timestamp;
}


