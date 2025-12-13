# 🧪 HƯỚNG DẪN TEST THROUGHPUT

## ⚡ Cách Test Đơn Giản (3 Bước)

### Bước 0: Chuẩn Bị

**0.1. Đảm bảo Kafka đang chạy:**
```bash
# Kiểm tra Kafka
docker ps | grep kafka
# Hoặc
netstat -an | grep 9092

# Nếu chưa chạy, start Kafka:
docker-compose up -d kafka zookeeper
```

**0.2. Đảm bảo Notification Service đang chạy:**
```bash
# Service phải đang chạy để consume messages
# Hoặc chạy test sẽ tự động start service
```

### Bước 1: Test TRƯỚC TỐI ƯU

**1.1. Kiểm tra cấu hình:**
```java
// notification-service/src/main/java/.../KafkaConfig.java
// Đảm bảo có dòng này:
factory.setConcurrency(1); // ❌ Chậm
```

**1.2. Chạy test:**
```bash
cd notification-service

# Dùng SimpleThroughputTest (dễ hơn, dùng Kafka server thật)
mvn test -Dtest=SimpleThroughputTest

# Hoặc dùng NotificationThroughputTest (dùng EmbeddedKafka)
mvn test -Dtest=NotificationThroughputTest
```

**1.3. Ghi lại kết quả:**
```
Throughput: ~15.00 notifications/sec
Processing time: ~66667 ms
⚠️  Throughput is LOW
```

---

### Bước 2: Tối Ưu

**2.1. Sửa KafkaConfig:**
```java
// notification-service/src/main/java/.../KafkaConfig.java
// Thay đổi:
factory.setConcurrency(10); // ✅ Nhanh (1 thread per partition)
```

**2.2. Rebuild:**
```bash
mvn clean compile
```

---

### Bước 3: Test SAU TỐI ƯU

**3.1. Chạy lại test:**
```bash
mvn test -Dtest=NotificationThroughputTest
```

**3.2. Ghi lại kết quả:**
```
Throughput: ~150.00 notifications/sec
Processing time: ~6667 ms
✅ Throughput is EXCELLENT
```

---

## 📊 Kết Quả Mong Đợi

| Metric | TRƯỚC TỐI ƯU | SAU TỐI ƯU | Improvement |
|--------|--------------|------------|-------------|
| **Throughput** | ~15 notifications/sec | ~150 notifications/sec | **10x** |
| **Processing Time** | ~66 seconds | ~6.7 seconds | **10x faster** |

---

## 🎯 Test Làm Gì?

1. **Tự động gửi 1000 notifications** vào Kafka
2. **Đếm số notifications** đã được xử lý (lưu vào database)
3. **Tính throughput** = số notifications / thời gian xử lý
4. **Hiển thị kết quả** với status (LOW/EXCELLENT)

---

## ⚠️ Lưu Ý

- ✅ Test dùng **H2 in-memory database** → KHÔNG ảnh hưởng database thật
- ✅ Test dùng **EmbeddedKafka** → KHÔNG cần Kafka server thật
- ⏱️ Test có thể mất **1-2 phút** để hoàn thành
- 🔄 Mỗi test tự động **clear database** trước khi chạy

---

## 🆘 Troubleshooting

### Lỗi: "No H2 database"

**Fix:** Thêm vào `pom.xml`:
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

### Test chạy quá lâu?

- Đây là bình thường nếu `concurrency = 1` (TRƯỚC TỐI ƯU)
- Sau khi tối ưu (`concurrency = 10`), test sẽ nhanh hơn 10x

### Throughput vẫn thấp sau tối ưu?

1. Verify `KafkaConfig.setConcurrency(10)` đã được apply
2. Rebuild project: `mvn clean compile`
3. Check logs xem có errors không

---

## ✅ Checklist

- [ ] H2 dependency có trong pom.xml
- [ ] `concurrency = 1` cho test TRƯỚC
- [ ] Chạy test và ghi kết quả
- [ ] `concurrency = 10` cho test SAU
- [ ] Rebuild project
- [ ] Chạy lại test và so sánh
- [ ] Verify: Throughput tăng ~10x

Good luck! 🚀

