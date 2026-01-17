package com.example.stockservice.config;

import com.example.stockservice.dto.analytics.BehaviorEventDto;
import com.example.stockservice.event.OrderCompensationEvent;
import com.example.stockservice.event.ProductUpdateKafkaEvent;
import com.example.stockservice.event.StockDecreaseEvent;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.*;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.kafka.support.serializer.JsonSerializer;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaConfig {
    @Value("${kafka.topic.product-updates}")
    private String productUpdatesTopic;

    @Value("${kafka.topic.analytics:analytics-topic}")
    private String analyticsTopic;

    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    @Value("${spring.kafka.consumer.group-id}")
    private String groupId;

    @Value("${kafka.topic.stock-decrease}")
    private String stockDecreaseTopic;

    @Value("${kafka.topic.order-compensation}")
    private String orderCompensationTopic;

    @Bean
    public NewTopic productUpdatesTopic() {
        return TopicBuilder.name(productUpdatesTopic)
                .partitions(10)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic analyticsTopic() {
        return TopicBuilder.name(analyticsTopic)
                .partitions(10) // High throughput for analytics
                .replicas(1)
                .build();
    }

    // Producer Factory for Product Updates
    @Bean
    public ProducerFactory<String, ProductUpdateKafkaEvent> productProducerFactory() {
        Map<String, Object> configProps = new HashMap<>();
        configProps.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        configProps.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configProps.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        return new DefaultKafkaProducerFactory<>(configProps);
    }

    @Bean("productKafkaTemplate")
    public KafkaTemplate<String, ProductUpdateKafkaEvent> productKafkaTemplate() {
        return new KafkaTemplate<>(productProducerFactory());
    }

    // Generic producer for analytics events (Object type) - This is the default
    // KafkaTemplate
    @Bean
    public ProducerFactory<String, Object> genericProducerFactory() {
        Map<String, Object> configProps = new HashMap<>();
        configProps.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        configProps.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configProps.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        return new DefaultKafkaProducerFactory<>(configProps);
    }

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        return new KafkaTemplate<>(genericProducerFactory());
    }

    // Consumer Factory
    @Bean
    public ConsumerFactory<String, ProductUpdateKafkaEvent> consumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "*");
        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, ProductUpdateKafkaEvent.class);
        return new DefaultKafkaConsumerFactory<>(props);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, ProductUpdateKafkaEvent> kafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, ProductUpdateKafkaEvent> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory());
        factory.setConcurrency(10);
        return factory;
    }

    // Analytics Consumer Factory for BehaviorEventDto
    @Bean
    public ConsumerFactory<String, BehaviorEventDto> analyticsConsumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId + "-analytics");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "*");
        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, BehaviorEventDto.class);
        return new DefaultKafkaConsumerFactory<>(props);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, BehaviorEventDto> analyticsKafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, BehaviorEventDto> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(analyticsConsumerFactory());
        factory.setConcurrency(10); // 10 concurrent consumers for high throughput
        return factory;
    }

    // ==================== PHASE 3: ASYNC STOCK DECREASE ====================

    // Consumer Factory for StockDecreaseEvent
    @Bean
    public ConsumerFactory<String, com.example.stockservice.event.StockDecreaseEvent> stockDecreaseConsumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId + "-stock-decrease");
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "*");
        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, com.example.stockservice.event.StockDecreaseEvent.class);
        props.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false); // CRITICAL: Ignore producer's type header
        // Batch processing
        props.put(ConsumerConfig.FETCH_MIN_BYTES_CONFIG, 10240);
        props.put(ConsumerConfig.FETCH_MAX_WAIT_MS_CONFIG, 100);
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 500);
        return new DefaultKafkaConsumerFactory<>(props);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, com.example.stockservice.event.StockDecreaseEvent> stockDecreaseListenerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, StockDecreaseEvent> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(stockDecreaseConsumerFactory());
        factory.setConcurrency(10);
        factory.setBatchListener(true); // Batch processing
        return factory;
    }

    // Producer Factory for OrderCompensationEvent
    @Bean
    public ProducerFactory<String, OrderCompensationEvent> compensationProducerFactory() {
        Map<String, Object> configProps = new HashMap<>();
        configProps.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        configProps.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        configProps.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        return new DefaultKafkaProducerFactory<>(configProps);
    }

    @Bean
    public KafkaTemplate<String, com.example.stockservice.event.OrderCompensationEvent> compensationKafkaTemplate() {
        return new KafkaTemplate<>(compensationProducerFactory());
    }
}
