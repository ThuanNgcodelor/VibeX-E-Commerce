# 🆘 TROUBLESHOOTING TEST THROUGHPUT

## ❌ Lỗi: EmbeddedKafka Timeout

**Lỗi:**
```
org.apache.kafka.common.KafkaException: java.util.concurrent.TimeoutException
```

**Nguyên nhân:**
- Port 9092 đang bị conflict (Kafka server thật đang chạy)
- EmbeddedKafka không thể khởi động
- Timeout quá ngắn

**Giải pháp:**

### Option 1: Dùng SimpleThroughputTest (Khuyến nghị)

Test này dùng Kafka server thật thay vì EmbeddedKafka:

```bash
# Đảm bảo Kafka đang chạy
docker-compose up -d kafka zookeeper

# Chạy test
mvn test -Dtest=SimpleThroughputTest
```

**Ưu điểm:**
- ✅ Không cần EmbeddedKafka
- ✅ Dùng Kafka server thật (giống production)
- ✅ Dễ debug hơn

### Option 2: Fix EmbeddedKafka

**2.1. Đổi port trong test:**
```java
@EmbeddedKafka(
    brokerProperties = {
        "listeners=PLAINTEXT://localhost:9093",  // Đổi port
        "port=9093"
    }
)
```

**2.2. Tăng timeout:**
```java
@TestPropertySource(properties = {
    "spring.kafka.admin.properties.request.timeout.ms=60000",
    "spring.kafka.admin.properties.default.api.timeout.ms=60000"
})
```

**2.3. Stop Kafka server thật:**
```bash
# Stop Kafka để giải phóng port 9092
docker-compose stop kafka
```

---

## ❌ Lỗi: Connection Refused

**Lỗi:**
```
Connection refused: connect
```

**Nguyên nhân:**
- Kafka server chưa chạy
- Port không đúng

**Giải pháp:**
```bash
# Start Kafka
docker-compose up -d kafka zookeeper

# Verify
docker ps | grep kafka
# Hoặc
curl http://localhost:9090  # Kafka UI
```

---

## ❌ Lỗi: No H2 Database

**Lỗi:**
```
No suitable driver found for jdbc:h2:mem:testdb
```

**Giải pháp:**
Thêm dependency vào `pom.xml`:
```xml
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>test</scope>
</dependency>
```

Sau đó:
```bash
mvn clean install
```

---

## ❌ Lỗi: Config Server Connection Refused

**Lỗi:**
```
Connection refused: getsockopt
ConfigServerConfigDataLoader: Exception on Url
```

**Giải pháp:**
Test đã disable config server:
```java
"spring.config.import=",
"eureka.client.enabled=false",
"spring.cloud.config.enabled=false"
```

Nếu vẫn lỗi, thêm vào test:
```java
@SpringBootTest(
    classes = NotificationServiceApplication.class,
    properties = {
        "spring.cloud.config.enabled=false",
        "eureka.client.enabled=false"
    }
)
```

---

## ✅ Test Chạy Nhưng Throughput = 0

**Nguyên nhân:**
- Messages không được consume
- Consumer chưa start
- Topic chưa được tạo

**Giải pháp:**

**1. Verify topic tồn tại:**
```bash
# Vào Kafka container
docker exec -it kafka bash

# List topics
kafka-topics --bootstrap-server localhost:9092 --list

# Nếu chưa có, tạo topic:
kafka-topics --bootstrap-server localhost:9092 \
  --create --topic notification-topic \
  --partitions 10 --replication-factor 1
```

**2. Verify consumer đang chạy:**
- Check logs của Notification Service
- Xem có messages "NotificationListener.consume" không

**3. Check consumer group:**
```bash
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --group test-throughput-group --describe
```

---

## ✅ Test Chạy Quá Lâu

**Nguyên nhân:**
- `concurrency = 1` → rất chậm (bình thường)
- Database connection pool nhỏ
- System resources thấp

**Giải pháp:**

**1. Giảm số messages:**
```java
int totalMessages = 100; // Thay vì 1000
```

**2. Tăng timeout:**
```java
long timeout = System.currentTimeMillis() + 600000; // 10 phút
```

**3. Check system:**
- CPU usage
- Memory usage
- Disk I/O

---

## 📝 Best Practices

1. **Dùng SimpleThroughputTest** thay vì EmbeddedKafka (dễ hơn)
2. **Đảm bảo Kafka đang chạy** trước khi test
3. **Check logs** để debug
4. **Giảm số messages** nếu test quá lâu
5. **Verify concurrency** đã được apply đúng

---

## 🎯 Quick Fix Checklist

- [ ] Kafka server đang chạy (`docker ps | grep kafka`)
- [ ] Topic `notification-topic` đã được tạo
- [ ] H2 dependency có trong pom.xml
- [ ] Config server disabled trong test
- [ ] Eureka disabled trong test
- [ ] Port không conflict (9092 hoặc 9093)

Good luck! 🚀

