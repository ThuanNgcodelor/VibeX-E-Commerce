package com.example.stockservice.listener;

import com.example.stockservice.event.ProductUpdateKafkaEvent;
import com.example.stockservice.service.cart.CartService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Listens for product update events from Kafka.
 * Proactively syncs cart items when product info changes (price, status, etc.)
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CartEventListener {

    private final CartService cartService;

    @KafkaListener(topics = "${kafka.topic.product-updates}", groupId = "${spring.kafka.consumer.group-id}")
    public void handleProductUpdatedEvent(ProductUpdateKafkaEvent event) {
        log.info("Received Kafka ProductUpdatedEvent for productId: {}", event.getProductId());
        try {
            // Proactive sync: Update all cart items that reference this product
            cartService.syncCartItemsForProduct(event.getProductId());
        } catch (Exception e) {
            log.error("Error syncing cart items for productId: {}", event.getProductId(), e);
        }
    }
}
