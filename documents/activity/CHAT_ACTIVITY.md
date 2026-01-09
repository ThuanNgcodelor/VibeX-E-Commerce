# Activity Diagrams - Chat

Tài liệu mô tả Activity Diagram cho hệ thống Chat giữa User và ShopOwner.

---

## 1. Start Conversation (Bắt Đầu Hội Thoại)

```mermaid
flowchart TD
    Start([Start]) --> UserAction[User click Chat với Shop]
    
    subgraph Client["👤 USER"]
        UserAction --> CheckLogin{Đã đăng nhập?}
        CheckLogin -->|No| RedirectLogin[Chuyển trang Login]
        CheckLogin -->|Yes| SendRequest[Gửi request tạo/lấy conversation]
        OpenChat[Mở cửa sổ Chat]
        OpenChat --> LoadMessages[Load lịch sử tin nhắn]
    end
    
    subgraph System["🖥️ SYSTEM"]
        SendRequest --> CheckExist{Conversation đã tồn tại?}
        CheckExist -->|Yes| GetExisting[Lấy conversation hiện tại]
        CheckExist -->|No| CreateNew[Tạo conversation mới]
        GetExisting --> EnrichData[Enrich thông tin user/shop]
        CreateNew --> EnrichData
        EnrichData --> ReturnConv[Trả về ConversationDto]
        ReturnConv --> OpenChat
    end
    
    RedirectLogin --> EndLogin([End])
    LoadMessages --> EndOK([End])
    
    style Client fill:#e6f3ff
    style System fill:#fff5e6
```

---

## 2. View Conversations (Xem Danh Sách Hội Thoại)

```mermaid
flowchart TD
    Start([Start]) --> OpenPanel[Mở Chat Panel]
    
    subgraph Client["👤 USER / SHOPOWNER"]
        OpenPanel --> SendRequest[Gửi request lấy conversations]
        DisplayList[Hiển thị danh sách]
        DisplayList --> ConnectWS[Kết nối WebSocket]
        ConnectWS --> WaitSelect[Chờ chọn conversation]
    end
    
    subgraph System["🖥️ SYSTEM"]
        SendRequest --> ExtractUser[Trích xuất userId từ JWT]
        ExtractUser --> QueryConv[Query conversations by userId]
        QueryConv --> EnrichInfo[Enrich user info + shop info]
        EnrichInfo --> CalcUnread[Tính unread count]
        CalcUnread --> SortByTime[Sắp xếp theo thời gian]
        SortByTime --> ReturnList[Trả về danh sách]
        ReturnList --> DisplayList
    end
    
    WaitSelect --> EndOK([End])
    
    style Client fill:#e6f3ff
    style System fill:#fff5e6
```

---

## 3. View Messages (Xem Tin Nhắn)

```mermaid
flowchart TD
    Start([Start]) --> SelectConv[Chọn conversation]
    
    subgraph Client["👤 USER / SHOPOWNER"]
        SelectConv --> SendRequest[Gửi request lấy messages]
        DisplayMsgs[Hiển thị tin nhắn]
        DisplayMsgs --> SubscribeWS[Subscribe WebSocket channel]
        SubscribeWS --> MarkRead[Đánh dấu đã đọc]
        MarkRead --> WaitNewMsg[Chờ tin nhắn mới]
        WaitNewMsg --> ReceiveWS{WebSocket message?}
        ReceiveWS -->|Yes| AppendMsg[Thêm tin nhắn mới]
        AppendMsg --> ScrollBottom[Scroll xuống cuối]
        ScrollBottom --> WaitNewMsg
    end
    
    subgraph System["🖥️ SYSTEM"]
        SendRequest --> QueryMsgs[Query messages by conversationId]
        QueryMsgs --> LoadImages[Load images nếu có]
        LoadImages --> ReturnMsgs[Trả về messages]
        ReturnMsgs --> DisplayMsgs
    end
    
    style Client fill:#e6f3ff
    style System fill:#fff5e6
```

---

## 4. Send Message (Gửi Tin Nhắn)

```mermaid
flowchart TD
    Start([Start]) --> TypeMsg[User nhập tin nhắn]
    
    subgraph Sender["👤 SENDER"]
        TypeMsg --> ClickSend[Click Gửi]
        ClickSend --> ValidateInput{Nội dung hợp lệ?}
        ValidateInput -->|No| ShowError[Hiển thị lỗi]
        ValidateInput -->|Yes| SendRequest[Gửi request]
        ClearInput[Xóa input field]
    end
    
    subgraph System["🖥️ SYSTEM"]
        SendRequest --> ExtractSender[Trích xuất senderId từ JWT]
        ExtractSender --> CheckType{Message Type?}
        CheckType -->|TEXT| SaveText[Lưu tin nhắn text]
        CheckType -->|IMAGE| SaveImage[Lưu tin nhắn + image]
        CheckType -->|PRODUCT_LINK| SaveProduct[Lưu tin nhắn + product info]
        SaveText --> UpdateConv[Cập nhật lastMessage và updatedAt]
        SaveImage --> UpdateConv
        SaveProduct --> UpdateConv
        UpdateConv --> BroadcastWS[Broadcast qua WebSocket]
        BroadcastWS --> ReturnMsg[Trả về MessageDto]
        ReturnMsg --> ClearInput
    end
    
    subgraph Receiver["👤 RECEIVER"]
        BroadcastWS -.-> ReceiveWS[WebSocket nhận message]
        ReceiveWS --> DisplayNew[Hiển thị tin nhắn mới]
        DisplayNew --> UpdateBadge[Cập nhật unread badge]
    end
    
    ShowError --> EndErr([End])
    ClearInput --> EndOK([End])
    UpdateBadge --> EndReceiver([End])
    
    style Sender fill:#e6f3ff
    style System fill:#fff5e6
    style Receiver fill:#e6ffe6
```

---

## 5. Share Product (Chia Sẻ Sản Phẩm)

```mermaid
flowchart TD
    Start([Start]) --> ViewProduct[User xem sản phẩm]
    
    subgraph Client["👤 USER"]
        ViewProduct --> ClickChat[Click Chat với Shop]
        ClickChat --> TriggerEvent[Dispatch open-chat-with-product event]
        TriggerEvent --> OpenWidget[Mở ChatBotWidget]
        OpenWidget --> AutoSend[Tự động gửi PRODUCT_LINK message]
        ShowProduct[Hiển thị Product Card]
        ShowProduct --> StartChat[Bắt đầu chat về sản phẩm]
    end
    
    subgraph System["🖥️ SYSTEM"]
        AutoSend --> CreateConv[Tạo/lấy conversation với productId]
        CreateConv --> SaveProductMsg[Lưu message type PRODUCT_LINK]
        SaveProductMsg --> LoadProductInfo[Load product info]
        LoadProductInfo --> ReturnData[Trả về data]
        ReturnData --> ShowProduct
    end
    
    StartChat --> EndOK([End])
    
    style Client fill:#e6f3ff
    style System fill:#fff5e6
```

---

## 6. ShopOwner Reply (Shop Trả Lời Khách)

```mermaid
flowchart TD
    Start([Start]) --> OpenChatPage[ShopOwner mở ChatPage]
    
    subgraph ShopOwner["🏪 SHOPOWNER"]
        OpenChatPage --> LoadConvs[Load danh sách conversations]
        LoadConvs --> SelectConv[Chọn conversation từ khách]
        SelectConv --> ViewHistory[Xem lịch sử chat]
        ViewHistory --> ViewProduct{Có Product Card?}
        ViewProduct -->|Yes| ReviewProduct[Xem sản phẩm khách hỏi]
        ViewProduct -->|No| TypeReply[Nhập tin trả lời]
        ReviewProduct --> TypeReply
        TypeReply --> SendReply[Gửi tin nhắn]
    end
    
    subgraph System["🖥️ SYSTEM"]
        SendReply --> SaveMsg[Lưu message]
        SaveMsg --> UpdateConv[Cập nhật conversation]
        UpdateConv --> BroadcastWS[Broadcast qua WebSocket]
    end
    
    subgraph Client["👤 USER"]
        BroadcastWS -.-> ReceiveWS[WebSocket nhận message]
        ReceiveWS --> ShowNotify[Hiển thị notification]
        ShowNotify --> DisplayMsg[Hiển thị tin nhắn mới]
    end
    
    DisplayMsg --> EndOK([End])
    
    style ShopOwner fill:#ffe6e6
    style System fill:#fff5e6
    style Client fill:#e6f3ff
```

---

## 7. Tổng Quan Kiến Trúc

```mermaid
flowchart TB
    subgraph Client["👤 USER (ChatBotWidget)"]
        UC1[Start Conversation]
        UC2[View Messages]
        UC3[Send Message]
        UC4[Share Product]
    end
    
    subgraph ShopOwner["🏪 SHOPOWNER (ChatPage)"]
        SO1[View Conversations]
        SO2[View Messages]
        SO3[Reply Message]
    end
    
    subgraph System["🖥️ NOTIFICATION SERVICE"]
        CC[ChatController]
        CS[ChatService]
        WS[WebSocketChatService]
    end
    
    subgraph Storage["💾 STORAGE"]
        DB[(MongoDB)]
        REDIS[(Redis)]
    end
    
    UC1 --> CC
    UC2 --> CC
    UC3 --> CC
    UC4 --> CC
    SO1 --> CC
    SO2 --> CC
    SO3 --> CC
    
    CC --> CS
    CS --> DB
    CS --> WS
    WS <-.-> REDIS
    WS <-.-> Client
    WS <-.-> ShopOwner
    
    style Client fill:#e6f3ff
    style ShopOwner fill:#ffe6e6
    style System fill:#fff5e6
```

---

## 8. WebSocket Real-time Flow

```mermaid
sequenceDiagram
    participant U as User
    participant WS as WebSocket
    participant S as Server
    participant SO as ShopOwner
    
    Note over U,SO: Connection Phase
    U->>WS: Connect WebSocket
    WS->>S: Subscribe /user/{userId}/queue/messages
    SO->>WS: Connect WebSocket
    WS->>S: Subscribe /user/{shopOwnerId}/queue/messages
    
    Note over U,SO: Send Message Phase
    U->>S: POST /messages
    S->>S: Save to MongoDB
    S->>WS: Broadcast to conversation
    WS->>SO: Push message
    SO->>SO: Display new message
    
    Note over U,SO: Reply Phase
    SO->>S: POST /messages
    S->>S: Save to MongoDB
    S->>WS: Broadcast to conversation
    WS->>U: Push message
    U->>U: Display new message
```

---

## Bảng Tổng Hợp API

| Chức Năng | Endpoint | Method |
|-----------|----------|--------|
| Bắt đầu/lấy conversation | `/v1/notifications/chat/conversations/start` | POST |
| Lấy danh sách conversations | `/v1/notifications/chat/conversations` | GET |
| Lấy messages | `/v1/notifications/chat/conversations/{id}/messages` | GET |
| Gửi tin nhắn | `/v1/notifications/chat/messages` | POST |
| Đánh dấu đã đọc | `/v1/notifications/chat/conversations/{id}/read` | PUT |

---

## WebSocket Endpoints

| Chức Năng | Endpoint |
|-----------|----------|
| Kết nối | `/ws` |
| Subscribe messages | `/user/{userId}/queue/messages` |
| Subscribe conversation | `/topic/conversation/{conversationId}` |
