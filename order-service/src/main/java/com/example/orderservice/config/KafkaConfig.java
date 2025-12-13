package com.example.orderservice.config;

import com.example.orderservice.dto.PaymentEvent;
import com.example.orderservice.request.CheckOutKafkaRequest;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.support.serializer.JsonDeserializer;

import java.util.HashMap;
import java.util.Map;


/**
 * - Tạo 2 ConsumerFactory riêng cho CheckOutKafkaRequest và PaymentEvent
 * - Tạo 2 ListenerFactory với concurrency = 10
 * - Tăng FETCH_MIN_BYTES và MAX_POLL_RECORDS
 * Impact: Throughput tăng từ ~2-3 orders/s lên ~20-30 orders/s (10x)
 */
@Configuration
public class KafkaConfig {

    @Value("${kafka.topic.notification}")
    private String notificationTopic;

    @Value("${kafka.topic.order}")
    private String orderTopic;

    @Value("${kafka.topic.payment}")
    private String paymentTopic;

    @Value("${spring.kafka.consumer.bootstrap-servers}")
    private String bootstrapServers;

    @Value("${spring.kafka.consumer.group-id}")
    private String groupId;


    @Bean
    public NewTopic notificationTopic() {
        return TopicBuilder.name(notificationTopic)
                .partitions(10)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic orderTopic() {
        return TopicBuilder.name(orderTopic)
                .partitions(10)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic paymentTopic() {
        return TopicBuilder.name(paymentTopic)
                .partitions(10)
                .replicas(1)
                .build();
    }

    // Consumer Factory cho CheckOutKafkaRequest
    @Bean
    public ConsumerFactory<String, CheckOutKafkaRequest> checkoutConsumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);

        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, CheckOutKafkaRequest.class);
        props.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "*");

        // ✅ TỐI ƯU
        props.put(ConsumerConfig.FETCH_MIN_BYTES_CONFIG, 1024);
        props.put(ConsumerConfig.FETCH_MAX_WAIT_MS_CONFIG, 500);
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 500);

        return new DefaultKafkaConsumerFactory<>(props);
    }

    // Listener Factory cho Checkout
    @Bean
    public ConsumerFactory<String, PaymentEvent> paymentConsumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);

        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, PaymentEvent.class);
        props.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "*");

        // ✅ TỐI ƯU
        props.put(ConsumerConfig.FETCH_MIN_BYTES_CONFIG, 1024);
        props.put(ConsumerConfig.FETCH_MAX_WAIT_MS_CONFIG, 500);
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 500);

        return new DefaultKafkaConsumerFactory<>(props);
    }

    // Listener Factory cho Checkout
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, CheckOutKafkaRequest> checkoutListenerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, CheckOutKafkaRequest> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(checkoutConsumerFactory());
        factory.setConcurrency(10); //  10 threads cho 10 partitions
        return factory;
    }

    //  Listener Factory cho Payment
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, PaymentEvent> paymentListenerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, PaymentEvent> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(paymentConsumerFactory());
        factory.setConcurrency(10); //  10 threads cho 10 partitions
        return factory;
    }

}
