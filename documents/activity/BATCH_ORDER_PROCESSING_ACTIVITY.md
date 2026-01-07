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
