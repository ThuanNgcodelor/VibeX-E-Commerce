package com.example.userservice.model;

import com.example.userservice.enums.AdminWalletEntryType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity(name = "admin_wallet_entry")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Builder
public class AdminWalletEntry extends BaseEntity {

    @Column(nullable = false)
    private String adminWalletId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AdminWalletEntryType type; // COMMISSION, SUBSCRIPTION_REVENUE

    @Column(nullable = false)
    private BigDecimal amount;

    private String sourceId; // Order ID or Subscription ID

    @Lob
    private String description;

    @Column(nullable = false)
    private BigDecimal balanceBefore;

    @Column(nullable = false)
    private BigDecimal balanceAfter;
}
