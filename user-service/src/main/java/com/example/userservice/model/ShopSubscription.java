package com.example.userservice.model;

import com.example.userservice.enums.PaymentStatus;
import com.example.userservice.enums.PlanDuration;
import com.example.userservice.enums.SubscriptionType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "shop_subscriptions",
        indexes = {
                @Index(name = "idx_shop_owner_active", columnList = "shop_owner_id, is_active")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class ShopSubscription extends BaseEntity {

    @Column(name = "shop_owner_id", nullable = false)
    private String shopOwnerId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private SubscriptionPlan plan;

    @Column(name = "plan_code", nullable = false, length = 50)
    private String planCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "subscription_type", nullable = false)
    private SubscriptionType subscriptionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "plan_duration", nullable = false)
    private PlanDuration planDuration;

    @Column(name = "price_paid", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal pricePaid = BigDecimal.ZERO;

    @Column(name = "price", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal price = BigDecimal.ZERO;

    @Column(name = "start_date", nullable = false)
    private LocalDateTime startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDateTime endDate;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "auto_renew", nullable = false)
    @Builder.Default
    private Boolean autoRenew = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status")
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    private String cancellationReason;

    @Column(name = "commission_payment_rate", precision = 5, scale = 4)
    private BigDecimal commissionPaymentRate;

    @Column(name = "commission_fixed_rate", precision = 5, scale = 4)
    private BigDecimal commissionFixedRate;

    @Column(name = "commission_freeship_rate", precision = 5, scale = 4)
    private BigDecimal commissionFreeshipRate;

    @Column(name = "commission_voucher_rate", precision = 5, scale = 4)
    private BigDecimal commissionVoucherRate;

    @Column(name = "voucher_max_per_item", precision = 15, scale = 2)
    private BigDecimal voucherMaxPerItem;

    @Column(name = "freeship_enabled")
    @Builder.Default
    private Boolean freeshipEnabled = false;

    @Column(name = "voucher_enabled")
    @Builder.Default
    private Boolean voucherEnabled = false;
}