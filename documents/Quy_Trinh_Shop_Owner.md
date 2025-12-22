# Quy trình Chức năng Kênh Người Bán (Shop Owner)

Tài liệu này mô tả chi tiết các luồng hoạt động cho tất cả các tính năng có trong Kênh Người Bán (`/shop-owner`).

## 1. Bảng Điều Khiển (Dashboard) (`/shop-owner`)
**Mục tiêu**: Xem tổng quan nhanh về hiệu suất của shop và các tác vụ cần xử lý.
- **Giao diện**: `ShopOwnerDashboard.jsx`
- **Nguồn dữ liệu**: `order-service` (Thống kê).
- **Quy trình**:
  1.  **Tải trang**: Hệ thống lấy số liệu thống kê tổng hợp:
      -   Đơn chờ lấy hàng.
      -   Đơn đã xử lý.
      -   Đơn đã hủy.
      -   Doanh thu (Hôm nay).
      -   Tổng đơn hàng (Hôm nay).
  2.  **Hiển thị**: Hiển thị các thẻ tóm tắt và danh sách đơn hàng gần đây (nếu có).

## 2. Quản lý Sản phẩm

### 2.1 Thêm Sản phẩm (`/shop-owner/products/add`)
**Mục tiêu**: Đăng bán sản phẩm mới.
- **Giao diện**: `AddProductPage.jsx`
- **API Backend**: `POST /v1/stock/product` (`stock-service`).
- **Quy trình**:
  1.  **Nhập thông tin**: Chủ shop nhập Tên sản phẩm, Mô tả, Danh mục, Thương hiệu.
  2.  **Phân loại**: Thêm các tùy chọn (Kích thước, Màu sắc) và tạo mã SKU.
  3.  **Giá & Kho**: Thiết lập giá bán và số lượng tồn kho ban đầu cho từng SKU.
  4.  **Hình ảnh**: Tải lên ảnh sản phẩm (Ảnh chính + Ảnh phân loại).
  5.  **Gửi**: Gửi yêu cầu đến `stock-service`.
  6.  **Kết quả**: Sản phẩm được tạo với trạng thái `ACTIVE` (hoặc `PENDING` nếu có quy trình duyệt).

### 2.2 Tất cả Sản phẩm (`/shop-owner/products`)
**Mục tiêu**: Xem và quản lý kho hàng hiện có.
- **Giao diện**: `AllProductsPage.jsx`
- **API Backend**: `GET /v1/stock/product/shop/{shopId}` (`stock-service`).
- **Quy trình**:
  1.  **Danh sách**: Hiển thị bảng sản phẩm (Ảnh, Tên, Khoảng giá, Tồn kho, Trạng thái).
  2.  **Hành động**:
      -   **Sửa**: Chuyển đến trang Chỉnh sửa.
      -   **Xóa/Ẩn**: Xóa mềm hoặc chuyển trạng thái `ACTIVE`/`INACTIVE`.
  3.  **Tìm kiếm/Lọc**: Lọc theo tên hoặc danh mục.

### 2.3 Quản lý Đánh giá (`/shop-owner/reviews`)
**Mục tiêu**: Quản lý phản hồi từ khách hàng.
- **Giao diện**: `ReviewManagementPage.jsx`
- **API Backend**: `GET /v1/stock/review/shop/{shopId}` (`stock-service`).
- **Quy trình**:
  1.  **Xem**: Danh sách đánh giá gồm Số sao, Bình luận, Thông tin người mua và Hình ảnh.
  2.  **Phản hồi**: Chủ shop nhập nội dung trả lời.
  3.  **Gửi phản hồi**: Hệ thống lưu câu trả lời của shop vào đánh giá đó.

## 3. Quản lý Đơn hàng

### 3.1 Giao hàng Hàng loạt (`/shop-owner/orders/bulk-shipping`)
**Mục tiêu**: Xử lý nhiều đơn hàng cùng lúc để tiết kiệm thời gian.
- **Giao diện**: `BulkShippingPage.jsx`
- **API Backend**: `order-service`.
- **Quy trình**:
  1.  **Lấy đơn chờ**: Danh sách các đơn có trạng thái `PENDING` hoặc `PROCESSING`.
  2.  **Chọn**: Chủ shop tích chọn nhiều đơn hàng.
  3.  **In phiếu**: Tạo và in phiếu giao hàng (tích hợp GHN/GHTK).
  4.  **Xác nhận giao**: Cập nhật trạng thái sang `SHIPPED` hàng loạt.

### 3.2 Trả hàng & Hoàn tiền (`/shop-owner/orders/returns`)
**Mục tiêu**: Xử lý yêu cầu trả hàng từ khách.
- **Giao diện**: `ReturnOrderPage.jsx`
- **API Backend**: `order-service`.
- **Quy trình**:
  1.  **Xem yêu cầu**: Danh sách đơn hàng có trạng thái Yêu cầu Trả hàng.
  2.  **Quyết định**:
      -   **Đồng ý**: Chấp nhận trả hàng. Kích hoạt logic hoàn tiền (Cập nhật ví người dùng).
      -   **Từ chối**: Hủy yêu cầu trả hàng kèm lý do.
  3.  **Xuất dữ liệu**: Nút xuất lịch sử trả hàng ra file Excel/CSV.

## 4. Marketing (`/shop-owner/vouchers`)
**Mục tiêu**: Tạo mã giảm giá để thúc đẩy doanh số.
- **Giao diện**: `VoucherManagementPage.jsx`
- **API Backend**: `user-service`.
- **Điều kiện**: Yêu cầu Shop đã đăng ký gói Hội viên (kiểm tra qua logic `SubscriptionPage`).
- **Quy trình**:
  1.  **Kiểm tra Gói**: Nếu chưa đăng ký, hiển thị màn hình khóa tính năng.
  2.  **Tạo Voucher**:
      -   Nhập: Mã (VD: `SALE50`), Loại (`PHẦN TRĂM`/`CỐ ĐỊNH`), Giá trị, Đơn tối thiểu, Thời gian, Số lượng.
  3.  **Quản lý**: Xem voucher đang chạy/hết hạn, Sửa hoặc Xóa.
  4.  **Sử dụng**: Khách hàng áp dụng mã tại bước thanh toán; `order-service` sẽ xác thực mã.

## 5. Tài chính

### 5.1 Ví Shop (`/shop-owner/wallet`)
**Mục tiêu**: Theo dõi thu nhập và rút tiền.
- **Giao diện**: `WalletPage.jsx`
- **API Backend**: `order-service` (Sổ cái Shop - Shop Ledger).
- **Quy trình**:
  1.  **Số dư**: Hiển thị `Số dư khả dụng` và `Số dư đang chờ`.
  2.  **Giao dịch**: Lịch sử từ bảng `shop_ledger_entry`. Gồm:
      -   `EARNING`: Doanh thu từ đơn hàng.
      -   `FEE_DEDUCTION`: Phí hoa hồng sàn.
      -   `SUBSCRIPTION_PAYMENT`: Phí đăng ký gói hội viên.
      -   `PAYOUT`: Rút tiền về ngân hàng.
  3.  **Rút tiền**: Tạo yêu cầu rút tiền (Chuyển khoản/Momo).

### 5.2 Gói Hội viên (`/shop-owner/subscription`)
**Mục tiêu**: Nâng cấp hạng shop để giảm phí và mở khóa tính năng.
- **Giao diện**: `SubscriptionPage.jsx`
- **API Backend**: `user-service` (Thanh toán ủy quyền qua `order-service`).
- **Quy trình**:
  1.  **Xem gói**: `FREESHIP_XTRA`, `VOUCHER_XTRA`, `BOTH` (Cả hai).
  2.  **Đăng ký**:
      -   Người dùng xác nhận.
      -   Backend kiểm tra số dư ví shop (`shop_ledger`).
      -   Trừ phí -> Kích hoạt gói.
  3.  **Trạng thái**: Hiển thị gói hiện tại, ngày hết hạn.
  4.  **Hủy gói**: Hủy kích hoạt gói ngay lập tức.

## 6. Phân tích (`/shop-owner/analytics`)
**Mục tiêu**: Xem báo cáo chi tiết về kinh doanh.
- **Giao diện**: `AnalyticsPage.jsx`
- **API Backend**: `order-service` (Endpoints thống kê).
- **Quy trình**:
  1.  **Biểu đồ**: Doanh thu theo thời gian, Số lượng đơn, Top sản phẩm bán chạy.
  2.  **Bộ lọc**: Xem theo Tuần/Tháng/Năm.

## 7. Giao tiếp
- **Chat (`/shop-owner/chat`)**: Nhắn tin thời gian thực với khách hàng (WebSocket/Socket.io).
  -   **Quy trình**: Chọn hội thoại -> Gửi/Nhận tin nhắn -> Gửi ảnh.
- **Thông báo (`/shop-owner/notifications`)**: Cảnh báo hệ thống (Đơn mới, Yêu cầu trả hàng, Sắp hết hàng).

## 8. Cài đặt (`/shop-owner/settings`)
**Mục tiêu**: Cấu hình hồ sơ shop.
- **Giao diện**: `SettingsPage.jsx`
- **API Backend**: `user-service`.
- **Quy trình**:
  1.  **Hồ sơ**: Sửa Tên shop, Ảnh đại diện, Mô tả.
  2.  **Địa chỉ**: Cập nhật địa chỉ lấy hàng (Quan trọng để tính phí ship).
  3.  **Ngân hàng**: Cập nhật thông tin tài khoản nhận tiền.
