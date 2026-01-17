# Activity Diagrams - Notification Management

Tài liệu mô tả Activity Diagram cho hệ thống quản lý Thông Báo (Notification).

---

## 1. Create Notification (Tạo Thông Báo)

```mermaid
flowchart TD
    Start([Start]) --> ServiceEvent[Service có sự kiện<br/>Order/Payment/Shop]
    
    subgraph Services["📦 SERVICES"]
        ServiceEvent --> PublishKafka[Publish event to Kafka]
    end
    
    subgraph Kafka["📨 KAFKA"]
        PublishKafka --> KafkaTopic[Topic: notification-events]
    end
    
    subgraph NotificationSvc["🔔 NOTIFICATION SERVICE"]
        KafkaTopic --> Consumer[KafkaListener consume]
        Consumer --> BuildNotif[Build Notification object]
        BuildNotif --> SaveDB[Lưu MongoDB]
        SaveDB --> PushWS[Push WebSocket]
    end
    
    subgraph Client["👤 CLIENT"]
        PushWS -.Realtime.-> ReceiveWS[Nhận notification]
        ReceiveWS --> ShowUI[Hiển thị + Badge + Sound]
    end
    
    ShowUI --> End([End])
    
    style Services fill:#ffe6e6
    style Kafka fill:#e6ffe6
    style NotificationSvc fill:#fff5e6
    style Client fill:#e6f3ff
```

---

## 2. View Notification (Xem Thông Báo)

```mermaid
flowchart TD
    Start([Start]) --> OpenPanel[User/ShopOwner mở notification panel]
    
    subgraph Client["👤 CLIENT"]
        OpenPanel --> SendRequest[Gửi GET request]
        ShowList[Hiển thị danh sách]
        ShowList --> ClickNotif{Click notification?}
        ClickNotif -->|Yes| MarkRead[Đánh dấu đã đọc]
        ClickNotif -->|No| Close[Đóng panel]
    end
    
    subgraph NotificationSvc["🔔 NOTIFICATION SERVICE"]
        SendRequest --> CheckRole{User/ShopOwner?}
        CheckRole -->|User| QueryUser[Query by userId]
        CheckRole -->|ShopOwner| QueryShop[Query by shopId]
        QueryUser --> ReturnList[Trả về danh sách]
        QueryShop --> ReturnList
        ReturnList --> ShowList
        
        MarkRead --> UpdateDB[Update read = true]
        UpdateDB --> BroadcastWS[Broadcast WebSocket]
    end
    
    BroadcastWS -.Sync.-> UpdateAllTabs[Cập nhật tất cả tabs]
    
    Close --> End([End])
    UpdateAllTabs --> End
    
    style Client fill:#e6f3ff
    style NotificationSvc fill:#fff5e6
```

---

## 3. Delete Notification (Xóa Thông Báo)

```mermaid
flowchart TD
    Start([Start]) --> ViewList[User xem notification list]
    
    subgraph Client["👤 CLIENT"]
        ViewList --> ChooseAction{Hành động?}
        ChooseAction -->|Delete One| ClickDelete[Click icon xóa]
        ChooseAction -->|Delete All| ClickDeleteAll[Click Xóa tất cả]
        
        RemoveUI[Xóa khỏi UI]
        RemoveUI --> UpdateBadge[Cập nhật badge count]
    end
    
    subgraph NotificationSvc["🔔 NOTIFICATION SERVICE"]
        DeleteOne[DELETE /delete/id]
        DeleteAll[DELETE /deleteAll]
        
        ClickDelete --> DeleteOne
        ClickDeleteAll --> DeleteAll
        
        DeleteOne --> RemoveDB[Xóa khỏi MongoDB]
        DeleteAll --> RemoveAllDB[Xóa tất cả khỏi MongoDB]
        
        RemoveDB --> BroadcastWS[Broadcast WebSocket]
        RemoveAllDB --> BroadcastWS
        
        BroadcastWS --> RemoveUI
    end
    
    BroadcastWS -.Sync.-> SyncTabs[Đồng bộ các tabs khác]
    
    UpdateBadge --> End([End])
    SyncTabs --> End
    
    style Client fill:#e6f3ff
    style NotificationSvc fill:#fff5e6
```

---



---

## 4. Tổng Quan Kiến Trúc

```mermaid
flowchart TB
    subgraph Services["📦 MICROSERVICES"]
        OS[Order Service]
        PS[Payment Service]
        SS[Stock Service]
    end
    
    subgraph Kafka["📨 KAFKA"]
        Topic[notification-events topic]
    end
    
    subgraph NotificationSvc["🔔 NOTIFICATION SERVICE"]
        Consumer[KafkaListener]
        NS[NotificationService]
        WS[WebSocket Server]
        DB[(MongoDB)]
    end
    
    subgraph Client["👤 CLIENT"]
        NP[Notification Panel]
    end
    
    OS --Publish--> Topic
    PS --Publish--> Topic
    SS --Publish--> Topic
    
    Topic --Consume--> Consumer
    Consumer --> NS
    NS --> DB
    NS -.Push.-> WS
    WS -.Realtime.-> NP
    
    NP --REST API--> NS
    
    style Services fill:#ffe6e6
    style Kafka fill:#e6ffe6
    style NotificationSvc fill:#fff5e6
    style Client fill:#e6f3ff
```

---

## Bảng Tổng Hợp API

| Chức Năng | Endpoint | Method | Role |
|-----------|----------|--------|------|
| Tạo notification | `/v1/notifications/send` | POST | System |
| Xem notification (User) | `/v1/notifications/getAllByUserId` | GET | User |
| Xem notification (Shop) | `/v1/notifications/getAllByShopId` | GET | ShopOwner |
| Đánh dấu đã đọc | `/v1/notifications/markAsRead/{id}` | PUT | User/ShopOwner |
| Xóa notification | `/v1/notifications/delete/{id}` | DELETE | User/ShopOwner/Admin |
| Xóa tất cả (User) | `/v1/notifications/deleteAllByUserId` | DELETE | User |
| Xóa tất cả (Shop) | `/v1/notifications/deleteAllByShopId` | DELETE | ShopOwner |
| Đánh dấu tất cả đã đọc (User) | `/v1/notifications/markAllAsReadByUserId` | PUT | User |
| Đánh dấu tất cả đã đọc (Shop) | `/v1/notifications/markAllAsReadByShopId` | PUT | ShopOwner |

---

## WebSocket Events

| Event Type | Direction | Description |
|------------|-----------|-------------|
| `NEW_NOTIFICATION` | Server → Client | Có notification mới |
| `MARKED_AS_READ` | Server → Client | Đã đánh dấu đọc |
| `DELETED` | Server → Client | Đã xóa notification |
| `DELETED_ALL` | Server → Client | Đã xóa tất cả |
| `MARKED_ALL_AS_READ` | Server → Client | Đã đánh dấu tất cả đã đọc |

---

## Luồng Dữ Liệu Chính

1. **Service Events → Kafka** → Services (Order, Payment, Stock) publish events to Kafka topic `notification-events`
2. **Kafka → Notification Service** → KafkaListener consume events from Kafka
3. **Create & Store** → Lưu notification vào MongoDB
4. **Real-time Push** → Push notification qua WebSocket đến user đang online
5. **Client Display** → Client hiển thị notification với badge và âm thanh
6. **User Interaction** → User xem/đánh dấu đã đọc/xóa notification
7. **Sync** → WebSocket đồng bộ trạng thái notification trên tất cả tabs/devices
