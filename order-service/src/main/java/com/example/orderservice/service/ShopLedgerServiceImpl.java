package com.example.orderservice.service;

import com.example.orderservice.client.StockServiceClient;
import com.example.orderservice.client.UserServiceClient;
import com.example.orderservice.dto.*;
import com.example.orderservice.enums.LedgerEntryType;
import com.example.orderservice.enums.PayoutStatus;
import com.example.orderservice.enums.SubscriptionType;
import com.example.orderservice.model.Order;
import com.example.orderservice.model.OrderItem;
import com.example.orderservice.model.PayoutBatch;
import com.example.orderservice.model.ShopLedger;
import com.example.orderservice.model.ShopLedgerEntry;
import com.example.orderservice.repository.PayoutBatchRepository;
import com.example.orderservice.repository.ShopLedgerEntryRepository;
import com.example.orderservice.repository.ShopLedgerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShopLedgerServiceImpl implements ShopLedgerService {

    private final ShopLedgerRepository shopLedgerRepository;
    private final ShopLedgerEntryRepository shopLedgerEntryRepository;
    private final PayoutBatchRepository payoutBatchRepository;
    private final StockServiceClient stockServiceClient;
    private final UserServiceClient userServiceClient;

    @Override
    @Transactional
    public void processOrderEarning(Order order) {
        log.info("Processing earning for order: {}", order.getId());

        if (order.getOrderItems() == null || order.getOrderItems().isEmpty()) {
            log.warn("Order {} has no items, skipping ledger processing", order.getId());
            return;
        }

        // 1. Group items by Shop Owner
        Map<String, List<OrderItem>> itemsByShop = groupItemsByShopOwner(order);
        log.info("Order {} grouped into {} shops", order.getId(), itemsByShop.size());

        // 2. Process for each shop
        for (Map.Entry<String, List<OrderItem>> entry : itemsByShop.entrySet()) {
            String shopOwnerId = entry.getKey();
            List<OrderItem> shopItems = entry.getValue();

            processShopEarning(shopOwnerId, order, shopItems);
        }
    }

    private void processShopEarning(String shopOwnerId, Order order, List<OrderItem> shopItems) {
        // Idempotency check
        String refTxn = order.getId() + "_" + shopOwnerId;
        if (shopLedgerEntryRepository.existsByRefTxn(refTxn)) {
            log.info("Ledger entry already exists for refTxn: {}", refTxn);
            return;
        }

        // Calculate Commission
        CommissionResult calc = calculateCommission(shopOwnerId, order, shopItems);
        log.info("Calculated commission for shop {}: Gross={}, Net={}, Final={}",
                shopOwnerId, calc.getGrossAmount(), calc.getNetAmount(), calc.getFinalBalance());

        // Get or Create Ledger
        ShopLedger ledger = shopLedgerRepository.findByShopOwnerId(shopOwnerId)
                .orElseGet(() -> ShopLedger.builder()
                        .shopOwnerId(shopOwnerId)
                        .balanceAvailable(BigDecimal.ZERO)
                        .balancePending(BigDecimal.ZERO)
                        .totalEarnings(BigDecimal.ZERO)
                        .totalCommission(BigDecimal.ZERO)
                        .totalPayouts(BigDecimal.ZERO)
                        .build());

        if (ledger.getId() == null) {
            ledger = shopLedgerRepository.save(ledger);
        }

        // Update Ledger Stats
        ledger.setTotalEarnings(ledger.getTotalEarnings().add(calc.getGrossAmount()));
        ledger.setTotalCommission(ledger.getTotalCommission().add(calc.getTotalCommission()));

        // Update Balance
        ledger.setBalanceAvailable(ledger.getBalanceAvailable().add(calc.getFinalBalance()));

        shopLedgerRepository.save(ledger);
        log.info("Updated ledger for shop {}. New Balance={}", shopOwnerId, ledger.getBalanceAvailable());

        // Create Entry
        ShopLedgerEntry entry = ShopLedgerEntry.builder()
                .shopOwnerId(shopOwnerId)
                .orderId(order.getId())
                .entryType(LedgerEntryType.EARNING)
                .amountGross(calc.getGrossAmount())
                .commissionPayment(calc.getCommissionPayment())
                .commissionFixed(calc.getCommissionFixed())
                .commissionFreeship(calc.getCommissionFreeship())
                .commissionVoucher(calc.getCommissionVoucher())
                .commissionTotal(calc.getTotalCommission())
                .amountNet(calc.getNetAmount())
                .shippingFee(calc.getShippingFee())
                .otherFees(BigDecimal.ZERO)
                .balanceBefore(ledger.getBalanceAvailable().subtract(calc.getFinalBalance()))
                .balanceAfter(ledger.getBalanceAvailable())
                .refTxn(refTxn)
                .description("Earning from order " + order.getId())
                .build();

        shopLedgerEntryRepository.save(entry);
    }

    @Override
    public CommissionResult calculateCommission(String shopOwnerId, Order order, List<OrderItem> shopItems) {
        // 1. Get Subscription
        ShopSubscriptionDTO sub = getSubscription(shopOwnerId);
        SubscriptionType type = sub != null ? sub.getSubscriptionType() : SubscriptionType.NONE;

        // 2. Calculate Gross for THIS shop
        double grossDouble = shopItems.stream().mapToDouble(OrderItem::getTotalPrice).sum();
        BigDecimal grossAmount = BigDecimal.valueOf(grossDouble);

        // 3. Constants
        // Default to match PAYOUT_LEDGER_SYSTEM.md
        BigDecimal ratePayment = sub != null && sub.getCommissionPaymentRate() != null ? sub.getCommissionPaymentRate()
                : new BigDecimal("0.04"); // 4%
        BigDecimal rateFixed = sub != null && sub.getCommissionFixedRate() != null ? sub.getCommissionFixedRate()
                : new BigDecimal("0.04"); // 4% (Fixed fee)
        BigDecimal rateFreeship = sub != null && sub.getCommissionFreeshipRate() != null
                ? sub.getCommissionFreeshipRate()
                : new BigDecimal("0.08"); // 8%
        BigDecimal rateVoucher = sub != null && sub.getCommissionVoucherRate() != null ? sub.getCommissionVoucherRate()
                : new BigDecimal("0.05"); // 5%
        BigDecimal maxVoucherFee = sub != null && sub.getVoucherMaxPerItem() != null ? sub.getVoucherMaxPerItem()
                : new BigDecimal("50000");

        // 4. Calculate
        // Base commission (Payment + Fixed)
        BigDecimal commPayment = grossAmount.multiply(ratePayment);
        BigDecimal commFixed = grossAmount.multiply(rateFixed);

        BigDecimal commFreeship = BigDecimal.ZERO;
        if (type == SubscriptionType.FREESHIP_XTRA || type == SubscriptionType.BOTH) {
            commFreeship = grossAmount.multiply(rateFreeship);
        }

        BigDecimal commVoucher = BigDecimal.ZERO;
        // Only charge Voucher Xtra fee if order actually has a voucher applied
        if ((type == SubscriptionType.VOUCHER_XTRA || type == SubscriptionType.BOTH) && order.getVoucherId() != null) {
            for (OrderItem item : shopItems) {
                BigDecimal itemVal = BigDecimal.valueOf(item.getTotalPrice());
                BigDecimal fee = itemVal.multiply(rateVoucher);
                if (fee.compareTo(maxVoucherFee) > 0) {
                    fee = maxVoucherFee;
                }
                commVoucher = commVoucher.add(fee);
            }
        }

        BigDecimal totalComm = commPayment.add(commFixed).add(commFreeship).add(commVoucher);
        BigDecimal netAmount = grossAmount.subtract(totalComm);

        // Shipping Fee logic
        // For now, adhere to strictly 0 deduction unless instructed otherwise
        BigDecimal shippingFee = BigDecimal.ZERO;

        BigDecimal finalBalance = netAmount.subtract(shippingFee);

        // Ensure final balance is not negative
        if (finalBalance.compareTo(BigDecimal.ZERO) < 0) {
            finalBalance = BigDecimal.ZERO;
        }

        return CommissionResult.builder()
                .grossAmount(grossAmount)
                .commissionPayment(commPayment)
                .commissionFixed(commFixed)
                .commissionFreeship(commFreeship)
                .commissionVoucher(commVoucher)
                .totalCommission(totalComm)
                .netAmount(netAmount)
                .shippingFee(shippingFee)
                .finalBalance(finalBalance)
                .build();
    }

    private ShopSubscriptionDTO getSubscription(String shopOwnerId) {
        try {
            ResponseEntity<ShopSubscriptionDTO> res = userServiceClient.getSubscriptionByShopOwnerId(shopOwnerId);
            if (res != null && res.getBody() != null) {
                return res.getBody();
            }
        } catch (Exception e) {
            log.error("Failed to get subscription for shop {}: {}", shopOwnerId, e.getMessage());
        }
        return null;
    }

    private Map<String, List<OrderItem>> groupItemsByShopOwner(Order order) {
        Map<String, List<OrderItem>> map = new HashMap<>();
        if (order.getOrderItems() == null)
            return map;

        for (OrderItem item : order.getOrderItems()) {
            try {
                ProductDto product = stockServiceClient.getProductById(item.getProductId()).getBody();
                if (product != null && product.getUserId() != null) {
                    map.computeIfAbsent(product.getUserId(), k -> new ArrayList<>()).add(item);
                }
            } catch (Exception e) {
                log.error("Error getting product owner for item {}: {}", item.getId(), e.getMessage());
            }
        }
        return map;
    }

    @Override
    public ShopLedgerDTO getLedgerByShopOwnerId(String shopOwnerId) {
        ShopLedger ledger = shopLedgerRepository.findByShopOwnerId(shopOwnerId)
                .orElse(ShopLedger.builder()
                        .shopOwnerId(shopOwnerId)
                        .balanceAvailable(BigDecimal.ZERO)
                        .balancePending(BigDecimal.ZERO)
                        .totalEarnings(BigDecimal.ZERO)
                        .totalCommission(BigDecimal.ZERO)
                        .totalPayouts(BigDecimal.ZERO)
                        .build());

        return ShopLedgerDTO.builder()
                .shopOwnerId(ledger.getShopOwnerId())
                .balanceAvailable(ledger.getBalanceAvailable())
                .balancePending(ledger.getBalancePending())
                .totalEarnings(ledger.getTotalEarnings())
                .totalCommission(ledger.getTotalCommission())
                .totalPayouts(ledger.getTotalPayouts())
                .build();
    }

    @Override
    public Page<ShopLedgerEntryDTO> getLedgerEntries(String shopOwnerId, Pageable pageable) {
        return shopLedgerEntryRepository.findByShopOwnerIdOrderByCreatedAtDesc(shopOwnerId, pageable)
                .map(entry -> ShopLedgerEntryDTO.builder()
                        .id(entry.getId())
                        .orderId(entry.getOrderId())
                        .entryType(entry.getEntryType())
                        .amountGross(entry.getAmountGross())
                        .commissionTotal(entry.getCommissionTotal())
                        .amountNet(entry.getAmountNet())
                        .balanceAfter(entry.getBalanceAfter())
                        .shippingFee(entry.getShippingFee())
                        .description(entry.getDescription())
                        .createdAt(entry.getCreatedAt())
                        .build());
    }

    @Override
    @Transactional
    public PayoutBatch requestPayout(String shopOwnerId, PayoutRequestDTO request) {
        ShopLedger ledger = shopLedgerRepository.findByShopOwnerId(shopOwnerId)
                .orElseThrow(() -> new RuntimeException("Ledger not found for shop: " + shopOwnerId));

        if (ledger.getBalanceAvailable().compareTo(request.getAmount()) < 0) {
            throw new RuntimeException("Insufficient balance");
        }

        // Deduct balance
        ledger.setBalanceAvailable(ledger.getBalanceAvailable().subtract(request.getAmount()));
        ledger.setTotalPayouts(ledger.getTotalPayouts().add(request.getAmount()));
        shopLedgerRepository.save(ledger);

        // Create Payout Batch
        PayoutBatch batch = PayoutBatch.builder()
                .shopOwnerId(shopOwnerId)
                .amount(request.getAmount())
                .status(PayoutStatus.PENDING)
                .bankAccountNumber(request.getBankAccountNumber())
                .bankName(request.getBankName())
                .accountHolderName(request.getAccountHolderName())
                .transactionRef(UUID.randomUUID().toString())
                .description(request.getDescription())
                .build();

        batch = payoutBatchRepository.save(batch);

        // Create Ledger Entry for Payout
        ShopLedgerEntry entry = ShopLedgerEntry.builder()
                .shopOwnerId(shopOwnerId)
                .entryType(LedgerEntryType.PAYOUT)
                .amountGross(BigDecimal.ZERO)
                .amountNet(request.getAmount().negate())
                .balanceBefore(ledger.getBalanceAvailable().add(request.getAmount()))
                .balanceAfter(ledger.getBalanceAvailable())
                .refTxn("PAYOUT_" + batch.getId())
                .description("Payout Request: " + batch.getTransactionRef())
                .build();
        shopLedgerEntryRepository.save(entry);

        return batch;
    }

    @Override
    public List<PayoutBatch> getPayoutHistory(String shopOwnerId) {
        return payoutBatchRepository.findByShopOwnerIdOrderByCreatedAtDesc(shopOwnerId);
    }

    @Override
    @Transactional
    public void deductSubscriptionFee(com.example.orderservice.dto.DeductSubscriptionRequestDTO request) {
        log.info("Deducting subscription fee for shop {}: {}", request.getShopOwnerId(), request.getAmount());

        // Auto-create ledger if not exists
        ShopLedger ledger = shopLedgerRepository.findByShopOwnerId(request.getShopOwnerId())
                .orElseGet(() -> {
                    log.info("Creating new ledger for shop: {}", request.getShopOwnerId());
                    return shopLedgerRepository.save(ShopLedger.builder()
                            .shopOwnerId(request.getShopOwnerId())
                            .balanceAvailable(BigDecimal.ZERO)
                            .balancePending(BigDecimal.ZERO)
                            .totalEarnings(BigDecimal.ZERO)
                            .totalCommission(BigDecimal.ZERO)
                            .totalPayouts(BigDecimal.ZERO)
                            .build());
                });

        if (ledger.getBalanceAvailable().compareTo(request.getAmount()) < 0) {
            throw new RuntimeException("Số dư ví không đủ. Cần: " + request.getAmount() + ", Hiện có: " + ledger.getBalanceAvailable());
        }

        BigDecimal balanceBefore = ledger.getBalanceAvailable();
        BigDecimal balanceAfter = balanceBefore.subtract(request.getAmount());

        // Update Ledger
        ledger.setBalanceAvailable(balanceAfter);
        shopLedgerRepository.save(ledger);

        // Create Entry
        ShopLedgerEntry entry = ShopLedgerEntry.builder()
                .shopOwnerId(request.getShopOwnerId())
                .entryType(LedgerEntryType.SUBSCRIPTION_PAYMENT)
                .amountGross(BigDecimal.ZERO)
                .amountNet(request.getAmount().negate())
                .balanceBefore(balanceBefore)
                .balanceAfter(balanceAfter)
                .refTxn("SUB_" + request.getPlanId() + "_" + System.currentTimeMillis())
                .description("Payment for subscription: " + request.getPlanName())
                .build();

        shopLedgerEntryRepository.save(entry);
        log.info("Deducted subscription fee successfully. New balance: {}", balanceAfter);
    }
}
