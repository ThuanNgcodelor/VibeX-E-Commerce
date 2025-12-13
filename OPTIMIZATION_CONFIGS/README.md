# 📁 OPTIMIZATION CONFIGURATION FILES

Thư mục này chứa các file cấu hình mẫu đã được tối ưu để bạn có thể copy và áp dụng vào project.

## 📋 Các File Trong Thư Mục

### 1. `notification-service-kafka-config.java`
- **Mục đích:** Kafka Consumer config cho Notification Service
- **Thay đổi chính:** `setConcurrency(1)` → `setConcurrency(10)`
- **Cách dùng:** Copy vào `notification-service/src/main/java/com/example/notificationservice/config/KafkaConfig.java`

### 2. `order-service-kafka-config.java`
- **Mục đích:** Kafka Consumer config cho Order Service
- **Thay đổi chính:** Tạo 2 ConsumerFactory và ListenerFactory với `concurrency = 10`
- **Cách dùng:** Copy vào `order-service/src/main/java/com/example/orderservice/config/KafkaConfig.java`

### 3. `application-properties-optimized.properties`
- **Mục đích:** Template cho application.properties với các tối ưu
- **Bao gồm:**
  - Database Connection Pool (HikariCP)
  - Tomcat Thread Pool
  - Spring Boot Actuator
  - Kafka Consumer settings
  - WebSocket settings
- **Cách dùng:** Copy các config cần thiết vào `*/src/main/resources/application.properties` của từng service

### 4. `mysql-optimized.cnf`
- **Mục đích:** MySQL configuration file đã tối ưu
- **Cách dùng:** 
  - Linux: Copy vào `/etc/mysql/my.cnf`
  - Windows: Copy vào `C:\ProgramData\MySQL\MySQL Server 8.0\my.ini`
  - Sau đó restart MySQL

### 5. `verify-optimization.sh`
- **Mục đích:** Script để verify các tối ưu đã được apply
- **Cách dùng:** 
  - Linux/Mac: `bash verify-optimization.sh`
  - Windows: Chạy trong Git Bash hoặc WSL

## 🚀 Hướng Dẫn Áp Dụng

### Bước 1: Tối Ưu Kafka Consumers

#### Notification Service:
```bash
# Backup file cũ
cp notification-service/src/main/java/com/example/notificationservice/config/KafkaConfig.java \
   notification-service/src/main/java/com/example/notificationservice/config/KafkaConfig.java.bak

# Copy file mới
cp OPTIMIZATION_CONFIGS/notification-service-kafka-config.java \
   notification-service/src/main/java/com/example/notificationservice/config/KafkaConfig.java
```

#### Order Service:
```bash
# Backup file cũ (nếu có)
cp order-service/src/main/java/com/example/orderservice/config/KafkaConfig.java \
   order-service/src/main/java/com/example/orderservice/config/KafkaConfig.java.bak

# Copy file mới
cp OPTIMIZATION_CONFIGS/order-service-kafka-config.java \
   order-service/src/main/java/com/example/orderservice/config/KafkaConfig.java
```

**Lưu ý:** Sau khi copy, cần update `OrderServiceImpl.java` để sử dụng `containerFactory`:
```java
@KafkaListener(
    topics = "#{@orderTopic.name}", 
    groupId = "order-service-checkout",
    containerFactory = "checkoutListenerFactory" // ✅ Thêm dòng này
)
```

### Bước 2: Tối Ưu Database Connection Pool

Mở file `application.properties` của từng service và thêm:

```properties
# Copy từ application-properties-optimized.properties
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
spring.datasource.hikari.max-lifetime=1800000
spring.datasource.hikari.leak-detection-threshold=60000
```

**Services cần tối ưu:**
- `order-service` → `maximum-pool-size=30`
- `stock-service` → `maximum-pool-size=30`
- `user-service` → `maximum-pool-size=25`
- Các service khác → `maximum-pool-size=20`

### Bước 3: Tối Ưu Tomcat Thread Pool

Thêm vào `application.properties` của các service có nhiều traffic:

```properties
# Copy từ application-properties-optimized.properties
server.tomcat.threads.max=500
server.tomcat.threads.min-spare=50
server.tomcat.accept-count=1000
server.tomcat.max-connections=10000
```

**Services cần tối ưu:**
- `gateway` → `threads.max=500`
- `order-service` → `threads.max=500`
- `stock-service` → `threads.max=500`
- `user-service` → `threads.max=300`
- Các service khác → `threads.max=200` (default)

### Bước 4: Cấu Hình MySQL

#### Linux:
```bash
# Backup config cũ
sudo cp /etc/mysql/my.cnf /etc/mysql/my.cnf.bak

# Copy config mới
sudo cp OPTIMIZATION_CONFIGS/mysql-optimized.cnf /etc/mysql/my.cnf

# Restart MySQL
sudo systemctl restart mysql
```

#### Windows:
1. Mở `C:\ProgramData\MySQL\MySQL Server 8.0\my.ini` (backup trước)
2. Copy nội dung từ `mysql-optimized.cnf`
3. Restart MySQL service từ Services

**Lưu ý:** Điều chỉnh `innodb_buffer_pool_size` theo RAM của server:
- 8GB RAM → `innodb_buffer_pool_size=4G`
- 16GB RAM → `innodb_buffer_pool_size=8G`
- 32GB RAM → `innodb_buffer_pool_size=16G`

### Bước 5: Enable Actuator (Monitoring)

Thêm vào `pom.xml` của mỗi service:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

Thêm vào `application.properties`:
```properties
management.endpoints.web.exposure.include=health,metrics,info,prometheus
management.endpoint.health.show-details=always
management.metrics.export.prometheus.enabled=true
```

### Bước 6: Verify

Chạy script verify:
```bash
bash OPTIMIZATION_CONFIGS/verify-optimization.sh
```

Hoặc verify thủ công:
```bash
# Check Kafka concurrency
grep -r "setConcurrency" notification-service/src/
grep -r "setConcurrency" order-service/src/

# Check database pool
grep -r "hikari.maximum-pool-size" */src/main/resources/

# Check MySQL config
mysql -u root -p -e "SHOW VARIABLES LIKE 'max_connections';"
mysql -u root -p -e "SHOW VARIABLES LIKE 'innodb_buffer_pool_size';"
```

## ✅ Checklist

Sau khi áp dụng, kiểm tra:

- [ ] Notification Service: `concurrency = 10`
- [ ] Order Service: `concurrency = 10` cho cả 2 listeners
- [ ] Database pool size ≥ 20 cho tất cả services
- [ ] Tomcat threads ≥ 500 cho high traffic services
- [ ] MySQL `max_connections = 500`
- [ ] MySQL `innodb_buffer_pool_size` đã set
- [ ] Actuator endpoints enabled
- [ ] Services đã restart
- [ ] MySQL đã restart

## 🧪 Testing

Sau khi apply, test với:

1. **Load test:** Gửi 1000 notifications và đo thời gian xử lý
2. **Monitor metrics:** Check Actuator endpoints
3. **Check logs:** Xem có errors không
4. **Verify throughput:** So sánh trước và sau

## 📊 Expected Results

Sau khi tối ưu:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Notifications/sec | ~10-15 | ~100-150 | **10x** |
| Orders/sec | ~2-3 | ~20-30 | **10x** |
| Database queries/sec | ~100-150 | ~500-1000 | **5-7x** |
| HTTP requests/sec | ~1,000-1,500 | ~5,000-10,000 | **5-7x** |
| Concurrent users | ~1,000 | ~5,000-10,000 | **5-10x** |

## 🆘 Troubleshooting

### Connection Pool Exhaustion
```
HikariPool - Connection is not available
```
**Fix:** Tăng `maximum-pool-size` hoặc check connection leaks

### Kafka Consumer Lag
**Fix:** Tăng `concurrency` hoặc scale out consumers

### High CPU Usage
**Fix:** Giảm `threads.max` hoặc optimize code

### Out of Memory
**Fix:** Tăng JVM heap: `-Xmx4g -Xms4g`

## 📚 Tài Liệu Tham Khảo

- [TOI_UU_HIEU_NANG.md](../TOI_UU_HIEU_NANG.md) - Hướng dẫn chi tiết
- [Spring Kafka Documentation](https://docs.spring.io/spring-kafka/docs/current/reference/html/)
- [HikariCP Configuration](https://github.com/brettwooldridge/HikariCP#configuration-knobs-baby)
- [MySQL Performance Tuning](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)

