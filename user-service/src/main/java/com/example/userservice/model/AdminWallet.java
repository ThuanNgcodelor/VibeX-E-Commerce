package com.example.userservice.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import lombok.*;

import java.math.BigDecimal;

@Entity(name = "admin_wallet")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class AdminWallet extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String adminId; // e.g., "SYSTEM_ADMIN"

    @Column(nullable = false)
    @Builder.Default
    private BigDecimal balance = BigDecimal.ZERO;

    @Column(nullable = false)
    @Builder.Default
    private BigDecimal totalCommission = BigDecimal.ZERO;

    @Column(nullable = false)
    @Builder.Default
    private BigDecimal totalSubscriptionRevenue = BigDecimal.ZERO;
}
