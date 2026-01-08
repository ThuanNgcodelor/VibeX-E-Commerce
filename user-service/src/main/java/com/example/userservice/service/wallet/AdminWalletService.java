package com.example.userservice.service.wallet;

import com.example.userservice.model.AdminWallet;
import com.example.userservice.model.AdminWalletEntry;
import org.springframework.data.domain.Page;

import java.math.BigDecimal;

public interface AdminWalletService {
    AdminWallet getOrCreateAdminWallet();

    AdminWallet depositCommission(String orderId, BigDecimal amount, String description);

    AdminWallet depositSubscription(String subscriptionId, BigDecimal amount, String description);

    Page<AdminWalletEntry> getEntries(int page, int size);

    AdminWallet getWallet();
}
