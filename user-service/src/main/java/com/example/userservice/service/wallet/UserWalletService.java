package com.example.userservice.service.wallet;

import com.example.userservice.enums.WalletEntryType;
import com.example.userservice.model.UserWallet;
import com.example.userservice.model.UserWalletEntry;

import java.math.BigDecimal;

public interface UserWalletService {
    UserWallet getOrCreateWallet(String userId);

    UserWallet getWallet(String userId);

    UserWallet addRefund(String userId, String orderId, String paymentId, BigDecimal amount, String reason);

    UserWallet withdraw(String userId, BigDecimal amount, String bankAccount, String bankName, String accountHolder);

    UserWallet paySubscription(String userId, BigDecimal amount, String planName);

    UserWallet payOrder(String userId, BigDecimal amount, String orderId);

    UserWalletEntry createEntry(String userId, String orderId, String paymentId, WalletEntryType entryType,
            BigDecimal amount, String description);

    org.springframework.data.domain.Page<UserWalletEntry> getEntries(String userId, int page, int size);

    // Direct Deposit (Manual)
    UserWallet depositDirect(String userId, BigDecimal amount);
}
