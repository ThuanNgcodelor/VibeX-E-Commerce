-- ================================================================
-- LUA SCRIPT: GIỮ HÀNG (RESERVE STOCK)
-- Mục đích: Kiểm tra và trừ tồn kho một cách nguyên tử (Atomic)
-- ================================================================

-- I. NHẬN THAM SỐ ĐẦU VÀO
-- KEYS[1]: Key chứa số lượng tồn kho (VD: stock:ao_thun:size_L)
-- KEYS[2]: Key phiếu giữ hàng tạm thời (VD: reserve:order_123:ao_thun:size_L)
local stockKey = KEYS[1]
local reserveKey = KEYS[2]

-- ARGV[1]: Số lượng khách muốn mua (cần chuyển sang kiểu số)
-- ARGV[2]: Thời gian giữ hàng (TTL) tính bằng giây (VD: 900s = 15 phút)
local quantity = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

-- II. KIỂM TRA DỮ LIỆU (VALIDATION)

-- Bước 1: Lấy thông tin tồn kho hiện tại từ Redis
local stock = redis.call('GET', stockKey)

-- Kiểm tra: Nếu key không tồn tại (nil) hoặc rỗng (false)
-- Trường hợp này thường là Cache Miss (dữ liệu chưa được load từ DB lên Redis)
if not stock then
    return -1  -- Mã lỗi: Key kho không tìm thấy
end

-- Bước 2: Chuyển đổi dữ liệu kho sang kiểu số
local stockNum = tonumber(stock)

-- Kiểm tra: Nếu dữ liệu trong kho không phải là số hợp lệ (tránh lỗi crash)
if not stockNum then
    return -1  -- Mã lỗi: Dữ liệu kho bị lỗi format
end

-- III. XỬ LÝ LOGIC NGHIỆP VỤ

-- Bước 3: Kiểm tra xem có đủ hàng để bán không
if stockNum < quantity then
    return 0  -- Kết quả: Không đủ hàng (Out of stock)
end

-- IV. THỰC THI GIAO DỊCH (ATOMIC)

-- Bước 4: Trừ tồn kho và Tạo phiếu giữ hàng
-- Lưu ý: Hai lệnh này chạy liên tiếp, không ai có thể chen ngang
redis.call('DECRBY', stockKey, quantity)       -- Trừ trực tiếp số lượng trong kho
redis.call('SETEX', reserveKey, ttl, quantity) -- Tạo key giữ hàng, tự xóa sau 'ttl' giây

-- Trả về 1 báo hiệu giữ hàng thành công
return 1