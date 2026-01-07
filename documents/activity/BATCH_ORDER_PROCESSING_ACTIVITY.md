# Optimized Batch Order Processing Activity

## 1. Overview
This document illustrates the high-throughput order processing flow implemented to handle heavy traffic (target: 500-1000 orders/s). The optimization focuses on resolving N+1 Select issues and leveraging Hibernate Batch Inserts.

## 2. Configuration & Key Concepts

### A. `application.properties`
To enable efficient batching, the following configurations are crucial:
```properties
# Batch size: Send 50 inserts in one go
spring.jpa.properties.hibernate.jdbc.batch_size=50

# Order inserts: Group statements by table to maximize batching
spring.jpa.properties.hibernate.order_inserts=true
```

### B. `BaseEntity.java` (The "N+1 Select" Fix)
*   **Problem:** When manually assigning UUIDs (`order.setId(...)`), Hibernate's default behavior (`merge`) triggers a `SELECT` statement to check if the ID exists before inserting. This causes N+1 Selects, killing performance.
*   **Solution:** Implemented `Persistable<String>` interface.
    *   Added `boolean isNew = true` (transient field).
    *   Hibernate checks `isNew()`. If true, it skips the `SELECT` and queues the `INSERT` directly.
    *   This enables **True Batch Insert**.

## 3. Process Flow

1.  **Kafka Consumer (Batch Mode)**: Receives a list of messages (e.g., 50 orders) at once.
2.  **In-Memory Preparation**:
    *   Validates messages.
    *   Constructs `Order` objects.
    *   **Pre-assigns UUIDs** manually (`ensureIdsAssignedForBatchInsert`).
    *   Adds to `ordersToSave` list.
3.  **Batch Insert (The "Magic" Step)**:
    *   `orderRepository.saveAll(ordersToSave)` is called once.
    *   Hibernate converts this into **1 single SQL batch INSERT** (or very few).
    *   Latency drops mainly to IO time.
4.  **Post-Processing**:
    *   After database transaction commits successfuly.
    *   Sends Notifications (Async).
    *   Creates Shipping Orders (GHN) (Sync/Async).

## 4. Activity Diagram

```mermaid
flowchart TD
    Start([Kafka Batch Consumer: consumeCheckout]) --> BatchCheck{Is Batch Empty?}
    BatchCheck -- Yes --> End([End])
    BatchCheck -- No --> InitLists[Init lists: ordersToSave, orderItemsToSave]
    
    InitLists --> LoopStart[Loop through Kafka Messages]
    LoopStart --> ValidateMsg{Validate Message}
    
    ValidateMsg -- Invalid --> LogError[Log Error & Continue]
    LogError --> LoopNext
    
    ValidateMsg -- Valid --> ExtractInfo[Extract Order Info]
    ExtractInfo --> CheckTest{Is Test Product?}
    
    CheckTest -- Yes --> MockData[Mock ShopOwner & Skip Stock Check]
    CheckTest -- No --> CallStock[Call Stock Service: Get Product Info]
    
    MockData --> BuildOrder[Build Order Object]
    CallStock --> BuildOrder
    
    BuildOrder --> CalcTotal[Calculate Total Price with Vouchers]
    
    CalcTotal --> AssignUUID[⚡ Optim: Pre-assign UUID to Order & Items]
    AssignUUID --> AddToLists[Add to ordersToSave & orderItemsToSave]
    
    AddToLists --> AsyncCart[Async: Clear Cart]
    AsyncCart --> LoopNext{More Messages?}
    
    LoopNext -- Yes --> LoopStart
    LoopNext -- No --> BatchSave
    
    BatchSave[⚡ Optim: Batch Insert DB]
    
    subgraph Database Optimization
        BatchSave -- saveAll() --> PersistableCheck{Check Persistable}
        PersistableCheck -- isNew=true --> SmartInsert["Hibernate: INSERT (No SELECT)"]
        SmartInsert --> DB[(Database)]
    end
    
    DB --> PostSave[Post-Save Actions Loop]
    
    PostSave --> Notify{Send Notification}
    Notify -- Async --> SendNotif[Send Realtime Notif]
    
    PostSave --> CheckConfirmed{Is Status CONFIRMED?}
    CheckConfirmed -- Yes --> CheckTestOrder{Is Test Order?}
    
    CheckTestOrder -- Yes --> SkipGHN[Skip GHN Creation]
    CheckTestOrder -- No --> CreateGHN[Create GHN Shipping Order]
    
    SendNotif --> NextPostAction
    SkipGHN --> NextPostAction
    CreateGHN --> NextPostAction
    
    NextPostAction{More Saved Orders?}
    NextPostAction -- Yes --> PostSave
    NextPostAction -- No --> LogSuccess[Log Batch Success stats]
    LogSuccess --> End
```
