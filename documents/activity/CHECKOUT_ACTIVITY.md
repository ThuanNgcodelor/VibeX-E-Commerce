# Checkout Activity Diagrams

Tài liệu mô tả Activity Diagram cho hệ thống Checkout với **Option C Flash Sale Reservation**, **Smart Cache Strategy**, **Distributed Lock**, và **Async Persistence**.

---

## Mục lục

1. [Checkout COD](#1-checkout-cod)
2. [Checkout VNPAY](#2-checkout-vnpay)
3. [Checkout MoMo](#3-checkout-momo)
4. [Checkout Wallet](#4-checkout-wallet)
5. [Smart Stock Reservation Flow](#5-smart-stock-reservation-flow)

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
        
        ClickOrder --> ReserveFS{Có Flash Sale?}
        ReserveFS -->|Yes| CallReserve[Call Reserve API]
        CallReserve --> CheckReserve{Reserved OK?}
        CheckReserve -->|No| ShowFSError[Hiển thị: Flash Sale hết]
        CheckReserve -->|Yes| SendCheckout
        ReserveFS -->|No| SendCheckout[Send Checkout Request]
    end
    
    subgraph OrderService["🖥️ ORDER SERVICE"]
        SendCheckout --> ValidateOrder{Validate}
        ValidateOrder -->|Invalid| ReturnError[Return 400 Error]
        ValidateOrder -->|Valid| SavePending["Save Order (PENDING)"]
        
        SavePending --> SendKafka[Send to Kafka]
        SendKafka --> ReturnOK["Return 200 OK"]
    end
    
    subgraph StockService["📦 STOCK SERVICE"]
        CallReserve --> FSReserve["Flash Sale Reserve (Redis)"]
        FSReserve --> SetTTL["Set TTL 15 min"]
    end

    subgraph KafkaConsumer["📨 ASYNC PROCESSING"]
        SendKafka -.-> Consumer[Kafka Consumer]
        Consumer --> AsyncDecr["Decrease Regular Stock"]
        Consumer --> ConfirmFS["Confirm Flash Sale (Delete Keys)"]
        ConfirmFS --> CreateGHN[Create GHN Order]
        CreateGHN --> Notify[Send Notification]
    end
    
    ReturnOK --> ShowSuccess[Hiển thị: Đặt hàng thành công]
    ShowSuccess --> NavigateOrders[Chuyển trang đơn hàng]
    
    ReturnError --> EndErr([End])
    ShowFSError --> EndStock([End])
    NavigateOrders --> EndOK([End])
    Notify -.-> EndAsync([End])
    
    style Client fill:#e6f3ff
    style OrderService fill:#fff5e6
    style KafkaConsumer fill:#e6ffe6
    style StockService fill:#ffe6f0
    style FSReserve fill:#FFD700
    style CallReserve fill:#FFD700
```

### COD Flow Summary

| Bước | Mô tả | Thời gian |
|------|-------|-----------|
| 1 | **Frontend**: Reserve Flash Sale items (if any) | ~10ms |
| 2 | User chọn COD và click Đặt hàng | - |
| 3 | Save Order (PENDING) | ~10ms |
| 4 | Send to Kafka | ~5ms |
| 5 | Return 200 OK | **~25ms total** |
| 6 | Async: Decrease stock + Confirm FS + Create GHN | Background |

---

## 2. Checkout VNPAY

**Luồng thanh toán online qua VNPAY**

```mermaid
flowchart TD
    Start([User clicks Checkout]) --> SelectVNPAY[Chọn VNPAY]
    
    subgraph Client["👤 CLIENT"]
        SelectVNPAY --> ClickOrder[Click Đặt hàng]
        
        ClickOrder --> ReserveFS{Có Flash Sale?}
        ReserveFS -->|Yes| CallReserve[Call Reserve API]
        CallReserve --> CheckReserve{Reserved OK?}
        CheckReserve -->|No| ShowFSError[Hiển thị: Flash Sale hết]
        CheckReserve -->|Yes| SendCheckout
        ReserveFS -->|No| SendCheckout[Send Checkout Request]
        
        WaitRedirect[Chờ redirect]
        ReturnFromVNPAY[Quay về từ VNPAY]
        ReturnFromVNPAY --> CheckResult{Thanh toán OK?}
        CheckResult -->|No| ShowFailed[Hiển thị thất bại]
        CheckResult -->|Yes| ShowSuccess[Hiển thị thành công]
        ShowSuccess --> NavigateOrders[Chuyển trang đơn hàng]
    end
    
    subgraph StockService["📦 STOCK SERVICE"]
        CallReserve --> FSReserve["Flash Sale Reserve (Redis)"]
        FSReserve --> SetTTL["Set TTL 15 min"]
    end
    
    subgraph OrderService["🖥️ ORDER SERVICE"]
        SendCheckout --> CreateOrder["Create Order (PENDING)"]
        CreateOrder --> CallPayment[Call Payment Service]
        CallPayment --> ReturnURL[Return VNPAY URL]
        
        ReturnCallback[VNPAY Callback]
        ReturnCallback --> VerifySign{Verify Signature}
        VerifySign -->|Invalid| MarkFailed[Mark FAILED]
        VerifySign -->|Valid| CreateFromPayment["Create Order from Payment"]
        CreateFromPayment --> DecrStock["Decrease Regular Stock"]
        CreateFromPayment --> ConfirmFS["Confirm Flash Sale"]
        ConfirmFS --> MarkSuccess[Mark PAID]
    end
    
    subgraph PaymentService["💳 PAYMENT SERVICE"]
        CallPayment --> GenURL[Generate VNPAY URL]
    end
    
    subgraph VNPAY["🌐 VNPAY"]
        ReturnURL --> WaitRedirect
        WaitRedirect --> VNPAYPage[Trang VNPAY]
        VNPAYPage --> UserPay[User nhập thẻ]
        UserPay --> ProcessPay[Xử lý thanh toán]
        ProcessPay --> RedirectBack[Redirect về website]
        RedirectBack --> ReturnCallback
        RedirectBack --> ReturnFromVNPAY
    end
    
    MarkFailed --> ShowFailed
    ShowFailed --> EndFail([End])
    ShowFSError --> EndFS([End])
    NavigateOrders --> EndOK([End])
    
    style Client fill:#e6f3ff
    style OrderService fill:#fff5e6
    style StockService fill:#ffe6f0
    style VNPAY fill:#ffe6e6
    style PaymentService fill:#e6e6fa
    style FSReserve fill:#FFD700
    style CallReserve fill:#FFD700
```

### VNPAY Flow Summary

| Bước | Mô tả |
|------|-------|
| 1 | **Frontend**: Reserve Flash Sale trước khi redirect |
| 2 | Create Order (PENDING) + Generate VNPAY URL |
| 3 | Redirect sang trang VNPAY |
| 4 | User thanh toán thành công → Callback về Order Service |
| 5 | **Confirm Stock**: Xóa reservation keys, decrease regular stock |
| 6 | Update Order Status: PAID |

---

## 3. Checkout MoMo

**Luồng thanh toán qua ví MoMo (IPN)**

```mermaid
flowchart TD
    Start([User clicks Checkout]) --> SelectMOMO[Chọn MoMo]
    
    subgraph Client["👤 CLIENT"]
        SelectMOMO --> ClickOrder[Click Đặt hàng]
        
        ClickOrder --> ReserveFS{Có Flash Sale?}
        ReserveFS -->|Yes| CallReserve[Call Reserve API]
        CallReserve --> CheckReserve{Reserved OK?}
        CheckReserve -->|No| ShowFSError[Hiển thị: Flash Sale hết]
        CheckReserve -->|Yes| SendCheckout
        ReserveFS -->|No| SendCheckout[Send Checkout Request]
        
        WaitRedirect[Chờ redirect]
        ReturnFromMOMO[Quay về từ MoMo]
        ReturnFromMOMO --> CheckDB{Check Order Status}
        CheckDB -->|PENDING| PollStatus[Poll Status...]
        CheckDB -->|PAID| ShowSuccess[Hiển thị thành công]
        ShowSuccess --> NavigateOrders[Chuyển trang đơn hàng]
    end
    
    subgraph StockService["📦 STOCK SERVICE"]
        CallReserve --> FSReserve["Flash Sale Reserve (Redis)"]
        FSReserve --> SetTTL["Set TTL 15 min"]
    end
    
    subgraph OrderService["🖥️ ORDER SERVICE"]
        SendCheckout --> CreateOrder["Create Order (PENDING)"]
        CreateOrder --> CallPayment[Call Payment Service]
        
        IPNCallback[IPN Callback from MoMo]
        IPNCallback --> VerifyIPN{Verify Signature}
        VerifyIPN -->|Valid| CreateFromPayment["Create Order from Payment"]
        CreateFromPayment --> DecrStock["Decrease Regular Stock"]
        CreateFromPayment --> ConfirmFS["Confirm Flash Sale"]
        ConfirmFS --> UpdatePaid[Update PAID]
    end
    
    subgraph PaymentService["💳 PAYMENT SERVICE"]
        CallPayment --> GenMomoURL[Generate MoMo URL]
    end
    
    subgraph MoMo["🌐 MOMO"]
        CallPayment --> WaitRedirect
        WaitRedirect --> MoMoPage[App MoMo]
        MoMoPage --> UserPay[User xác nhận]
        UserPay --> ProcessPay[MoMo xử lý]
        ProcessPay --> SendIPN[Gửi IPN Callback]
        SendIPN --> IPNCallback
        ProcessPay --> RedirectBack[Redirect về website]
        RedirectBack --> ReturnFromMOMO
    end
    
    ShowFSError --> EndFS([End])
    NavigateOrders --> EndOK([End])
    
    style Client fill:#e6f3ff
    style OrderService fill:#fff5e6
    style StockService fill:#ffe6f0
    style MoMo fill:#ffe6e6
    style PaymentService fill:#e6e6fa
    style FSReserve fill:#FFD700
    style CallReserve fill:#FFD700
```

---

## 4. Checkout Wallet

**Luồng thanh toán qua Ví điện tử (E-Wallet)**

```mermaid
flowchart TD
    Start([User clicks Checkout]) --> SelectWallet[Chọn Wallet]
    
    subgraph Client["👤 CLIENT"]
        SelectWallet --> ClickOrder[Click Đặt hàng]
        
        ClickOrder --> ReserveFS{Có Flash Sale?}
        ReserveFS -->|Yes| CallReserve[Call Reserve API]
        CallReserve --> CheckReserve{Reserved OK?}
        CheckReserve -->|No| ShowFSError[Hiển thị: Flash Sale hết]
        CheckReserve -->|Yes| SendCheckout
        ReserveFS -->|No| SendCheckout[Send Wallet Checkout]
        
        SendCheckout --> WaitResponse[Chờ response]
        WaitResponse --> CheckResult{Success?}
        CheckResult -->|No| ShowFailed[Hiển thị: Số dư không đủ]
        CheckResult -->|Yes| ShowSuccess[Hiển thị thành công]
        ShowSuccess --> NavigateOrders[Chuyển trang đơn hàng]
    end
    
    subgraph StockService["📦 STOCK SERVICE"]
        CallReserve --> FSReserve["Flash Sale Reserve (Redis)"]
        FSReserve --> SetTTL["Set TTL 15 min"]
    end
    
    subgraph OrderService["🖥️ ORDER SERVICE"]
        SendCheckout --> ValidateReq{Validate Request}
        ValidateReq -->|Invalid| ReturnError[Return 400]
        ValidateReq -->|Valid| CallWallet[Call User Service]
    end
    
    subgraph UserService["👤 USER SERVICE"]
        CallWallet --> CheckBalance{Số dư đủ?}
        CheckBalance -->|No| ReturnInsufficient[Return 400]
        CheckBalance -->|Yes| DeductWallet[Trừ tiền từ Wallet]
        DeductWallet --> ReturnOK[Return 200]
    end
    
    subgraph OrderService2["🖥️ ORDER SERVICE (cont.)"]
        ReturnOK --> CreateOrder["Create Order (PENDING)"]
        CreateOrder --> DecrStock["Decrease Regular Stock"]
        CreateOrder --> ConfirmFS["Confirm Flash Sale"]
        ConfirmFS --> SaveOrder[Save Order]
        SaveOrder --> ReturnSuccess[Return Order]
    end
    
    ReturnInsufficient --> ShowFailed
    ReturnError --> ShowFailed
    ReturnSuccess --> CheckResult
    ShowFSError --> EndFS([End])
    ShowFailed --> EndFail([End])
    NavigateOrders --> EndOK([End])
    
    style Client fill:#e6f3ff
    style OrderService fill:#fff5e6
    style OrderService2 fill:#fff5e6
    style StockService fill:#ffe6f0
    style UserService fill:#e6fff5
    style FSReserve fill:#FFD700
    style CallReserve fill:#FFD700
```

### Wallet Flow Summary

| Bước | Mô tả | Thời gian |
|------|-------|-----------|
| 1 | **Frontend**: Reserve Flash Sale items (if any) | ~10ms |
| 2 | Send Wallet Checkout Request | - |
| 3 | **User Service**: Validate & Deduct Wallet | ~20ms |
| 4 | **Order Service**: Create Order + Decrease Stock + Confirm FS | ~30ms |
| 5 | Return 200 OK | **~60ms total** |
| 6 | User sees success immediately | Instant |

**Ưu điểm:** 
- Synchronous flow - User nhận kết quả ngay lập tức
- Không cần redirect như VNPAY/MoMo
- Tự động rollback nếu có lỗi (Transaction)

---

## 5. Smart Stock Reservation Flow

**Logic xử lý tồn kho tối ưu (Flash Sale & Regular)**

### 5.1. Flash Sale Reservation (Frontend-triggered)

```mermaid
flowchart TD
    Start([Reserve Request]) --> CheckProduct{Product Type?}
    
    subgraph FlashSalePath["🔥 FLASH SALE PATH"]
        CheckProduct -->|Flash Sale| CheckApproved{APPROVED?}
        CheckApproved -->|No| ReturnNotFS[Return: Not Flash Sale]
        CheckApproved -->|Yes| RouteFS[Route to Flash Sale Service]
        
        RouteFS --> CheckRedis{Redis Stock Exists?}
        CheckRedis -->|No| LoadFromDB[Load Flash Sale Stock]
        LoadFromDB --> SetRedis[Set Redis Key]
        
        CheckRedis -->|Yes| LuaFS[Execute Lua: Reserve]
        SetRedis --> LuaFS
        
        LuaFS --> LuaResult{Result?}
        LuaResult -->|1| AsyncDB["Async: Update flash_sale_product_size"]
        LuaResult -->|0/-1/-2| ReturnFail[Return: Sold Out / Limit]
        
        AsyncDB --> ReturnFSSuccess["Return: Reserved (TTL 15m)"]
    end
    
    subgraph RegularPath["📦 REGULAR PATH"]
        CheckProduct -->|Regular| CheckCache{Redis Key Exists?}
        CheckCache -->|No| DistLock{Acquire Lock?}
        DistLock -->|No| WaitRetry[Wait & Retry]
        WaitRetry --> CheckCache
        
        DistLock -->|Yes| LoadDB[Load Stock from DB]
        LoadDB --> SetCache[Set Redis Key]
        SetCache --> ReleaseLock[Release Lock]
        ReleaseLock --> LuaReg
        
        CheckCache -->|Yes| LuaReg[Execute Lua: Reserve]
        LuaReg --> RegResult{Result?}
        RegResult -->|1| AsyncReg["Async: Update product_size"]
        RegResult -->|0/-1| ReturnRegFail[Return: Out of Stock]
        
        AsyncReg --> ReturnRegSuccess["Return: Reserved"]
    end
    
    ReturnFSSuccess --> EndOK([✅ Success])
    ReturnRegSuccess --> EndOK
    ReturnFail --> EndFail([❌ Failed])
    ReturnRegFail --> EndFail
    ReturnNotFS --> EndFail
    
    style FlashSalePath fill:#ffe6f0
    style RegularPath fill:#e6f3ff
    style LuaFS fill:#FF6347
    style LuaReg fill:#4682B4
    style RouteFS fill:#FFD700
```

### 5.2. Sequence Diagram (Wallet + Flash Sale)

```mermaid
sequenceDiagram
    participant U as User (Frontend)
    participant SS as Stock Service
    participant OS as Order Service
    participant US as User Service
    participant R as Redis
    participant DB as Database
    
    Note over U: 1. Click Checkout (Wallet)
    
    U->>SS: POST /reservation/reserve (Flash Sale item)
    activate SS
    SS->>SS: Check if Flash Sale (APPROVED)
    SS->>R: Check Redis Stock
    
    alt Cache Hit
        SS->>R: EVAL (Lua: Reserve + TTL 15m)
        R-->>SS: 1 (Success)
    else Cache Miss
        SS->>DB: Load Flash Sale Stock
        DB-->>SS: flashSaleStock = 50
        SS->>R: SET flashsale:stock:xxx 50
        SS->>R: EVAL (Lua: Reserve + TTL 15m)
        R-->>SS: 1 (Success)
    end
    
    par Async DB Update
        SS->>DB: UPDATE flash_sale_product_size
    and Response
        SS-->>U: { success: true }
    end
    deactivate SS
    
    Note over U: 2. Submit Checkout Request
    U->>OS: POST /checkout/wallet
    activate OS
    
    OS->>US: Deduct Wallet
    activate US
    US->>DB: BEGIN TRANSACTION
    US->>DB: UPDATE wallet SET balance = balance - amount
    US-->>OS: 200 OK (Deducted)
    deactivate US
    
    OS->>OS: Create Order (PENDING)
    OS->>DB: INSERT orders (PENDING)
    
    OS->>SS: Decrease Regular Stock (non-FS items)
    activate SS
    SS->>R: EVAL (Lua: Decrease)
    SS->>DB: Async Update
    SS-->>OS: OK
    deactivate SS
    
    OS->>SS: Confirm Flash Sale Reservation
    activate SS
    SS->>R: DEL flashsale:reserve:xxx
    SS-->>OS: Confirmed
    deactivate SS
    
    OS->>DB: COMMIT
    OS-->>U: 200 OK (Order Created)
    deactivate OS
    
    U->>U: Show Success + Navigate
```

---

## Flow Comparison

| Feature | COD | VNPAY | MoMo | Wallet |
|---------|-----|-------|------|--------|
| **Frontend Reserve FS** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Payment Flow** | None | Redirect | Redirect | Synchronous |
| **Stock Decrease** | Async (Kafka) | Sync (Callback) | Sync (IPN) | Sync (Direct) |
| **Order Creation** | Async | Async | Async | Sync |
| **User Experience** | Instant | Wait redirect | Wait redirect | Instant |
| **Response Time** | ~25ms | ~5s (redirect) | ~5s (redirect) | ~60ms |

---

## Performance Metrics (Estimated)

| Metric | Legacy Logic | Smart Cache Strategy |
|--------|--------------|----------------------|
| **Latency** | 100-500ms (DB Hit) | **5-20ms (Redis Hit)** |
| **Concurrency** | Low (DB Lock) | **High (Redis Atomic)** |
| **Consistency** | Strong | **Eventual (Async DB Sync)** |
| **Thundering Herd** | Vulnerable | **Protected (Distributed Lock)** |
| **Flash Sale Protection** | Race Conditions | **TTL + Lua Atomic Operations** |
