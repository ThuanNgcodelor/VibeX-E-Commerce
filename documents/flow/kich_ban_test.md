# Kịch Bản Test (Test Cases) - Checkout Flow

Tài liệu này định nghĩa các kịch bản test chi tiết (Input -> Expected Output) cho 8 luồng checkout đã phân tích.

## 1. Test Cases: Thanh Toán COD

### TC_01: COD - Sản phẩm thường - Active Redis
*   **Input:** User chọn 1 sp thường, qty=2, chọn "Thanh toán khi nhận hàng".
*   **Pre-condition:** Redis `stock:{productId}:{sizeId}` = 10.
*   **Steps:** Bấm "Đặt hàng".
*   **Expected Output:**
    1.  API trả về 201 Created (Status: PENDING).
    2.  Redis stock giảm còn 8.
    3.  Kafka `order-topic` nhận message.
    4.  Sau 1-2s: DB `orders` có đơn mới, DB `product_size` stock = 8.
    5.  Redis key `reserve:...` bị xóa.

### TC_02: COD - Sản phẩm thường - Cache Miss
*   **Input:** User chọn 1 sp thường, qty=2.
*   **Pre-condition:** Redis EMPTY (xóa key stock). DB `product_size` stock = 100.
*   **Steps:** Bấm "Đặt hàng".
*   **Expected Output:**
    1.  API trả về 201 Created.
    2.  Redis key `stock:{productId}:{sizeId}` được tạo mới với value = 98 (Warm-up + Decrease).
    3.  DB `product_size` stock = 98.

### TC_03: COD - Flash Sale - Cache Miss + High Load
*   **Input:** User chọn sp Flash Sale, qty=1.
*   **Pre-condition:** Redis EMPTY. DB `flash_sale_sessions` stock = 50.
*   **Scenario:** Giả lập 10 request cùng lúc (Apache Benchmark/JMeter).
*   **Expected Output:**
    1.  Chỉ 1 request query DB (Check log `SELECT` stock).
    2.  Redis `flashsale:stock:...` được tạo = 40 (50 - 10).
    3.  10 đơn hàng được tạo thành công.

---

## 2. Test Cases: Thanh Toán Ví (Wallet)

### TC_04: Wallet - Đủ tiền - Success
*   **Input:** User ví 500k, đơn hàng 100k. Chọn "Ví".
*   **Steps:** Bấm "Thanh toán".
*   **Expected Output:**
    1.  API trả về 201 Created (Status: CONFIRMED/PAID - tùy config).
    2.  Ví user còn 400k (DB `wallets`).
    3.  Stock giảm trong Redis & DB.

### TC_05: Wallet - Không đủ tiền - Fail
*   **Input:** User ví 50k, đơn hàng 100k.
*   **Steps:** Bấm "Thanh toán".
*   **Expected Output:**
    1.  API trả về 400 Bad Request ("Insufficient wallet balance").
    2.  Stock Redis được hoàn trả (Rollback).
    3.  Không có đơn hàng nào được tạo.

---

## 3. Test Cases: Thanh Toán Online (VNPay/Momo)

### TC_06: VNPay - Thanh toán thành công
*   **Input:** Chọn VNPay -> Redirect -> Nhập thẻ demo thành công.
*   **Steps:** Hoàn tất thanh toán.
*   **Expected Output:**
    1.  User nhận "Thanh toán thành công" trên UI.
    2.  DB `payments`: Status = PAID.
    3.  DB `orders`: Đơn hàng được tạo (Status = PENDING).
    4.  Stock bị trừ (Check DB).

### TC_07: VNPay - Hết hàng sau khi thanh toán (Edge Case)
*   **Input:**
    *   Sản phẩm A còn 1 cái.
    *   User 1: Tạo link VNPay (chưa thanh toán).
    *   User 2: Mua COD sản phẩm A -> Stock = 0.
    *   User 1: Giờ mới thanh toán VNPay.
*   **Expected Output:**
    1.  VNPay trừ tiền User 1 thành công.
    2.  Hệ thống nhận Callback -> Check stock = 0.
    3.  **Hệ thống thực hiện Hoàn tiền (Refund) vào Ví User 1.**
    4.  Order không được tạo (hoặc tạo với status CANCELLED/REFUNDED).

---

## 4. Test Cases: Flash Sale Limits

### TC_08: Flash Sale - Vượt quá Limit
*   **Input:** Flash Sale limit 2 cái/người. User mua lần 1 (2 cái). Quay lại mua lần 2 (1 cái).
*   **Expected Output:**
    1.  Lần 1: Thành công.
    2.  Lần 2: Failed ("Limit exceeded").
    3.  Check Redis `flashsale:bought:{userId}` = 2.

