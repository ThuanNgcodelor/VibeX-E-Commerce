package com.example.userservice.model;

import com.example.userservice.enums.SubscriptionType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "subscription_plans")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class SubscriptionPlan extends BaseEntity {

    @Column(name = "code", unique = true, nullable = false, length = 50)
    private String code; // FREESHIP_XTRA, VOUCHER_XTRA, BOTH...

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "subscription_type", nullable = false)
    private SubscriptionType subscriptionType;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "display_order")
    @Builder.Default
    private Integer displayOrder = 0;

    @Column(name = "color_hex")
    private String colorHex;

    @Column(name = "icon")
    private String icon;

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

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SubscriptionPlanPricing> pricing = new ArrayList<>();

    @OneToMany(mappedBy = "plan", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SubscriptionPlanFeature> features = new ArrayList<>();
}

