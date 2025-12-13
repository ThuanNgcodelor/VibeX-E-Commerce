package com.example.paymentservice.model;

import com.example.paymentservice.enums.PaymentMethod;
import com.example.paymentservice.enums.PaymentStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payments")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "VARCHAR(36)")
    private String id;

    @Column(name = "order_id")
    private String orderId;

    @Column(name = "txn_ref", unique = true, nullable = false)
    private String txnRef;

    @Column(name = "amount", precision = 19, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "currency", length = 10)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "method", length = 20, nullable = false)
    private PaymentMethod method;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private PaymentStatus status;

    @Column(name = "bank_code", length = 50)
    private String bankCode;

    @Column(name = "card_type", length = 50)
    private String cardType;

    @Column(name = "gateway_txn_no", length = 100)
    private String gatewayTxnNo;

    @Column(name = "response_code", length = 10)
    private String responseCode;

    @Column(name = "message", length = 255)
    private String message;

    @Column(name = "payment_url", length = 1024)
    private String paymentUrl;

    @Column(name = "return_url", length = 1024)
    private String returnUrl;

    @Lob
    @Column(name = "raw_callback", columnDefinition = "TEXT")
    private String rawCallback;

    // Store order data temporarily before order is created
    @Lob
    @Column(name = "order_data", columnDefinition = "TEXT")
    private String orderData; // JSON string: {userId, addressId, selectedItems}

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
