# Activity Diagrams - Context-Aware AI Assistant

Tài liệu mô tả luồng hoạt động của hệ thống AI Chat với khả năng nhận diện ngữ cảnh (Context-Aware) và gợi ý sản phẩm thông minh.

---

## 1. Context-Aware Product Suggestion (Gợi Ý Sản Phẩm Có Ngữ Cảnh)

```mermaid
flowchart TD
    Start([Start]) --> InitAI[Khởi tạo AIChatService]
    
    subgraph System Initialization["⚙️ SYSTEM INIT"]
        InitAI --> LoadCats[Load Categories từ DB]
        LoadCats --> InjectPrompt[Inject vào System Prompt]
        InjectPrompt --> Ready[AI Sẵn Sàng]
    end
    
    Ready --> UserChat[User gửi tin nhắn: 'Tôi muốn đi cầu lông']
    
    subgraph AI_Reasoning["🧠 AI BRAIN"]
        UserChat --> Analyze[Phân tích Intent]
        Analyze --> CheckContext{Check Shop Context}
        CheckContext -->|Match Category| InferKeywords[Suy luận Keywords phù hợp]
        CheckContext -->|No Match| Fallback[Suy luận General Keywords]
        InferKeywords --> CallTool[Gọi suggestProductsByScenario]
        Fallback --> CallTool
    end
    
    subgraph Backend_Processing["🖥️ BACKEND"]
        CallTool --> ParseInputs[Tách keywords: 'giày, áo, quần']
        ParseInputs --> LoopSearch{Search từng keyword}
        LoopSearch -->|Found| AddList[Thêm vào danh sách]
        LoopSearch -->|Not Found| Skip[Bỏ qua]
        AddList --> LoopSearch
        LoopSearch -->|Done| Dedup[Xóa trùng lặp]
        Dedup --> StoreThread[Lưu vào ThreadLocal]
        StoreThread --> ReturnMsg[Trả về text tóm tắt]
    end
    
    subgraph Response_Generation["📝 RESPONSE"]
        ReturnMsg --> AIGen[AI tạo câu trả lời thân thiện]
        AIGen --> ServiceCheck[AIChatService check ThreadLocal]
        ServiceCheck -->|Has Products| Enrich[Gán productSuggestions vào Response]
        ServiceCheck -->|No Products| TextOnly[Chỉ trả về Text]
    end
    
    subgraph Client["👤 CLIENT"]
        Enrich --> RenderUI[Hiển thị Chat UI]
        RenderUI --> ShowText[Hiển thị Text Message]
        RenderUI --> ShowCarousel[Render Product Carousel]
        ShowCarousel --> ClickProduct{User click?}
        ClickProduct -->|Yes| Navigate[Chuyển trang chi tiết SP]
    end
    
    TextOnly --> RenderUI
    Navigate --> End([End])
    
    style System Initialization fill:#fff5e6
    style AI_Reasoning fill:#e6f3ff
    style Backend_Processing fill:#ffe6e6
    style Response_Generation fill:#f0fff0
    style Client fill:#f9f9f9
```

---

## 2. Dynamic Context Injection Flow (Cơ Chế Tiêm Ngữ Cảnh Động)

```mermaid
sequenceDiagram
    participant User
    participant Service as AIChatService
    participant DB as Database
    participant AI as AI Model (LLM)
    
    Note over Service, DB: 1. Initialization Phase
    Service->>DB: findAllCategories()
    DB-->>Service: List<Category> [Name + Description]
    Service->>Service: Format Context String
    
    Note over User, AI: 2. Chat Phase
    User->>Service: "Tôi muốn đi picnic"
    Service->>Service: Build System Prompt
    Service->>Service: Replace {available_categories}
    Service->>AI: Send Prompt + User Message
    
    Note over AI: 3. Inference Phase
    AI->>AI: Read "Shop Context"
    AI->>AI: Reason: "Picnic" + "Sport & Outdoor (Camping gear)"
    AI->>AI: Infer: "lều, thảm, đèn pin"
    
    AI->>Service: Call suggestProductsByScenario("lều, thảm, đèn pin")
    Service->>DB: Search Products...
    DB-->>Service: Found Products
    Service-->>AI: Tool Output
    
    AI-->>User: "Dưới đây là các sán phẩm cho chuyến picnic..."
```

---

## 3. Keyword Inference Logic (Logic Suy Luận Từ Khóa)

| User Input | Shop Context (Inventory) | AI Implied Action (Suy Luận) |
|------------|--------------------------|------------------------------|
| "Đánh cầu lông" | Chỉ có `Quần áo`, `Giày` | Tìm: "giày cầu lông", "áo thể thao" (Bỏ qua "vợt") |
| "Đi picnic" | Có `Sport & Outdoor (Camping)` | Tìm: "lều", "túi ngủ", "thảm" |
| "Đi tiệc" | Có `Men Clothes`, `Women Clothes` | Tìm: "váy dạ hội", "vest nam", "giày tây" |
| "Đi bơi" | Không có category liên quan | Tìm: "kính bơi", "đồ bơi" (Fallback general search) |
