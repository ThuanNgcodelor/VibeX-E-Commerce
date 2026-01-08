package com.example.userservice.service.wallet;

import com.example.userservice.enums.AdminWalletEntryType;
import com.example.userservice.model.AdminWallet;
import com.example.userservice.model.AdminWalletEntry;
import com.example.userservice.repository.AdminWalletEntryRepository;
import com.example.userservice.repository.AdminWalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminWalletServiceImpl implements AdminWalletService {

    private final AdminWalletRepository walletRepository;
    private final AdminWalletEntryRepository entryRepository;

    private static final String SYSTEM_ADMIN_ID = "SYSTEM_ADMIN";

    @Override
    @Transactional
    public AdminWallet getOrCreateAdminWallet() {
        return walletRepository.findByAdminId(SYSTEM_ADMIN_ID)
                .orElseGet(() -> {
                    AdminWallet wallet = AdminWallet.builder()
                            .adminId(SYSTEM_ADMIN_ID)
                            .balance(BigDecimal.ZERO)
                            .totalCommission(BigDecimal.ZERO)
                            .totalSubscriptionRevenue(BigDecimal.ZERO)
                            .build();
                    log.info("[ADMIN-WALLET] Created new admin wallet");
                    return walletRepository.save(wallet);
                });
    }

    @Override
    @Transactional
    public AdminWallet depositCommission(String orderId, BigDecimal amount, String description) {
        return processDeposit(AdminWalletEntryType.COMMISSION, orderId, amount, description);
    }

    @Override
    @Transactional
    public AdminWallet depositSubscription(String subscriptionId, BigDecimal amount, String description) {
        return processDeposit(AdminWalletEntryType.SUBSCRIPTION_REVENUE, subscriptionId, amount, description);
    }

    private AdminWallet processDeposit(AdminWalletEntryType type, String sourceId, BigDecimal amount,
            String description) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("[ADMIN-WALLET] Attempted to deposit non-positive amount: {}", amount);
            return getOrCreateAdminWallet();
        }

        AdminWallet wallet = getOrCreateAdminWallet();
        BigDecimal balanceBefore = wallet.getBalance();
        BigDecimal balanceAfter = balanceBefore.add(amount);

        // Update wallet
        wallet.setBalance(balanceAfter);
        if (type == AdminWalletEntryType.COMMISSION) {
            wallet.setTotalCommission(wallet.getTotalCommission().add(amount));
        } else if (type == AdminWalletEntryType.SUBSCRIPTION_REVENUE) {
            wallet.setTotalSubscriptionRevenue(wallet.getTotalSubscriptionRevenue().add(amount));
        }
        wallet = walletRepository.save(wallet);

        // Create entry
        AdminWalletEntry entry = AdminWalletEntry.builder()
                .adminWalletId(wallet.getId())
                .type(type)
                .amount(amount)
                .sourceId(sourceId)
                .description(description)
                .balanceBefore(balanceBefore)
                .balanceAfter(balanceAfter)
                .build();
        entryRepository.save(entry);

        log.info("[ADMIN-WALLET] Deposit successful: type={}, amount={}, sourceId={}, newBalance={}",
                type, amount, sourceId, balanceAfter);

        return wallet;
    }

    @Override
    public Page<AdminWalletEntry> getEntries(int page, int size) {
        AdminWallet wallet = getOrCreateAdminWallet();
        Pageable pageable = PageRequest.of(page, size, Sort.by("creationTimestamp").descending());
        return entryRepository.findByAdminWalletId(wallet.getId(), pageable);
    }

    @Override
    public AdminWallet getWallet() {
        return getOrCreateAdminWallet();
    }
}
