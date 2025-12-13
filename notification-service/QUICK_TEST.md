# ⚡ QUICK TEST - CHỈ CẦN GỬI JSON

## 🎯 Cách Test Đơn Giản Nhất

### Bước 1: Start Service

```bash
# Start Kafka
docker-compose up -d kafka zookeeper

# Start Notification Service
cd notification-service
mvn spring-boot:run
```

### Bước 2: Test TRƯỚC TỐI ƯU

**Copy và paste vào terminal (hoặc Postman):**

```bash
curl -X POST http://localhost:8009/v1/test/throughput/quick
```

**Hoặc dùng file `test-requests.http`** (mở trong VS Code với REST Client extension)

### Bước 3: Tối Ưu

Sửa `KafkaConfig.setConcurrency(10)` → Rebuild → Restart

### Bước 4: Test SAU TỐI ƯU

Gửi lại request tương tự và so sánh kết quả!

---

## 📋 Các Endpoints

| Endpoint | Method | Mô Tả |
|----------|--------|-------|
| `/v1/test/throughput` | POST | Test với số messages tùy chỉnh (JSON body) |
| `/v1/test/throughput/quick` | POST | Test nhanh 100 messages (không cần body) |
| `/v1/test/stats` | GET | Xem thống kê |

---

## 📝 JSON Request Examples

### Test 1000 messages:
```json
POST http://localhost:8009/v1/test/throughput
Content-Type: application/json

{
  "totalMessages": 1000,
  "batchSize": 100
}
```

### Quick test (100 messages):
```json
POST http://localhost:8009/v1/test/throughput/quick
```

---

## 📊 Expected Results

**TRƯỚC:** `"throughput": "15.00"`  
**SAU:** `"throughput": "150.00"`  
**Improvement:** 10x 🚀

---

Xem chi tiết: `TEST_API_GUIDE.md`

