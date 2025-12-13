## VNPay (Merchant of Record) – Payout & Ledger Design

### Bức tranh tổng quan
- VNPay đang dùng **một tài khoản platform** (TmnCode/HashSecret chung). Tất cả giao dịch VNPAY tiền sẽ về ví/ tài khoản platform.
- Nhiệm vụ: hạch toán nội bộ và chi trả lại cho từng shop owner.

### Luồng dòng tiền
1) User checkout VNPay → tiền về tài khoản platform (merchant of record).
2) `payment-service` nhận callback, publish `PaymentEvent` (status PAID/FAILED).
3) `order-service` consume event, tạo order PAID và gửi `ShopEarningEvent` (đề xuất) hoặc gọi ledger service.
4) Ledger/Payout service cộng số dư shop (sau khi trừ phí/commission).
5) Định kỳ payout: platform chuyển khoản cho từng shop owner theo số dư khả dụng.

### Thiết kế thành phần (đề xuất)
1) **payment-service**
   - Giữ nguyên: nhận VNPay callback → publish `PaymentEvent`.
   - Bổ sung: emit thêm `ShopEarningEvent` (khi PaymentEvent=PAID) gồm: `orderId`, `shopOwnerId`, `grossAmount`, `commissionRate`, `netAmount`, `txnRef`.
2) **order-service**
   - Khi tạo order từ PaymentEvent, tính mapping sản phẩm → shopOwner (nếu một order nhiều shop, nên tách đơn theo shop từ trước).
   - Publish `ShopEarningEvent` cho từng shop (nếu chưa tách).
3) **ledger/payout-service** (mới, hoặc module trong order-service tạm thời)
   - Bảng gợi ý:
     - `shop_ledger(id, shop_owner_id, balance_available, balance_pending, updated_at)`
     - `shop_ledger_entry(id, shop_owner_id, order_id, amount_gross, commission, amount_net, type: EARNING|PAYOUT|ADJUST, ref_txn, created_at)`
     - `payout_batch(id, shop_owner_id, amount, status, bank_info, created_at, processed_at)`
   - Logic:
     - Nhận `ShopEarningEvent` → tạo entry `EARNING`, cộng `balance_available`.
     - Khi tạo payout → tạo entry `PAYOUT`, trừ balance và ghi batch.
4) **notification-service**
   - Thông báo shop khi có earnings và khi payout thành công.

### Tách đơn theo shop (khuyến nghị)
- Nếu giỏ chứa sản phẩm nhiều shop: split thành nhiều order theo `shopOwnerId`.
- Mỗi order → một payment (hoặc gộp payment nhưng cần phân bổ net per shop sau đó; split order đơn giản hơn).
- Tách sớm giúp:
  - Rõ ràng revenue per shop.
  - Dễ rollback/tính phí ship riêng.

### Phí & commission
- Commission per shop hoặc theo danh mục: lưu `commission_rate` hoặc số tuyệt đối.
- `netAmount = grossAmount - commission`.
- Lưu cả gross, commission, net vào ledger_entry để đối soát.

### Đối soát & bảo vệ
- Idempotency: dùng `txnRef` + `orderId` làm key chống ghi trùng.
- Trạng thái payout: `PENDING` → `PROCESSING` → `DONE` / `FAILED`.
- Retry có kiểm soát, log đầy đủ.
- Báo cáo: tổng thu VNPay (platform), tổng commission, tổng phải trả shop, tồn quỹ.

### Việc cần làm tối thiểu
1) Thêm service/module ledger:
   - API/consumer nhận `ShopEarningEvent`.
   - Bảng `shop_ledger`, `shop_ledger_entry`.
2) order-service:
   - Split order theo shop (nếu đa shop).
   - Emit `ShopEarningEvent` sau khi order PAID.
3) payout job/API:
   - Admin trigger hoặc batch theo lịch, sinh payout entry cho shop.
4) notification:
   - Gửi thông báo earnings/payout cho shop.

### Lộ trình triển khai nhanh (incremental)
Phase 1: Không split giỏ (giả định 1 shop) → emit `ShopEarningEvent` với net=gross-commission, cập nhật ledger.
Phase 2: Split giỏ theo shop; mỗi shop một order/payment hoặc một order đa shop nhưng phân bổ net per shop.
Phase 3: Payout batch + UI báo cáo cho admin/shop.

### Lưu ý bảo mật & vận hành
- Bảo vệ các endpoint internal bằng header `X-Internal-Call` hoặc auth service-to-service.
- Log và audit trail cho tất cả ledger entries.
- Đảm bảo timezone, currency (VND) nhất quán.

