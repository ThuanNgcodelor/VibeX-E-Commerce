package com.example.orderservice.service;

import com.example.orderservice.enums.OrderStatus;
import com.example.orderservice.model.Order;
import com.example.orderservice.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class LedgerReconciliationService {

    private final OrderRepository orderRepository;
    private final ShopLedgerService shopLedgerService;

    /**
     * Periodically check for COMPLETED orders that might have been missed by the
     * event triggers
     * (e.g. direct DB updates or failures).
     * Runs every 10 seconds.
     */
    @Scheduled(fixedRate = 10000)
    @Transactional
    public void reconcileMissedEarnings() {
        log.info("[Ledger Reconciliation] Starting reconciliation scan...");
        try {
            // Find recent delivered orders (e.g. last 24 hours to avoid scanning everything
            // forever)
            // Or simple approach: Find ALL Delivered orders? (might be heavy)
            // Better: Find Delivered orders updated in last 5 minutes?
            // Since the user says "I update straight in DB", updatedAt SHOULD change if
            // they use SQL correctly,
            // but if they don't update timestamp, we might miss it.
            // For safety in this specific "test" scenario, let's scan ALL DELIVERED orders
            // (assuming volume is low).
            // In production, we should page this or filter by "not in shop_ledger_entry".

            // Scan for COMPLETED orders that might have missed the wallet update trigger
            List<Order> deliveredOrders = orderRepository.findByOrderStatus(OrderStatus.COMPLETED);
            log.info("[Ledger Reconciliation] Found {} COMPLETED orders.", deliveredOrders.size());

            for (Order order : deliveredOrders) {
                try {
                    // This method is idempotent, so it's safe to call repeatedly.
                    // It checks if 'refTxn' exists before processing.
                    shopLedgerService.processOrderEarning(order);
                } catch (Exception e) {
                    log.error("[Ledger Reconciliation] Failed to process order {}: {}", order.getId(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("[Ledger Reconciliation] Global error: {}", e.getMessage());
        }
    }
}
