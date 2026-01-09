# Kịch Bản Test - Chức Năng Checkout & Order (Pre-Reserve Pattern)

## 📋 Tổng Quan Hệ Thống

| Component | Mô tả | Công nghệ |
|-----------|-------|-----------|
| **Pre-Reserve** | Giữ chỗ tồn kho trước khi đặt hàng | Redis Lua Script |
| **Async Processing** | Xử lý đơn hàng không đồng bộ | Apache Kafka |
| **Batch Insert** | Gom nhóm INSERT để tối ưu DB | Spring Data JPA |
| **Stock Sync** | Đồng bộ Redis ↔ Database | Scheduled Job |

---

## 🧪 Nhóm A: Checkout Flow Cơ Bản

### A1. Checkout COD (Thanh toán khi nhận hàng)

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Đăng nhập | Thành công |
| 2 | Thêm sản phẩm vào giỏ hàng | Sản phẩm hiển thị trong giỏ |
| 3 | Click "Thanh toán" | Chuyển sang trang Checkout |
| 4 | Chọn địa chỉ giao hàng | Địa chỉ được chọn |
| 5 | Chọn phương thức: **COD** | Hiển thị tổng tiền |
| 6 | Click "Đặt hàng" | ✅ Response ~20ms, thông báo "Đang xử lý" |
| 7 | Kiểm tra đơn hàng | Đơn hàng status: **PENDING** |

### A2. Checkout VNPAY (Thanh toán online)

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Thêm sản phẩm, chọn VNPAY | Redirect sang trang VNPAY |
| 2 | Hoàn tất thanh toán trên VNPAY | Redirect về website |
| 3 | Kiểm tra đơn hàng | Đơn hàng status: **CONFIRMED** |

### A3. Checkout MoMo (Thanh toán ví điện tử)

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Thêm sản phẩm, chọn MoMo | Redirect sang MoMo |
| 2 | Xác nhận thanh toán trên MoMo | IPN callback về backend |
| 3 | Kiểm tra đơn hàng | Đơn hàng status: **CONFIRMED** |

---

## 🧪 Nhóm B: Pre-Reserve Pattern (Redis)

### B1. Kiểm tra tồn kho được trừ trong Redis

| Bước | Thao tác | Kiểm tra |
|------|----------|----------|
| 1 | Kiểm tra stock trong Redis trước checkout | `redis-cli GET stock:{productId}:{sizeId}` → Ví dụ: 100 |
| 2 | Checkout 2 sản phẩm | Response 200 OK |
| 3 | Kiểm tra stock trong Redis sau checkout | `redis-cli GET stock:{productId}:{sizeId}` → **98** (đã trừ) |

### B2. Kiểm tra Reservation Key được tạo

| Bước | Thao tác | Kiểm tra |
|------|----------|----------|
| 1 | Checkout sản phẩm | Response 200 OK |
| 2 | Kiểm tra reservation key | `redis-cli KEYS reserve:*` → Có key mới |
| 3 | Kiểm tra TTL | `redis-cli TTL reserve:{orderId}:{productId}:{sizeId}` → ~900 giây |

### B3. Kiểm tra Reservation Key bị xóa sau confirm

| Bước | Thao tác | Kiểm tra |
|------|----------|----------|
| 1 | Checkout sản phẩm | Response 200 OK |
| 2 | Đợi ~5 giây (Kafka consumer xử lý) | - |
| 3 | Kiểm tra reservation key | `redis-cli KEYS reserve:*` → Key đã bị XÓA |
| 4 | Kiểm tra order trong DB | Order đã được tạo |

### B4. Kiểm tra hết hàng trả về lỗi ngay

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Set stock = 1 trong Redis | `redis-cli SET stock:{productId}:{sizeId} 1` |
| 2 | Checkout 5 sản phẩm | ❌ Response 400: "Không đủ tồn kho" |
| 3 | Kiểm tra stock | Vẫn = 1 (không bị trừ) |

---

## 🧪 Nhóm C: Race Condition Test

### C1. Nhiều user checkout cùng lúc (Load Test)

```bash
# Chuẩn bị data
cd order-service
python prepare_data.py

# Chạy load test
python attack_checkout.py
```

| Metric | Kết quả mong đợi |
|--------|------------------|
| **Total Requests** | 5000 |
| **Success Rate** | 100% hoặc fail do hết stock (không overselling) |
| **Throughput** | > 300 req/s |
| **Latency p50** | < 300ms |

### C2. Kiểm tra không bị Overselling

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Set stock = 50 | `redis-cli SET stock:{productId}:{sizeId} 50` |
| 2 | Chạy 100 requests đồng thời (mỗi request mua 1) | Tối đa 50 orders được tạo |
| 3 | Kiểm tra stock | = 0 (không âm!) |
| 4 | Kiểm tra số orders | = 50 (đúng với stock) |

---

## 🧪 Nhóm D: Failure & Rollback

### D1. Rollback khi checkout nhiều item và 1 item hết hàng

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Thêm 3 sản phẩm vào giỏ (A, B, C) | Giỏ hàng có 3 items |
| 2 | Set stock của C = 0 | `redis-cli SET stock:{productC}:{sizeC} 0` |
| 3 | Checkout | ❌ Response 400: "Không đủ tồn kho" |
| 4 | Kiểm tra stock của A và B | Vẫn như cũ (đã rollback) |

### D2. Abandoned checkout (User bỏ dở)

| Bước | Thao tác | Kết quả mong đợi |
|------|----------|------------------|
| 1 | Call API reserve trực tiếp | Reservation key được tạo |
| 2 | KHÔNG gọi confirm/cancel | - |
| 3 | Đợi 15 phút | TTL hết hạn, key tự xóa |
| 4 | Đợi scheduled sync | Stock được restore từ DB |

---

## 🧪 Nhóm E: Backend API Testing

### E1. Stock Reservation APIs

| ID | Endpoint | Method | Body | Kết quả mong đợi |
|----|----------|--------|------|------------------|
| E1.1 | `/v1/stock/reservation/reserve` | POST | `{tempOrderId, productId, sizeId, quantity}` | 200 OK + success: true |
| E1.2 | `/v1/stock/reservation/confirm` | POST | `{tempOrderId, productId, sizeId}` | 200 OK |
| E1.3 | `/v1/stock/reservation/cancel` | POST | `{tempOrderId, productId, sizeId}` | 200 OK + returned quantity |

### E2. Order APIs

| ID | Endpoint | Method | Auth | Kết quả mong đợi |
|----|----------|--------|------|------------------|
| E2.1 | `/v1/order/create-from-cart` | POST | ✅ | 200 OK, message "Đang xử lý" |
| E2.2 | `/v1/order/my-orders` | GET | ✅ | Danh sách orders của user |
| E2.3 | `/v1/order/{orderId}` | GET | ✅ | Chi tiết order |

### E3. Curl Commands

```bash
# Reserve stock
curl -X POST http://localhost:8004/v1/stock/reservation/reserve \
  -H "Content-Type: application/json" \
  -d '{"tempOrderId":"test-123","productId":"prod-001","sizeId":"size-M","quantity":2}'

# Confirm reservation
curl -X POST http://localhost:8004/v1/stock/reservation/confirm \
  -H "Content-Type: application/json" \
  -d '{"tempOrderId":"test-123","productId":"prod-001","sizeId":"size-M"}'

# Cancel reservation
curl -X POST http://localhost:8004/v1/stock/reservation/cancel \
  -H "Content-Type: application/json" \
  -d '{"tempOrderId":"test-123","productId":"prod-001","sizeId":"size-M"}'
```

---

## 🧪 Nhóm F: Redis Commands để Debug

```bash
# Xem tất cả stock keys
redis-cli KEYS stock:*

# Xem giá trị stock cụ thể
redis-cli GET stock:{productId}:{sizeId}

# Xem tất cả reservation keys
redis-cli KEYS reserve:*

# Xem TTL của reservation
redis-cli TTL reserve:{orderId}:{productId}:{sizeId}

# Set stock thủ công (để test)
redis-cli SET stock:prod-001:size-M 100

# Monitor Redis realtime
redis-cli MONITOR
```

---

## 📊 Performance Metrics Mong Đợi

| Environment | Throughput | Latency p50 | Latency p95 |
|-------------|------------|-------------|-------------|
| **Local (1 máy)** | 300-500 req/s | < 200ms | < 500ms |
| **Production (cluster)** | 5,000-10,000 req/s | < 50ms | < 100ms |

---

## ✅ Checklist Hoàn Thành

### Functional Test
- [ ] A1: Checkout COD thành công
- [ ] A2: Checkout VNPAY thành công
- [ ] A3: Checkout MoMo thành công

### Pre-Reserve Pattern
- [ ] B1: Stock giảm trong Redis
- [ ] B2: Reservation key được tạo
- [ ] B3: Key bị xóa sau confirm
- [ ] B4: Hết hàng trả lỗi ngay

### Race Condition
- [ ] C1: Load test 5000 requests
- [ ] C2: Không overselling

### Failure Handling
- [ ] D1: Rollback khi partial fail
- [ ] D2: TTL expire handling

### API Testing
- [ ] E1: Reserve/Confirm/Cancel APIs
- [ ] E2: Order APIs
- [ ] E3: Curl commands

### Evidence
- [ ] Screenshot các kết quả
- [ ] Load test report
- [ ] Redis MONITOR log
- [ ] Video demo (optional)
