# Event-Driven Architecture - Payment Service Integration

## Tổng Quan

Dự án đã được refactor từ **Synchronous REST (Feign)** sang **Event-Driven Architecture (Kafka)** cho luồng thanh toán VNPay. Điều này giúp:

- **Decoupling**: Payment service và Order service không phụ thuộc trực tiếp vào nhau
- **Scalability**: Dễ dàng scale từng service độc lập
- **Reliability**: Kafka đảm bảo message delivery, có thể retry nếu lỗi
- **Consistency**: Cùng pattern với COD flow (cũng dùng Kafka)

---

## Kiến Trúc Tổng Thể

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │
       │ 1. POST /v1/payment/vnpay/create
       ▼
┌─────────────────────┐
│  Payment Service    │
│  (Port 8006)        │
│                     │
│  - Create Payment   │
│  - Handle Callback  │
│  - Publish Events   │
└──────┬──────────────┘
       │
       │ 2. Publish PaymentEvent to Kafka
       ▼
┌─────────────────────┐
│   Kafka Broker      │
│   (Topic: payment)  │
└──────┬──────────────┘
       │
       │ 3. Consume PaymentEvent
       ▼
┌─────────────────────┐
│   Order Service     │
│   (Port 8005)       │
│                     │
│  - Create Order     │
│  - Update Status    │
│  - Rollback Stock   │
└─────────────────────┘
```

---

## Luồng Thanh Toán VNPay (Event-Driven)

### Bước 1: User Chọn Thanh Toán VNPay

**Frontend** (`my-app/src/components/client/cart/ListCart.jsx`):
```javascript
// User chọn VNPay và click checkout
handleCheckout() {
  const orderData = {
    userId: currentUser.id,
    addressId: selectedAddress.id,
    selectedItems: selectedItems
  };
  
  // Gọi payment-service để tạo payment URL
  const response = await createVnpayPayment({
    amount: totalPrice,
    orderDataJson: JSON.stringify(orderData)
  });
  
  // Redirect đến VNPay
  window.location.href = response.paymentUrl;
}
```

### Bước 2: Payment Service Tạo Payment

**Payment Service** (`payment-service/src/main/java/.../VnpayPaymentService.java`):
```java
public PaymentUrlResponse createPayment(CreateVnpayPaymentRequest req) {
    // 1. Tạo VNPay payment URL
    String paymentUrl = buildVnpayUrl(...);
    
    // 2. Lưu Payment vào DB với status PENDING
    Payment payment = Payment.builder()
        .txnRef(vnpTxnRef)
        .status(PaymentStatus.PENDING)
        .orderData(orderDataJson) // Lưu tạm order data
        .build();
    paymentRepository.save(payment);
    
    // 3. Trả về payment URL cho frontend
    return new PaymentUrlResponse("00", "success", paymentUrl, vnpTxnRef);
}
```

**Lưu ý**: Order chưa được tạo ở bước này!

### Bước 3: User Thanh Toán trên VNPay

- User được redirect đến VNPay sandbox
- User nhập thông tin thẻ và thanh toán
- VNPay redirect về `http://localhost:5173/payment/vnpay/return` với các tham số callback

### Bước 4: Payment Service Xử Lý Callback

**Payment Service** (`VnpayPaymentService.handleReturn()`):
```java
public PaymentStatus handleReturn(Map<String, String[]> params) {
    // 1. Verify VNPay secure hash
    if (!VnpayUtil.verifySecureHash(params, hashSecret)) {
        return PaymentStatus.FAILED;
    }
    
    // 2. Parse callback parameters
    String responseCode = params.get("vnp_ResponseCode");
    boolean success = "00".equals(responseCode);
    
    // 3. Update Payment status
    payment.setStatus(success ? PaymentStatus.PAID : PaymentStatus.FAILED);
    paymentRepository.save(payment);
    
    // 4. Publish PaymentEvent to Kafka
    PaymentEvent event = PaymentEvent.builder()
        .paymentId(payment.getId())
        .txnRef(payment.getTxnRef())
        .status(payment.getStatus().name())
        .userId(extractUserIdFromOrderData(...))
        .addressId(extractAddressIdFromOrderData(...))
        .orderDataJson(payment.getOrderData())
        .build();
    
    kafkaTemplate.send("payment-topic", payment.getTxnRef(), event);
    
    return payment.getStatus();
}
```

**Kafka Topic**: `payment-topic`

### Bước 5: Order Service Consume Event

**Order Service** (`order-service/src/main/java/.../OrderServiceImpl.java`):
```java
@KafkaListener(topics = "#{@paymentTopic.name}", groupId = "order-service-payment")
@Transactional
public void consumePaymentEvent(PaymentEvent event) {
    if ("PAID".equals(event.getStatus())) {
        // Payment thành công
        
        if (event.getOrderId() != null) {
            // Order đã tồn tại - chỉ update status
            Order order = orderRepository.findById(event.getOrderId());
            order.setOrderStatus(OrderStatus.PAID);
            orderRepository.save(order);
        } else {
            // Order chưa tồn tại - tạo mới từ orderData
            List<SelectedItemDto> selectedItems = parseOrderData(event.getOrderDataJson());
            Order order = createOrderFromPayment(
                event.getUserId(), 
                event.getAddressId(), 
                selectedItems
            );
            // Order được tạo với status PAID ngay từ đầu
        }
    } else if ("FAILED".equals(event.getStatus())) {
        // Payment thất bại - rollback nếu có order
        if (event.getOrderId() != null) {
            rollbackOrderStock(event.getOrderId());
        }
    }
}
```

---

## So Sánh: COD vs VNPay

### COD (Cash on Delivery) - Đã có sẵn

```
Frontend → Order Service → Kafka (order-topic) → Order Service Consumer
```

- Order được tạo ngay với status `PENDING`
- Thanh toán khi nhận hàng
- Dùng Kafka để tạo order asynchronously

### VNPay (Online Payment) - Mới refactor

```
Frontend → Payment Service → VNPay Gateway → Payment Service Callback
                                                      ↓
                                            Kafka (payment-topic)
                                                      ↓
                                            Order Service Consumer
```

- Order chỉ được tạo SAU KHI thanh toán thành công
- Order được tạo với status `PAID` ngay từ đầu
- Dùng Kafka để decouple payment và order services

---

## Cấu Hình Kafka

### Payment Service (`payment-service/src/main/resources/application.properties`)

```properties
# Kafka Producer
spring.kafka.producer.bootstrap-servers=localhost:9092
spring.kafka.producer.key-serializer=org.apache.kafka.common.serialization.StringSerializer
spring.kafka.producer.value-serializer=org.springframework.kafka.support.serializer.JsonSerializer

# Topic
kafka.topic.payment=payment-topic
```

### Order Service (`order-service/src/main/resources/application.properties`)

```properties
# Kafka Consumer
spring.kafka.consumer.bootstrap-servers=localhost:9092
spring.kafka.consumer.key-deserializer=org.apache.kafka.common.serialization.StringDeserializer
spring.kafka.consumer.value-deserializer=org.springframework.kafka.support.serializer.JsonDeserializer
spring.kafka.consumer.properties.spring.json.trusted.packages=*

# Topics
kafka.topic.payment=payment-topic
kafka.topic.order=order-topic
kafka.topic.notification=notification-topic

# Consumer Group
spring.kafka.consumer.group-id=order-service-group
```

### Kafka Config (`order-service/src/main/java/.../KafkaConfig.java`)

```java
@Bean
public NewTopic paymentTopic() {
    return TopicBuilder.name("payment-topic")
            .partitions(10)
            .replicas(1)
            .build();
}
```

---

## PaymentEvent DTO

**Location**: 
- `payment-service/src/main/java/.../dto/PaymentEvent.java`
- `order-service/src/main/java/.../dto/PaymentEvent.java`

```java
public class PaymentEvent {
    private String paymentId;
    private String txnRef;
    private String orderId;          // null nếu order chưa tạo
    private String status;            // PAID, FAILED
    private BigDecimal amount;
    private String currency;
    private String method;            // VNPAY, CARD
    private String bankCode;
    private String cardType;
    private String gatewayTxnNo;
    private String responseCode;
    
    // Dữ liệu để tạo order sau khi payment thành công
    private String userId;
    private String addressId;
    private String orderDataJson;     // JSON của selectedItems
    
    private Instant timestamp;
}
```

---

## Rollback Mechanism

Khi payment thất bại, Order Service sẽ:

1. **Nếu order đã tồn tại**: Gọi `rollbackOrderStock(orderId)`
   - Tăng lại stock cho các sản phẩm
   - Cancel order (status = CANCELLED)

2. **Nếu order chưa tồn tại**: Không cần rollback (chưa trừ stock)

**Code** (`OrderServiceImpl.rollbackOrderStock()`):
```java
@Transactional
public void rollbackOrderStock(String orderId) {
    Order order = orderRepository.findById(orderId)
        .orElseThrow(() -> new RuntimeException("Order not found"));
    
    // Tăng lại stock
    for (OrderItem item : order.getOrderItems()) {
        stockServiceClient.increaseStock(item.getSizeId(), item.getQuantity());
    }
    
    // Cancel order
    order.setOrderStatus(OrderStatus.CANCELLED);
    orderRepository.save(order);
}
```

---

## Lợi Ích của Event-Driven Architecture

### 1. **Decoupling**
- Payment service không cần biết về Order service
- Order service không cần biết về Payment service
- Dễ dàng thay đổi implementation của từng service

### 2. **Scalability**
- Có thể scale Payment service và Order service độc lập
- Kafka handle high throughput tốt hơn REST calls

### 3. **Reliability**
- Kafka đảm bảo message delivery (at-least-once)
- Có thể retry nếu consumer xử lý lỗi
- Message được persist trong Kafka

### 4. **Consistency**
- Cùng pattern với COD flow (cũng dùng Kafka)
- Dễ maintain và hiểu code

### 5. **Asynchronous Processing**
- Payment service không phải đợi Order service xử lý xong
- User nhận response nhanh hơn

---

## Troubleshooting

### 1. Payment thành công nhưng Order không được tạo

**Kiểm tra**:
- Kafka broker có đang chạy không? (`localhost:9092`)
- Payment event có được publish không? (check logs của Payment Service)
- Order Service consumer có nhận được event không? (check logs của Order Service)

**Logs cần check**:
```
[PAYMENT] Published payment event to Kafka: txnRef=..., status=PAID
[PAYMENT-CONSUMER] Received payment event: txnRef=..., status=PAID
```

### 2. Payment failed nhưng Stock không được rollback

**Kiểm tra**:
- Order có tồn tại không? (check `event.getOrderId()`)
- `rollbackOrderStock()` có được gọi không?
- Stock service có available không?

### 3. Kafka connection errors

**Kiểm tra**:
- Kafka broker đang chạy: `docker ps` (nếu dùng Docker)
- Bootstrap servers config đúng: `localhost:9092`
- Network connectivity giữa services và Kafka

---

## Recommendations cho Dự Án

### 1. **Idempotency**
- Implement idempotency key cho PaymentEvent để tránh duplicate processing
- Sử dụng `txnRef` làm key trong Kafka message

### 2. **Error Handling & Retry**
- Implement retry mechanism với exponential backoff
- Dead Letter Queue (DLQ) cho messages không thể xử lý

### 3. **Monitoring & Observability**
- Add metrics (Prometheus) cho payment success/failure rate
- Distributed tracing (Zipkin/Jaeger) để track request flow
- Log aggregation (ELK stack)

### 4. **Saga Pattern** (cho tương lai)
- Nếu có nhiều services cần coordinate (Payment → Order → Inventory → Shipping)
- Dùng Saga pattern để manage distributed transactions

### 5. **Event Sourcing** (cho tương lai)
- Store tất cả payment events để có audit trail
- Có thể replay events để rebuild state

### 6. **API Gateway Rate Limiting**
- Implement rate limiting cho payment endpoints
- Prevent abuse và DDoS attacks

### 7. **Payment Webhook**
- Thay vì redirect callback, implement webhook từ VNPay
- More reliable và secure hơn

### 8. **Database Transactions**
- Đảm bảo Payment và Order updates là atomic
- Use distributed transactions nếu cần (2PC, Saga)

---

## Kết Luận

Việc refactor từ **Synchronous REST (Feign)** sang **Event-Driven Architecture (Kafka)** giúp:

✅ **Decouple** Payment và Order services  
✅ **Scale** tốt hơn với high throughput  
✅ **Reliable** hơn với message persistence  
✅ **Consistent** với COD flow  
✅ **Maintainable** và dễ extend trong tương lai  

Pattern này phù hợp cho **microservices architecture** và **large-scale systems**.

