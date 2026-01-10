-- LUA SCRIPT: HỦY GIỮ HÀNG & HOÀN KHO (CANCEL & ROLLBACK)
-- Mục đích: Trả lại số lượng hàng đã giữ vào kho tổng khi hủy đơn
-- ================================================================

-- I. NHẬN THAM SỐ ĐẦU VÀO
-- KEYS[1]: Key chứa số lượng tồn kho (VD: stock:ao_thun:size_L)
-- KEYS[2]: Key phiếu giữ hàng cần hủy (VD: reserve:order_123:ao_thun:size_L)
local stockKey = KEYS[1]
local reserveKey = KEYS[2]

-- II. KIỂM TRA PHIẾU GIỮ HÀNG

-- Bước 1: Lấy thông tin số lượng đang được giữ trong Redis
local reserved = redis.call('GET', reserveKey)

-- Kiểm tra: Nếu không tìm thấy key giữ hàng (nil)
-- Trường hợp này xảy ra khi:
-- 1. Key đã hết hạn (TTL) và tự bị xóa trước đó.
-- 2. Đơn hàng này đã được xử lý (confirm) hoặc đã hủy rồi.
if not reserved then
    return 0  -- Trả về 0: Không có gì để hoàn tác
end

-- Bước 2: Chuyển đổi dữ liệu sang kiểu số để tính toán
local reservedNum = tonumber(reserved)

-- Kiểm tra tính hợp lệ của dữ liệu (phòng ngừa lỗi)
if not reservedNum then
    return 0  -- Dữ liệu lỗi, không xử lý
end

-- III. THỰC THI HOÀN KHO (ATOMIC)

-- Bước 3: Cộng lại tồn kho và Xóa phiếu giữ hàng
-- INCRBY: Cộng số lượng 'reservedNum' trả về lại cho 'stockKey'
redis.call('INCRBY', stockKey, reservedNum)

-- DEL: Xóa key giữ hàng để đảm bảo không hoàn tác 2 lần (Idempotency)
redis.call('DEL', reserveKey)

-- Trả về số lượng thực tế đã được hoàn lại vào kho
return reservedNum