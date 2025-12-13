# Giải Thích Flow Đặt Hàng: COD vs VNPay

## Tổng Quan

Hệ thống hỗ trợ 2 phương thức thanh toán:
- **COD (Cash on Delivery)**: Thanh toán khi nhận hàng
- **VNPay**: Thanh toán online qua VNPay gateway

---

## 🔵 FLOW 1: COD (Cash on Delivery)

### Mô Tả
User chọn COD → Order được tạo ngay → Thanh toán khi nhận hàng

### Chi Tiết Flow

```
1. Frontend (Checkout)
   ↓
   POST /order/create-from-cart
   Body: {
     addressId: "...",
     selectedItems: [...],
     paymentMethod: "COD"
   }
   ↓
2. Order Service (OrderController.createOrderFromCart)
   - Validate paymentMethod (chỉ chấp nhận COD)
   - Validate address, cart, stock
   - Gọi orderService.orderByKafka()
   ↓
3. Order Service (OrderServiceImpl.orderByKafka)
   - Validate cart, address, stock
   - Tạo CheckOutKafkaRequest với paymentMethod = "COD"
   - Gửi message vào Kafka topic: "order-topic"
   ↓
4. Kafka Message Queue
   Topic: order-topic
   Message: CheckOutKafkaRequest {
     userId, addressId, selectedItems, paymentMethod: "COD"
   }
   ↓
5. Order Service Consumer (OrderServiceImpl.consumeCheckout)
   - Validate stock
   - Tạo Order với:
     * orderStatus = PENDING
     * paymentMethod = "COD"
   - Tạo OrderItems và giảm stock
   - Cleanup cart
   - Gửi notifications
   ↓
6. Kết Quả
   ✅ Order được tạo với status PENDING
   ✅ paymentMethod = "COD"
   ✅ Stock đã được giảm
   ✅ Cart đã được cleanup
```

### Đặc Điểm
- ✅ Order được tạo **NGAY LẬP TỨC** (không cần chờ thanh toán)
- ✅ Order status: **PENDING** (chờ shop xác nhận)
- ✅ Payment method: **COD**
- ✅ Không có Payment record (vì chưa thanh toán)
- ✅ Thanh toán khi nhận hàng

---

## 🟢 FLOW 2: VNPay (Online Payment)

### Mô Tả
User chọn VNPay → Tạo Payment → Redirect VNPay → Thanh toán → Callback → Tạo Order

### Chi Tiết Flow

#### Bước 1: Tạo Payment Request
```
1. Frontend (Checkout)
   ↓
   POST /payment/vnpay/create
   Body: {
     amount: 100000,
     userId: "...",
     addressId: "...",
     orderDataJson: "{selectedItems: [...]}"
   }
   ↓
2. Payment Service (VnpayPaymentService.createPayment)
   - Tạo VNPay payment URL
   - Lưu Payment với:
     * status = PENDING
     * method = VNPAY
     * orderId = null (chưa có order)
     * orderData = JSON string (lưu tạm để tạo order sau)
   ↓
3. Response
   {
     code: "00",
     message: "success",
     paymentUrl: "https://sandbox.vnpayment.vn/...",
     txnRef: "123456789012"
   }
   ↓
4. Frontend
   - Redirect user đến paymentUrl (VNPay gateway)
```

#### Bước 2: User Thanh Toán tại VNPay
```
5. User thanh toán tại VNPay gateway
   - Nhập thông tin thẻ/ngân hàng
   - Xác nhận thanh toán
   ↓
6. VNPay redirect về returnUrl
   GET /payment/vnpay/return?vnp_ResponseCode=00&vnp_TxnRef=...
```

#### Bước 3: Xử Lý Callback
```
7. Payment Service (VnpayPaymentService.handleReturn)
   - Verify VNPay secure hash
   - Parse callback parameters
   - Update Payment:
     * status = PAID (nếu thành công) hoặc FAILED
     * responseCode, gatewayTxnNo, bankCode, etc.
   - Lưu rawCallback (JSON)
   ↓
8. Publish PaymentEvent to Kafka
   Topic: payment-topic
   Message: PaymentEvent {
     paymentId, txnRef, orderId (null),
     status: "PAID",
     method: "VNPAY",
     userId, addressId, orderDataJson
   }
```

#### Bước 4: Tạo Order từ Payment
```
9. Order Service Consumer (OrderServiceImpl.consumePaymentEvent)
   - Nhận PaymentEvent từ Kafka
   - Nếu status = "PAID":
     * Parse orderDataJson → selectedItems
     * Gọi createOrderFromPayment()
   ↓
10. Order Service (OrderServiceImpl.createOrderFromPayment)
    - Validate address, stock
    - Tạo Order với:
      * orderStatus = PENDING (chờ shop xác nhận)
      * paymentMethod = "VNPAY"
    - Tạo OrderItems và giảm stock
    - Cleanup cart
    - Gửi notifications
    ↓
11. Update Payment với orderId
    - Link Payment với Order đã tạo
```

### Đặc Điểm
- ✅ Order chỉ được tạo **SAU KHI thanh toán thành công**
- ✅ Order status: **PENDING** (chờ shop xác nhận)
- ✅ Payment method: **VNPAY**
- ✅ Có Payment record với status = PAID
- ✅ Payment và Order được link qua orderId

---

## 📊 So Sánh COD vs VNPay

| Tiêu Chí | COD | VNPay |
|----------|-----|-------|
| **Thời điểm tạo Order** | Ngay khi user click "Đặt hàng" | Sau khi thanh toán thành công |
| **Order Status ban đầu** | PENDING | PENDING |
| **Payment Method** | COD | VNPAY |
| **Payment Record** | ❌ Không có | ✅ Có (status = PAID) |
| **Kafka Topic** | order-topic | payment-topic → order-topic |
| **Stock giảm khi nào** | Khi tạo order | Khi tạo order (sau payment) |
| **Cart cleanup khi nào** | Khi tạo order | Khi tạo order (sau payment) |
| **Thanh toán** | Khi nhận hàng | Trước khi tạo order |

---

## 🔄 Order Status Lifecycle

Cả COD và VNPay đều có cùng lifecycle:

```
PENDING (Tạo order)
    ↓
PROCESSING (Shop xác nhận)
    ↓
SHIPPED (Đã gửi hàng)
    ↓
DELIVERED (Đã giao hàng)
    ↓
COMPLETED (Hoàn thành)
```

**Lưu ý:**
- COD: Thanh toán khi status = DELIVERED
- VNPay: Đã thanh toán trước khi tạo order (Payment status = PAID)

---

## 🗄️ Database Schema

### Order Table
```sql
orders:
  - id (UUID)
  - user_id
  - address_id
  - total_price
  - order_status (PENDING, PROCESSING, SHIPPED, DELIVERED, ...)
  - payment_method (COD, VNPAY, CARD)  ← MỚI THÊM
  - created_at
  - updated_at
```

### Payment Table
```sql
payments:
  - id (UUID)
  - order_id (nullable - có thể null nếu order chưa tạo)
  - txn_ref (unique)
  - amount
  - currency
  - method (VNPAY)
  - status (PENDING, PAID, FAILED)
  - order_data (TEXT) ← Lưu JSON để tạo order sau
  - created_at
  - updated_at
```

---

## 🔍 Cách Phân Biệt Order COD vs VNPay

### Trong Code
```java
// Query orders by payment method
List<Order> codOrders = orderRepository.findByPaymentMethod("COD");
List<Order> vnpayOrders = orderRepository.findByPaymentMethod("VNPAY");

// Check payment method
if ("COD".equals(order.getPaymentMethod())) {
    // COD logic
} else if ("VNPAY".equals(order.getPaymentMethod())) {
    // VNPay logic - có thể query Payment record
    Payment payment = paymentRepository.findByOrderId(order.getId());
}
```

### Trong Database
```sql
-- COD orders
SELECT * FROM orders WHERE payment_method = 'COD';

-- VNPay orders
SELECT * FROM orders WHERE payment_method = 'VNPAY';

-- VNPay orders với Payment info
SELECT o.*, p.status as payment_status, p.txn_ref
FROM orders o
JOIN payments p ON o.id = p.order_id
WHERE o.payment_method = 'VNPAY';
```

---

## ⚠️ Lưu Ý Quan Trọng

1. **Order Status không phải PAID**
   - Order status luôn là **PENDING** khi tạo (cả COD và VNPay)
   - Payment status mới có **PAID** (trong Payment entity)

2. **VNPay Flow: Order tạo sau Payment**
   - Payment được tạo trước với `orderId = null`
   - Order được tạo sau khi payment thành công
   - Sau đó Payment được update với `orderId`

3. **Stock Management**
   - COD: Stock giảm ngay khi tạo order
   - VNPay: Stock giảm sau khi payment thành công (khi tạo order)

4. **Error Handling**
   - COD: Nếu tạo order fail → không có order, stock không giảm
   - VNPay: Nếu tạo order fail → Payment đã PAID nhưng không có order (cần retry hoặc manual intervention)

---

## 📝 Tóm Tắt

### COD Flow
```
Frontend → Order Service → Kafka → Order Created (PENDING, COD)
```

### VNPay Flow
```
Frontend → Payment Service → VNPay Gateway → Payment Callback 
→ Kafka (payment-topic) → Order Service → Order Created (PENDING, VNPAY)
```

Cả hai đều tạo order với status **PENDING** và có field **paymentMethod** để phân biệt.

