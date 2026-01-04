# Kịch Bản Test - Chức Năng Search Superpromax (Phase 3)

## 📋 Phân Biệt Trải Nghiệm Theo Loại User

| Tiêu chí | 👤 Guest (Chưa đăng nhập) | 🔐 Client (Đã đăng nhập) |
|----------|---------------------------|-----------------------------|
| **Tìm kiếm cơ bản** | ✅ Được phép search | ✅ Được phép search |
| **Autocomplete** | ✅ Hiển thị gợi ý sản phẩm | ✅ Hiển thị sản phẩm + lịch sử tìm kiếm |
| **Lịch sử tìm kiếm** | ❌ Không lưu lịch sử | ✅ Lưu 10 queries gần nhất (30 ngày) |
| **Smart price parsing** | ✅ Hoạt động | ✅ Hoạt động |
| **Cache results** | ✅ Sử dụng cache chung | ✅ Sử dụng cache chung |
| **Filter sản phẩm** | ✅ Sử dụng được tất cả filters | ✅ Sử dụng được tất cả filters |

---

## 🧪 Kịch Bản Test

### Nhóm A: Basic Search (Guest User)

| ID | Kịch bản | Bước thực hiện | Kết quả mong đợi |
|----|----------|----------------|------------------|
| A1 | Tìm kiếm đơn giản | 1. Mở trang Home<br>2. Nhập "laptop" vào search box<br>3. Enter | Chuyển đến `/shop?q=laptop`<br>Hiển thị danh sách laptop |
| A2 | Tìm kiếm rỗng | 1. Submit form search trống<br>2. Enter | Không chuyển trang hoặc hiển thị tất cả sản phẩm |
| A3 | Tìm kiếm không có kết quả | Nhập "asdfghjkl123" | Hiển thị "Không tìm thấy sản phẩm" |
| A4 | Sắp xếp kết quả | 1. Search "laptop"<br>2. Click "Giá: Thấp đến Cao" | Sản phẩm sắp xếp theo giá tăng dần |
| A5 | Phân trang | 1. Search có >40 kết quả<br>2. Scroll xuống<br>3. Click trang 2 | Hiển thị 40 sản phẩm tiếp theo |

### Nhóm B: Smart Search (Price Parsing)

| ID | Kịch bản | Bước thực hiện | Kết quả mong đợi |
|----|----------|----------------|------------------|
| B1 | Parse "dưới Xk" | Search "laptop dưới 10tr" | Chỉ hiển thị laptop giá ≤ 10,000,000₫ |
| B2 | Parse "trên Xk" | Search "điện thoại trên 5tr" | Chỉ hiển thị phone giá ≥ 5,000,000₫ |
| B3 | Parse "từ X đến Y" | Search "áo từ 100k đến 500k" | Chỉ hiển thị áo giá 100k-500k |
| B4 | Parse format "Xtr" | Search "laptop 15tr" | Hiển thị laptop quanh mức 15 triệu |
| B5 | Parse category | Search "máy ảnh canon" | Keywords: [máy, ảnh, canon]<br>Category: Camera |

### Nhóm C: Autocomplete (Guest vs Logged-in)

| ID | Kịch bản | User Type | Bước thực hiện | Kết quả mong đợi |
|----|----------|-----------|----------------|------------------|
| C1 | Autocomplete rỗng | Guest | Focus vào search box (empty) | KHÔNG hiển thị dropdown |
| C2 | Autocomplete rỗng | Logged-in | Focus vào search box (empty) | Hiển thị lịch sử tìm kiếm (nếu có) |
| C3 | Autocomplete có query | Cả 2 | Nhập "lap" | Hiển thị gợi ý: "laptop dell", "laptop asus" |
| C4 | Click suggestion sản phẩm | Cả 2 | Click item type "product" | Chuyển đến `/product/{id}` |
| C5 | Click suggestion keyword | Cả 2 | Click item type "history/keyword" | Chuyển đến `/shop?q={query}` |

### Nhóm D: Search History (Logged-in Only)

| ID | Kịch bản | Bước thực hiện | Kết quả mong đợi |
|----|----------|----------------|------------------|
| D1 | Lưu lịch sử search | 1. Đăng nhập<br>2. Search "laptop"<br>3. Focus search box | Thấy "laptop" trong lịch sử |
| D2 | Dedup lịch sử | 1. Search "laptop"<br>2. Search "phone"<br>3. Search "laptop" lại | "laptop" chỉ xuất hiện 1 lần (ở đầu) |
| D3 | Max 10 items | Search 15 queries khác nhau | Chỉ lưu 10 queries gần nhất |
| D4 | Xóa lịch sử item | 1. Focus search box<br>2. Click nút × trên item | Item bị xóa khỏi danh sách |
| D5 | TTL 30 ngày | Check Redis sau 31 ngày | Key `search:history:{userId}` hết hạn |

### Nhóm E: Filter & Sorting

| ID | Kịch bản | Bước thực hiện | Kết quả mong đợi |
|----|----------|----------------|------------------|
| E1 | Filter price preset | 1. Search "laptop"<br>2. Click "100k-500k" | Chỉ hiển thị SP giá 100k-500k |
| E2 | Filter price custom | 1. Nhập Min: 1000000<br>2. Nhập Max: 5000000 | Chỉ hiển thị SP giá 1tr-5tr |
| E3 | Filter category | 1. Search "điện tử"<br>2. Chọn category "Laptop" | Chỉ hiển thị laptop |
| E4 | Filter location | 1. Search "laptop"<br>2. Chọn "Hà Nội" | Chỉ hiển thị SP từ Hà Nội |
| E5 | Multi-filter | 1. Set price 1tr-5tr<br>2. Chọn category<br>3. Chọn location | Kết quả thỏa TẤT CẢ filters |
| E6 | Clear single filter | Click × trên price badge | Chỉ xóa price filter, giữ filters khác |
| E7 | Clear all filters | Click "Xóa tất cả" | Xóa toàn bộ filters |
| E8 | Sort bestselling | Click "Bán chạy" | SP sắp xếp theo soldCount giảm dần |
| E9 | Sort newest | Click "Mới nhất" | SP sắp xếp theo createdAt giảm dần |

### Nhóm F: Cache Performance

| ID | Kịch bản | Bước thực hiện | Kết quả mong đợi | Performance |
|----|----------|----------------|------------------|-------------|
| F1 | First search (cache miss) | 1. Search "laptop" lần đầu<br>2. Check Redis | Key chưa tồn tại → Query DB<br>Response: `cached: false` | ~300-500ms |
| F2 | Repeated search (cache hit) | 1. Search "laptop" lần 2<br>2. Check Redis | Key đã tồn tại → Lấy từ cache<br>Response: `cached: true` | < 50ms |
| F3 | Different filter (new cache) | 1. Search "laptop"<br>2. Add filter price<br>3. Check Redis | Tạo cache key mới (hash khác) | ~300-500ms |
| F4 | Page 2 (no cache) | 1. Search "laptop"<br>2. Click page 2 | KHÔNG dùng cache, query DB | ~300-500ms |
| F5 | Cache TTL 24h | Check Redis sau 25 giờ | Key `search:cache:*` hết hạn | Auto expired |

### Nhóm G: Backend API Testing

| ID | Endpoint | Auth | Lệnh test | Expected |
|----|----------|------|-----------|----------|
| G1 | POST /search/query | ❌ | `curl -X POST http://localhost:8083/v1/stock/search/query -H "Content-Type: application/json" -d '{"query":"laptop","page":0,"size":20}'` | 200 OK, products array |
| G2 | GET /autocomplete | ❌ | `curl "http://localhost:8083/v1/stock/search/autocomplete?q=lap&limit=10"` | 200 OK, suggestions array |
| G3 | GET /history | ✅ | `curl -H "Authorization: Bearer <token>" http://localhost:8083/v1/stock/search/history` | 200 OK, history array (max 10) |
| G4 | DELETE /history | ✅ | `curl -X DELETE -H "Authorization: Bearer <token>" http://localhost:8083/v1/stock/search/history` | 200 OK, history cleared |
| G5 | DELETE /history/item | ✅ | `curl -X DELETE -H "Authorization: Bearer <token>" "http://localhost:8083/v1/stock/search/history/item?query=laptop"` | 200 OK, item removed |
| G6 | Smart parse price | ❌ | `curl -X POST ... -d '{"query":"laptop dưới 10tr"}'` | `priceMax: 10000000` in parsedCriteria |
| G7 | Pagination | ❌ | `curl -X POST ... -d '{"query":"laptop","page":1,"size":20}'` | 200 OK, page 2 results (items 21-40) |

---

## 🔍 Redis Verification

### Cache Keys

```bash
# Kiểm tra search cache
redis-cli KEYS "search:cache:*"
# Expected: search:cache:laptop:a1b2c3d4...

# Kiểm tra TTL
redis-cli TTL "search:cache:laptop:hash123"
# Expected: ~86400 (24h)

# Xem nội dung cache
redis-cli GET "search:cache:laptop:hash123"
# Expected: JSON array of products (max 20)
```

### History Keys

```bash
# Kiểm tra search history
redis-cli KEYS "search:history:*"
# Expected: search:history:user123

# Xem lịch sử
redis-cli LRANGE "search:history:user123" 0 -1
# Expected: ["laptop", "phone", "áo thun", ...]

# Kiểm tra max 10 items
redis-cli LLEN "search:history:user123"
# Expected: <= 10

# Kiểm tra TTL
redis-cli TTL "search:history:user123"
# Expected: ~2592000 (30d)
```

### Trending Keywords

```bash
# Kiểm tra trending
redis-cli KEYS "analytics:search:*"
# Expected: analytics:search:laptop, analytics:search:phone...

# Xem search count
redis-cli GET "analytics:search:laptop"
# Expected: số lần search (integer)
```

---

## ✅ Checklist Hoàn Thành

### Frontend Testing
- [ ] Test nhóm A: Basic Search (5 kịch bản)
- [ ] Test nhóm B: Smart Search (5 kịch bản)
- [ ] Test nhóm C: Autocomplete (5 kịch bản)
- [ ] Test nhóm D: Search History (5 kịch bản)
- [ ] Test nhóm E: Filter & Sorting (9 kịch bản)
- [ ] Test nhóm F: Cache Performance (5 kịch bản)

### Backend API Testing
- [ ] Test nhóm G: API Endpoints (7 kịch bản)
- [ ] Verify Redis cache keys
- [ ] Verify Redis history keys
- [ ] Verify trending keywords

### Documentation
- [ ] Screenshot/Video demo các tính năng
- [ ] Record performance metrics (cache hit/miss)
- [ ] Document edge cases phát hiện
- [ ] Update walkthrough.md nếu cần

---

## 🎯 Critical Test Cases (Priority)

| Priority | ID | Description | Why Critical |
|----------|---- |-------------|--------------|
| 🔴 P0 | A1 | Basic search works | Core functionality |
| 🔴 P0 | B1 | Smart price parsing | Key differentiator |
| 🔴 P0 | F2 | Cache hit performance | Performance critical |
| 🟡 P1 | C3 | Autocomplete works | UX enhancement |
| 🟡 P1 | D1 | History saves correctly | User feature |
| 🟢 P2 | E5 | Multi-filter works | Advanced feature |

---

## 📊 Performance Benchmarks

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Cache Hit Response | < 50ms | ___ ms | ⬜ |
| Cache Miss Response | < 500ms | ___ ms | ⬜ |
| Autocomplete Response | < 200ms | ___ ms | ⬜ |
| Filter Change | < 500ms | ___ ms | ⬜ |
| Page Load (40 items) | < 1s | ___ ms | ⬜ |

---

## 🐛 Bug Report Template

```markdown
**Bug ID**: [e.g., SEARCH-001]
**Kịch bản**: [e.g., A1]
**Mô tả**: [Chi tiết lỗi]
**Steps to reproduce**:
1. ...
2. ...

**Expected**: [Kết quả mong đợi]
**Actual**: [Kết quả thực tế]
**Screenshot**: [Nếu có]
**Priority**: P0/P1/P2
```
