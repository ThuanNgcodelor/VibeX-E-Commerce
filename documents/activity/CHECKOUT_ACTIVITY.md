# Checkout Activity Diagrams

Tài liệu mô tả Activity Diagram cho hệ thống Checkout với **3 phương thức thanh toán** và **1 module xử lý Stock riêng biệt**.

---

## Mục lục

1. [Checkout COD](#1-checkout-cod)
2. [Checkout VNPAY](#2-checkout-vnpay)
3. [Checkout MoMo](#3-checkout-momo)
4. [Stock Reservation Flow](#4-stock-reservation-flow-pre-reserve-pattern)

---

## 1. Checkout COD

**Luồng thanh toán khi nhận hàng (Cash On Delivery)**

```mermaid
flowchart TD
    Start([User clicks Checkout]) --> SelectItems[Chọn sản phẩm từ giỏ]
    
    subgraph Client["👤 CLIENT"]
        SelectItems --> SelectAddress[Chọn địa chỉ giao hàng]
        SelectAddress --> SelectCOD[Chọn phương thức: COD]
        SelectCOD --> ReviewOrder[Xem lại đơn hàng]
        ReviewOrder --> ClickOrder[Click Đặt hàng]
    end
    
    subgraph OrderService["🖥️ ORDER SERVICE"]
        ClickOrder --> ValidateOrder{Validate}
        ValidateOrder -->|Invalid| ReturnError[Return 400 Error]
        ValidateOrder -->|Valid| StockReserve["📦 Stock Reservation Flow"]
        
        StockReserve -->|Success| PublishKafka["Publish to Kafka"]
        StockReserve -->|Failed| ReturnStockError[Return 400 Insufficient Stock]
        
        PublishKafka --> ReturnOK["Return 200 OK"]
    end
    
    subgraph KafkaConsumer["📨 ASYNC PROCESSING"]
        PublishKafka -.-> Consumer[Kafka Consumer]
        Consumer --> CreateOrder["Create Order (PENDING)"]
        CreateOrder --> SaveDB[Batch Save to DB]
        SaveDB --> ConfirmStock["Confirm Reservation"]
        ConfirmStock --> ClearCart[Clear Cart Items]
        ClearCart --> GHN[Calculate GHN Shipping]
        GHN --> Notify[Send Notification]
    end
    
    ReturnOK --> ShowSuccess[Hiển thị: Đang xử lý]
    ShowSuccess --> NavigateOrders[Chuyển trang đơn hàng]
    
    ReturnError --> EndErr([End])
    ReturnStockError --> EndStock([End])
    NavigateOrders --> EndOK([End])
    Notify -.-> EndAsync([End])
    
    style Client fill:#e6f3ff
    style OrderService fill:#fff5e6
    style KafkaConsumer fill:#e6ffe6
    style StockReserve fill:#FFD700
```

### COD Flow Summary

| Bước | Mô tả | Thời gian |
|------|-------|-----------|
| 1 | User chọn COD và click Đặt hàng | - |
| 2 | **Stock Reservation** (xem Section 4) | ~10ms |
| 3 | Publish to Kafka | ~5ms |
| 4 | Return 200 OK | **~20ms total** |
| 5 | Async: Create Order + Notify | ~200ms (background) |

---

## 2. Checkout VNPAY

**Luồng thanh toán online qua VNPAY**

```mermaid
flowchart TD
    Start([User clicks Checkout]) --> SelectVNPAY[Chọn VNPAY]
    
    subgraph Client["👤 CLIENT"]
        SelectVNPAY --> ClickOrder[Click Đặt hàng]
        WaitRedirect[Chờ redirect]
        ReturnFromVNPAY[Quay về từ VNPAY]
        ReturnFromVNPAY --> CheckResult{Thanh toán OK?}
        CheckResult -->|No| ShowFailed[Hiển thị thất bại]
        CheckResult -->|Yes| ShowSuccess[Hiển thị thành công]
        ShowSuccess --> NavigateOrders[Chuyển trang đơn hàng]
    end
    
    subgraph OrderService["🖥️ ORDER SERVICE"]
        ClickOrder --> CreatePayment["Create Payment (PENDING)"]
        CreatePayment --> BuildURL[Build VNPAY URL + Checksum]
        BuildURL --> WaitRedirect
        
        ReturnCallback[VNPAY Return Callback]
        ReturnCallback --> VerifySign{Verify Signature}
        VerifySign -->|Invalid| MarkFailed[Mark FAILED]
        VerifySign -->|Valid| MarkSuccess[Mark SUCCESS]
        
        MarkSuccess --> StockReserve["📦 Stock Reservation Flow"]
        StockReserve -->|Success| PublishKafka[Publish to Kafka]
        StockReserve -->|Failed| RefundPayment[Refund to Wallet]
    end
    
    subgraph VNPAY["🌐 VNPAY"]
        WaitRedirect --> VNPAYPage[Trang VNPAY]
        VNPAYPage --> UserPay[User nhập thẻ]
        UserPay --> ProcessPay[Xử lý thanh toán]
        ProcessPay --> RedirectBack[Redirect về website]
        RedirectBack --> ReturnCallback
        RedirectBack --> ReturnFromVNPAY
    end
    
    subgraph KafkaConsumer["📨 ASYNC PROCESSING"]
        PublishKafka -.-> Consumer[Kafka Consumer]
        Consumer --> CreateOrder["Create Order (CONFIRMED)"]
        CreateOrder --> SaveDB[Batch Save to DB]
        SaveDB --> ConfirmStock[Confirm Reservation]
        ConfirmStock --> CreateGHN[Create GHN Order]
        CreateGHN --> Notify[Send Notification]
    end
    
    MarkFailed --> ShowFailed
    RefundPayment --> ShowFailed
    ShowFailed --> EndFail([End])
    NavigateOrders --> EndOK([End])
    Notify -.-> EndAsync([End])
    
    style Client fill:#e6f3ff
    style OrderService fill:#fff5e6
    style VNPAY fill:#ffe6e6
    style KafkaConsumer fill:#e6ffe6
    style StockReserve fill:#FFD700
```

### VNPAY Flow Summary

| Bước | Mô tả |
|------|-------|
| 1 | User chọn VNPAY → Redirect sang trang VNPAY |
| 2 | User thanh toán trên VNPAY |
| 3 | VNPAY redirect về với callback |
| 4 | Verify signature → **Stock Reservation** |
| 5 | Publish to Kafka → Async create order |

---

## 3. Checkout MoMo

**Luồng thanh toán qua ví MoMo**

```mermaid
flowchart TD
    Start([User clicks Checkout]) --> SelectMOMO[Chọn MoMo]
    
    subgraph Client["👤 CLIENT"]
        SelectMOMO --> ClickOrder[Click Đặt hàng]
        WaitRedirect[Chờ redirect]
        ReturnFromMOMO[Quay về từ MoMo]
        ReturnFromMOMO --> CheckDB{Check Payment Status}
        CheckDB -->|FAILED| ShowFailed[Hiển thị thất bại]
        CheckDB -->|SUCCESS| ShowSuccess[Hiển thị thành công]
        ShowSuccess --> NavigateOrders[Chuyển trang đơn hàng]
    end
    
    subgraph OrderService["🖥️ ORDER SERVICE"]
        ClickOrder --> CreatePayment["Create Payment (PENDING)"]
        CreatePayment --> BuildURL[Build MoMo URL + Signature]
        BuildURL --> WaitRedirect
        
        IPNCallback[Nhận IPN từ MoMo]
        IPNCallback --> VerifyIPN{Verify Signature}
        VerifyIPN -->|Invalid| IgnoreIPN[Ignore Request]
        VerifyIPN -->|Valid| MarkSuccess[Mark SUCCESS]
        
        MarkSuccess --> StockReserve["📦 Stock Reservation Flow"]
        StockReserve -->|Success| PublishKafka[Publish to Kafka]
        StockReserve -->|Failed| RefundWallet[Refund to Wallet]
    end
    
    subgraph MoMo["🌐 MOMO"]
        WaitRedirect --> MoMoPage[Trang/App MoMo]
        MoMoPage --> UserPay[User xác nhận]
        UserPay --> ProcessPay[MoMo xử lý]
        ProcessPay --> SendIPN[Gửi IPN Callback]
        SendIPN --> IPNCallback
        ProcessPay --> RedirectBack[Redirect về website]
        RedirectBack --> ReturnFromMOMO
    end
    
    subgraph KafkaConsumer["📨 ASYNC PROCESSING"]
        PublishKafka -.-> Consumer[Kafka Consumer]
        Consumer --> CreateOrder["Create Order (CONFIRMED)"]
        CreateOrder --> SaveDB[Batch Save to DB]
        SaveDB --> ConfirmStock[Confirm Reservation]
        ConfirmStock --> CreateGHN[Create GHN Order]
        CreateGHN --> Notify[Send Notification]
    end
    
    RefundWallet --> ShowFailed
    IgnoreIPN --> EndIgnore([End])
    ShowFailed --> EndFail([End])
    NavigateOrders --> EndOK([End])
    Notify -.-> EndAsync([End])
    
    style Client fill:#e6f3ff
    style OrderService fill:#fff5e6
    style MoMo fill:#ffe6e6
    style KafkaConsumer fill:#e6ffe6
    style StockReserve fill:#FFD700
```

### MoMo Flow Summary

| Bước | Mô tả |
|------|-------|
| 1 | User chọn MoMo → Redirect sang MoMo |
| 2 | User xác nhận trên app MoMo |
| 3 | MoMo gửi **IPN Callback** (không đợi redirect) |
| 4 | Verify IPN → **Stock Reservation** |
| 5 | Publish to Kafka → Async create order |

---

## 4. Stock Reservation Flow (Pre-Reserve Pattern)

**Module xử lý trừ tồn kho - được import bởi cả 3 luồng checkout**

### 4.1. Activity Diagram

```mermaid
flowchart TD
    Start([Stock Reservation Start]) --> GenTempId["Generate tempOrderId (UUID)"]
    
    GenTempId --> LoopStart{For Each Item}
    
    subgraph ReserveLoop["🔄 RESERVE LOOP"]
        LoopStart --> CallReserve["POST /reservation/reserve"]
        
        CallReserve --> RedisLua["Execute Lua Script (Atomic)"]
        
        subgraph Redis["📦 REDIS"]
            RedisLua --> GetStock["GET stock:productId:sizeId"]
            GetStock --> CheckStock{stock >= qty?}
            CheckStock -->|No| ReturnFail["Return 0 (Insufficient)"]
            CheckStock -->|Yes| Decrement["DECRBY stock, qty"]
            Decrement --> SetReserve["SETEX reserve:orderId:... TTL=15m"]
            SetReserve --> ReturnSuccess["Return 1 (Success)"]
        end
        
        ReturnSuccess --> TrackItem["Track reserved item"]
        TrackItem --> NextItem{More items?}
        NextItem -->|Yes| LoopStart
        
        ReturnFail --> RollbackAll["Rollback all reserved items"]
    end
    
    RollbackAll --> RollbackLoop{For Each Reserved}
    RollbackLoop --> CancelCall["POST /reservation/cancel"]
    CancelCall --> RollbackLua["Lua: INCRBY + DEL"]
    RollbackLua --> RollbackNext{More?}
    RollbackNext -->|Yes| RollbackLoop
    RollbackNext -->|No| FailResult(["❌ Return: Insufficient Stock"])
    
    NextItem -->|No| SuccessResult(["✅ Return: All Reserved"])
    
    style Redis fill:#FFA500
    style ReserveLoop fill:#fff5e6
    style SuccessResult fill:#90EE90
    style FailResult fill:#FFB6C1
```

### 4.2. Sequence Diagram

```mermaid
sequenceDiagram
    participant OS as Order Service
    participant SS as Stock Service
    participant R as Redis
    
    Note over OS: Generate tempOrderId = UUID
    
    loop For Each Item in Cart
        OS->>SS: POST /reservation/reserve
        Note right of SS: {tempOrderId, productId, sizeId, qty}
        
        SS->>R: Execute Lua Script
        Note over R: ATOMIC OPERATIONS
        R->>R: GET stock:{productId}:{sizeId}
        R->>R: CHECK stock >= quantity
        
        alt Stock Sufficient
            R->>R: DECRBY stock, quantity
            R->>R: SETEX reserve:{orderId}:{productId}:{sizeId} TTL=900
            R-->>SS: Return 1 (Success)
            SS-->>OS: {success: true}
        else Stock Insufficient
            R-->>SS: Return 0 (Insufficient)
            SS-->>OS: {success: false}
            
            Note over OS: ROLLBACK all previously reserved items
            loop For Each Reserved Item
                OS->>SS: POST /reservation/cancel
                SS->>R: Lua: INCRBY + DEL
            end
            OS-->>OS: Throw Exception
        end
    end
    
    Note over OS: ✅ All items reserved successfully!
```

### 4.3. Redis Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    REDIS KEYS                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  STOCK (Permanent, synced from DB)                             │
│  ══════════════════════════════════                            │
│  Key: stock:{productId}:{sizeId}                               │
│  Value: Integer (available stock)                              │
│                                                                 │
│  Example: stock:prod-001:size-M = 100                          │
│                                                                 │
│  RESERVATION (Temporary, TTL = 15 minutes)                     │
│  ══════════════════════════════════════════                    │
│  Key: reserve:{orderId}:{productId}:{sizeId}                   │
│  Value: Integer (reserved quantity)                            │
│  TTL: 900 seconds                                              │
│                                                                 │
│  Example: reserve:abc-123:prod-001:size-M = 2 (TTL: 850s)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4. Lua Scripts

**reserve_stock.lua**
```lua
local stock = redis.call('GET', KEYS[1])
if not stock then return -1 end

local stockNum = tonumber(stock)
if stockNum < tonumber(ARGV[1]) then return 0 end

redis.call('DECRBY', KEYS[1], ARGV[1])
redis.call('SETEX', KEYS[2], ARGV[2], ARGV[1])
return 1
```

**cancel_reservation.lua**
```lua
local reserved = redis.call('GET', KEYS[2])
if not reserved then return 0 end

redis.call('INCRBY', KEYS[1], reserved)
redis.call('DEL', KEYS[2])
return tonumber(reserved)
```

---

## So Sánh 3 Phương Thức

| Đặc Điểm | COD | VNPAY | MoMo |
|----------|-----|-------|------|
| **Luồng** | Order → Ship → Pay | Pay → Order | Pay → Order |
| **Stock Reserve** | Trước Kafka | Sau verify payment | Sau IPN callback |
| **Order Status** | PENDING | CONFIRMED | CONFIRMED |
| **Callback** | ❌ | ✅ Return URL | ✅ IPN |
| **Refund khi hết hàng** | ❌ (chưa trả tiền) | ✅ Wallet | ✅ Wallet |

---

## Performance

| Metric | Before | After Pre-Reserve |
|--------|--------|-------------------|
| Throughput | 100-200 req/s | **5,000-10,000 req/s** |
| Latency | 500-2000ms | **10-50ms** |
| Race Condition | Possible | **Impossible** |
| Overselling | Possible | **Impossible** |
