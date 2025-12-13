# DOCS – Chức năng hiện có (Shopee Clone)

Tài liệu tóm tắt các chức năng đã triển khai (bỏ qua hạ tầng config/eureka/gateway). Nội dung bám theo hiện trạng code base và các service chính.

## Auth Service
- Đăng ký/đăng nhập email & password, phát hành JWT.
- Google OAuth2 login callback.
- OTP quên mật khẩu: gửi, xác thực, đặt lại mật khẩu.

## User Service
- Hồ sơ người dùng: xem/cập nhật thông tin, đổi mật khẩu, upload avatar (qua file-storage).
- Sổ địa chỉ: CRUD địa chỉ, đánh dấu mặc định, lưu lat/long.
- Role request: user gửi yêu cầu lên shop owner, admin duyệt/từ chối.
- Shop owner profile: lưu tên shop, logo, địa chỉ, trạng thái verified, counters.
- Người dùng & shop owner caching cho hiển thị tên trong chat.

## File Storage Service
- Upload/download/xóa file (avatar, ảnh sản phẩm, logo shop).
- Trả về `imageId` để các service khác tham chiếu.

## Stock Service
- Danh mục sản phẩm: CRUD category.
- Sản phẩm: CRUD, gán category, giá/giá gốc/discount, status, ảnh (imageId), owner (shop owner).
- Size/variant: thêm/sửa/xóa size, tồn kho và price modifier.
- Giỏ hàng: add/update/remove item, tính totalAmount, Redis cache.
- Lấy sản phẩm theo shop owner.

## Order Service
- Checkout từ giỏ: tạo order + order items, validate tồn kho.
- Luồng Kafka: publish `order-topic` (stock giảm tồn kho, dọn cart), publish `notification-topic` (thông báo order mới).
- Trạng thái đơn: PENDING → PROCESSING → SHIPPED → DELIVERED / CANCELLED.
- Tra cứu đơn theo user; tra cứu đơn theo shop owner.

## Notification Service
- Lưu notification, đánh dấu đã đọc.
- WebSocket (STOMP + SockJS): push realtime qua `/topic/user/{userId}/conversations` và `/topic/conversation/{conversationId}/messages` cho chat; `/ws/notifications` cho thông báo.
- Sửa destination cho chat: `/topic/conversation/{conversationId}/messages`.

## Chat (Mới)
- Mô hình conversation: UNIQUE (client_id, shop_owner_id, product_id); message có deliveryStatus, read.
- API: get/create conversation, list conversations, load messages, send message, mark as read.
- Realtime: WebSocket per conversation, realtime cho cả client và shop-owner.
- Frontend:
  - Client: `ChatBotWidget.jsx` (floating Shopee-like chat), mở từ FAB hoặc sự kiện `open-chat-with-product` (CommentsBox/ShopInfoBar). Hiển thị tên shop, product card (ảnh, tên, giá), realtime, responsive, minimize/close.
  - Shop owner: `pages/shop-owner/ChatPage.jsx` full page, hiển thị username khách hàng, product card, realtime, mark-as-read delay fix.
  - Caching tên shop/client, lấy ảnh sản phẩm qua file-storage, auto scroll, unread badge, filter/search.

## My-App (Frontend Vite)
- Vai trò: client, shop owner, admin (đã có guarded routes).
- Catalogue: xem danh sách, chi tiết sản phẩm, filter/search, show shop info.
- Giỏ hàng & Checkout UI: thêm/xóa/sửa, đặt hàng.
- User profile & address book UI; upload avatar.
- Role request UI; shop owner settings; quản lý sản phẩm (CRUD, size/stock).
- Shop owner dashboard: xem đơn hàng của shop, analytics/wip, return/bulk shipping UI (mock), notification page realtime.
- Admin pages: quản lý user, category, role requests (đã có).
- Notification badge/toast qua WebSocket.
- Chat như mô tả ở mục Chat.

## VR-BalloonPop-Game (tham khảo)
- Tài liệu hướng dẫn riêng; không ảnh hưởng luồng Shopee clone.

## Chức năng cần làm (để tiệm cận Shopee)
- Thanh toán & vận chuyển: tích hợp VNPay/MoMo, lưu giao dịch, webhook; tính phí ship GHN/GHTK, in vận đơn, tracking giao hàng.
- Khuyến mãi & chiến dịch: mã giảm giá (đơn/shop/sản phẩm), flash sale, combo; miễn phí vận chuyển theo ngưỡng, voucher sưu tầm.
- Đánh giá & phản hồi: review/rating sản phẩm kèm ảnh, báo cáo review; chat sau mua cho bảo hành/đổi trả.
- Trả hàng/hoàn tiền: quy trình request → approve/reject → refund; đính kèm bằng chứng, tính phí hoàn.
- Tìm kiếm & đề xuất: Elasticsearch, faceted filters, sort bán chạy/đánh giá/giá; gợi ý sản phẩm liên quan/cá nhân hóa.
- Phân tích & báo cáo: dashboard shop (doanh thu, top sản phẩm, tồn kho thấp); dashboard admin (GMV, user mới, đơn theo trạng thái, lỗi thanh toán).
- Quản lý tồn kho nâng cao: cảnh báo tồn thấp, auto ẩn hết hàng; import/export CSV, lịch sử điều chỉnh.
- Hỗ trợ & CSKH: ticket hỗ trợ, FAQ, quick replies trong chat, SLA phản hồi, gắn nhãn hội thoại.
- Bảo mật & an toàn: 2FA cho admin/shop owner, rate limiting, signed URL cho file; chống spam chat/review, captcha.
- Hiệu năng & tin cậy: cache catalogue, CDN static; quan sát (Prometheus/Grafana, log tập trung, tracing); retry/circuit breaker cho Feign.


