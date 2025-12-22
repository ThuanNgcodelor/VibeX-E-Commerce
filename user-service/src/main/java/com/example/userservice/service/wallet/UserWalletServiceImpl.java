package com.example.userservice.service.wallet;

import com.example.userservice.enums.WalletEntryType;
import com.example.userservice.exception.NotFoundException;
import com.example.userservice.model.UserWallet;
import com.example.userservice.model.UserWalletEntry;
import com.example.userservice.repository.UserWalletEntryRepository;
import com.example.userservice.repository.UserWalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserWalletServiceImpl implements UserWalletService {

    private final UserWalletRepository walletRepository;
    private final UserWalletEntryRepository entryRepository;

    @Override
    @Transactional
    public UserWallet getOrCreateWallet(String userId) {
        return walletRepository.findByUserId(userId)
                .orElseGet(() -> {
                    UserWallet wallet = UserWallet.builder()
                            .userId(userId)
                            .balanceAvailable(BigDecimal.ZERO)
                            .balancePending(BigDecimal.ZERO)
                            .totalDeposits(BigDecimal.ZERO)
                            .totalWithdrawals(BigDecimal.ZERO)
                            .totalRefunds(BigDecimal.ZERO)
                            .build();
                    log.info("[WALLET] Created new wallet for user: {}", userId);
                    return walletRepository.save(wallet);
                });
    }

    @Override
    public UserWallet getWallet(String userId) {
        return walletRepository.findByUserId(userId)
                .orElseThrow(() -> new NotFoundException("Wallet not found for user: " + userId));
    }

    @Override
    @Transactional
    public UserWallet addRefund(String userId, String orderId, String paymentId, BigDecimal amount, String reason) {
        UserWallet wallet = getOrCreateWallet(userId);

        BigDecimal balanceBefore = wallet.getBalanceAvailable();
        BigDecimal balanceAfter = balanceBefore.add(amount);

        // Update wallet
        wallet.setBalanceAvailable(balanceAfter);
        wallet.setTotalRefunds(wallet.getTotalRefunds().add(amount));
        wallet = walletRepository.save(wallet);

        // Create entry
        String refTxn = "REFUND_" + orderId + "_" + userId + "_" + System.currentTimeMillis();
        createEntry(userId, orderId, paymentId, WalletEntryType.REFUND, amount,
                "Refund from cancelled order: " + orderId + ". Reason: " + (reason != null ? reason : "N/A"));

        log.info("[WALLET] Added refund to wallet: userId={}, amount={}, balanceBefore={}, balanceAfter={}",
                userId, amount, balanceBefore, balanceAfter);

        return wallet;
    }

    @Override
    @Transactional
    public UserWallet withdraw(String userId, BigDecimal amount, String bankAccount, String bankName,
                               String accountHolder) {
        UserWallet wallet = getWallet(userId);

        if (wallet.getBalanceAvailable().compareTo(amount) < 0) {
            throw new RuntimeException(
                    "Insufficient balance. Available: " + wallet.getBalanceAvailable() + ", Requested: " + amount);
        }

        BigDecimal balanceBefore = wallet.getBalanceAvailable();
        BigDecimal balanceAfter = balanceBefore.subtract(amount);

        // Update wallet
        wallet.setBalanceAvailable(balanceAfter);
        wallet.setTotalWithdrawals(wallet.getTotalWithdrawals().add(amount));
        wallet = walletRepository.save(wallet);

        // Create entry
        String refTxn = "WITHDRAW_" + userId + "_" + System.currentTimeMillis();
        createEntry(userId, null, null, WalletEntryType.WITHDRAWAL, amount,
                "Withdrawal to " + bankName + " - " + bankAccount);

        log.info("[WALLET] Withdrawal from wallet: userId={}, amount={}, balanceBefore={}, balanceAfter={}",
                userId, amount, balanceBefore, balanceAfter);

        return wallet;
    }

    @Override
    @Transactional
    public UserWalletEntry createEntry(String userId, String orderId, String paymentId, WalletEntryType entryType,
                                       BigDecimal amount, String description) {
        UserWallet wallet = getOrCreateWallet(userId);

        BigDecimal balanceBefore = wallet.getBalanceAvailable();
        BigDecimal balanceAfter = balanceBefore;

        // Calculate balance after based on entry type
        if (entryType == WalletEntryType.REFUND || entryType == WalletEntryType.DEPOSIT) {
            balanceAfter = balanceBefore.add(amount);
        } else if (entryType == WalletEntryType.WITHDRAWAL || entryType == WalletEntryType.ADJUST
                || entryType == WalletEntryType.SUBSCRIPTION_FEE) {
            balanceAfter = balanceBefore.subtract(amount);
        }

        String refTxn = entryType.name() + "_" + (orderId != null ? orderId : userId) + "_"
                + System.currentTimeMillis();

        // Check if refTxn already exists
        if (entryRepository.existsByRefTxn(refTxn)) {
            refTxn = refTxn + "_" + UUID.randomUUID().toString().substring(0, 8);
        }

        UserWalletEntry entry = UserWalletEntry.builder()
                .userId(userId)
                .orderId(orderId)
                .paymentId(paymentId)
                .entryType(entryType)
                .amount(amount)
                .balanceBefore(balanceBefore)
                .balanceAfter(balanceAfter)
                .refTxn(refTxn)
                .description(description)
                .build();

        return entryRepository.save(entry);
    }

    @Override
    @Transactional
    public UserWallet paySubscription(String userId, BigDecimal amount, String planName) {
        UserWallet wallet = getOrCreateWallet(userId); // Ensure wallet exists

        if (wallet.getBalanceAvailable().compareTo(amount) < 0) {
            throw new RuntimeException("Insufficient balance to pay for subscription: " + planName);
        }

        BigDecimal balanceBefore = wallet.getBalanceAvailable();
        BigDecimal balanceAfter = balanceBefore.subtract(amount);

        // Update wallet
        wallet.setBalanceAvailable(balanceAfter);
        wallet = walletRepository.save(wallet);

        // Create entry
        createEntry(userId, null, null, WalletEntryType.SUBSCRIPTION_FEE, amount,
                "Payment for subscription plan: " + planName);

        log.info("[WALLET] Paid subscription: userId={}, amount={}, plan={}, balanceAfter={}",
                userId, amount, planName, balanceAfter);

        return wallet;
    }
}