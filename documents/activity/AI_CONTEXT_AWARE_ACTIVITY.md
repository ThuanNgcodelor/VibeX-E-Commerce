# AI Chat Activity Diagrams

Activity diagrams cho AI Chatbot - đơn giản và dễ nhìn.

---

## 1. Basic Chat Flow (Luồng Cơ Bản)

**User gửi tin nhắn → AI trả lời**

```mermaid
flowchart TD
    Start([User mở chat])
    
    subgraph User["👤 USER"]
        Start --> Input["Gõ tin nhắn:<br/>'Hôm nay có Flash Sale gì?'"]
        Input --> Send[Gửi]
        
        Response[Nhận phản hồi từ AI]
        Response --> Check{Kết quả?}
        Check -->|Text| ReadText[Đọc câu trả lời]
        Check -->|Products| ViewCarousel[Xem product carousel]
        
        ReadText --> Continue{Tiếp tục?}
        ViewCarousel --> Continue
        Continue -->|Yes| Input
        Continue -->|No| End([Kết thúc])
    end
    
    subgraph System["🖥️ SYSTEM"]
        Send --> Process["Xử lý:<br/>1. Detect ngôn ngữ<br/>2. Load lịch sử chat<br/>3. Inject context (categories, sales, live)<br/>4. Build system prompt"]
        Process --> CallAI[Gọi AI Model]
    end
    
    subgraph AI["🤖 AI MODEL"]
        CallAI --> Analyze[Phân tích câu hỏi]
        Analyze --> Decide{Cần gọi tool?}
        Decide -->|No| DirectAnswer[Trả lời trực tiếp]
        Decide -->|Yes| CallTool[Gọi tool phù hợp]
        
        CallTool --> GetData[Nhận dữ liệu từ tool]
        GetData --> Generate[Tạo câu trả lời]
        DirectAnswer --> Generate
    end
    
    subgraph System2["🖥️ SYSTEM"]
        Generate --> BuildResponse["Build response JSON:<br/>{message, productSuggestions}"]
        BuildResponse --> Return[Trả về user]
    end
    
    Return --> Response
    
    style User fill:#e6f3ff
    style System fill:#fff5e6
    style System2 fill:#fff5e6
    style AI fill:#ffe6f0
```

---

## 2. AI Tool Routing (Chọn Tool)

**AI phân tích và chọn tool phù hợp với câu hỏi**

```mermaid
flowchart LR
    Query([User Query]) --> AI{AI Phân Tích Intent}
    
    AI -->|Flash Sale| FS["⚡ Flash Sale Tools<br/>(4 functions)"]
    AI -->|Live Stream| Live["📺 Live Session Tools<br/>(3 functions)"]
    AI -->|Product Search| Product["🛍️ Product Tools<br/>(4 functions)"]
    AI -->|Trending/New| Advanced["📊 Advanced Product Tools<br/>(4 functions)"]
    AI -->|My Orders| Order["📦 Order Tools<br/>(4 functions)"]
    AI -->|Activity/Scenario| Context["🎯 Contextual Suggest<br/>(1 function)"]
    
    FS --> Examples1["Ví dụ:<br/>'Hôm nay có sale gì?'<br/>'Sản phẩm X có Flash Sale không?'"]
    Live --> Examples2["Ví dụ:<br/>'Có shop nào đang live?'<br/>'Live bán giày ở đâu?'"]
    Product --> Examples3["Ví dụ:<br/>'Tìm áo khoác'<br/>'Giá bao nhiêu?'"]
    Advanced --> Examples4["Ví dụ:<br/>'Sản phẩm trending?'<br/>'Hàng mới về?'"]
    Order --> Examples5["Ví dụ:<br/>'Đơn hàng của tôi?'<br/>'Chi tiêu bao nhiêu?'"]
    Context --> Examples6["Ví dụ:<br/>'Tôi muốn đi cắm trại'<br/>'Đi đá bóng cần gì?'"]
    
    Examples1 --> Result[Kết quả trả về AI]
    Examples2 --> Result
    Examples3 --> Result
    Examples4 --> Result
    Examples5 --> Result
    Examples6 --> Result
    
    Result --> Response([AI Response])
    
    style FS fill:#ffe6cc
    style Live fill:#e6ffe6
    style Product fill:#e6f0ff
    style Advanced fill:#f0f0ff
    style Order fill:#e6f5ff
    style Context fill:#fff0f5
```

---

## 3. Context Injection (Tiêm Ngữ Cảnh)

**System inject real-time context vào AI mỗi request**

```mermaid
flowchart TD
    subgraph Data["📊 DATA SOURCES"]
        DB1[(Categories DB)] --> Cat["Sport & Outdoor<br/>Fashion<br/>Electronics<br/>..."]
        DB2[(Flash Sale DB)] --> Flash["2 Flash Sales<br/>đang hoạt động"]
        Service[notification-service] --> Live["3 phiên live<br/>đang diễn ra"]
    end
    
    subgraph Build["🏗️ BUILD PROMPT"]
        Template["System Prompt Template:<br/>...<br/>Categories: {available_categories}<br/>Flash Sale: {flash_sale_context}<br/>Live: {live_context}<br/>..."]
        
        Cat --> Replace[Replace placeholders]
        Flash --> Replace
        Live --> Replace
        Template --> Replace
        
        Replace --> Final["Final Prompt:<br/>...<br/>Categories: Sport & Outdoor, Fashion...<br/>Flash Sale: 2 đang hoạt động 🔥<br/>Live: 3 phiên đang live 📺<br/>..."]
    end
    
    Final --> AI["🤖 AI Model<br/>(Nhận prompt với context đầy đủ)"]
    
    AI --> Smart["AI biết:<br/>✅ Shop có danh mục gì<br/>✅ Flash Sale nào đang diễn ra<br/>✅ Live session nào đang hoạt động<br/>→ Chọn tool phù hợp"]
    
    style Data fill:#e6f3ff
    style Build fill:#fff5e6
```

---

## 4. Tool Functions Summary

**Tổng hợp 20 AI functions**

| Tool Class | Count | Functions | Example Questions |
|------------|-------|-----------|-------------------|
| ⚡ **Flash Sale** | 4 | getCurrentFlashSales, getFlashSaleProducts, checkProductInFlashSale, getUpcomingFlashSales | "Flash Sale hôm nay?", "Sản phẩm X có sale không?" |
| 📺 **Live Sessions** | 3 | getActiveLiveSessions, searchLiveByKeyword, getLiveDetails | "Shop nào đang live?", "Live bán giày?" |
| 📊 **Advanced Products** | 4 | getTrendingProducts, getNewArrivals, getProductsByCategory, getCategories | "Trending?", "Hàng mới?", "Danh mục?" |
| 🛍️ **Products** | 4 | searchProducts, getProductPrice, getDiscountedProducts, getProductDetails | "Tìm giày", "Giá?", "Giảm giá?" |
| 📦 **Orders** | 4 | getMyOrders, getOrderStatus, getOrdersByPayment, getSpendingStats | "Đơn hàng?", "Trạng thái?", "Chi tiêu?" |
| 🎯 **Contextual** | 1 | suggestProductsByScenario | "Tôi muốn đi cắm trại" |

**Total: 20 functions**

---

## Key Features

✅ **Context-Aware**: AI biết shop có gì, Flash Sale nào, Live nào  
✅ **Real-time**: Context được inject mỗi request  
✅ **Smart Routing**: AI tự chọn tool phù hợp  
✅ **Product Carousel**: Hiển thị kèm danh sách sản phẩm  
✅ **Complete Order Info**: Fix hiển thị đầy đủ (ID, status, tổng tiền ✅, items, date)

---

**Last Updated:** 2026-01-15  
**Status:** ✅ Complete - 3 simplified diagrams

**Tổng hợp toàn bộ luồng chat với 20 AI functions**

```mermaid
flowchart TD
    Start([User mở chat])
    
    subgraph User["👤 USER"]
        Start --> TypeMsg[Gõ tin nhắn]
        TypeMsg --> Examples{Ví dụ tin nhắn}
        
        Examples -->|Flash Sale| Ex1["'Hôm nay có Flash Sale gì?'"]
        Examples -->|Live| Ex2["'Có shop nào đang live?'"]
        Examples -->|Scenario| Ex3["'Tôi muốn đi cắm trại'"]
        Examples -->|Order| Ex4["'Đơn hàng của tôi?'"]
        Examples -->|Product| Ex5["'Sản phẩm trending?'"]
        Examples -->|General| Ex6["'Tìm giày thể thao'"]
        
        Ex1 --> Send[Gửi tin nhắn]
        Ex2 --> Send
        Ex3 --> Send
        Ex4 --> Send
        Ex5 --> Send
        Ex6 --> Send
        
        ViewResult["Nhận kết quả:<br/>- Text response<br/>- Product carousel (nếu có)<br/>- Flash Sale info<br/>- Live session list<br/>- Order details"]
        ViewResult --> UserAction{Hành động?}
        UserAction -->|Xem sản phẩm| ClickProduct[Click sản phẩm]
        UserAction -->|Tiếp tục chat| ContinueChat[Chat tiếp]
        UserAction -->|Kết thúc| EndChat[Đóng chat]
        
        ClickProduct --> Navigate[Chuyển trang sản phẩm]
    end
    
    subgraph System["🖥️ SYSTEM (AIChatService)"]
        Send --> Step1[1️⃣ Detect Language]
        Step1 --> Step2[2️⃣ Load History]
        Step2 --> Step3["3️⃣ Inject Context:<br/>- Categories từ DB<br/>- Flash Sale status<br/>- Live session count"]
        Step3 --> Step4[4️⃣ Build System Prompt]
        Step4 --> Step5[5️⃣ Send to AI Model]
    end
    
    subgraph AI["🤖 AI MODEL (Ollama LLM)"]
        Step5 --> AnalyzeIntent[Phân tích Intent]
        AnalyzeIntent --> RouteToTool{Chọn Tool Category}
        
        RouteToTool -->|Flash Sale| FlashRoute[Flash Sale Tools]
        RouteToTool -->|Live| LiveRoute[Live Session Tools]
        RouteToTool -->|Product| ProductRoute[Product Tools]
        RouteToTool -->|Advanced| AdvancedRoute[Advanced Product Tools]
        RouteToTool -->|Order| OrderRoute[Order Tools]
        RouteToTool -->|Scenario| ScenarioRoute[Contextual Suggest]
        RouteToTool -->|No tool| DirectAnswer[Direct text answer]
    end
    
    subgraph FlashSaleTools["⚡ FlashSaleTools (4 functions)"]
        FlashRoute --> FSFunc{Function?}
        FSFunc -->|Current| FS1[getCurrentFlashSales]
        FSFunc -->|Products| FS2[getFlashSaleProducts]
        FSFunc -->|Check| FS3[checkProductInFlashSale]
        FSFunc -->|Upcoming| FS4[getUpcomingFlashSales]
        
        FS1 --> FSQuery[Query DB:<br/>findByStatus ACTIVE<br/>filter by time]
        FS2 --> FSQuery
        FS3 --> FSQuery
        FS4 --> FSQuery
        FSQuery --> FSReturn[Return to AI]
    end
    
    subgraph LiveTools["📺 LiveSessionTools (3 functions)"]
        LiveRoute --> LFunc{Function?}
        LFunc -->|Get Active| L1[getActiveLiveSessions]
        LFunc -->|Search| L2[searchLiveByKeyword]
        LFunc -->|Details| L3[getLiveDetails]
        
        L1 --> LFeign[Feign Call:<br/>notification-service<br/>/api/live]
        L2 --> LFeign
        L3 --> LFeign
        LFeign --> LReturn[Return to AI]
    end
    
    subgraph ProductTools["🛍️ ProductTools (4 functions)"]
        ProductRoute --> PFunc{Function?}
        PFunc -->|Search| P1[searchProducts]
        PFunc -->|Price| P2[getProductPrice]
        PFunc -->|Discount| P3[getDiscountedProducts]
        PFunc -->|Details| P4[getProductDetails]
        
        P1 --> PQuery[Query DB:<br/>Search by keyword]
        P2 --> PQuery
        P3 --> PQuery
        P4 --> PQuery
        PQuery --> PReturn[Return to AI]
    end
    
    subgraph AdvancedTools["📊 AdvancedProductTools (4 functions)"]
        AdvancedRoute --> AFunc{Function?}
        AFunc -->|Trending| A1[getTrendingProducts]
        AFunc -->|New| A2[getNewArrivals]
        AFunc -->|Category| A3[getProductsByCategory]
        AFunc -->|List| A4[getCategories]
        
        A1 --> AQuery[Query DB:<br/>By discount/date/category]
        A2 --> AQuery
        A3 --> AQuery
        A4 --> AQuery
        AQuery --> AReturn[Return to AI]
    end
    
    subgraph OrderTools["📦 OrderTools (4 functions)"]
        OrderRoute --> OFunc{Function?}
        OFunc -->|List| O1[getMyOrders]
        OFunc -->|Status| O2[getOrderStatus]
        OFunc -->|Payment| O3[getOrdersByPayment]
        OFunc -->|Stats| O4[getSpendingStats]
        
        O1 --> OFeign[Feign Call:<br/>order-service<br/>/v1/order]
        O2 --> OFeign
        O3 --> OFeign
        O4 --> OFeign
        OFeign --> OReturn["Format Message:<br/>✅ Hiển thị đầy đủ:<br/>- Order ID<br/>- Status<br/>- Tổng tiền 💰<br/>- Items<br/>- Date"]
        OReturn --> OtoAI[Return to AI]
    end
    
    subgraph ContextTools["🎯 ContextualSuggestTool (1 function)"]
        ScenarioRoute --> C1[suggestProductsByScenario]
        C1 --> CProcess["Process:<br/>1. Parse keywords<br/>2. Search each<br/>3. Deduplicate<br/>4. Limit 20<br/>5. Store ThreadLocal"]
        CProcess --> CReturn[Return summary to AI]
    end
    
    subgraph AIResponse["🤖 AI MODEL (Generate Response)"]
        FSReturn --> Combine[Combine tool results]
        LReturn --> Combine
        PReturn --> Combine
        AReturn --> Combine
        OtoAI --> Combine
        CReturn --> Combine
        DirectAnswer --> Combine
        
        Combine --> FormatMsg[Format friendly message]
        FormatMsg --> ReturnSystem[Return to System]
    end
    
    subgraph SystemResponse["🖥️ SYSTEM (Build Response)"]
        ReturnSystem --> CheckThread{ThreadLocal<br/>có products?}
        CheckThread -->|Yes| AddProducts["Add productSuggestions:<br/>{message, type:'products',<br/>productSuggestions:[...]}"]
        CheckThread -->|No| TextOnly[Text-only response]
        
        AddProducts --> SaveHistory[Save conversation]
        TextOnly --> SaveHistory
        SaveHistory --> ClearThread[Clear ThreadLocal]
        ClearThread --> ReturnUser[Return JSON to user]
    end
    
    ReturnUser --> ViewResult
    Navigate --> End([End])
    ContinueChat --> TypeMsg
    EndChat --> End
    
    style User fill:#e6f3ff
    style System fill:#fff5e6
    style SystemResponse fill:#fff5e6
    style AI fill:#ffe6f0
    style AIResponse fill:#ffe6f0
    style FlashSaleTools fill:#ffe6cc
    style LiveTools fill:#e6ffe6
    style ProductTools fill:#e6f0ff
    style AdvancedTools fill:#f0f0ff
    style OrderTools fill:#e6f5ff
    style ContextTools fill:#fff0f5
```

---

## 2. Context Injection & System Initialization

**Cơ chế tiêm ngữ cảnh động vào AI prompt**

```mermaid
flowchart LR
    subgraph Init["⚙️ SYSTEM INIT (Startup)"]
        A[AIChatService<br/>Khởi tạo] --> B[Load Categories]
        B --> C[CategoryRepository<br/>findAll]
        C --> D["Categories List:<br/>Sport & Outdoor,<br/>Fashion, Electronics,..."]
    end
    
    subgraph Request["📨 MỖI REQUEST"]
        R1[User gửi message] --> R2[Get Flash Sale Context]
        R2 --> R3["FlashSaleTools:<br/>getCurrentFlashSales<br/>→ '2 Flash Sales đang hoạt động'"]
        
        R3 --> R4[Get Live Context]
        R4 --> R5["LiveSessionTools:<br/>getActiveLiveSessions<br/>→ '3 phiên live đang hoạt động'"]
    end
    
    subgraph Build["🏗️ BUILD PROMPT"]
        D --> P1[System Prompt Template]
        R3 --> P1
        R5 --> P1
        
        P1 --> P2["Replace placeholders:<br/>{available_categories}<br/>{flash_sale_context}<br/>{live_context}<br/>{current_time}<br/>{user_id}"]
        
        P2 --> P3[Final System Prompt]
    end
    
    subgraph Prompt["📝 FINAL PROMPT"]
        P3 --> Content["CONTEXT:<br/>- Categories: Sport & Outdoor, Fashion...<br/>- Flash Sale: 2 đang hoạt động 🔥<br/>- Live: 3 phiên đang live 📺<br/>- Time: 15/01/2026 00:00<br/><br/>TOOLS AVAILABLE:<br/>- Flash Sale Tools (4)<br/>- Live Tools (3)<br/>- Product Tools (8)<br/>- Order Tools (4)<br/>- Contextual Suggest (1)"]
    end
    
    Content --> Send[Send to AI Model]
    Send --> AI[AI có đầy đủ context<br/>để quyết định tool phù hợp]
    
    style Init fill:#fff5e6
    style Request fill:#e6f3ff
    style Build fill:#f0fff0
    style Prompt fill:#ffe6f0
```

---

## AI Capabilities Summary

### 🎯 20 AI Functions Across 6 Tool Classes

| Category | Functions | Use Cases |
|----------|-----------|-----------|
| **🔥 Flash Sale** | 4 | "Hôm nay có Flash Sale gì?", "Sản phẩm X có sale không?" |
| **📺 Live Sessions** | 3 | "Có shop nào đang live?", "Live bán giày ở đâu?" |
| **📊 Advanced Products** | 4 | "Sản phẩm trending?", "Hàng mới về?", "Danh mục nào?" |
| **🛍️ Basic Products** | 4 | "Tìm giày", "Giá bao nhiêu?", "Sản phẩm giảm giá?" |
| **📦 Orders** | 4 | "Đơn hàng của tôi?", "Chi tiêu bao nhiêu?", "Trạng thái đơn?" |
| **🎯 Contextual** | 1 | "Tôi muốn đi cắm trại" → gợi ý lều, túi ngủ, thảm |

### ✅ Key Features

- **Context-Aware**: AI biết shop có danh mục gì, Flash Sale nào, Live nào
- **Real-time Data**: Context được inject mỗi request
- **Smart Routing**: AI tự chọn tool phù hợp dựa trên intent
- **Product Carousel**: Kết quả trả về kèm carousel (nếu có)
- **Fixed Order Display**: Hiển thị đủ thông tin đơn hàng (ID, status, tổng tiền ✅, items, date)

---

**Last Updated:** 2026-01-15  
**Status:** ✅ Complete - 2 consolidated diagrams

---

## Table of Contents

**Core Features:**
1. [Basic Chat Flow](#1-basic-chat-flow) - User sends message → AI responds
2. [Flash Sale Query](#2-flash-sale-query) - Query active/upcoming Flash Sales
3. [Live Session Discovery](#3-live-session-discovery) - Find active live streams
4. [Product Suggestion by Scenario](#4-product-suggestion-by-scenario) - Contextual product recommendations
5. [Order Management Query](#5-order-management-query) - View orders and spending
6. [Advanced Product Discovery](#6-advanced-product-discovery) - Trending, new arrivals, categories

---

## 1. Basic Chat Flow

**User sends message and receives AI response with context awareness**

```mermaid
flowchart TD
    Start([User opens chat])
    
    subgraph User["👤 USER"]
        Start --> TypeMsg[Type message]
        TypeMsg --> ClickSend[Click send button]
        
        ViewResponse[View AI response]
        ViewResponse --> CheckType{Response type?}
        CheckType -->|Text only| ReadMsg[Read message]
        CheckType -->|With products| ViewProducts[View product carousel]
        ViewProducts --> ClickProduct{Click product?}
        ClickProduct -->|Yes| NavigateProduct[Go to product page]
        ClickProduct -->|No| ContinueChat[Continue chatting]
        ReadMsg --> ContinueChat
    end
    
    subgraph System["🖥️ SYSTEM (AIChatService)"]
        ClickSend --> DetectLang[1. Detect language:<br/>Vietnamese/English]
        DetectLang --> LoadHistory[2. Load conversation history]
        LoadHistory --> InjectContext["3. Inject dynamic context:<br/>- Categories list<br/>- Flash Sale status<br/>- Live session count"]
        InjectContext --> BuildPrompt[4. Build System Prompt<br/>with placeholders filled]
        BuildPrompt --> SendToAI[5. Send to AI Model]
    end
    
    subgraph AI["🤖 AI MODEL (Ollama)"]
        SendToAI --> AnalyzeIntent[Analyze user intent]
        AnalyzeIntent --> DecideTool{Need to call tool?}
        DecideTool -->|No| DirectResponse[Generate text response]
        DecideTool -->|Yes| CallTool[Call appropriate tool]
        CallTool --> ReceiveResult[Receive tool result]
        ReceiveResult --> FormatResponse[Format response with data]
        DirectResponse --> ReturnToSystem
        FormatResponse --> ReturnToSystem[Return to system]
    end
    
    subgraph System2["🖥️ SYSTEM (Response Handler)"]
        ReturnToSystem --> CheckThreadLocal{Has product<br/>suggestions?}
        CheckThreadLocal -->|Yes| EnrichResponse[Add productSuggestions array]
        CheckThreadLocal -->|No| TextOnly[Text-only response]
        EnrichResponse --> SaveHistory[Save to conversation history]
        TextOnly --> SaveHistory
        SaveHistory --> ReturnJSON[Return JSON response]
    end
    
    ReturnJSON --> ViewResponse
    NavigateProduct --> End([End])
    ContinueChat --> End
    
    style User fill:#e6f3ff
    style System fill:#fff5e6
    style System2 fill:#fff5e6
    style AI fill:#ffe6f0
```

---

## 2. Flash Sale Query

**User asks about Flash Sales - AI calls FlashSaleTools**

```mermaid
flowchart TD
    Start([User asks:<br/>'Hôm nay có Flash Sale gì?'])
    
    subgraph User["👤 USER"]
        Start --> SendMsg[Send message]
        
        ViewFlashSales["View Flash Sale info:<br/>- Session name<br/>- Time range<br/>- Product count<br/>- Max discount %"]
        ViewFlashSales --> UserAction{Action?}
        UserAction -->|View products| AskProducts[Ask about specific sale]
        UserAction -->|Check product| AskCheck[Ask if product in sale]
        UserAction -->|Continue| ContinueChat[Continue chatting]
    end
    
    subgraph System["🖥️ SYSTEM"]
        SendMsg --> PreInject[Context already injected:<br/>'2 Flash Sales đang hoạt động']
        PreInject --> SendAI[Send to AI]
    end
    
    subgraph AI["🤖 AI MODEL"]
        SendAI --> SeeContext[AI sees context in prompt]
        SeeContext --> Decide{User query<br/>type?}
        Decide -->|Current sales| CallCurrent[Call: getCurrentFlashSales]
        Decide -->|Upcoming| CallUpcoming[Call: getUpcomingFlashSales]
        Decide -->|Check product| CallCheck[Call: checkProductInFlashSale]
        Decide -->|View products| CallProducts[Call: getFlashSaleProducts]
    end
    
    subgraph FlashSaleTools["⚡ FlashSaleTools"]
        CallCurrent --> QueryActive[Query: findByStatus(ACTIVE)<br/>filter by time]
        CallUpcoming --> QueryUpcoming[Query: ACTIVE sessions<br/>with future startTime]
        CallCheck --> QueryProduct[Query: findByProductId]
        CallProducts --> QueryBySession[Query: findBySessionId]
        
        QueryActive --> FormatFlash[Format response:<br/>sessionInfo + message]
        QueryUpcoming --> FormatFlash
        QueryProduct --> FormatFlash
        QueryBySession --> FormatFlash
        FormatFlash --> ReturnTool[Return to AI]
    end
    
    subgraph AI2["🤖 AI MODEL (cont)"]
        ReturnTool --> GenerateMsg[Generate friendly message]
        GenerateMsg --> ReturnSystem[Return to system]
    end
    
    ReturnSystem --> ViewFlashSales
    AskProducts --> End([End])
    AskCheck --> End
    ContinueChat --> End
    
    style User fill:#e6f3ff
    style System fill:#fff5e6
    style AI fill:#ffe6f0
    style AI2 fill:#ffe6f0
    style FlashSaleTools fill:#ffe6cc
```

---

## 3. Live Session Discovery

**User searches for active live streaming sessions**

```mermaid
flowchart TD
    Start([User asks:<br/>'Có shop nào live bán giày?'])
    
    subgraph User["👤 USER"]
        Start --> SendQuery[Send message]
        
        ViewLive["View live sessions:<br/>- Shop name<br/>- Title<br/>- Viewer count<br/>- Product count"]
        ViewLive --> UserDecision{Action?}
        UserDecision -->|View details| AskDetails[Ask about specific live]
        UserDecision -->|Continue| ContinueChat[Continue chatting]
    end
    
    subgraph System["🖥️ SYSTEM"]
        SendQuery --> CheckContext[Context already shows:<br/>'2 phiên live đang hoạt động']
        CheckContext --> ForwardAI[Forward to AI]
    end
    
    subgraph AI["🤖 AI MODEL"]
        ForwardAI --> DetectIntent[Detect: Live session query]
        DetectIntent --> ChooseTool{Query type?}
        ChooseTool -->|All active| CallGetActive[Call: getActiveLiveSessions]
        ChooseTool -->|Search keyword| CallSearch[Call: searchLiveByKeyword]
        ChooseTool -->|Specific room| CallDetails[Call: getLiveDetails]
    end
    
    subgraph LiveTools["📺 LiveSessionTools"]
        CallGetActive --> FeignAll[Feign: GET notification-service<br/>/api/live?page=1&size=50]
        CallSearch --> FeignSearch[Feign: GET notification-service<br/>/api/live?page=1&size=50]
        CallDetails --> FeignDetail[Feign: GET notification-service<br/>/api/live/:roomId]
    end
    
    subgraph NotificationService["🌐 notification-service"]
        FeignAll --> GetActive[Get LIVE status rooms]
        FeignSearch --> GetAll[Get all rooms]
        FeignDetail --> GetRoom[Get room by ID]
        
        GetActive --> ReturnRooms[Return LiveRoomDto list]
        GetAll --> FilterKeyword[Filter by keyword in<br/>title/description/shopName]
        GetRoom --> ReturnRoom[Return LiveRoomDto]
        FilterKeyword --> ReturnFiltered[Return filtered list]
    end
    
    subgraph LiveTools2["📺 LiveSessionTools (cont)"]
        ReturnRooms --> MapToInfo[Map to LiveSessionInfo]
        ReturnFiltered --> MapToInfo
        ReturnRoom --> MapToDetail[Map to LiveSessionDetail]
        MapToInfo --> FormatMsg[Build formatted message]
        MapToDetail --> FormatMsg
        FormatMsg --> ReturnAI[Return to AI]
    end
    
    subgraph AI2["🤖 AI MODEL (cont)"]
        ReturnAI --> GenerateResponse[Generate user-friendly response]
        GenerateResponse --> ReturnSys[Return to system]
    end
    
    ReturnSys --> ViewLive
    AskDetails --> End([End])
    ContinueChat --> End
    
    style User fill:#e6f3ff
    style System fill:#fff5e6
    style AI fill:#ffe6f0
    style AI2 fill:#ffe6f0
    style LiveTools fill:#e6ffe6
    style LiveTools2 fill:#e6ffe6
    style NotificationService fill:#ffe6cc
```

---

## 4. Product Suggestion by Scenario

**Context-aware product suggestions based on user activity**

```mermaid
flowchart TD
    Start([User says:<br/>'Tôi muốn đi cắm trại'])
    
    subgraph User["👤 USER"]
        Start --> SendScenario[Send scenario message]
        
        ViewSuggestions["View suggestions:<br/>- AI text explanation<br/>- Product carousel<br/>- Click to view product"]
        ViewSuggestions --> UserChoice{Action?}
        UserChoice -->|View product| ClickCard[Click product card]
        UserChoice -->|Ask more| AskMore[Ask follow-up question]
        ClickCard --> Navigate[Go to product page]
    end
    
    subgraph System["🖥️ SYSTEM"]
        SendScenario --> LoadCategories[Categories already in prompt:<br/>'Sport & Outdoor (Camping gear)']
        LoadCategories --> SendAI[Send to AI]
    end
    
    subgraph AI["🤖 AI MODEL"]
        SendAI --> ReadContext[Read shop categories]
        ReadContext --> InferKeywords["Infer keywords matching inventory:<br/>'lều', 'túi ngủ', 'thảm'"]
        InferKeywords --> CallSuggest[Call: suggestProductsByScenario<br/>(keywords)]
    end
    
    subgraph ContextualTool["🎯 ContextualSuggestTool"]
        CallSuggest --> ParseKeywords[Parse keyword list]
        ParseKeywords --> LoopSearch{For each keyword}
        LoopSearch --> SearchDB[searchProducts(keyword)]
        SearchDB --> AddResults[Add to results list]
        AddResults --> LoopSearch
        LoopSearch -->|All done| Deduplicate[Remove duplicates]
        Deduplicate --> LimitResults[Limit to top 20]
        LimitResults --> StoreThread[Store in ThreadLocal]
        StoreThread --> ReturnText[Return summary text to AI]
    end
    
    subgraph AI2["🤖 AI MODEL (cont)"]
        ReturnText --> GenerateFriendly[Generate friendly explanation]
        GenerateFriendly --> ReturnSys[Return to system]
    end
    
    subgraph System2["🖥️ SYSTEM (Response)"]
        ReturnSys --> CheckThread{ThreadLocal<br/>has products?}
        CheckThread -->|Yes| EnrichJSON["Enrich response:<br/>{message, type: 'products',<br/>productSuggestions: [...]}"]
        CheckThread -->|No| TextJSON[Text-only response]
        EnrichJSON --> ClearThread[Clear ThreadLocal]
        TextJSON --> ReturnUser
        ClearThread --> ReturnUser[Return to user]
    end
    
    ReturnUser --> ViewSuggestions
    Navigate --> End([End])
    AskMore --> End
    
    style User fill:#e6f3ff
    style System fill:#fff5e6
    style System2 fill:#fff5e6
    style AI fill:#ffe6f0
    style AI2 fill:#ffe6f0
    style ContextualTool fill:#fff0f5
```

---

## 5. Order Management Query

**User views their orders with full details**

```mermaid
flowchart TD
    Start([User asks:<br/>'Đơn hàng của tôi thế nào?'])
    
    subgraph User["👤 USER"]
        Start --> SendQuery[Send message]
        
        ViewOrders["View order list:<br/>📦 Đơn hàng của bạn (X đơn):<br/>- Order ID<br/>- Status<br/>- Total amount ✅<br/>- Item count<br/>- Created date"]
        ViewOrders --> UserAction{What next?}
        UserAction -->|Check status| AskStatus[Ask about order status]
        UserAction -->|View spending| AskSpending[Ask about spending stats]
        UserAction -->|Done| FinishChat[End conversation]
    end
    
    subgraph System["🖥️ SYSTEM"]
        SendQuery --> ForwardAI[Forward to AI]
    end
    
    subgraph AI["🤖 AI MODEL"]
        ForwardAI --> DetectOrder[Detect: Order query]
        DetectOrder --> ChooseFunc{Query type?}
        ChooseFunc -->|List orders| CallGetOrders[Call: getMyOrders<br/>(userId)]
        ChooseFunc -->|Order status| CallStatus[Call: getOrderStatus<br/>(orderId)]
        ChooseFunc -->|Payment filter| CallPayment[Call: getOrdersByPayment<br/>(paymentType)]
        ChooseFunc -->|Spending| CallSpending[Call: getSpendingStats<br/>(userId)]
    end
    
    subgraph OrderTools["📦 OrderTools"]
        CallGetOrders --> FetchOrders[Feign: GET order-service<br/>/v1/order/user/:userId]
        CallStatus --> FetchStatus[Feign: GET order-service<br/>/v1/order/:orderId]
        CallPayment --> FetchPayment[Feign: GET order-service<br/>/v1/order/user/:userId<br/>filter by payment]
        CallSpending --> FetchStats[Feign: GET order-service<br/>/v1/order/user/:userId<br/>aggregate stats]
        
        FetchOrders --> MapOrders[Map to OrderSummary]
        FetchStatus --> MapStatus[Map to OrderDetail]
        FetchPayment --> MapPayment[Map to OrderSummary list]
        FetchStats --> MapStats[Calculate total/avg/count]
        
        MapOrders --> BuildMessage["Build formatted message:<br/>- Order ID<br/>- Trạng thái<br/>- Tổng tiền 💰<br/>- Số sản phẩm<br/>- Ngày đặt"]
        MapStatus --> BuildMessage
        MapPayment --> BuildMessage
        MapStats --> BuildMessage
        BuildMessage --> ReturnAI[Return to AI]
    end
    
    subgraph AI2["🤖 AI MODEL (cont)"]
        ReturnAI --> FormatNatural[Format in natural language]
        FormatNatural --> ReturnSys[Return to system]
    end
    
    ReturnSys --> ViewOrders
    AskStatus --> End([End])
    AskSpending --> End
    FinishChat --> End
    
    style User fill:#e6f3ff
    style System fill:#fff5e6
    style AI fill:#ffe6f0
    style AI2 fill:#ffe6f0
    style OrderTools fill:#e6f5ff
```

---

## 6. Advanced Product Discovery

**Trending products, new arrivals, category browsing**

```mermaid
flowchart TD
    Start([User asks:<br/>'Sản phẩm nào đang trending?'])
    
    subgraph User["👤 USER"]
        Start --> SendQuery[Send message]
        
        ViewResults["View product list:<br/>- Product name<br/>- Price<br/>- Discount %<br/>- Category<br/>- Stock status"]
        ViewResults --> UserAction{Action?}
        UserAction -->|Browse category| AskCategory[Ask about category]
        UserAction -->|View new| AskNew[Ask about new arrivals]
        UserAction -->|Continue| Continue[Continue chat]
    end
    
    subgraph System["🖥️ SYSTEM"]
        SendQuery --> ForwardAI[Forward to AI]
    end
    
    subgraph AI["🤖 AI MODEL"]
        ForwardAI --> AnalyzeQuery[Analyze query intent]
        AnalyzeQuery --> SelectFunc{Query type?}
        SelectFunc -->|Trending| CallTrending[Call: getTrendingProducts<br/>(limit)]
        SelectFunc -->|New arrivals| CallNew[Call: getNewArrivals<br/>(days, limit)]
        SelectFunc -->|By category| CallCategory[Call: getProductsByCategory<br/>(categoryName)]
        SelectFunc -->|List categories| CallList[Call: getCategories]
    end
    
    subgraph AdvancedTools["📊 AdvancedProductTools"]
        CallTrending --> QueryTrending["Query products:<br/>ORDER BY discountPercent DESC<br/>LIMIT X"]
        CallNew --> QueryNew["Query products:<br/>createdTimestamp > cutoffDate<br/>ORDER BY createdTimestamp DESC"]
        CallCategory --> QueryCategory["Query products:<br/>WHERE category.name = X"]
        CallList --> QueryCategories[Query: findAll categories]
        
        QueryTrending --> MapProducts[Map to ProductInfo]
        QueryNew --> MapProducts
        QueryCategory --> MapProducts
        QueryCategories --> MapCategories[Map to CategoryInfo]
        
        MapProducts --> FormatProduct["Format message:<br/>- Name<br/>- Price + discount<br/>- Category<br/>- Stock"]
        MapCategories --> FormatCat["Format categories:<br/>- Name<br/>- Product count"]
        FormatProduct --> ReturnAI
        FormatCat --> ReturnAI[Return to AI]
    end
    
    subgraph AI2["🤖 AI MODEL (cont)"]
        ReturnAI --> GenerateResponse[Generate user-friendly response]
        GenerateResponse --> ReturnSys[Return to system]
    end
    
    ReturnSys --> ViewResults
    AskCategory --> End([End])
    AskNew --> End
    Continue --> End
    
    style User fill:#e6f3ff
    style System fill:#fff5e6
    style AI fill:#ffe6f0
    style AI2 fill:#ffe6f0
    style AdvancedTools fill:#f0f0ff
```

---

## AI Tools Summary

| Tool Class | Functions | Purpose |
|------------|-----------|---------|
| 🔥 **FlashSaleTools** | 4 | Query Flash Sales, check product status |
| 📺 **LiveSessionTools** | 3 | Discover live streams via notification-service |
| 📊 **AdvancedProductTools** | 4 | Trending, new, category browsing |
| 🛍️ **ProductTools** | 4 | Search, price, discounts, details |
| 📦 **OrderTools** | 4 | Orders, status, payment filter, spending |
| 🎯 **ContextualSuggestTool** | 1 | Scenario-based suggestions |

**Total**: **20 AI Functions**

---

## Context Injection Mechanism

The system dynamically injects real-time context into the AI prompt:

```plaintext
REAL-TIME UPDATES:
- 🔥 Flash Sale: {flash_sale_context}
  → Example: "2 Flash Sale đang hoạt động"
  
- 📺 Live Sessions: {live_context}
  → Example: "3 phiên live đang hoạt động"
  
- 📂 Categories: {available_categories}
  → Example: "Sport & Outdoor, Fashion, Electronics, Home & Living"
```

This allows AI to:
1. **Know** what's happening in real-time
2. **Suggest** relevant tools to call
3. **Infer** keywords matching actual inventory

---

**Last Updated:** 2026-01-15  
**Status:** ✅ Complete - Flowchart with swimlanes

```mermaid
sequenceDiagram
    participant User as 👤 User
    participant System as 🖥️ System Backend<br/>(AIChatService + Tools)
    participant AI as 🤖 AI Model<br/>(Ollama LLM)
    participant DB as 💾 Database<br/>(Product/Order/FlashSale)
    
    Note over User,DB: === INITIALIZATION PHASE ===
    System->>DB: Load Categories, Flash Sales, Live Sessions
    DB-->>System: Context Data
    System->>System: Build System Prompt with:<br/>- Categories<br/>- Flash Sale Status<br/>- Live Session Count
    
    Note over User,DB: === USER CHAT PHASE ===
    User->>System: Send Message:<br/>"Hôm nay có Flash Sale gì?"
    
    System->>System: 1. Language Detection
    System->>System: 2. Get Conversation History
    System->>System: 3. Inject Dynamic Context<br/>(Flash Sale, Live, Categories)
    
    System->>AI: [System Prompt] + [User Message]<br/>+ [Conversation History]
    
    Note over AI: AI Analyzes Intent
    
    alt Flash Sale Query
        AI->>System: Call getCurrentFlashSales()
        System->>DB: Query Active Flash Sales
        DB-->>System: Flash Sale Sessions
        System-->>AI: Tool Result:<br/>"2 Flash Sales active"
        
    else Product Search Query
        AI->>System: Call searchProducts(keyword)
        System->>DB: Search Products
        DB-->>System: Product List
        System-->>AI: Tool Result
        
    else Scenario-Based Query
        AI->>System: Call suggestProductsByScenario(keywords)
        System->>DB: Multi-keyword Search
        DB-->>System: Matched Products
        System->>System: Store in ThreadLocal
        System-->>AI: Tool Result
        
    else Order Query
        AI->>System: Call getMyOrders(userId)
        System->>DB: Fetch User Orders
        DB-->>System: Order List with Details
        System-->>AI: Formatted Order Info
        
    else Live Session Query
        AI->>System: Call getActiveLiveSessions()
        System->>System: Feign Call to notification-service
        System-->>AI: Live Room List
        
    else Trending Products
        AI->>System: Call getTrendingProducts()
        System->>DB: Query by Discount %
        DB-->>System: Trending Products
        System-->>AI: Product List
    end
    
    AI->>AI: Generate Natural Response
    AI-->>System: Final AI Response Text
    
    System->>System: Check ThreadLocal for Product Suggestions
    
    alt Has Product Suggestions
        System-->>User: {<br/>  message: "Đây là sản phẩm...",<br/>  type: "products",<br/>  productSuggestions: [...]<br/>}
        User->>User: Render Chat Bubble + Product Carousel
        
    else Text Only
        System-->>User: {<br/>  message: "...",<br/>  type: "text"<br/>}
        User->>User: Render Chat Bubble
    end
    
    Note over User,DB: === END CHAT PHASE ===
```

---

## 2. AI Tool Decision Tree

```mermaid
flowchart TD
    Start([User Message]) --> Analyze{AI Phân Tích Intent}
    
    Analyze -->|Flash Sale Query| FlashTools[Flash Sale Tools]
    Analyze -->|Product Search| ProductTools[Product Tools]
    Analyze -->|Scenario/Activity| ContextTools[Contextual Suggest]
    Analyze -->|Order/Spending| OrderTools[Order Tools]
    Analyze -->|Live/Shopping| LiveTools[Live Session Tools]
    Analyze -->|Category Browse| AdvancedTools[Advanced Product Tools]
    
    subgraph FlashSaleTools["🔥 Flash Sale Tools"]
        FlashTools --> FS1[getCurrentFlashSales]
        FlashTools --> FS2[getFlashSaleProducts]
        FlashTools --> FS3[checkProductInFlashSale]
        FlashTools --> FS4[getUpcomingFlashSales]
    end
    
    subgraph ProductTools["🛍️ Product Tools"]
        ProductTools --> PT1[searchProducts]
        ProductTools --> PT2[getProductPrice]
        ProductTools --> PT3[getDiscountedProducts]
        ProductTools --> PT4[getProductDetails]
    end
    
    subgraph ContextualSuggest["🎯 Contextual Tools"]
        ContextTools --> CT1[suggestProductsByScenario<br/>Extract keywords → Search → Dedupe]
    end
    
    subgraph OrderTools["📦 Order Tools"]
        OrderTools --> OT1[getMyOrders]
        OrderTools --> OT2[getOrderStatus]
        OrderTools --> OT3[getOrdersByPayment]
        OrderTools --> OT4[getSpendingStats]
    end
    
    subgraph LiveSessionTools["📺 Live Session Tools"]
        LiveTools --> LT1[getActiveLiveSessions]
        LiveTools --> LT2[searchLiveByKeyword]
        LiveTools --> LT3[getLiveDetails]
    end
    
    subgraph AdvancedProductTools["📊 Advanced Product Tools"]
        AdvancedTools --> AT1[getTrendingProducts]
        AdvancedTools --> AT2[getNewArrivals]
        AdvancedTools --> AT3[getProductsByCategory]
        AdvancedTools --> AT4[getCategories]
    end
    
    FS1 --> Return[Return Tool Result to AI]
    FS2 --> Return
    FS3 --> Return
    FS4 --> Return
    PT1 --> Return
    PT2 --> Return
    PT3 --> Return
    PT4 --> Return
    CT1 --> Return
    OT1 --> Return
    OT2 --> Return
    OT3 --> Return
    OT4 --> Return
    LT1 --> Return
    LT2 --> Return
    LT3 --> Return
    AT1 --> Return
    AT2 --> Return
    AT3 --> Return
    AT4 --> Return
    
    Return --> AIResponse[AI Format Response]
    AIResponse --> End([Send to User])
    
    style FlashSaleTools fill:#ffe6e6
    style ProductTools fill:#e6f3ff
    style ContextualSuggest fill:#fff5e6
    style OrderTools fill:#f0fff0
    style LiveSessionTools fill:#f3e6ff
    style AdvancedProductTools fill:#ffe6f5
```

---

## 3. Context Injection Flow (Real-Time Updates)

```mermaid
flowchart LR
    subgraph Init["System Initialization"]
        A[CategoryRepository] -->|findAll| B[Categories List]
        C[FlashSaleRepository] -->|findActive| D[Flash Sale Sessions]
        E[NotificationServiceClient] -->|getActiveLiveRooms| F[Live Rooms]
    end
    
    subgraph Build["Build System Prompt"]
        B --> G{Format Context}
        D --> G
        F --> G
        G --> H[System Prompt Template]
    end
    
    subgraph Inject["Dynamic Replacement"]
        H --> I["Replace {available_categories}"]
        I --> J["Replace {flash_sale_context}"]
        J --> K["Replace {live_context}"]
        K --> L["Replace {current_time}"]
        L --> M["Replace {user_id}"]
    end
    
    M --> N[Final System Prompt]
    N --> O[Send to AI Model]
    
    style Init fill:#e6f3ff
    style Build fill:#fff5e6
    style Inject fill:#f0fff0
```

---

## 4. Example: Flash Sale Query Flow

```mermaid
sequenceDiagram
    participant U as User
    participant S as AIChatService
    participant AI as Ollama
    participant FST as FlashSaleTools
    participant DB as Database
    
    U->>S: "Hôm nay có Flash Sale gì?"
    S->>S: Inject Flash Sale Context:<br/>"2 Flash Sales đang hoạt động"
    S->>AI: System Prompt + User Query
    
    Note over AI: AI sees context → knows to call tool
    
    AI->>S: Function Call:<br/>getCurrentFlashSales()
    S->>FST: Execute Tool
    FST->>DB: findByStatus(ACTIVE)<br/>filter by time
    DB-->>FST: 2 Active Sessions
    FST->>FST: Build Formatted Message
    FST-->>S: FlashSaleSessionInfo[]<br/>+ Message
    S-->>AI: Tool Result
    
    AI->>AI: Generate Natural Response
    AI-->>S: "🔥 Hiện đang có 2 Flash Sale..."
    S-->>U: Display Response
```

---

## 5. Example: Live Session Discovery Flow

```mermaid
sequenceDiagram
    participant U as User
    participant S as AIChatService
    participant AI as Ollama
    participant LST as LiveSessionTools
    participant NS as notification-service
    
    U->>S: "Có shop nào đang live bán đồ thể thao?"
    S->>AI: System Prompt + Query
    
    AI->>S: searchLiveByKeyword("thể thao")
    S->>LST: Execute Tool
    LST->>NS: GET /api/live?page=1&size=50<br/>(via Feign Client)
    NS-->>LST: List<LiveRoomDto>
    LST->>LST: Filter by keyword<br/>Match: title, description, shopName
    LST-->>S: Matched Live Sessions
    S-->>AI: Tool Result
    
    AI->>AI: Format Response
    AI-->>S: "📺 Có 2 phiên live..."
    S-->>U: Display Response
```

---

## 6. Summary of AI Capabilities

| Category | Functions | Description |
|----------|-----------|-------------|
| 🔥 **Flash Sale** | 4 | Query active/upcoming Flash Sales, check product status |
| 📺 **Live Sessions** | 3 | Find live streams, search by keyword, get details |
| 📊 **Product Discovery** | 4 | Trending, new arrivals, browse by category |
| 🛍️ **Product Search** | 4 | Search, price check, discounts, details |
| 📦 **Order Management** | 4 | View orders, status, filter by payment, spending stats |
| 🎯 **Contextual Suggest** | 1 | Scenario-based product suggestions |

**Total**: **20 AI Functions** (9 existing + 11 new)
