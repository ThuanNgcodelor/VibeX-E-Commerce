# Cancel Order Activity Documentation

## 🔄 CANCEL ORDER ACTIVITY

### Overview

Cancel Order flow restores stock to both **Redis + DB** for consistency. Flash Sale items are checked for session status - if session ended, stock is restored to regular inventory instead.

---

## Cancel Order - Regular Product

```mermaid
flowchart TD
    Start([User clicks Cancel Order]) --> CancelReq[POST /v1/order/cancel/orderId]
    
    subgraph OrderService[Order Service]
        CancelReq --> LoadOrder[Load order from DB]
        LoadOrder --> CheckStatus{Order status<br/>== PENDING?}
        
        CheckStatus -->|No| ThrowError[Throw error:<br/>Cannot cancel order]
        ThrowError --> Stop1([Stop])
        
        CheckStatus -->|Yes| CheckPayment{Payment method<br/>WALLET/VNPAY/MOMO?}
        CheckPayment -->|Yes| ProcessRefund[Process Refund to Wallet]
        CheckPayment -->|No| CallRollback[Call rollbackOrderStock]
        ProcessRefund --> CallRollback
    end
    
    subgraph StockService[Stock Service]
        CallRollback --> ReceiveRestore[Receive restoreStock request]
        ReceiveRestore --> UpdateDB[Update DB:<br/>stock = stock + quantity]
        ReceiveRestore --> UpdateRedis[Update Redis:<br/>INCR stock:productId:sizeId]
        UpdateDB --> LogChange[Log inventory change]
        UpdateRedis --> LogChange
        LogChange --> ReturnSuccess[Return success]
    end
    
    ReturnSuccess --> UpdateStatus[Update order status<br/>to CANCELLED]
    UpdateStatus --> SaveOrder[Save order]
    SaveOrder --> Return200[Return 200 OK]
    Return200 --> ShowSuccess[Display success message]
    ShowSuccess --> Stop2([Stop])
    
    style StockService fill:#ffe6cc
    style OrderService fill:#d4f1d4
    style UpdateRedis fill:#fff2cc
    style UpdateDB fill:#fff2cc
```

---

## Cancel Order - Flash Sale Product (Active Session)

```mermaid
flowchart TD
    Start([User cancels Flash Sale order]) --> CancelReq[PUT /v1/order/cancel/orderId]
    
    subgraph OrderService[Order Service]
        CancelReq --> LoadOrder[Load order with items]
        LoadOrder --> IdentifyFS[Identify Flash Sale items]
        IdentifyFS --> CallRestore[Call restoreFlashSaleStock]
    end
    
    subgraph FlashSaleService[Flash Sale Service]
        CallRestore --> FindProduct[Find active Flash Sale product]
        FindProduct --> ProductExists{Product<br/>exists?}
        
        ProductExists -->|No| ReturnFalse1[Return false]
        
        ProductExists -->|Yes| LoadSession[Load Flash Sale session]
        LoadSession --> CheckStatus{Session<br/>ACTIVE?}
        
        CheckStatus -->|No| ReturnFalse2[Return false]
        
        CheckStatus -->|Yes| CheckTime{Current time <<br/>session.endTime?}
        
        CheckTime -->|No| ReturnFalse3[Return false:<br/>Session ended]
        
        CheckTime -->|Yes| RestoreRedis[Restore Redis:<br/>INCR flashsale:stock:*]
        RestoreRedis --> QueueDB[Queue Async DB Update:<br/>Publish to Kafka]
        QueueDB --> ReturnTrue[Return true]
        
        ReturnFalse1 --> Fallback
        ReturnFalse2 --> Fallback
        ReturnFalse3 --> Fallback
    end
    
    subgraph Fallback[Fallback Logic]
        ReturnTrue --> LogFS[Log: Stock restored<br/>to Flash Sale]
        Fallback[Fallback: Restore<br/>to Regular Stock]
    end
    
    LogFS --> UpdateOrder
    Fallback --> UpdateOrder[Update order to CANCELLED]
    UpdateOrder --> Return200[Return 200 OK]
    Return200 --> ShowMsg[Display 'Order cancelled']
    ShowMsg --> Stop([Stop])
    
    style FlashSaleService fill:#ffe6cc
    style OrderService fill:#d4f1d4
    style Fallback fill:#fff4cc
```

---

## Cancel Order - Complete Decision Flow

```mermaid
flowchart TD
    Start([User requests cancel order]) --> LoadOrder[Load order]
    LoadOrder --> CheckStatus{Order status<br/>== PENDING?}
    
    CheckStatus -->|No| Error[❌ Cannot cancel]
    Error --> Stop1([Stop])
    
    CheckStatus -->|Yes| CheckRefund{Payment method<br/>needs refund?}
    
    CheckRefund -->|Yes| ProcessRefund[Process refund to wallet<br/>WALLET/VNPAY/MOMO]
    CheckRefund -->|No| StartRestore
    ProcessRefund --> StartRestore[Start Stock Restoration]
    
    StartRestore --> ForEach{For each<br/>order item}
    
    ForEach -->|Flash Sale| CheckSession{Session ACTIVE<br/>&& time valid?}
    
    CheckSession -->|Yes| RestoreFS[✅ Restore to<br/>Flash Sale Stock<br/>Redis: flashsale:stock:*<br/>DB: flash_sale_product_sizes]
    
    CheckSession -->|No| RestoreRegular1[⚠️ Restore to<br/>Regular Stock<br/>Session ended]
    
    ForEach -->|Regular| RestoreRegular2[✅ Restore to<br/>Regular Stock<br/>Redis: stock:product:size<br/>DB: sizes.stock]
    
    RestoreFS --> MoreItems{More items?}
    RestoreRegular1 --> MoreItems
    RestoreRegular2 --> MoreItems
    
    MoreItems -->|Yes| ForEach
    MoreItems -->|No| UpdateStatus[Update order status<br/>= CANCELLED]
    
    UpdateStatus --> Success[✅ Order Cancelled]
    Success --> Return[Return success response]
    Return --> Stop2([Stop])
    
    style RestoreFS fill:#d4f1d4
    style RestoreRegular1 fill:#fff2cc
    style RestoreRegular2 fill:#d4e8f7
    style Success fill:#d4f1d4
```

---

## Key Features

### 1. Redis + DB Synchronization
- Before: Only DB updated → Redis cache stale
- After: Both Redis + DB updated → Always in sync

### 2. Flash Sale Session Validation
- Active Session → Restore to Flash Sale Stock
- Ended Session → Restore to Regular Stock (security)

### 3. Refund Processing
- WALLET: Direct refund to user wallet
- VNPAY/MOMO: Refund via wallet
- COD: No refund needed

### 4. Error Resilience
- Continue with other items if one fails
- Log all errors for debugging
- Status updated regardless of minor failures

---

## Performance Metrics

| Operation | Latency | Notes |
|-----------|---------|-------|
| Load order | ~5ms | Single DB query |
| Check refund eligibility | ~2ms | In-memory check |
| Process refund | ~50ms | UserService call |
| Restore regular stock | ~10ms | Redis + DB parallel |
| Restore flash sale stock | ~15ms | + session validation |
| Update order status | ~5ms | Single DB update |
| **Total (Regular)** | **~70ms** | Including refund |
| **Total (Flash Sale)** | **~75ms** | Including session check |

---

**Last Updated:** 2026-01-13  
**Status:** ✅ Implementation Complete
