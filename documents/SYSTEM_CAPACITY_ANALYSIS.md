# 📊 PHÂN TÍCH KHẢ NĂNG CHỊU TẢI HỆ THỐNG - BẢN ĐẦY ĐỦ

## 📋 MỤC LỤC

1. [Tổng Hợp Cấu Hình Hiện Tại](#1-tổng-hợp-cấu-hình-hiện-tại)
2. [Phân Tích Tài Nguyên](#2-phân-tích-tài-nguyên)
3. [Mục Tiêu: 5000 Concurrent Users](#3-mục-tiêu-5000-concurrent-users)
4. [Khuyến Nghị Cấu Hình](#4-khuyến-nghị-cấu-hình)
5. [Các Tối Ưu Quan Trọng](#5-các-tối-ưu-quan-trọng)
6. [Kịch Bản Load Test](#6-kịch-bản-load-test)
7. [Cảnh Báo và Giải Pháp](#7-cảnh-báo-và-giải-pháp)
8. [Monitoring và Metrics](#8-monitoring-và-metrics)
9. [Troubleshooting](#9-troubleshooting)
10. [Checklist Tối Ưu](#10-checklist-tối-ưu)
11. [So Sánh Trước/Sau](#11-so-sánh-trước-sau)
12. [Best Practices](#12-best-practices)

---

## 1. TỔNG HỢP CẤU HÌNH HIỆN TẠI

### 1.1. TOMCAT THREAD POOL CONFIGURATION

| Service | Port | Threads Max | Threads Min-Spare | Accept Count | Max Connections | DB Pool Max | DB Pool Min | Async | Batch | Actuator |
|---------|------|-------------|-------------------|--------------|-----------------|-------------|-------------|-------|-------|----------|
| **Gateway** | 8080 | 500 | 50 | 1000 | 10000 | N/A | N/A | N/A* | N/A | ✅ |
| **Order Service** | 8005 | 500 | 50 | 1000 | 10000 | 30 | 10 | ✅ | ✅ | ✅ |
| **Stock Service** | 8004 | 500 | 50 | 1000 | 10000 | 30 | 10 | ❌ | ❌ | ✅ |
| **User Service** | 8002 | 300 | 30 | 500 | 5000 | 25 | 5 | ❌ | ❌ | ✅ |
| **Notification Service** | 8009 | 300 | 30 | 500 | 5000 | 20 | 5 | ❌ | ❌ | ✅ |
| **Payment Service** | 8006 | 200 | 20 | 500 | 5000 | 25 | 5 | ✅ | ✅ | ✅ |
| **File Storage** | 8000 | 150 | 15 | 300 | 3000 | 20 | 5 | ✅ | ✅ | ✅ |

**Lưu ý:**
- **Gateway**: Dùng WebFlux (non-blocking) → không dùng Tomcat threads, nhưng config vẫn có để tương thích
- **Async**: ✅ = Đã có config, ❌ = Chưa có
- **Batch**: ✅ = Đã có config, ❌ = Chưa có

### 1.2. CHI TIẾT TỪNG SERVICE

#### Gateway (8080)
- **Threads**: 500 max, 50 min-spare
- **Architecture**: WebFlux (non-blocking) → Không block threads
- **Throughput**: ~10,000-20,000 requests/second (với WebFlux)
- **Đặc điểm**: Entry point, route tất cả requests

#### Order Service (8005)
- **Threads**: 500 max, 50 min-spare
- **DB Pool**: 30 max, 10 min-idle
- **Async**: ✅ Enabled
- **Batch**: ✅ Enabled
- **Throughput**: ~500 requests/second (sync) → ~2,500-5,000 req/s (với async)
- **Đặc điểm**: High traffic, nhiều database operations

#### Stock Service (8004)
- **Threads**: 500 max, 50 min-spare
- **DB Pool**: 30 max, 10 min-idle
- **Async**: ❌ Chưa có
- **Batch**: ❌ Chưa có
- **Throughput**: ~500 requests/second
- **Đặc điểm**: High traffic, inventory updates, Redis cache

#### User Service (8002)
- **Threads**: 300 max, 30 min-spare
- **DB Pool**: 25 max, 5 min-idle
- **Async**: ❌ Chưa có
- **Batch**: ❌ Chưa có
- **Throughput**: ~300 requests/second
- **Đặc điểm**: Medium traffic, authentication, profile management

#### Notification Service (8009)
- **Threads**: 300 max, 30 min-spare
- **DB Pool**: 20 max, 5 min-idle
- **Async**: ❌ Chưa có
- **Batch**: ❌ Chưa có
- **Throughput**: ~300 requests/second
- **Đặc điểm**: Medium traffic, WebSocket, Kafka consumer (concurrency=10)

#### Payment Service (8006)
- **Threads**: 200 max, 20 min-spare
- **DB Pool**: 25 max, 5 min-idle
- **Async**: ✅ Enabled
- **Batch**: ✅ Enabled
- **Throughput**: ~200 requests/second (sync) → ~1,000-2,000 req/s (với async)
- **Đặc điểm**: Medium traffic, external API calls (VNPay)

#### File Storage (8000)
- **Threads**: 150 max, 15 min-spare
- **DB Pool**: 20 max, 5 min-idle
- **Async**: ✅ Enabled
- **Batch**: ✅ Enabled
- **Throughput**: ~150 requests/second (sync) → ~750-1,500 req/s (với async)
- **Đặc điểm**: Lower traffic, file I/O bound, multipart uploads

---

## 2. PHÂN TÍCH TÀI NGUYÊN

### 2.1. THREADS TỔNG HỢP

**Hiện Tại:**
- **Tổng threads max**: 2,450 threads (không tính Gateway WebFlux)
- **Tổng threads min-spare**: 245 threads
- **RAM cho thread stacks**: ~2.45GB (mỗi thread ~1MB stack)
  - Calculation: 2,450 threads × 1MB = 2.45GB

**Phân Bổ:**
- High traffic services (Order, Stock): 1,000 threads (40.8%)
- Medium traffic services (User, Notification, Payment): 800 threads (32.7%)
- Lower traffic (File Storage): 150 threads (6.1%)
- Gateway (WebFlux): 500 threads (20.4%) - nhưng không block

### 2.2. DATABASE CONNECTIONS

**Hiện Tại:**
- **Tổng DB pool max**: 150 connections
- **Tổng DB pool min-idle**: 50 connections
- **MySQL max_connections cần**: ≥ 200 (150 + buffer 50)

**Phân Bổ:**
- Order Service: 30 connections (20%)
- Stock Service: 30 connections (20%)
- User Service: 25 connections (16.7%)
- Payment Service: 25 connections (16.7%)
- Notification Service: 20 connections (13.3%)
- File Storage: 20 connections (13.3%)

### 2.3. CONNECTIONS TỔNG

**Hiện Tại:**
- **Tổng max connections**: 48,000 connections
  - Gateway: 10,000
  - Order: 10,000
  - Stock: 10,000
  - User: 5,000
  - Notification: 5,000
  - Payment: 5,000
  - File Storage: 3,000

### 2.4. RAM USAGE ESTIMATE

**Hiện Tại:**
- **Thread stacks**: 2.45GB
- **Services heap** (7 services × 2GB): 14GB
- **OS + System**: ~1GB
- **Buffer**: ~1.55GB
- **Tổng**: ~19GB (vượt 16GB!)

**Vấn đề:**
- ❌ Vượt 16GB RAM → Cần giảm JVM heap hoặc threads

---

## 3. MỤC TIÊU: 5000 CONCURRENT USERS

### 3.1. YÊU CẦU HỆ THỐNG

- **Concurrent Users**: 5,000
- **RAM**: 16GB
- **CPU**: 4 cores
- **Target Latency**: P95 < 500ms
- **Target Availability**: 99.9%

### 3.2. PHÂN TÍCH LOAD

**Với 5000 users cùng lúc:**

**User Behavior:**
- Mỗi user có thể có 2-3 requests đồng thời:
  - Page load: 1 request
  - API calls: 1-2 requests
  - WebSocket: 1 connection (persistent)
- **Tổng requests**: ~10,000-15,000 requests
- **Requests/second**: ~500-1000 req/s (peak)

**Request Distribution (ước tính):**
- Gateway: 5,000 requests (100% - entry point)
- Order Service: 1,500 requests (30% users đặt hàng)
- Stock Service: 1,000 requests (20% users xem sản phẩm)
- User Service: 1,500 requests (30% users login/profile)
- Notification Service: 500 requests (10% users nhận notification)
- Payment Service: 300 requests (6% users thanh toán)
- File Storage: 200 requests (4% users upload)

**Tổng: ~10,000 requests**

### 3.3. VẤN ĐỀ HIỆN TẠI

**Threads:**
- ❌ Tổng threads: 2,450 → chỉ xử lý được 2,450 requests cùng lúc (sync)
- ✅ Với async: 2,450 threads × 5-10 requests/thread = **12,250-24,500 requests** → Đủ!
- ⚠️ Nhưng chỉ 3 services có async (Order, Payment, File Storage)

**CPU:**
- ❌ 2,450 threads trên 4 cores → Context switching overhead cao
- ⚠️ Rule of thumb: 200-300 threads/core → Tối đa 800-1,200 threads
- ✅ Async processing giảm context switching

**RAM:**
- ❌ 2.45GB (threads) + 14GB (services) = 16.45GB → Vượt 16GB!
- ⚠️ Cần giảm JVM heap hoặc threads

**Database:**
- ✅ 150 connections → Đủ cho 5000 users
- ⚠️ MySQL cần `max_connections >= 200`

---

## 4. KHUYẾN NGHỊ CẤU HÌNH

### 4.1. NGUYÊN TẮC TỐI ƯU

1. **Với 4 cores**: 
   - Không nên có quá 200-300 threads/core
   - Tổng ~800-1,200 threads (sync)
   - Với async: ~1,500-2,000 threads OK

2. **Với 16GB RAM**:
   - Mỗi service ~1.5-2GB heap
   - 7 services = ~10.5-14GB
   - Thread stacks: ~1.5-2GB
   - Buffer: 2-4GB

3. **Tối ưu code** quan trọng hơn tăng threads:
   - Async processing
   - Batch processing
   - Caching
   - Database indexing

### 4.2. KHUYẾN NGHỊ CẤU HÌNH CHI TIẾT

| Service | Threads Max | Threads Min | DB Pool Max | DB Pool Min | Async | Batch | Lý Do |
|---------|-------------|-------------|-------------|-------------|-------|-------|-------|
| **Gateway** | 400 | 40 | N/A | N/A | N/A* | N/A | Entry point, WebFlux (non-blocking) |
| **Order Service** | 300 | 30 | 40 | 10 | ✅ | ✅ | High traffic, cần cân bằng với 4 cores |
| **Stock Service** | 300 | 30 | 40 | 10 | ✅ | ✅ | High traffic, inventory updates |
| **User Service** | 200 | 20 | 30 | 5 | ✅ | ✅ | Medium traffic |
| **Notification Service** | 200 | 20 | 25 | 5 | ✅ | ✅ | Medium traffic, WebSocket overhead |
| **Payment Service** | 200 | 20 | 25 | 5 | ✅ | ✅ | Medium traffic, external API calls |
| **File Storage** | 150 | 15 | 20 | 5 | ✅ | ✅ | Lower traffic, file I/O bound |

**Tổng Khuyến Nghị:**
- **Threads max**: 1,750 threads (~1.75GB RAM cho stacks)
- **DB pool max**: 180 connections
- **RAM usage**: ~1.75GB (threads) + ~10.5GB (services) = ~12.25GB (còn 3.75GB buffer)

### 4.3. SO SÁNH: HIỆN TẠI vs KHUYẾN NGHỊ

| Metric | Hiện Tại | Khuyến Nghị | Thay Đổi | Lý Do |
|--------|----------|-------------|----------|-------|
| **Total Threads** | 2,450 | 1,750 | Giảm 28.6% | Giảm context switching, phù hợp 4 cores |
| **RAM (Threads)** | 2.45GB | 1.75GB | Tiết kiệm 0.7GB | Giảm RAM usage |
| **DB Pool** | 150 | 180 | Tăng 20% | Đảm bảo đủ connections |
| **Max Connections** | 48,000 | 50,000 | Tăng 4.2% | Đủ cho 5000 users |
| **Async Services** | 3/7 | 7/7 | +4 services | Tăng throughput |
| **Batch Services** | 3/7 | 7/7 | +4 services | Giảm DB load |

---

## 5. CÁC TỐI ƯU QUAN TRỌNG

### 5.1. ASYNC PROCESSING (QUAN TRỌNG NHẤT!)

**Vì sao quan trọng?**
- 1 thread sync: xử lý 1 request tại 1 thời điểm (blocking)
- 1 thread async: xử lý 5-20 requests (non-blocking)
- **→ Giảm số threads cần thiết → Giảm RAM, giảm context switching**

**Cách hoạt động:**
```
Sync (Blocking):
Thread 1: Request → Query DB (wait 2s) → Process → Response
         └───────── Blocking ─────────┘
→ Thread bị block, không làm gì được

Async (Non-blocking):
Thread 1: Request → Query DB (async) → [free] → Process result → Response
         └─── 0.1s ───┘                    └─── 1.9s ───┘
→ Thread free để xử lý request khác
```

**Config:**
```properties
# Enable async support
spring.web.async.request-timeout=30000
spring.web.async.timeout=30000

# Thread pool cho async tasks (riêng biệt với Tomcat threads)
spring.task.execution.pool.core-size=20
spring.task.execution.pool.max-size=50
spring.task.execution.pool.queue-capacity=500
spring.task.execution.thread-name-prefix=async-task-
```

**Kết quả:**
- 300 threads sync ≈ 300 requests/second
- 300 threads async ≈ 1,500-3,000 requests/second
- **→ Tăng 5-10x throughput!**

**Status:**
- ✅ Order Service: Đã có
- ✅ Payment Service: Đã có
- ✅ File Storage: Đã có
- ❌ Stock Service: Chưa có
- ❌ User Service: Chưa có
- ❌ Notification Service: Chưa có

### 5.2. JPA BATCH PROCESSING

**Vì sao quan trọng?**
- Giảm database round-trips
- Tăng throughput insert/update

**Ví dụ:**
```
Insert 100 OrderItems:

Sync (100 queries):
INSERT INTO order_items ... (query 1)
INSERT INTO order_items ... (query 2)
...
INSERT INTO order_items ... (query 100)
→ 100 round-trips → Chậm!

Batch (2 queries):
INSERT INTO order_items ... (50 items) (query 1)
INSERT INTO order_items ... (50 items) (query 2)
→ 2 round-trips → Nhanh hơn 50x!
```

**Config:**
```properties
# Batch size để tối ưu inserts/updates
spring.jpa.properties.hibernate.jdbc.batch_size=50
spring.jpa.properties.hibernate.order_inserts=true
spring.jpa.properties.hibernate.order_updates=true
```

**Status:**
- ✅ Order Service: Đã có
- ✅ Payment Service: Đã có
- ✅ File Storage: Đã có
- ❌ Stock Service: Chưa có
- ❌ User Service: Chưa có
- ❌ Notification Service: Chưa có

### 5.3. DATABASE CONNECTION POOL TỐI ƯU

**Vì sao quan trọng?**
- Giảm connection timeout
- Tăng throughput
- Giảm database load

**Rule of thumb:**
- Pool size = 2-3x số threads thường xuyên query DB
- Không phải tất cả threads query DB cùng lúc
- Ví dụ: 300 threads → pool = 40-60 (không phải 300)

**Config:**
```properties
spring.datasource.hikari.maximum-pool-size=40
spring.datasource.hikari.minimum-idle=10
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
spring.datasource.hikari.max-lifetime=1800000
spring.datasource.hikari.leak-detection-threshold=60000
```

**Status:**
- ✅ Tất cả services: Đã có

### 5.4. COMPRESSION

**Vì sao quan trọng?**
- Giảm bandwidth
- Tăng tốc độ load
- Giảm server load

**Config:**
```properties
server.compression.enabled=true
server.compression.mime-types=text/html,text/xml,text/plain,text/css,text/javascript,application/javascript,application/json
server.compression.min-response-size=1024
```

**Status:**
- ✅ Tất cả services: Đã có

### 5.5. KAFKA CONSUMER OPTIMIZATION

**Vì sao quan trọng?**
- Tăng throughput xử lý messages
- Giảm consumer lag

**Config:**
```java
// KafkaConfig.java
factory.setConcurrency(10); // Thay vì 1
```

**Status:**
- ✅ Notification Service: concurrency = 10
- ✅ Order Service: concurrency = 10
- ❌ Các services khác: N/A (không có consumer)

---

## 6. KỊCH BẢN LOAD TEST

### 6.1. SCENARIO: 5000 USERS CÙNG LÚC

**Request Distribution:**
- Gateway: 5,000 requests (100% - entry point)
- Order Service: 1,500 requests (30% users đặt hàng)
- Stock Service: 1,000 requests (20% users xem sản phẩm)
- User Service: 1,500 requests (30% users login/profile)
- Notification Service: 500 requests (10% users nhận notification)
- Payment Service: 300 requests (6% users thanh toán)
- File Storage: 200 requests (4% users upload)

**Tổng: ~10,000 requests**

### 6.2. VỚI CẤU HÌNH HIỆN TẠI

**Threads Available:**
- Total: 2,450 threads
- Với async (3 services): ~1,500 threads async + 950 threads sync
- Throughput: (1,500 × 5-10) + 950 = **8,450-15,950 requests**
- **→ Đủ cho 10,000 requests!**

**RAM Usage:**
- Thread stacks: 2.45GB
- Services: 14GB (7 × 2GB)
- OS: 1GB
- **Tổng: 17.45GB → Vượt 16GB!**

**CPU Usage:**
- 2,450 threads / 4 cores = 612 threads/core
- **→ Quá cao! Context switching overhead lớn**

### 6.3. VỚI CẤU HÌNH KHUYẾN NGHỊ

**Threads Available:**
- Total: 1,750 threads
- Với async (7 services): Tất cả threads async
- Throughput: 1,750 × 5-10 = **8,750-17,500 requests**
- **→ Đủ cho 10,000 requests!**

**RAM Usage:**
- Thread stacks: 1.75GB
- Services: 10.5GB (7 × 1.5GB)
- OS: 1GB
- Buffer: 2.75GB
- **Tổng: 14.25GB → Còn 1.75GB buffer**

**CPU Usage:**
- 1,750 threads / 4 cores = 437 threads/core
- **→ Vẫn cao, nhưng OK với async processing**

---

## 7. CẢNH BÁO VÀ GIẢI PHÁP

### 7.1. CPU BOTTLENECK (4 CORES)

**Vấn đề:**
- 2,450 threads trên 4 cores → Context switching overhead cao
- Rule: 200-300 threads/core → Tối đa 800-1,200 threads (sync)

**Giải pháp:**
1. ✅ **Async processing** (quan trọng nhất!)
   - Giảm context switching
   - Tăng throughput mà không cần thêm threads

2. ✅ **Giảm threads** xuống 1,750 (theo khuyến nghị)
   - Giảm 28.6% threads
   - Vẫn đủ với async

3. ✅ **Horizontal scaling**: Chạy 2 instances mỗi service
   - Giảm threads mỗi instance
   - Tăng fault tolerance

4. ⚠️ **Monitor CPU**: Nếu > 80% → giảm threads hoặc scale out

### 7.2. RAM BOTTLENECK (16GB)

**Vấn đề:**
- 7 services × 2GB = 14GB
- Thread stacks: 2.45GB
- **→ Tổng: 16.45GB → Vượt 16GB!**

**Giải pháp:**
1. ✅ **Giảm JVM heap** mỗi service: `-Xmx1.5g -Xms1.5g` (thay vì 2GB)
   - 7 × 1.5GB = 10.5GB
   - Tiết kiệm 3.5GB

2. ✅ **Giảm threads** xuống 1,750
   - Tiết kiệm 0.7GB

3. ✅ **Tối ưu code**: 
   - Giảm memory leaks
   - Optimize data structures
   - Use object pooling

4. ✅ **Monitor memory**: Dùng Actuator metrics
   - `/actuator/metrics/jvm.memory.used`
   - `/actuator/health`

### 7.3. DATABASE BOTTLENECK

**Vấn đề:**
- 150 connections tổng → MySQL cần `max_connections >= 200`
- Nếu không đủ → Connection timeout

**Giải pháp:**
1. ✅ **Tăng MySQL max_connections**: 200-300
   ```sql
   SET GLOBAL max_connections = 300;
   ```

2. ✅ **Database indexing**: Tối ưu queries
   - Index trên các cột thường query
   - Composite indexes
   - Explain plan analysis

3. ✅ **Read replicas**: Nếu có thể
   - Read từ replica
   - Write vào master

4. ✅ **Connection pooling**: Đã có (HikariCP)

### 7.4. NETWORK BOTTLENECK

**Vấn đề:**
- 48,000 max connections → Có thể vượt network limits

**Giải pháp:**
1. ✅ **Connection timeout**: 20 giây
   - Giải phóng connections không dùng

2. ✅ **Compression**: Đã enable
   - Giảm bandwidth

3. ⚠️ **OS limits**: Tăng file descriptors
   ```bash
   # Linux
   ulimit -n 65536
   ```

---

## 8. MONITORING VÀ METRICS

### 8.1. ACTUATOR ENDPOINTS

**Tất cả services đã enable Actuator:**

```bash
# Health check
curl http://localhost:8005/actuator/health  # Order
curl http://localhost:8004/actuator/health  # Stock
curl http://localhost:8002/actuator/health   # User
curl http://localhost:8009/actuator/health  # Notification
curl http://localhost:8006/actuator/health  # Payment
curl http://localhost:8000/actuator/health  # File Storage
curl http://localhost:8080/actuator/health  # Gateway

# Metrics
curl http://localhost:8005/actuator/metrics
curl http://localhost:8005/actuator/metrics/jvm.memory.used
curl http://localhost:8005/actuator/metrics/tomcat.threads.busy
curl http://localhost:8005/actuator/metrics/hikari.connections.active

# Prometheus
curl http://localhost:8005/actuator/prometheus
```

### 8.2. METRICS QUAN TRỌNG

**CPU:**
- `system.cpu.usage` - CPU usage tổng
- `process.cpu.usage` - CPU usage của process
- **Target**: < 80%

**Memory:**
- `jvm.memory.used` - Memory đang dùng
- `jvm.memory.max` - Memory tối đa
- `jvm.memory.committed` - Memory đã commit
- **Target**: < 80% của max

**Threads:**
- `tomcat.threads.busy` - Threads đang busy
- `tomcat.threads.current` - Threads hiện tại
- `tomcat.threads.max` - Threads tối đa
- **Target**: < 90% của max

**Database:**
- `hikari.connections.active` - Connections đang active
- `hikari.connections.idle` - Connections idle
- `hikari.connections.max` - Connections tối đa
- **Target**: < 90% của max

**HTTP:**
- `http.server.requests` - Số requests
- `http.server.requests.duration` - Response time
- **Target**: P95 < 500ms

### 8.3. DASHBOARD GRAFANA

**Có thể tạo dashboard với các metrics:**
- CPU usage per service
- Memory usage per service
- Thread pool usage per service
- Database connection pool usage
- Request rate per service
- Response time per service
- Error rate per service

---

## 9. TROUBLESHOOTING

### 9.1. HIGH CPU USAGE (> 80%)

**Symptoms:**
- CPU usage > 80%
- Slow response time
- High context switching

**Solutions:**
1. Giảm threads theo khuyến nghị
2. Enable async processing
3. Check for infinite loops
4. Profile code để tìm hot spots
5. Scale out (2 instances)

### 9.2. HIGH MEMORY USAGE (> 80%)

**Symptoms:**
- Memory usage > 80%
- OutOfMemoryError
- GC overhead

**Solutions:**
1. Giảm JVM heap: `-Xmx1.5g -Xms1.5g`
2. Check memory leaks
3. Optimize data structures
4. Reduce cache size
5. Scale out

### 9.3. CONNECTION TIMEOUT

**Symptoms:**
- `HikariPool - Connection is not available`
- Timeout errors

**Solutions:**
1. Tăng database connection pool
2. Check MySQL `max_connections`
3. Check connection leaks
4. Optimize queries (reduce query time)

### 9.4. HIGH THREAD POOL USAGE (> 90%)

**Symptoms:**
- `tomcat.threads.busy` > 90% của max
- Slow response time
- Requests queuing

**Solutions:**
1. Tăng threads (nếu có đủ resources)
2. Enable async processing
3. Optimize slow operations
4. Scale out

### 9.5. KAFKA CONSUMER LAG

**Symptoms:**
- Consumer lag tăng
- Messages xử lý chậm

**Solutions:**
1. Tăng `concurrency` (đã làm: 10)
2. Optimize consumer logic
3. Scale out consumers
4. Check database performance

---

## 10. CHECKLIST TỐI ƯU

### 10.1. ĐÃ HOÀN THÀNH

- [x] **Payment Service**: Config threads (200 max, 20 min)
- [x] **File Storage**: Config threads (150 max, 15 min)
- [x] **Payment Service**: Async processing enabled
- [x] **File Storage**: Async processing enabled
- [x] **Payment Service**: JPA batch processing enabled
- [x] **File Storage**: JPA batch processing enabled
- [x] **Payment Service**: Actuator enabled
- [x] **File Storage**: Actuator enabled
- [x] **Tất cả services**: Compression enabled
- [x] **Tất cả services**: Database connection pool configured
- [x] **Notification Service**: Kafka concurrency = 10
- [x] **Order Service**: Kafka concurrency = 10

### 10.2. CẦN LÀM

- [ ] **Stock Service**: Thêm async processing config
- [ ] **User Service**: Thêm async processing config
- [ ] **Notification Service**: Thêm async processing config
- [ ] **Stock Service**: Thêm JPA batch processing config
- [ ] **User Service**: Thêm JPA batch processing config
- [ ] **Notification Service**: Thêm JPA batch processing config
- [ ] **Tất cả services**: Giảm threads theo khuyến nghị (tổng ~1,750)
- [ ] **Tất cả services**: Giảm JVM heap: `-Xmx1.5g -Xms1.5g`
- [ ] **MySQL**: Tăng `max_connections = 200-300`

### 10.3. TÙY CHỌN (NẾU CẦN)

- [ ] **Horizontal scaling**: Chạy 2 instances mỗi service
- [ ] **Database read replicas**: Giảm load database
- [ ] **Redis caching**: Cache frequently accessed data
- [ ] **CDN**: Static assets (nếu có)

---

## 11. SO SÁNH TRƯỚC/SAU

### 11.1. HIỆN TẠI vs KHUYẾN NGHỊ

| Metric | Hiện Tại | Khuyến Nghị | Cải Thiện | Ghi Chú |
|--------|----------|-------------|-----------|---------|
| **Total Threads** | 2,450 | 1,750 | Giảm 28.6% | Giảm context switching |
| **RAM (Threads)** | 2.45GB | 1.75GB | Tiết kiệm 0.7GB | Giảm RAM usage |
| **RAM (Services)** | 14GB | 10.5GB | Tiết kiệm 3.5GB | Giảm JVM heap |
| **Total RAM** | 16.45GB | 12.25GB | Tiết kiệm 4.2GB | Phù hợp 16GB |
| **DB Pool** | 150 | 180 | Tăng 20% | Đảm bảo đủ connections |
| **Max Connections** | 48,000 | 50,000 | Tăng 4.2% | Đủ cho 5000 users |
| **Async Services** | 3/7 | 7/7 | +4 services | Tăng throughput |
| **Batch Services** | 3/7 | 7/7 | +4 services | Giảm DB load |
| **Throughput (sync)** | ~2,450 req/s | ~1,750 req/s | Giảm 28.6% | Nhưng... |
| **Throughput (async)** | ~12,250 req/s | **~8,750-17,500 req/s** | **Tương đương hoặc tốt hơn** | Với ít threads hơn! |

### 11.2. CAPACITY ESTIMATE

**Hiện Tại (với async 3 services):**
- Throughput: ~12,250 requests/second
- Concurrent users: ~6,000-8,000 users
- **→ Đủ cho 5000 users!**

**Khuyến Nghị (với async 7 services):**
- Throughput: ~8,750-17,500 requests/second
- Concurrent users: ~4,000-8,000 users
- **→ Đủ cho 5000 users!**
- **→ Với ít tài nguyên hơn (RAM, CPU)**

---

## 12. BEST PRACTICES

### 12.1. THREAD POOL SIZING

**Rule of thumb:**
- **CPU-bound tasks**: threads = CPU cores
- **I/O-bound tasks**: threads = CPU cores × (1 + wait time / service time)
- **Web applications**: 200-500 threads/service (tùy traffic)

**Với 4 cores:**
- Sync: 200-300 threads/service (tổng ~1,400-2,100)
- Async: 300-500 threads/service OK (tổng ~2,100-3,500)

### 12.2. DATABASE CONNECTION POOL

**Rule of thumb:**
- Pool size = 2-3x số threads thường xuyên query DB
- Không phải tất cả threads query DB cùng lúc
- MySQL `max_connections` ≥ tổng pool size + buffer

**Ví dụ:**
- 300 threads → 40-60 connections (không phải 300)
- 7 services × 30 connections = 210 → MySQL cần ≥ 250

### 12.3. JVM HEAP SIZING

**Rule of thumb:**
- Heap = Total RAM / (số services + 1)
- Ví dụ: 16GB / 8 = 2GB mỗi service
- Nhưng với 7 services → 16GB / 8 = 2GB → Vượt!

**Khuyến nghị:**
- 16GB RAM, 7 services → 1.5GB mỗi service
- 7 × 1.5GB = 10.5GB
- Thread stacks: 1.75GB
- OS: 1GB
- Buffer: 2.75GB

### 12.4. MONITORING

**Metrics cần monitor:**
1. **CPU**: < 80%
2. **Memory**: < 80%
3. **Thread pool**: < 90%
4. **DB pool**: < 90%
5. **Response time**: P95 < 500ms
6. **Error rate**: < 0.1%

**Tools:**
- Spring Boot Actuator
- Prometheus + Grafana
- Application logs
- Database slow query log

---

## 13. KẾT LUẬN

### 13.1. VỚI 16GB RAM VÀ 4 CORES

**✅ CÓ THỂ chịu 5000 users nếu:**

1. ✅ **Áp dụng async processing** cho tất cả services
   - Status: 3/7 services đã có
   - Cần: Thêm 4 services (Stock, User, Notification)

2. ✅ **Giảm threads** theo khuyến nghị (tổng ~1,750)
   - Status: Hiện tại 2,450 threads
   - Cần: Giảm 28.6%

3. ✅ **Giảm JVM heap** mỗi service (1.5GB thay vì 2GB)
   - Status: Chưa làm
   - Cần: Set `-Xmx1.5g -Xms1.5g`

4. ✅ **Tối ưu code** (batch processing, indexing)
   - Status: 3/7 services đã có batch
   - Cần: Thêm 4 services

5. ✅ **Monitor metrics** thường xuyên
   - Status: Actuator đã enable
   - Cần: Setup Prometheus + Grafana

### 13.2. LƯU Ý QUAN TRỌNG

**⚠️ 4 cores là hạn chế cho 5000 users:**
- Context switching overhead cao
- Nên monitor CPU - nếu > 80% → giảm threads hoặc scale out
- **Horizontal scaling** (2 instances) sẽ tốt hơn nếu có thể

**⚠️ 16GB RAM là đủ nhưng cần tối ưu:**
- Hiện tại: 16.45GB → Vượt!
- Sau tối ưu: 12.25GB → OK
- Cần giảm JVM heap và threads

### 13.3. KHUYẾN NGHỊ

**Short-term (Ngay lập tức):**
1. ✅ Thêm async config cho Stock, User, Notification services
2. ✅ Thêm batch config cho Stock, User, Notification services
3. ⚠️ Giảm threads theo khuyến nghị (nếu cần)
4. ⚠️ Giảm JVM heap: `-Xmx1.5g -Xms1.5g`
5. ✅ Tăng MySQL `max_connections = 200-300`

**Long-term (Tương lai):**
1. **Horizontal scaling**: Chạy 2 instances mỗi service
2. **Upgrade CPU**: 8+ cores sẽ tốt hơn
3. **Database read replicas**: Giảm load database
4. **Redis caching**: Cache frequently accessed data
5. **CDN**: Static assets

---

## 14. NEXT STEPS

### 14.1. IMMEDIATE ACTIONS

1. **Thêm async config** cho Stock, User, Notification services
2. **Thêm batch config** cho Stock, User, Notification services
3. **Test load** với 5000 concurrent users
4. **Monitor** CPU, RAM, latency
5. **Fine-tune** dựa trên metrics thực tế

### 14.2. MONITORING SETUP

1. **Setup Prometheus**: Scrape metrics từ Actuator endpoints
2. **Setup Grafana**: Tạo dashboards
3. **Setup Alerts**: CPU > 80%, Memory > 80%, etc.
4. **Log aggregation**: Centralized logging

### 14.3. LOAD TESTING

**Tools:**
- Apache JMeter
- Gatling
- k6
- Locust

**Scenarios:**
- 1000 users: Baseline
- 3000 users: Medium load
- 5000 users: Target load
- 7000 users: Stress test

**Metrics to measure:**
- Response time (P50, P95, P99)
- Throughput (requests/second)
- Error rate
- CPU, Memory usage
- Database connection pool usage

---

## 📚 TÀI LIỆU THAM KHẢO

1. **TOI_UU_HIEU_NANG.md** - Hướng dẫn chi tiết đầy đủ
2. **OPTIMIZATION_CONFIGS/README.md** - Config files mẫu
3. **Spring Boot Docs**: https://docs.spring.io/spring-boot/docs/current/reference/html/
4. **HikariCP Docs**: https://github.com/brettwooldridge/HikariCP
5. **Tomcat Tuning**: https://tomcat.apache.org/tomcat-9.0-doc/config/http.html

---

**Last Updated**: 2025-12-13  
**Version**: 2.0 (Full Analysis)

Good luck! 🚀
