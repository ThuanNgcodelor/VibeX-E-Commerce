# 🧪 HƯỚNG DẪN TEST THROUGHPUT QUA REST API

## ⚡ Cách Sử Dụng Đơn Giản

### Bước 1: Start Services

```bash
# Start Kafka
docker-compose up -d kafka zookeeper

# Start Notification Service
cd notification-service
mvn spring-boot:run
# Hoặc
java -jar target/notification-service-0.0.1-SNAPSHOT.jar
```

### Bước 2: Test TRƯỚC TỐI ƯU

**2.1. Đảm bảo:** `KafkaConfig.setConcurrency(1)`

**2.2. Gửi request:**

```bash
# Dùng curl
curl -X POST http://localhost:8009/v1/test/throughput \
  -H "Content-Type: application/json" \
  -d '{
    "totalMessages": 1000,
    "batchSize": 100
  }'
```

**Hoặc dùng Postman/Thunder Client:**

**URL:** `POST http://localhost:8009/v1/test/throughput`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "totalMessages": 1000,
  "batchSize": 100
}
```

**2.3. Kết quả mong đợi:**
```json
{
  "success": true,
  "totalMessages": 1000,
  "messagesProcessed": 1000,
  "sendTime": 1234,
  "processingTime": 66667,
  "sendRate": "810.37",
  "throughput": "15.00",
  "status": "LOW",
  "message": "⚠️ Throughput is LOW - This is BEFORE optimization (concurrency = 1). Expected: 100-150 after optimization."
}
```

### Bước 3: Tối Ưu

Sửa `KafkaConfig.java`:
```java
factory.setConcurrency(10); // Thay đổi từ 1 → 10
```

Rebuild và restart:
```bash
mvn clean package
# Restart service
```

### Bước 4: Test SAU TỐI ƯU

Gửi lại request tương tự:

```bash
curl -X POST http://localhost:8009/v1/test/throughput \
  -H "Content-Type: application/json" \
  -d '{
    "totalMessages": 1000,
    "batchSize": 100
  }'
```

**Kết quả mong đợi:**
```json
{
  "success": true,
  "totalMessages": 1000,
  "messagesProcessed": 1000,
  "sendTime": 1234,
  "processingTime": 6667,
  "sendRate": "810.37",
  "throughput": "150.00",
  "status": "EXCELLENT",
  "message": "✅ Throughput is EXCELLENT - This is AFTER optimization (concurrency = 10)",
  "improvement": "10.0x"
}
```

---

## 📋 API Endpoints

### 1. Test Throughput (Full)

**Endpoint:** `POST /v1/test/throughput`

**Request Body:**
```json
{
  "totalMessages": 1000,  // Số notifications muốn gửi (default: 1000)
  "batchSize": 100         // Số messages gửi mỗi batch (default: 100)
}
```

**Response:**
```json
{
  "success": true,
  "totalMessages": 1000,
  "messagesProcessed": 1000,
  "sendTime": 1234,
  "processingTime": 6667,
  "sendRate": "810.37",
  "throughput": "150.00",
  "status": "EXCELLENT",
  "message": "✅ Throughput is EXCELLENT",
  "improvement": "10.0x"
}
```

### 2. Quick Test (100 messages)

**Endpoint:** `POST /v1/test/throughput/quick`

**Request:** Không cần body

**Response:** Tương tự như trên (với 100 messages)

### 3. Xem Stats

**Endpoint:** `GET /v1/test/stats`

**Response:**
```json
{
  "totalNotificationsInDatabase": 5000,
  "lastTestProcessed": 1000,
  "lastTestTotalMessages": 1000,
  "lastTestProcessingTime": 6667,
  "lastTestThroughput": "150.00"
}
```

---

## 🎯 Ví Dụ Sử Dụng

### Ví Dụ 1: Test với 1000 messages

```bash
curl -X POST http://localhost:8009/v1/test/throughput \
  -H "Content-Type: application/json" \
  -d '{
    "totalMessages": 1000,
    "batchSize": 100
  }'
```

### Ví Dụ 2: Test nhanh (100 messages)

```bash
curl -X POST http://localhost:8009/v1/test/throughput/quick
```

### Ví Dụ 3: Test với 5000 messages (load test)

```bash
curl -X POST http://localhost:8009/v1/test/throughput \
  -H "Content-Type: application/json" \
  -d '{
    "totalMessages": 5000,
    "batchSize": 500
  }'
```

### Ví Dụ 4: Xem stats

```bash
curl http://localhost:8009/v1/test/stats
```

---

## 📊 So Sánh Kết Quả

### TRƯỚC TỐI ƯU (concurrency = 1)

```json
{
  "throughput": "15.00",
  "processingTime": 66667,
  "status": "LOW"
}
```

### SAU TỐI ƯU (concurrency = 10)

```json
{
  "throughput": "150.00",
  "processingTime": 6667,
  "status": "EXCELLENT",
  "improvement": "10.0x"
}
```

**Improvement:** 10x faster! 🚀

---

## 🔧 Sử Dụng với Postman/Thunder Client

### Collection JSON (Import vào Postman)

```json
{
  "info": {
    "name": "Notification Service Throughput Test",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Test Throughput (1000 messages)",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"totalMessages\": 1000,\n  \"batchSize\": 100\n}"
        },
        "url": {
          "raw": "http://localhost:8009/v1/test/throughput",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8009",
          "path": ["v1", "test", "throughput"]
        }
      }
    },
    {
      "name": "Quick Test (100 messages)",
      "request": {
        "method": "POST",
        "header": [],
        "url": {
          "raw": "http://localhost:8009/v1/test/throughput/quick",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8009",
          "path": ["v1", "test", "throughput", "quick"]
        }
      }
    },
    {
      "name": "Get Stats",
      "request": {
        "method": "GET",
        "url": {
          "raw": "http://localhost:8009/v1/test/stats",
          "protocol": "http",
          "host": ["localhost"],
          "port": "8009",
          "path": ["v1", "test", "stats"]
        }
      }
    }
  ]
}
```

---

## ⚠️ Lưu Ý

1. **Đảm bảo Kafka đang chạy** trước khi test
2. **Notification Service phải đang chạy** để consume messages
3. **Test có thể mất 1-2 phút** để hoàn thành (tùy vào số messages)
4. **Database sẽ có thêm records** sau mỗi test (có thể xóa nếu cần)

---

## 🎯 Quick Start

```bash
# 1. Start services
docker-compose up -d kafka zookeeper
cd notification-service && mvn spring-boot:run

# 2. Test TRƯỚC tối ưu
curl -X POST http://localhost:8009/v1/test/throughput/quick

# 3. Tối ưu: Sửa KafkaConfig.setConcurrency(10)

# 4. Restart service và test lại
curl -X POST http://localhost:8009/v1/test/throughput/quick

# 5. So sánh kết quả
```

Done! 🚀

