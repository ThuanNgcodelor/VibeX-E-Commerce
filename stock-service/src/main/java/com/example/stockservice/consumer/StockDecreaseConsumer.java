package com.example.stockservice.consumer;

import com.example.stockservice.dto.BatchDecreaseStockRequest;
import com.example.stockservice.event.OrderCompensationEvent;
import com.example.stockservice.event.StockDecreaseEvent;
import com.example.stockservice.service.product.ProductService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StockDecreaseConsumer {
    
    private final ProductService productService;
    private final KafkaTemplate<String, OrderCompensationEvent> compensationKafkaTemplate;
    
    @Value("${kafka.topic.order-compensation}")
    private String orderCompensationTopic;
    
    /**
     * Consumer for async stock decrease events
     * Processes stock updates in batches for maximum throughput
     */
    @KafkaListener(
        topics = "${kafka.topic.stock-decrease}",
        groupId = "stock-service-decrease",
        containerFactory = "stockDecreaseListenerFactory"
    )
    @Transactional
    public void handleStockDecrease(List<StockDecreaseEvent> events) {
        log.info("[ASYNC-STOCK] Processing {} stock decrease events", events.size());
        
        for (StockDecreaseEvent event : events) {
            try {
                // Convert to batch request
                List<BatchDecreaseStockRequest.DecreaseStockItem> items = 
                    event.getItems().stream()
                        .map(item -> new BatchDecreaseStockRequest.DecreaseStockItem(
                            item.getProductId(),
                            item.getSizeId(),
                            item.getQuantity()
                        ))
                        .collect(Collectors.toList());
                
                // Batch decrease stock
                Map<String, Boolean> results = productService.batchDecreaseStock(items);
                
                // Check for failures
                List<String> failedProducts = results.entrySet().stream()
                    .filter(e -> !e.getValue())
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toList());
                
                if (!failedProducts.isEmpty()) {
                    // Publish compensation event
                    publishCompensationEvent(event, failedProducts);
                } else {
                    log.info("[ASYNC-STOCK] Successfully decreased stock for order: {}", 
                        event.getOrderId());
                }
                
            } catch (Exception e) {
                log.error("[ASYNC-STOCK] Failed to process event for order {}: {}", 
                    event.getOrderId(), e.getMessage());
                publishCompensationEvent(event, List.of("ALL"));
            }
        }
    }
    
    private void publishCompensationEvent(StockDecreaseEvent event, List<String> failedProducts) {
        OrderCompensationEvent compensation = OrderCompensationEvent.builder()
            .orderId(event.getOrderId())
            .userId(event.getUserId())
            .reason(OrderCompensationEvent.CompensationReason.INSUFFICIENT_STOCK)
            .details("Insufficient stock for products: " + String.join(", ", failedProducts))
            .build();
        
        compensationKafkaTemplate.send(orderCompensationTopic, event.getOrderId(), compensation);
        log.warn("[COMPENSATION] Published compensation event for order: {} (Failed products: {})", 
            event.getOrderId(), failedProducts.size());
    }
}
