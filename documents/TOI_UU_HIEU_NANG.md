# 🚀 HƯỚNG DẪN TỐI ƯU HIỆU NĂNG HỆ THỐNG SHOPEE CLONE

## 📋 MỤC LỤC

1. [Tổng Quan Vấn Đề](#1-tổng-quan-vấn-đề)
2. [Tối Ưu Kafka Consumers](#2-tối-ưu-kafka-consumers)
3. [Tối Ưu Database Connection Pool](#3-tối-ưu-database-connection-pool)
4. [Tối Ưu Application Server Thread Pool](#4-tối-ưu-application-server-thread-pool)
5. [Tối Ưu WebSocket Configuration](#5-tối-ưu-websocket-configuration)
6. [Cấu Hình MySQL](#6-cấu-hình-mysql)
7. [Monitoring & Metrics](#7-monitoring--metrics)
8. [Testing & Verification](#8-testing--verification)
9. [Checklist Tối Ưu](#9-checklist-tối-ưu)

---

## 1. TỔNG QUAN VẤN ĐỀ

### 1.1. Các Bottleneck Hiện Tại

| Component | Vấn Đề | Impact | Priority |
|-----------|--------|--------|----------|
| **Notification Service Kafka** | `concurrency = 1` (1 thread cho 10 partitions) | ⚠️ **CRITICAL** | 🔴 **HIGH** |
| **Order Service Kafka** | `concurrency = 1` (mặc định) | ⚠️ **HIGH** | 🟡 **MEDIUM** |
| **Database Pool** | `max-pool-size = 10` (mặc định) | ⚠️ **HIGH** | 🟡 **MEDIUM** |
| **Tomcat Threads** | `max-threads = 200` (mặc định) | ⚠️ **MEDIUM** | 🟢 **LOW** |
| **WebSocket** | In-memory broker (không scale) | ⚠️ **LOW** | 🟢 **LOW** |

### 1.2. Capacity Hiện Tại vs Sau Tối Ưu

| Metric | Hiện Tại | Sau Tối Ưu | Cải Thiện |
|--------|----------|------------|-----------|
| **Concurrent Users** | ~1,000 | ~5,000-10,000 | **5-10x** |
| **Notifications/sec** | ~10-15 | ~100-150 | **10x** |
| **Orders/sec** | ~2-3 | ~20-30 | **10x** |
| **Database Queries/sec** | ~100-150 | ~500-1000 | **5-7x** |
| **HTTP Requests/sec** | ~1,000-1,500 | ~5,000-10,000 | **5-7x** |

---

## 2. TỐI ƯU KAFKA CONSUMERS

### 2.1. Vấn Đề Hiện Tại

**Notification Service:**
```java
// notification-service/src/main/java/.../KafkaConfig.java
factory.setConcurrency(1); // ❌ 1 thread xử lý 10 partitions → RẤT CHẬM
```

**Vấn đề:**
- 1 thread phải xử lý 10 partitions → sequential processing
- Throughput: ~10-15 notifications/giây
- Latency cao khi có nhiều notifications

**Giải thích:**
- Kafka partition = đơn vị song song hóa
- Mỗi partition chỉ có thể được consume bởi 1 consumer trong cùng consumer group
- `concurrency = 1` → chỉ 1 thread consume tất cả partitions → không tận dụng được parallelism

### 2.2. Giải Pháp: Tăng Concurrency

**Rule of thumb:**
- `concurrency` ≤ số partitions
- Tốt nhất: `concurrency = số partitions` (1 thread per partition)

**Fix cho Notification Service:**

**File:** `notification-service/src/main/java/com/example/notificationservice/config/KafkaConfig.java`

```java
package com.example.notificationservice.config;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.support.serializer.JsonDeserializer;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaConfig {

    @Value("${kafka.topic.notification}")
    private String notificationTopic;

    @Value("${spring.kafka.consumer.bootstrap-servers}")
    private String bootstrapServers;

    @Value("${spring.kafka.consumer.group-id}")
    private String groupId;

    @Bean
    public ConsumerFactory<String, SendNotificationRequest> consumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);

        // Enable auto-commit
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, true);
        props.put(ConsumerConfig.AUTO_COMMIT_INTERVAL_MS_CONFIG, 1000);

        // JsonDeserializer config
        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, SendNotificationRequest.class);
        props.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "*");
        
        // ✅ TỐI ƯU: Tăng fetch size và batch size để giảm số lần fetch
        props.put(ConsumerConfig.FETCH_MIN_BYTES_CONFIG, 1024); // Fetch khi có ít nhất 1KB
        props.put(ConsumerConfig.FETCH_MAX_WAIT_MS_CONFIG, 500); // Đợi tối đa 500ms
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 500); // Poll tối đa 500 records mỗi lần
        
        return new DefaultKafkaConsumerFactory<>(props);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, SendNotificationRequest> kafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, SendNotificationRequest> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory());

        // ✅ TỐI ƯU: 10 threads cho 10 partitions (1 thread per partition)
        // Đảm bảo ordering: messages trong cùng partition vẫn được xử lý tuần tự
        factory.setConcurrency(10);

        // ✅ TỐI ƯU: Enable batch processing nếu cần xử lý nhiều messages cùng lúc
        // factory.setBatchListener(true); // Uncomment nếu muốn nhận List<SendNotificationRequest>

        return factory;
    }
}
```

**Giải thích:**
- `setConcurrency(10)`: 10 threads, mỗi thread xử lý 1 partition → parallel processing
- `FETCH_MIN_BYTES`: Giảm số lần fetch từ Kafka
- `MAX_POLL_RECORDS`: Tăng số records poll mỗi lần → giảm overhead

**Impact:**
- Throughput: ~10-15/s → **~100-150/s** (10x)
- Latency: Giảm đáng kể

---

### 2.3. Fix cho Order Service

**File:** `order-service/src/main/java/com/example/orderservice/config/KafkaConfig.java`

**Bước 1:** Tạo KafkaConfig nếu chưa có:

```java
package com.example.orderservice.config;

import com.example.orderservice.dto.CheckOutKafkaRequest;
import com.example.orderservice.dto.PaymentEvent;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.support.serializer.JsonDeserializer;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaConfig {

    @Value("${spring.kafka.consumer.bootstrap-servers}")
    private String bootstrapServers;

    @Value("${spring.kafka.consumer.group-id}")
    private String groupId;

    // ✅ Consumer Factory cho CheckOutKafkaRequest
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

    // ✅ Consumer Factory cho PaymentEvent
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

    // ✅ Listener Factory cho Checkout
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, CheckOutKafkaRequest> checkoutListenerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, CheckOutKafkaRequest> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(checkoutConsumerFactory());
        factory.setConcurrency(10); // ✅ 10 threads cho 10 partitions
        return factory;
    }

    // ✅ Listener Factory cho Payment
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, PaymentEvent> paymentListenerFactory() {
        ConcurrentKafkaListenerContainerFactory<String, PaymentEvent> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(paymentConsumerFactory());
        factory.setConcurrency(10); // ✅ 10 threads cho 10 partitions
        return factory;
    }
}
```

**Bước 2:** Update OrderServiceImpl để sử dụng factory mới:

**File:** `order-service/src/main/java/com/example/orderservice/service/OrderServiceImpl.java`

```java
// Thêm import
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;

// Update @KafkaListener để chỉ định containerFactory
@KafkaListener(
    topics = "#{@orderTopic.name}", 
    groupId = "order-service-checkout",
    containerFactory = "checkoutListenerFactory" // ✅ Chỉ định factory
)
@Transactional
public void consumeCheckout(CheckOutKafkaRequest msg) {
    // ... existing code ...
}

@KafkaListener(
    topics = "#{@paymentTopic.name}", 
    groupId = "order-service-payment",
    containerFactory = "paymentListenerFactory" // ✅ Chỉ định factory
)
@Transactional
public void consumePaymentEvent(PaymentEvent event) {
    // ... existing code ...
}
```

**Impact:**
- Throughput: ~2-3 orders/s → **~20-30 orders/s** (10x)

---

### 2.4. Verify Kafka Consumer Configuration

**Cách kiểm tra:**

1. **Xem số threads đang chạy:**
```bash
# Vào notification-service logs
tail -f logs/notification-service.log | grep "KafkaListenerContainer"

# Hoặc check JVM threads
jstack <pid> | grep -i kafka
```

2. **Monitor consumer lag:**
```bash
# Sử dụng Kafka UI (port 9090)
# Hoặc kafka-consumer-groups command
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group notification-service-group \
  --describe
```

3. **Test throughput:**
```java
// Tạo test script để gửi nhiều notifications
// Đo thời gian xử lý
```

---

## 3. TỐI ƯU DATABASE CONNECTION POOL

### 3.1. Vấn Đề Hiện Tại

**HikariCP Default:**
- `maximum-pool-size = 10`
- `minimum-idle = 10`
- Không có timeout configuration

**Vấn đề:**
- 9 services × 10 connections = 90 connections
- MySQL default `max_connections = 151` → gần đạt giới hạn
- Connection pool exhaustion khi có nhiều requests đồng thời

### 3.2. Giải Pháp: Tăng Pool Size

**File:** `config/application.properties` (hoặc mỗi service riêng)

```properties
# ✅ TỐI ƯU: Database Connection Pool Configuration
# HikariCP là connection pool mặc định của Spring Boot (tốt nhất)

# Maximum số connections trong pool
spring.datasource.hikari.maximum-pool-size=20

# Minimum số idle connections (luôn giữ sẵn)
spring.datasource.hikari.minimum-idle=5

# Timeout khi chờ connection từ pool (ms)
spring.datasource.hikari.connection-timeout=30000

# Timeout cho idle connections (ms) - tự động đóng connections không dùng
spring.datasource.hikari.idle-timeout=600000

# Maximum lifetime của connection (ms) - đóng connection sau thời gian này
spring.datasource.hikari.max-lifetime=1800000

# Phát hiện connection leak (ms) - cảnh báo nếu connection không được đóng
spring.datasource.hikari.leak-detection-threshold=60000

# Connection test query (đảm bảo connection còn sống)
spring.datasource.hikari.connection-test-query=SELECT 1

# Pool name (để dễ debug)
spring.datasource.hikari.pool-name=ShopeeHikariPool
```

**Giải thích từng tham số:**
- `maximum-pool-size`: Số connections tối đa. **Rule:** `(max_connections / số_services) - 10` (buffer)
- `minimum-idle`: Số connections giữ sẵn → giảm latency khi có request mới
- `connection-timeout`: Nếu pool hết connections, đợi tối đa 30s → trả về error
- `idle-timeout`: Đóng connections không dùng sau 10 phút → giải phóng tài nguyên
- `max-lifetime`: Đóng connection sau 30 phút (dù đang dùng) → tránh stale connections
- `leak-detection-threshold`: Cảnh báo nếu connection không được đóng sau 60s → phát hiện bug

### 3.3. Cấu Hình Cho Từng Service

**Services có nhiều traffic (cần pool lớn hơn):**
- `order-service`
- `stock-service`
- `user-service`
- `gateway` (nếu có database)

**File:** `order-service/src/main/resources/application.properties`

```properties
# Order Service - nhiều traffic
spring.datasource.hikari.maximum-pool-size=30
spring.datasource.hikari.minimum-idle=10
```

**Services ít traffic:**
- `auth-service`
- `file-storage`
- `notification-service` (chủ yếu dùng Kafka)

**File:** `auth-service/src/main/resources/application.properties`

```properties
# Auth Service - ít traffic
spring.datasource.hikari.maximum-pool-size=15
spring.datasource.hikari.minimum-idle=3
```

### 3.4. Monitor Connection Pool

**Thêm Actuator để monitor:**

**File:** `pom.xml` (mỗi service)

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

**File:** `application.properties`

```properties
# Enable HikariCP metrics
management.endpoints.web.exposure.include=health,metrics,hikaricp
management.metrics.export.prometheus.enabled=true
```

**Access metrics:**
```bash
# Health check
curl http://localhost:8005/actuator/health

# HikariCP metrics
curl http://localhost:8005/actuator/metrics/hikaricp.connections.active
curl http://localhost:8005/actuator/metrics/hikaricp.connections.idle
curl http://localhost:8005/actuator/metrics/hikaricp.connections.pending
```

---

## 4. TỐI ƯU APPLICATION SERVER THREAD POOL

### 4.1. Vấn Đề Hiện Tại

**Tomcat Default:**
- `max-threads = 200`
- `min-spare-threads = 10`
- `accept-count = 100`

**Vấn đề:**
- Khi có > 200 requests đồng thời → requests phải đợi
- Queue đầy → connection timeout

### 4.2. Giải Pháp: Tăng Thread Pool

**File:** `order-service/src/main/resources/application.properties`

```properties
# ✅ TỐI ƯU: Tomcat Thread Pool Configuration

# Maximum số threads xử lý requests
server.tomcat.threads.max=500

# Minimum số threads giữ sẵn (luôn có sẵn)
server.tomcat.threads.min-spare=50

# Maximum số connections chờ trong queue (khi tất cả threads đang busy)
server.tomcat.accept-count=1000

# Maximum số connections TCP (tổng số connections)
server.tomcat.max-connections=10000

# Connection timeout (ms) - đóng connection nếu không có request trong 20s
server.connection-timeout=20000

# Enable compression
server.compression.enabled=true
server.compression.mime-types=text/html,text/xml,text/plain,text/css,text/javascript,application/javascript,application/json
server.compression.min-response-size=1024
```

**Giải thích:**
- `threads.max`: Số threads tối đa. **Rule:** `(CPU cores × 2) + số_IO_operations`
- `threads.min-spare`: Giữ sẵn threads → giảm latency
- `accept-count`: Queue size → chứa requests khi threads đang busy
- `max-connections`: Tổng số TCP connections → phải > `threads.max + accept-count`

**Cấu hình theo service:**

**High Traffic Services:**
```properties
# order-service, stock-service, gateway
server.tomcat.threads.max=500
server.tomcat.threads.min-spare=50
server.tomcat.accept-count=1000
server.tomcat.max-connections=10000
```

**Medium Traffic Services:**
```properties
# user-service, notification-service
server.tomcat.threads.max=300
server.tomcat.threads.min-spare=30
server.tomcat.accept-count=500
server.tomcat.max-connections=5000
```

**Low Traffic Services:**
```properties
# auth-service, file-storage
server.tomcat.threads.max=200
server.tomcat.threads.min-spare=20
server.tomcat.accept-count=200
server.tomcat.max-connections=2000
```

### 4.3. Monitor Thread Pool

**Actuator metrics:**
```bash
# Thread pool metrics
curl http://localhost:8005/actuator/metrics/tomcat.threads.busy
curl http://localhost:8005/actuator/metrics/tomcat.threads.current
curl http://localhost:8005/actuator/metrics/tomcat.connections.active
curl http://localhost:8005/actuator/metrics/tomcat.connections.max
```

---

## 5. TỐI ƯU WEBSOCKET CONFIGURATION

### 5.1. Vấn Đề Hiện Tại

**In-Memory Broker:**
- Không scale được (chỉ trong 1 JVM)
- Mất messages khi service restart
- Không thể load balance

### 5.2. Giải Pháp: External Message Broker (RabbitMQ/Redis)

**Option 1: RabbitMQ (Khuyến nghị cho production)**

**File:** `notification-service/pom.xml`

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

**File:** `notification-service/src/main/resources/application.properties`

```properties
# RabbitMQ Configuration
spring.rabbitmq.host=localhost
spring.rabbitmq.port=5672
spring.rabbitmq.username=guest
spring.rabbitmq.password=guest

# STOMP over WebSocket với RabbitMQ
spring.websocket.stomp.relay.enabled=true
spring.websocket.stomp.relay.host=localhost
spring.websocket.stomp.relay.port=61613
spring.websocket.stomp.relay.client-login=guest
spring.websocket.stomp.relay.server-login=guest
```

**File:** `notification-service/src/main/java/.../WebSocketConfig.java`

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // ✅ Sử dụng RabbitMQ thay vì in-memory
        config.enableStompBrokerRelay("/topic", "/queue")
            .setRelayHost("localhost")
            .setRelayPort(61613)
            .setClientLogin("guest")
            .setClientPasscode("guest");
        
        config.setApplicationDestinationPrefixes("/app");
    }

    // ... rest of config ...
}
```

**Option 2: Redis (Đơn giản hơn, nhưng ít tính năng hơn)**

**File:** `notification-service/pom.xml`

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-session-data-redis</artifactId>
</dependency>
```

### 5.3. Tối Ưu WebSocket Connections

**File:** `notification-service/src/main/resources/application.properties`

```properties
# ✅ TỐI ƯU: WebSocket Configuration

# Maximum số WebSocket connections
spring.websocket.max-connections=10000

# Heartbeat interval (giữ connection alive)
spring.websocket.heartbeat.interval=30000

# Connection timeout
spring.websocket.timeout=3600000
```

**File:** `notification-service/src/main/java/.../WebSocketConfig.java`

```java
@Override
public void configureClientInboundChannel(ChannelRegistration registration) {
    // ✅ Tăng thread pool cho WebSocket
    registration.taskExecutor()
        .corePoolSize(10)
        .maxPoolSize(20)
        .queueCapacity(1000);
    
    registration.interceptors(webSocketJwtInterceptor);
}

@Override
public void configureClientOutboundChannel(ChannelRegistration registration) {
    // ✅ Tăng thread pool cho outbound messages
    registration.taskExecutor()
        .corePoolSize(10)
        .maxPoolSize(20)
        .queueCapacity(1000);
}
```

---

## 6. CẤU HÌNH MYSQL

### 6.1. Tối Ưu MySQL Configuration

**File:** `my.cnf` hoặc `my.ini` (MySQL config file)

```ini
[mysqld]
# ✅ TỐI ƯU: Connection Settings
max_connections=500
max_user_connections=400

# ✅ TỐI ƯU: InnoDB Buffer Pool (quan trọng nhất!)
# Rule: 70-80% của RAM (nếu MySQL là service chính)
# Ví dụ: 16GB RAM → 8-12GB cho buffer pool
innodb_buffer_pool_size=8G
innodb_buffer_pool_instances=8

# ✅ TỐI ƯU: InnoDB Log Files
innodb_log_file_size=512M
innodb_log_buffer_size=64M

# ✅ TỐI ƯU: Query Cache (MySQL 5.7 trở xuống)
# query_cache_size=256M
# query_cache_type=1

# ✅ TỐI ƯU: Table Cache
table_open_cache=4000
table_definition_cache=2000

# ✅ TỐI ƯU: Thread Settings
thread_cache_size=50
thread_stack=256K

# ✅ TỐI ƯU: Connection Timeouts
wait_timeout=600
interactive_timeout=600

# ✅ TỐI ƯU: Slow Query Log
slow_query_log=1
slow_query_log_file=/var/log/mysql/slow-query.log
long_query_time=2

# ✅ TỐI ƯU: Binary Log (nếu cần replication)
# log_bin=/var/log/mysql/mysql-bin.log
# binlog_format=ROW
# expire_logs_days=7
```

**Giải thích:**
- `max_connections`: Tổng số connections. **Rule:** `(số_services × pool_size) + 100` (buffer)
- `innodb_buffer_pool_size`: Cache data và indexes → giảm disk I/O. **Quan trọng nhất!**
- `innodb_log_file_size`: Transaction log size → ảnh hưởng đến write performance
- `table_open_cache`: Cache table descriptors → giảm file opens

### 6.2. Apply Configuration

**Cách 1: Edit config file**
```bash
# Linux
sudo nano /etc/mysql/my.cnf

# Windows
# Edit C:\ProgramData\MySQL\MySQL Server 8.0\my.ini
```

**Cách 2: Runtime (tạm thời)**
```sql
SET GLOBAL max_connections = 500;
SET GLOBAL innodb_buffer_pool_size = 8589934592; -- 8GB
```

**Restart MySQL:**
```bash
# Linux
sudo systemctl restart mysql

# Windows
# Restart MySQL service từ Services
```

### 6.3. Verify MySQL Configuration

```sql
-- Kiểm tra max_connections
SHOW VARIABLES LIKE 'max_connections';

-- Kiểm tra buffer pool
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';

-- Kiểm tra connections hiện tại
SHOW STATUS LIKE 'Threads_connected';
SHOW STATUS LIKE 'Max_used_connections';

-- Kiểm tra slow queries
SHOW VARIABLES LIKE 'slow_query_log';
SHOW VARIABLES LIKE 'long_query_time';
```

---

## 7. MONITORING & METRICS

### 7.1. Spring Boot Actuator

**Thêm dependency (mỗi service):**

**File:** `pom.xml`

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>

<!-- Optional: Prometheus metrics -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>
```

**File:** `application.properties`

```properties
# ✅ Enable Actuator Endpoints
management.endpoints.web.exposure.include=health,metrics,info,prometheus
management.endpoint.health.show-details=always

# ✅ Metrics Export
management.metrics.export.prometheus.enabled=true
management.metrics.tags.application=${spring.application.name}
```

**Access endpoints:**
```bash
# Health check
curl http://localhost:8005/actuator/health

# All metrics
curl http://localhost:8005/actuator/metrics

# Specific metric
curl http://localhost:8005/actuator/metrics/hikaricp.connections.active

# Prometheus format
curl http://localhost:8005/actuator/prometheus
```

### 7.2. Key Metrics Cần Monitor

**Database:**
- `hikaricp.connections.active` - Số connections đang dùng
- `hikaricp.connections.idle` - Số connections idle
- `hikaricp.connections.pending` - Số requests đang chờ connection
- `hikaricp.connections.timeout` - Số lần timeout

**Application Server:**
- `tomcat.threads.busy` - Số threads đang busy
- `tomcat.threads.current` - Tổng số threads
- `tomcat.connections.active` - Số connections active
- `http.server.requests` - HTTP request metrics

**Kafka:**
- `spring.kafka.consumer.records.lag` - Consumer lag
- `spring.kafka.consumer.records.consumed` - Số records consumed
- `spring.kafka.producer.records.sent` - Số records sent

**JVM:**
- `jvm.memory.used` - Memory đang dùng
- `jvm.memory.max` - Memory tối đa
- `jvm.gc.pause` - GC pause time
- `jvm.threads.live` - Số threads đang chạy

### 7.3. Prometheus + Grafana Setup

**docker-compose.yml:**
```yaml
prometheus:
  image: prom/prometheus:latest
  ports:
    - "9090:9090"
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'

grafana:
  image: grafana/grafana:latest
  ports:
    - "3000:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

**prometheus.yml:**
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'order-service'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['localhost:8005']
  
  - job_name: 'notification-service'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['localhost:8009']
  
  - job_name: 'stock-service'
    metrics_path: '/actuator/prometheus'
    static_configs:
      - targets: ['localhost:8004']
```

---

## 8. TESTING & VERIFICATION

### 8.1. Load Testing với Apache JMeter

**Tạo Test Plan:**

1. **Test HTTP Requests:**
   - Thread Group: 100 users, ramp-up 10s, loop 10
   - HTTP Request: GET /v1/stock/product
   - Listeners: Summary Report, Graph Results

2. **Test Kafka Throughput:**
   - Tạo script gửi 1000 messages
   - Đo thời gian xử lý

**Script test Kafka (Java):**
```java
@SpringBootTest
public class KafkaLoadTest {
    
    @Autowired
    private KafkaTemplate<String, SendNotificationRequest> kafkaTemplate;
    
    @Test
    public void testNotificationThroughput() {
        long start = System.currentTimeMillis();
        int count = 1000;
        
        for (int i = 0; i < count; i++) {
            SendNotificationRequest request = SendNotificationRequest.builder()
                .userId("user-" + i)
                .message("Test notification " + i)
                .build();
            kafkaTemplate.send("notification-topic", request);
        }
        
        long end = System.currentTimeMillis();
        System.out.println("Sent " + count + " messages in " + (end - start) + "ms");
        System.out.println("Throughput: " + (count * 1000.0 / (end - start)) + " messages/sec");
    }
}
```

### 8.2. Verify Configuration

**Checklist:**

- [ ] Kafka consumer concurrency = 10
- [ ] Database pool size = 20-30
- [ ] Tomcat max threads = 500
- [ ] MySQL max_connections = 500
- [ ] MySQL innodb_buffer_pool_size = 8GB
- [ ] Actuator endpoints enabled
- [ ] Metrics accessible

**Script verify:**
```bash
#!/bin/bash

echo "=== Checking Kafka Consumer Concurrency ==="
grep -r "setConcurrency" notification-service/src/
grep -r "setConcurrency" order-service/src/

echo "=== Checking Database Pool Size ==="
grep -r "hikari.maximum-pool-size" */src/main/resources/

echo "=== Checking Tomcat Threads ==="
grep -r "tomcat.threads.max" */src/main/resources/

echo "=== Checking MySQL Config ==="
mysql -u root -p -e "SHOW VARIABLES LIKE 'max_connections';"
mysql -u root -p -e "SHOW VARIABLES LIKE 'innodb_buffer_pool_size';"
```

---

## 9. CHECKLIST TỐI ƯU

### 9.1. Priority 1 (CRITICAL - Làm ngay)

- [ ] **Notification Service Kafka:** Tăng `concurrency` từ 1 → 10
- [ ] **Order Service Kafka:** Tạo KafkaConfig với `concurrency = 10`
- [ ] **Database Pool:** Tăng `maximum-pool-size` từ 10 → 20-30
- [ ] **MySQL:** Tăng `max_connections` từ 151 → 500
- [ ] **MySQL:** Set `innodb_buffer_pool_size = 8GB` (hoặc 70% RAM)

### 9.2. Priority 2 (HIGH - Làm trong tuần)

- [ ] **Tomcat Threads:** Tăng `max-threads` từ 200 → 500 (high traffic services)
- [ ] **Actuator:** Enable metrics và health endpoints
- [ ] **Monitoring:** Setup Prometheus + Grafana
- [ ] **Kafka:** Tối ưu `FETCH_MIN_BYTES` và `MAX_POLL_RECORDS`

### 9.3. Priority 3 (MEDIUM - Làm khi có thời gian)

- [ ] **WebSocket:** Migrate sang RabbitMQ (external broker)
- [ ] **Connection Pool:** Fine-tune theo metrics thực tế
- [ ] **MySQL:** Tối ưu query indexes
- [ ] **Caching:** Thêm Redis cache cho hot data

### 9.4. Testing & Validation

- [ ] Load test với 1,000 concurrent users
- [ ] Monitor metrics trong 24h
- [ ] Verify không có connection pool exhaustion
- [ ] Verify Kafka consumer lag < 1000
- [ ] Verify response time p95 < 500ms

---

## 10. TROUBLESHOOTING

### 10.1. Connection Pool Exhaustion

**Symptoms:**
```
HikariPool - Connection is not available, request timed out after 30000ms
```

**Solutions:**
1. Tăng `maximum-pool-size`
2. Kiểm tra connection leaks (enable `leak-detection-threshold`)
3. Tăng `connection-timeout` (tạm thời)
4. Kiểm tra slow queries

### 10.2. Kafka Consumer Lag

**Symptoms:**
- Messages xử lý chậm
- Consumer lag tăng liên tục

**Solutions:**
1. Tăng `concurrency` (≤ số partitions)
2. Tối ưu consumer logic (giảm processing time)
3. Scale out (thêm consumer instances)
4. Tăng partitions (nếu cần)

### 10.3. High CPU Usage

**Symptoms:**
- CPU > 80%
- Response time tăng

**Solutions:**
1. Kiểm tra số threads (có thể quá nhiều)
2. Tối ưu code (giảm CPU-intensive operations)
3. Scale out (thêm instances)
4. Profile code để tìm bottleneck

### 10.4. Out of Memory

**Symptoms:**
```
OutOfMemoryError: Java heap space
```

**Solutions:**
1. Tăng JVM heap size: `-Xmx4g -Xms4g`
2. Kiểm tra memory leaks
3. Giảm cache size
4. Tối ưu data structures

---

## 11. KẾT LUẬN

Sau khi áp dụng các tối ưu trên, hệ thống sẽ có thể:

✅ **Chịu tải:** ~5,000-10,000 concurrent users  
✅ **Throughput:** 10x improvement  
✅ **Latency:** Giảm đáng kể  
✅ **Stability:** Tăng cao  

**Lưu ý:**
- Tối ưu là quá trình liên tục, không phải một lần
- Monitor metrics thường xuyên
- Fine-tune dựa trên data thực tế
- Scale out khi cần thiết

**Next Steps:**
1. Apply Priority 1 optimizations
2. Monitor trong 1 tuần
3. Fine-tune dựa trên metrics
4. Apply Priority 2 & 3

Good luck! 🚀

