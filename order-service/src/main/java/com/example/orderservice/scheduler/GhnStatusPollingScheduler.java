package com.example.orderservice.scheduler;

import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.example.orderservice.client.GhnApiClient;
import com.example.orderservice.dto.ghn.GhnOrderInfoResponse;
import com.example.orderservice.model.ShippingOrder;
import com.example.orderservice.repository.ShippingOrderRepository;
import com.example.orderservice.service.OrderService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Scheduler that polls GHN API every 30 seconds to get shipping status updates.
 * Updates both ShippingOrder status and Order status accordingly.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class GhnStatusPollingScheduler {
    
    private final ShippingOrderRepository shippingOrderRepository;
    private final GhnApiClient ghnApiClient;
    private final OrderService orderService;
    
    /**
     * Poll GHN API every 30 seconds (10000 ms) for active shipping orders
     */
    @Scheduled(fixedRate = 10000)
    public void pollGhnStatus() {
        try {
            List<ShippingOrder> activeOrders = shippingOrderRepository.findActiveShippingOrders();
            
            if (activeOrders.isEmpty()) {
                log.debug("[GHN POLL] No active shipping orders to poll");
                return;
            }
            
            log.info("[GHN POLL] Polling {} active shipping orders...", activeOrders.size());
            
            for (ShippingOrder shippingOrder : activeOrders) {
                try {
                    pollSingleOrder(shippingOrder);
                } catch (Exception e) {
                    log.error("[GHN POLL] Error polling order {}: {}", 
                        shippingOrder.getGhnOrderCode(), e.getMessage());
                }
            }
            
        } catch (Exception e) {
            log.error("[GHN POLL] Scheduler error: {}", e.getMessage(), e);
        }
    }
    
    /**
     * Poll status for a single shipping order
     */
    private void pollSingleOrder(ShippingOrder shippingOrder) {
        String ghnOrderCode = shippingOrder.getGhnOrderCode();
        String currentStatus = shippingOrder.getStatus();
        
        // Get order info from GHN
        GhnOrderInfoResponse response = ghnApiClient.getOrderInfo(ghnOrderCode);
        
        if (response == null || response.getData() == null) {
            log.warn("[GHN POLL] No data returned for order {}", ghnOrderCode);
            return;
        }
        
        String newStatus = response.getData().getStatus();
        
        if (newStatus == null || newStatus.isBlank()) {
            log.warn("[GHN POLL] Empty status for order {}", ghnOrderCode);
            return;
        }
        
        // Normalize status to uppercase for comparison
        String normalizedNewStatus = newStatus.toLowerCase();
        String normalizedCurrentStatus = currentStatus != null ? currentStatus.toLowerCase() : "";
        
        // Check if status changed
        if (!normalizedNewStatus.equals(normalizedCurrentStatus)) {
            log.info("[GHN POLL] Order {} status changed: {} -> {}", 
                ghnOrderCode, currentStatus, newStatus);
            
            // Call existing handleGhnStatus to update both ShippingOrder and Order
            orderService.handleGhnStatus(ghnOrderCode, newStatus);
        } else {
            log.debug("[GHN POLL] Order {} status unchanged: {}", ghnOrderCode, currentStatus);
        }
    }
}
