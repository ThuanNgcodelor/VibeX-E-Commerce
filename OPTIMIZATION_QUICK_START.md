# ⚡ QUICK START: TỐI ƯU HIỆU NĂNG

## 🎯 Mục Tiêu

Tăng capacity từ **~1,000 users** lên **~5,000-10,000 users** với các tối ưu đơn giản.

## ⏱️ Thời Gian: ~30 phút

---

## 📝 CHECKLIST NHANH

### ✅ Priority 1 (Làm ngay - 15 phút)

#### 1. Notification Service Kafka (5 phút)
```bash
# Backup và replace KafkaConfig
cp notification-service/src/main/java/com/example/notificationservice/config/KafkaConfig.java \
   notification-service/src/main/java/com/example/notificationservice/config/KafkaConfig.java.bak

cp OPTIMIZATION_CONFIGS/notification-service-kafka-config.java \
   notification-service/src/main/java/com/example/notificationservice/config/KafkaConfig.java
```

**Thay đổi:** `setConcurrency(1)` → `setConcurrency(10)`

#### 2. Order Service Kafka (5 phút)
```bash
# Backup và replace KafkaConfig
cp OPTIMIZATION_CONFIGS/order-service-kafka-config.java \
   order-service/src/main/java/com/example/orderservice/config/KafkaConfig.java
```

**Thay đổi:** Tạo 2 factories với `concurrency = 10`

**Update OrderServiceImpl.java:**
```java
@KafkaListener(
    topics = "#{@orderTopic.name}", 
    groupId = "order-service-checkout",
    containerFactory = "checkoutListenerFactory" // ✅ Thêm dòng này
)
```

#### 3. Database Pool (3 phút)
Thêm vào `*/src/main/resources/application.properties`:
```properties
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
```

#### 4. MySQL Config (2 phút)
```bash
# Linux
sudo cp OPTIMIZATION_CONFIGS/mysql-optimized.cnf /etc/mysql/my.cnf
sudo systemctl restart mysql

# Windows: Copy vào my.ini và restart MySQL service
```

**Verify:**
```sql
SHOW VARIABLES LIKE 'max_connections';  -- Should be 500
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';  -- Should be 8G
```

---

### ✅ Priority 2 (Làm sau - 15 phút)

#### 5. Tomcat Threads (5 phút)
Thêm vào `application.properties` của high traffic services:
```properties
server.tomcat.threads.max=500
server.tomcat.threads.min-spare=50
server.tomcat.accept-count=1000
```

**Services:** `gateway`, `order-service`, `stock-service`

#### 6. Actuator (5 phút)
Thêm vào `pom.xml`:
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

Thêm vào `application.properties`:
```properties
management.endpoints.web.exposure.include=health,metrics,prometheus
```

#### 7. Restart Services (5 phút)
```bash
# Restart tất cả services
# Kiểm tra logs xem có errors không
```

---

## 🧪 VERIFY

```bash
# Chạy script verify
bash OPTIMIZATION_CONFIGS/verify-optimization.sh

# Hoặc check thủ công
grep -r "setConcurrency" notification-service/src/  # Should show 10
grep -r "hikari.maximum-pool-size" */src/main/resources/  # Should show 20+
```

---

## 📊 EXPECTED RESULTS

| Metric | Before | After |
|--------|--------|-------|
| Notifications/sec | ~10-15 | **~100-150** |
| Orders/sec | ~2-3 | **~20-30** |
| Concurrent users | ~1,000 | **~5,000-10,000** |

---

## 🆘 TROUBLESHOOTING

**Connection Pool Exhaustion?**
→ Tăng `maximum-pool-size` lên 30-50

**Kafka Consumer Lag?**
→ Verify `concurrency = 10` đã được apply

**High CPU?**
→ Giảm `threads.max` xuống 300

---

## 📚 Chi Tiết

Xem file **[TOI_UU_HIEU_NANG.md](./TOI_UU_HIEU_NANG.md)** để hiểu rõ hơn về:
- Giải thích chi tiết từng tối ưu
- Cách tính toán capacity
- Monitoring & metrics
- Advanced optimizations

---

## ✅ DONE!

Sau khi hoàn thành, hệ thống sẽ có thể chịu tải **5-10x** so với trước! 🚀

