# Giải Thích Chi Tiết 4 Loại Checkout x 2 Kịch Bản (Normal/FlashSale + Cache Miss)

Tài liệu này phân tích **8 kịch bản** hoạt động của hệ thống checkout, với focus vào trường hợp **"Chưa có Cache"** (Cache Miss) để hiểu rõ cơ chế warm-up và xử lý lỗi.

---

## Mục Lục
1. [COD (Cash On Delivery)](#1-cod-cash-on-delivery)
2. [Wallet (E-Wallet Payment)](#2-wallet-e-wallet-payment)
3. [VNPay (Online Payment)](#3-vnpay-online-payment)
4. [Momo (Online Payment)](#4-momo-online-payment)

---

## 1. COD (Cash On Delivery)

### 1.1 COD - Normal Sale + Cache Miss

**Tình huống:** Khách hàng đặt sản phẩm thường (không phải Flash Sale), nhưng Redis chưa có dữ liệu stock của sản phẩm đó.

#### Luồng xử lý chi tiết:

```
Step 1: User clicks "Đặt hàng" -> Frontend gửi POST /create-from-cart (method=COD)
        ↓
Step 2: OrderController nhận request -> Gọi orderService.orderByKafka()
        ↓
Step 3: [SYNC] OrderService gọi StockService.reserveStock(tempOrderId, productId, sizeId, qty)
        ↓
Step 4: StockReservationService thực thi reserveStock()
        ├─→ Gọi Redis: GET stock:{productId}:{sizeId}
        ├─→ Redis trả về NULL (Cache Miss!)
        └─→ Kích hoạt warmUpSingleStock()
                ↓
Step 5: [WARM-UP] warmUpSingleStock() xử lý Cache Miss:
        ├─→ Query MySQL: SELECT stock FROM product_size WHERE id = sizeId
        ├─→ Lấy được: stock = 100
        ├─→ Ghi vào Redis: SET stock:{productId}:{sizeId} 100
        └─→ Return stock = 100
                ↓
Step 6: Thực thi Lua Script reserve_stock.lua:
        ├─→ Script đọc: stock = 100
        ├─→ Check: 100 >= qty (VD: qty=2) ✅
        ├─→ DECRBY stock:{productId}:{sizeId} 2 → Redis = 98
        ├─→ SETEX reserve:{tempOrderId}:{productId}:{sizeId} 900 2
        └─→ Return 1 (Success)
                ↓
Step 7: [ASYNC] OrderService đẩy message vào Kafka topic "order-topic"
        ├─→ Message: {userId, tempOrderId, addressId, selectedItems, paymentMethod: "COD"}
        └─→ Trả về Client: {"status": "PENDING", "message": "Đơn hàng đang xử lý"}
                ↓
Step 8: [BACKGROUND] Kafka Consumer (OrderService) nhận message:
        ├─→ Tạo Order entity với status = PENDING
        ├─→ INSERT vào MySQL: orders table
        └─→ Publish event "stock-decrease-topic"
                ↓
Step 9: [BACKGROUND] StockDecreaseConsumer nhận event:
        ├─→ UPDATE product_size SET stock = stock - 2 WHERE id = sizeId (MySQL)
        └─→ Confirm Reservation: DEL reserve:{tempOrderId}:{productId}:{sizeId}
```

**Điểm chú ý:**
- **Warm-up không cần Lock** ở đây vì `warmUpSingleStock` là logic đơn giản (1 thread gọi DB, ghi cache, xong).
- **Nếu nhiều request cùng lúc:** Có thể nhiều thread cùng query DB, nhưng không sao vì đây là operation READ, không ảnh hưởng tính đúng đắn.

---

### 1.2 COD - Flash Sale + Cache Miss

**Tình huống:** Sản phẩm đang Flash Sale, Redis chưa có dữ liệu flash sale stock.

#### Luồng xử lý chi tiết:

```
Step 1-2: Tương tự COD Normal
        ↓
Step 3: [SYNC] OrderService phát hiện isFlashSale=true
        └─→ Gọi FlashSaleClient.reserveStock(tempOrderId, productId, sizeId, qty, userId)
                ↓
Step 4: FlashSaleService.reserveFlashSaleStock() xử lý:
        ├─→ Tạo lockKey = "lock:flashsale:{productId}"
        └─→ Gọi executeWithLock(lockKey, () -> { ... })
                ↓
Step 5: [DISTRIBUTED LOCK] RedisLockService.executeWithLock():
        ├─→ SETNX lock:flashsale:{productId} "1" EX 30 (Thử lấy lock)
        ├─→ Nếu thành công → Thread này được quyền warm-up
        └─→ Nếu thất bại → Chờ 50ms rồi thử lại (max 1 lần)
                ↓
Step 6: [CRITICAL SECTION - Chỉ 1 thread chạy] handleCacheMissWithLock():
        ├─→ Check lại Redis (Double-check): GET flashsale:stock:{productId}
        ├─→ Vẫn NULL → Query MySQL:
        │      SELECT fs.stock, fs.start_time, fs.end_time, fs.limit_per_user
        │      FROM flash_sale_sessions fs WHERE product_id = productId
        ├─→ Kết quả: stock=50, startTime, endTime, limitPerUser=2
        ├─→ Ghi vào Redis:
        │      SET flashsale:stock:{productId} 50
        │      SET flashsale:session:{sessionId} "{startTime, endTime, limitPerUser}"
        └─→ UNLOCK: DEL lock:flashsale:{productId}
                ↓
Step 7: Thực thi Lua Script flashsale_reserve.lua:
        ├─→ Check limitPerUser:
        │      GET flashsale:bought:{userId}:{productId} → 0 (chưa mua lần nào)
        │      Check: (0 + qty) <= limitPerUser → OK
        ├─→ Check stock: GET flashsale:stock:{productId} → 50 >= qty (2) → OK
        ├─→ Execute (Atomic):
        │      DECRBY flashsale:stock:{productId} 2 → 48
        │      INCRBY flashsale:bought:{userId}:{productId} 2 → 2
        │      SETEX flashsale:reserve:{tempOrderId}:{productId} 900 2
        └─→ Return 1 (Success)
                ↓
Step 8-9: Tương tự COD Normal (Kafka processing)
```

**Điểm chú ý:**
- **Distributed Lock ở đây rất quan trọng!** Nếu không có lock, 1000 request cùng lúc sẽ query DB 1000 lần (Cache Stampede).
- **Lock chỉ dùng cho Warm-up**, còn Reserve thì dùng Lua Script (Atomic).
- **Async Persistence:** Việc cập nhật stock flash sale xuống MySQL diễn ra sau, qua `stockPersistenceService` (Write-Behind pattern).

---

## 2. Wallet (E-Wallet Payment)

### 2.1 Wallet - Normal Sale + Cache Miss

**Tình huống:** Thanh toán bằng ví điện tử, sản phẩm thường, Redis chưa có stock.

#### Luồng xử lý chi tiết:

```
Step 1: User clicks "Thanh toán Ví" -> POST /create-from-cart (method=WALLET)
        ↓
Step 2: OrderController gọi orderService.createOrderFromWallet()
        ↓
Step 3-6: [WARM-UP + RESERVE] Tương tự COD Normal (Steps 3-6)
        └─→ Kết quả: Stock reserved trong Redis (stock=98, reservation key created)
                ↓
Step 7: [SYNC - CRITICAL] OrderService gọi UserService để trừ tiền ví:
        ├─→ POST /wallet/deduct
        ├─→ Payload: {userId, amount: totalPrice, reason: "Pay order"}
        ├─→ UserService check balance:
        │      SELECT balance FROM wallets WHERE user_id = userId
        │      Balance = 500,000 VND, totalPrice = 100,000 VND
        │      → OK, đủ tiền
        ├─→ UPDATE wallets SET balance = balance - 100000 WHERE user_id = userId
        └─→ Return: {"success": true}
                ↓
Step 8: [SYNC] OrderService tạo Order ngay lập tức:
        ├─→ INSERT orders (status = PENDING, paymentMethod = WALLET)
        ├─→ INSERT order_items
        └─→ Gọi StockService.decreaseStock() để trừ DB:
                UPDATE product_size SET stock = stock - 2 WHERE id = sizeId
                ↓
Step 9: Confirm Reservation:
        └─→ DEL reserve:{tempOrderId}:{productId}:{sizeId}
                ↓
Step 10: Return to Client:
        └─→ {"status": "CONFIRMED", "orderId": "abc-123"}
```

**Điểm chú ý:**
- **Luồng Wallet là SYNC hoàn toàn**, không qua Kafka.
- **Nếu trừ tiền thất bại (Step 7 fails):**
  ```
  catch (WalletException) {
      → Gọi rollbackReservations(tempOrderId, reservedItems)
      → Lua Script cancel_reservation.lua:
            INCRBY stock:{productId}:{sizeId} 2  (Hoàn trả)
            DEL reserve:{tempOrderId}:{productId}:{sizeId}
      → Throw RuntimeException("Insufficient wallet balance")
  }
  ```

---

### 2.2 Wallet - Flash Sale + Cache Miss

#### Luồng xử lý chi tiết:

```
Step 1-6: [DISTRIBUTED LOCK + WARM-UP] Tương tự COD Flash Sale (Steps 1-6)
        └─→ Kết quả: flashsale:stock:{productId} = 48, reservation created
                ↓
Step 7: [SYNC] Trừ tiền ví (Tương tự Wallet Normal - Step 7)
        ↓
Step 8: [SYNC] Tạo Order (Tương tự Wallet Normal - Step 8)
        ↓
Step 9: [ASYNC PERSISTENCE] stockPersistenceService.persistFlashSaleStock():
        └─→ Kafka hoặc Batch Job cập nhật MySQL:
                UPDATE flash_sale_sessions SET stock = stock - 2
                WHERE product_id = productId
                ↓
Step 10: Confirm Reservation: DEL flashsale:reserve:{tempOrderId}:{productId}
```

**Điểm chú ý:**
- Flash Sale + Wallet kết hợp 2 cơ chế:
  - **Distributed Lock** cho warm-up cache.
  - **Sync payment** để đảm bảo user bị trừ tiền đúng.

---

## 3. VNPay (Online Payment)

### 3.1 VNPay - Normal Sale + Cache Miss

**Tình huống:** Thanh toán qua cổng VNPay, sản phẩm thường, Redis chưa có stock.

⚠️ **LƯU Ý QUAN TRỌNG:** Hiện tại hệ thống **KHÔNG giữ chỗ (Reserve)** khi tạo payment link! Đây là điểm yếu tiềm ẩn (Risk of Overselling).

#### Luồng xử lý chi tiết:

```
Step 1: User clicks "Thanh toán VNPay" -> Frontend gọi Payment Service
        └─→ POST /payment/vnpay/create
                ↓
Step 2: PaymentService.createPayment():
        ├─→ Tạo txnRef = random12digits()
        ├─→ Build VNPay URL với params: amount, orderInfo, returnUrl
        ├─→ Lưu Payment entity:
        │      status = PENDING
        │      orderData = JSON.stringify({userId, addressId, selectedItems})
        ├─→ INSERT payments table
        └─→ Return: {"paymentUrl": "https://vnpay.vn/...", "txnRef": "123456"}
                ↓
Step 3: User redirect đến VNPay -> Nhập thông tin thẻ -> Thanh toán
        ↓
Step 4: VNPay IPN Callback -> POST /payment/vnpay/callback
        ├─→ PaymentService.handleReturn() verify signature
        ├─→ Nếu hợp lệ:
        │      UPDATE payments SET status = PAID WHERE txnRef = "123456"
        └─→ Publish Kafka: PaymentEvent {status: PAID, orderData, userId, addressId}
                ↓
Step 5: [KAFKA CONSUMER] OrderService.consumePaymentEvent():
        ├─→ Parse orderData JSON -> List<SelectedItemDto>
        └─→ Gọi createOrderFromPayment()
                ↓
Step 6: [ĐÂY LÀ LÚC CHECK STOCK - SAU KHI ĐÃ TRỪ TIỀN!]
        ├─→ StockService lấy stock từ Redis:
        │      GET stock:{productId}:{sizeId} → NULL (Cache Miss)
        ├─→ [WARM-UP] Query MySQL:
        │      SELECT stock FROM product_size WHERE id = sizeId → stock = 100
        │      SET stock:{productId}:{sizeId} 100
        ├─→ Check: 100 >= qty? 
        │      Nếu OK → Proceed
        │      Nếu FAIL (hết hàng) → ⚠️ PHẢI HOÀN TIỀN!
        │             └─→ Gọi UserService.addRefundToWallet(userId, amount)
        │             └─→ Throw "Out of stock, refunded"
        └─→ Trừ stock: UPDATE product_size SET stock = stock - qty
                ↓
Step 7: Tạo Order (status = PENDING)
        ├─→ INSERT orders
        └─→ INSERT order_items
```

**Điểm chú ý:**
- **Rủi ro Overselling:** Giả sử còn 1 sản phẩm, 10 người cùng tạo payment link và thanh toán. Tất cả 10 người đều bị trừ tiền. Khi Callback về, chỉ người đầu tiên mua được, 9 người còn lại bị hoàn tiền.
- **Cache Miss ở đây ít nguy hiểm hơn** vì không có traffic spike (callback về từ từ).

---

### 3.2 VNPay - Flash Sale + Cache Miss

#### Luồng xử lý chi tiết:

```
Step 1-4: [PAYMENT PHASE] Tương tự VNPay Normal
        └─→ User đã bị trừ tiền, PaymentEvent được publish
                ↓
Step 5: [KAFKA CONSUMER] OrderService nhận PaymentEvent:
        └─→ Parse orderData -> selectedItems (có flag isFlashSale=true)
                ↓
Step 6: [CRITICAL - CHECK FLASH SALE STOCK]
        ├─→ FlashSaleService.reserveFlashSaleStock():
        │      Phát hiện Cache Miss
        │      └─→ [DISTRIBUTED LOCK] executeWithLock("lock:flashsale:{productId}")
        │             ├─→ SETNX lock (chỉ 1 thread được quyền)
        │             ├─→ Query MySQL: 
        │             │      SELECT fs.stock FROM flash_sale_sessions fs
        │             │      WHERE product_id = productId
        │             ├─→ stock = 10
        │             ├─→ SET flashsale:stock:{productId} 10
        │             └─→ DEL lock
        │      
        │      └─→ Lua Script flashsale_reserve.lua:
        │             ├─→ Check limitPerUser (VD: 2)
        │             │      GET flashsale:bought:{userId}:{productId} → 0
        │             ├─→ Check stock: 10 >= qty (2) → OK
        │             ├─→ DECRBY flashsale:stock:{productId} 2 → 8
        │             ├─→ INCRBY flashsale:bought:{userId}:{productId} 2
        │             └─→ Return 1 (Success)
        │
        └─→ Nếu FAIL (hết hàng hoặc vượt limit):
                ⚠️ User đã trả tiền rồi!
                └─→ Gọi UserService.addRefundToWallet()
                └─→ Log error, gửi email xin lỗi
                ↓
Step 7: Tạo Order (nếu stock OK)
        ├─→ INSERT orders (isFlashSale=true)
        └─→ Async persist: UPDATE flash_sale_sessions SET stock = stock - 2
```

**Điểm chú ý:**
- **Rủi ro cao nhất ở kịch bản này!** Flash Sale + Payment Online = Có thể nhiều người thanh toán nhưng hết hàng sau đó.
- **Giải pháp cải tiến:** Nên thêm bước Reserve Stock **TRƯỚC KHI** tạo payment link.

---

## 4. Momo (Online Payment)

Luồng Momo **hoàn toàn tương tự VNPay**, chỉ khác tên service và endpoint:
- VNPay: `VnpayPaymentService`
- Momo: `MomoPaymentService`

### 4.1 Momo - Normal Sale + Cache Miss
→ Tham khảo [VNPay Normal](#31-vnpay---normal-sale--cache-miss)

### 4.2 Momo - Flash Sale + Cache Miss
→ Tham khảo [VNPay Flash Sale](#32-vnpay---flash-sale--cache-miss)

---

## Tóm Tắt So Sánh 4 Loại Checkout

| **Loại**        | **Reserve Stock?** | **Sync/Async?** | **Risk Overselling** | **Cache Miss Handling**          |
|-----------------|--------------------|-----------------|----------------------|----------------------------------|
| **COD**         | ✅ Trước           | Async           | ❌ Thấp              | Warm-up đơn giản (DB → Redis)    |
| **Wallet**      | ✅ Trước           | Sync            | ❌ Thấp              | Warm-up + Rollback nếu lỗi       |
| **VNPay/Momo**  | ❌ Không           | Async           | ⚠️ **CAO**           | Warm-up sau khi trả tiền (Risk!) |

**Flash Sale Cache Miss:** Luôn dùng **Distributed Lock** để tránh Cache Stampede khi warm-up.

---

*Tài liệu này được soạn để hỗ trợ trình bày trong buổi phỏng vấn. Chúc bạn thành công!*
