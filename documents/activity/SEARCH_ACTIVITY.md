# Activity Diagrams - Search & Cache

Tài liệu mô tả Activity Diagram cho hệ thống tìm kiếm thông minh với Redis Cache.

---

## 1. Smart Search with Cache (Tìm Kiếm với Cache)

```mermaid
flowchart TD
    Start([Start]) --> TypeQuery[User nhập từ khóa tìm kiếm]
    
    subgraph Client["👤 CLIENT"]
        TypeQuery --> Debounce[Debounce 300ms]
        Debounce --> SendSearch[Gửi search request]
        ShowResults[Hiển thị kết quả] --> CheckCache{Cached?}
        CheckCache -->|Yes| ShowBadge[Hiện badge Cached]
        CheckCache -->|No| NoBadge[Không hiện badge]
        ShowBadge --> UserView[User xem kết quả]
        NoBadge --> UserView
    end
    
    subgraph System["🖥️ SYSTEM"]
        SendSearch --> ParseQuery[SmartSearchService parse query]
        ParseQuery --> ExtractPrice{Có giá?}
        ExtractPrice -->|Yes| SetPriceFilter[Set priceMin/Max]
        ExtractPrice -->|No| ExtractCategory
        SetPriceFilter --> ExtractCategory{Có category?}
        ExtractCategory -->|Yes| SetCategoryFilter[Set categories]
        ExtractCategory -->|No| MergeFilters
        SetCategoryFilter --> MergeFilters[Merge UI filters]
        MergeFilters --> CheckRedis{Có cache?}
        CheckRedis -->|Hit| GetCache[Lấy từ Redis]
        CheckRedis -->|Miss| QueryDB[Query database]
        QueryDB --> ApplyCriteria[Apply search criteria]
        ApplyCriteria --> ApplySort[Apply sorting]
        ApplySort --> Paginate[Paginate results]
        Paginate --> SaveCache[Lưu cache 24h TTL]
        SaveCache --> ReturnResults
        GetCache --> ReturnResults[Trả về kết quả]
        ReturnResults --> ShowResults
        ReturnResults --> SaveHistory{User logged in?}
        SaveHistory -->|Yes| AddHistory[Thêm search history]
        SaveHistory -->|No| TrackAnalytics
        AddHistory --> TrackAnalytics[Track trending keywords]
    end
    
    subgraph Redis["💾 REDIS"]
        GetCache -.-> CacheData[("search:cache:query:hash<br/>TTL: 24h")]
        SaveCache -.-> CacheData
        AddHistory -.-> HistoryData[("search:history:userId<br/>TTL: 30d<br/>Max: 10 items")]
        TrackAnalytics -.-> TrendingData[("analytics:search:keyword<br/>TTL: 7d")]
    end
    
    UserView --> End([End])
    
    style Client fill:#e6f3ff
    style System fill:#fff5e6
    style Redis fill:#ffe6e6
```

---

## 2. Autocomplete with History (Gợi Ý với Lịch Sử)

```mermaid
flowchart TD
    Start([Start]) --> Focus[User focus vào search box]
    
    subgraph Client["👤 CLIENT"]
        Focus --> CheckInput{Có query?}
        CheckInput -->|No| SendEmpty[Gửi request autocomplete rỗng]
        CheckInput -->|Yes| TypeQuery[User nhập từ khóa]
        TypeQuery --> Debounce[Debounce 300ms]
        Debounce --> SendQuery[Gửi request autocomplete]
        ShowSuggestions[Hiển thị danh sách gợi ý] --> ClickItem{User click?}
        ClickItem -->|Product| NavigateProduct[Chuyển trang sản phẩm]
        ClickItem -->|History/Keyword| NavigateSearch[Chuyển trang search]
        ClickItem -->|Remove| RemoveHistory[Xóa item khỏi history]
    end
    
    subgraph System["🖥️ SYSTEM"]
        SendEmpty --> GetHistory[Lấy search history]
        GetHistory --> ReturnHistory[Trả về history items]
        SendQuery --> SearchProducts[Tìm products by name]
        SearchProducts --> GetMatchHistory[Lấy matching history]
        GetMatchHistory --> CombineResults[Kết hợp products + history]
        CombineResults --> RemoveDuplicates[Bỏ trùng lặp]
        RemoveDuplicates --> LimitResults[Giới hạn items]
        LimitResults --> ReturnSuggestions[Trả về suggestions]
        ReturnHistory --> ShowSuggestions
        ReturnSuggestions --> ShowSuggestions
        RemoveHistory --> DeleteFromRedis[Xóa khỏi Redis List]
    end
    
    subgraph Redis["💾 REDIS"]
        GetHistory -.-> HistoryList[("search:history:userId<br/>List LIFO<br/>Max: 10")]
        GetMatchHistory -.-> HistoryList
        DeleteFromRedis -.-> HistoryList
    end
    
    NavigateProduct --> End([End])
    NavigateSearch --> End
    DeleteFromRedis --> Refresh[Làm mới suggestions]
    Refresh --> End
    
    style Client fill:#e6f3ff
    style System fill:#fff5e6
    style Redis fill:#ffe6e6
```

---

## 3. Cache Invalidation (Vô Hiệu Cache)

```mermaid
flowchart TD
    Start([Start]) --> Trigger{Trigger event?}
    
    subgraph Admin["👨‍💼 ADMIN"]
        Trigger -->|Product Update| UpdateProduct[Cập nhật sản phẩm]
        Trigger -->|Product Delete| DeleteProduct[Xóa sản phẩm]
        Trigger -->|Category Change| ChangeCategory[Thay đổi category]
        UpdateProduct --> AdminAction
        DeleteProduct --> AdminAction
        ChangeCategory --> AdminAction[Admin action completed]
    end
    
    subgraph System["🖥️ SYSTEM"]
        AdminAction --> InvalidateCache[Invalidate search cache]
        InvalidateCache --> FindKeys[Tìm cache keys liên quan]
        FindKeys --> LoopKeys{Còn keys?}
        LoopKeys -->|Yes| DeleteKey[Xóa cache key]
        DeleteKey --> LoopKeys
        LoopKeys -->|No| LogInvalidation[Log invalidation event]
        LogInvalidation --> Complete[Hoàn tất]
    end
    
    subgraph Redis["💾 REDIS"]
        FindKeys -.-> SearchCache[("search:cache:*<br/>Pattern matching")]
        DeleteKey -.-> SearchCache
    end
    
    subgraph NextSearch["🔄 NEXT SEARCH"]
        Complete -.-> CacheMiss[Cache miss]
        CacheMiss -.-> FreshData[Query fresh data]
        FreshData -.-> RebuildCache[Rebuild cache]
    end
    
    RebuildCache --> End([End])
    
    style Admin fill:#fff0e6
    style System fill:#fff5e6
    style Redis fill:#ffe6e6
    style NextSearch fill:#e6ffe6
```

---

## 4. Search with Filters (Tìm Kiếm với Bộ Lọc)

```mermaid
flowchart TD
    Start([Start]) --> SelectFilter[User chọn filter]
    
    subgraph Client["👤 CLIENT"]
        SelectFilter --> FilterType{Loại filter?}
        FilterType -->|Price| SetPrice[Set price range]
        FilterType -->|Category| SelectCat[Chọn category]
        FilterType -->|Location| SelectLoc[Chọn location]
        SetPrice --> TriggerSearch
        SelectCat --> TriggerSearch
        SelectLoc --> TriggerSearch[Trigger search API]
        ShowFiltered[Hiển thị kết quả lọc] --> ViewResults[User xem sản phẩm]
    end
    
    subgraph System["🖥️ SYSTEM"]
        TriggerSearch --> MergeFilters[Merge tất cả filters]
        MergeFilters --> HashFilters[MD5 hash filters]
        HashFilters --> BuildCacheKey[Build cache key: query + hash]
        BuildCacheKey --> CheckCache{Có cache?}
        CheckCache -->|Hit| GetCache[Lấy cached results]
        CheckCache -->|Miss| QueryDB[Query database]
        QueryDB --> FilterByPrice{Có price?}
        FilterByPrice -->|Yes| ApplyPrice[Filter price range]
        FilterByPrice -->|No| FilterByCategory
        ApplyPrice --> FilterByCategory{Có category?}
        FilterByCategory -->|Yes| ApplyCategory[Filter categories]
        FilterByCategory -->|No| FilterByLoc
        ApplyCategory --> FilterByLoc{Có location?}
        FilterByLoc -->|Yes| ApplyLocation[Filter locations]
        FilterByLoc -->|No| SortResults
        ApplyLocation --> SortResults[Sort theo sortBy]
        SortResults --> PaginateResults[Paginate]
        PaginateResults --> SaveToCache[Lưu cache max 20 items]
        SaveToCache --> ReturnFiltered
        GetCache --> ReturnFiltered[Trả về kết quả]
        ReturnFiltered --> ShowFiltered
    end
    
    subgraph Redis["💾 REDIS"]
        GetCache -.-> FilterCache[("search:cache:query:hash<br/>Filtered results<br/>TTL: 24h")]
        SaveToCache -.-> FilterCache
    end
    
    ViewResults --> End([End])
    
    style Client fill:#e6f3ff
    style System fill:#fff5e6
    style Redis fill:#ffe6e6
```

---

## 5. Tổng Quan Search Architecture

```mermaid
flowchart LR
    subgraph Client["👤 CLIENT"]
        A[Search Input]
        B[Filter Selection]
        C[Pagination]
    end
    
    subgraph Gateway["🚪 GATEWAY"]
        API[API Gateway<br/>Public endpoints]
    end
    
    subgraph Services["🖥️ SERVICES"]
        SearchController[SearchController]
        SmartSearch[SmartSearchService]
        CacheService[SearchCacheService]
        HistoryService[SearchHistoryService]
        MainSearch[SearchService]
    end
    
    subgraph Storage["💾 STORAGE"]
        Redis[("Redis<br/>Cache & History")]
        MySQL[("MySQL<br/>Products")]
    end
    
    A --> API
    B --> API
    C --> API
    API --> SearchController
    SearchController --> MainSearch
    MainSearch --> SmartSearch
    MainSearch --> CacheService
    MainSearch --> HistoryService
    SmartSearch --> MainSearch
    CacheService <--> Redis
    HistoryService <--> Redis
    MainSearch --> MySQL
    
    style Client fill:#e6f3ff
    style Gateway fill:#f0e6ff
    style Services fill:#fff5e6
    style Storage fill:#ffe6e6
```

---

## Bảng Tổng Hợp

| Feature | Redis Key Pattern | TTL | Description |
|---------|-------------------|-----|-------------|
| **Search Cache** | `search:cache:{query}:{hash}` | 24h | Cached search results (max 20 items) |
| **Search History** | `search:history:{userId}` | 30d | User's recent searches (max 10, LIFO) |
| **Trending Keywords** | `analytics:search:{keyword}` | 7d | Search count for trending |

## Cache Strategy

| Scenario | Action | Performance |
|----------|--------|-------------|
| **First Search** | Cache Miss → Query DB → Save Cache | ~300-500ms |
| **Repeated Search** | Cache Hit → Return from Redis | < 50ms |
| **Filter Change** | New cache key (different hash) → Query DB | ~300-500ms |
| **Page 2+** | Always query DB (no cache) | ~300-500ms |
| **Product Update** | Invalidate related cache keys | Auto rebuild on next search |

## Smart Query Examples

| User Input | Parsed Result |
|------------|---------------|
| "laptop dưới 10tr" | keywords: [laptop], priceMax: 10000000 |
| "áo thun size M" | keywords: [áo, thun], sizes: [M] |
| "máy ảnh hà nội" | keywords: [máy, ảnh], locations: [Hà Nội] |
| "phone từ 5tr đến 10tr" | keywords: [phone], priceMin: 5000000, priceMax: 10000000 |
