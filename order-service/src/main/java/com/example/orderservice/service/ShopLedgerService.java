package com.example.orderservice.service;

import com.example.orderservice.dto.CommissionResult;
import com.example.orderservice.dto.PayoutRequestDTO;
import com.example.orderservice.dto.ShopLedgerDTO;
import com.example.orderservice.dto.ShopLedgerEntryDTO;
import com.example.orderservice.model.Order;
import com.example.orderservice.model.PayoutBatch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface ShopLedgerService {
    void processOrderEarning(Order order);

    ShopLedgerDTO getLedgerByShopOwnerId(String shopOwnerId);

    Page<ShopLedgerEntryDTO> getLedgerEntries(String shopOwnerId, Pageable pageable);

    PayoutBatch requestPayout(String shopOwnerId, PayoutRequestDTO request);

    List<PayoutBatch> getPayoutHistory(String shopOwnerId);

    CommissionResult calculateCommission(String shopOwnerId, Order order,
            List<com.example.orderservice.model.OrderItem> shopItems);

    void deductSubscriptionFee(com.example.orderservice.dto.DeductSubscriptionRequestDTO request);
}
