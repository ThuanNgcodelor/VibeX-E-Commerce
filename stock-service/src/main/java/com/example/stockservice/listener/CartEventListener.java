import com.example.stockservice.event.ProductUpdateKafkaEvent;
import com.example.stockservice.service.cart.CartRedisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class CartEventListener {

    private final CartRedisService cartRedisService;

    @KafkaListener(topics = "${kafka.topic.product-updates}", groupId = "${spring.kafka.consumer.group-id}")
    public void handleProductUpdatedEvent(ProductUpdateKafkaEvent event) {
        log.info("Received Kafka ProductUpdatedEvent for productId: {}", event.getProductId());
        try {
            cartRedisService.refreshCartsContainingProduct(event.getProductId());
        } catch (Exception e) {
            log.error("Error handling Kafka ProductUpdatedEvent for productId: {}", event.getProductId(), e);
        }
    }
}
