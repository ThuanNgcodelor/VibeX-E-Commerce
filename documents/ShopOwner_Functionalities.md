# Tài Liệu Chức Năng Shop Owner

Tài liệu này tổng hợp các chức năng chính của Shop Owner, bao gồm các thư viện sử dụng, sự kiện (Events) được gọi, và cơ chế nghiệp vụ chi tiết.

## 1. Tổng Quan Kiến Trúc
Hệ thống sử dụng kiến trúc Microservices với các service chính liên quan đến Shop Owner:
- **User Service**: Quản lý thông tin Shop, trang trí (Decoration), ví (Wallet).
- **Stock Service**: Quản lý sản phẩm, tồn kho, Flash Sale.
- **Order Service**: Quản lý đơn hàng, vận chuyển (GHN), doanh thu/sổ cái (Ledger).

Data flow chủ yếu thông qua Rest API (Feign Client) cho các tác vụ đồng bộ và Kafka cho các tác vụ bất đồng bộ (đặt hàng, thông báo).

## 2. Chi Tiết Chức Năng

### 2.1. Quản Lý Hồ Sơ Shop (Shop Profile)
*   **Mô tả**: Shop Owner cập nhật thông tin cửa hàng, avatar, địa chỉ (liên kết với GHN).
*   **Service**: `user-service`
*   **Controller**: `ShopOwnerController`, `AddressController`
*   **Thư viện sử dụng**:
    -   `ModelMapper`: Chuyển đổi Entity <-> DTO.
    -   `JwtUtil`: Xác thực Shop Owner từ Token.
    -   `MultipartFile`: Upload ảnh Avatar.
*   **Cơ chế nghiệp vụ**:
    -   Shop Owner gửi request `UpdateShopOwnerRequest` kèm file ảnh.
    -   Ảnh được upload lên Cloudinary (qua `FileStorageClient`).
    -   Thông tin địa chỉ (Huyện/Xã) phải khớp với ID của Giao Hàng Nhanh (GHN) để tính phí ship sau này.

### 2.2. Quản Lý Sản Phẩm & Kho (Product & Inventory)
*   **Mô tả**: Tạo, sửa, xóa sản phẩm, quản lý tồn kho, Flash Sale.
*   **Service**: `stock-service`
*   **Controller**: `ProductController`, `InventoryController`, `FlashSaleController`
*   **Thư viện & Event**:
    -   `ObjectMapper`: Xử lý JSON Attributes của sản phẩm (màu sắc, kích thước).
    -   **Event**: Không dùng Kafka trực tiếp ở level Controller, nhưng `ProductService` quản lý transactional cho việc trừ kho (`decreaseStock`).
*   **Cơ chế nghiệp vụ**:
    -   **Tạo sản phẩm**: Upload nhiều ảnh, lưu thông tin Variants (Size/Color) dưới dạng JSON.
    -   **Tồn kho**: Khi có đơn hàng, `stock-service` nhận request trừ kho. Nếu là Flash Sale, check giới hạn số lượng bán ra (`FlashSaleProduct`).
    -   **Thống kê**: API `getShopStats` đếm số lượng sản phẩm theo trạng thái (BANNED, OUT_OF_STOCK).

### 2.3. Quản Lý Đơn Hàng (Order Management)
*   **Mô tả**: Xem danh sách đơn, xác nhận, chuẩn bị hàng, giao hàng.
*   **Service**: `order-service`
*   **Controller**: `OrderController`
*   **Thư viện & External APIs**:
    -   **Kafka**: Xử lý việc tạo đơn hàng bất đồng bộ (tránh overload DB).
    -   **GHN ApiClient**: Tích hợp Giao Hàng Nhanh để tính phí ship và tạo vận đơn.
    -   **SseEmitter**: (Có thể dùng) để đẩy update trạng thái realtime.
*   **Events (Kafka Topics)**:
    -   `order-topic`: Nhận request tạo đơn hàng (`CheckOutKafkaRequest`).
    -   `notification-topic`: Gửi thông báo cho User và Shop Owner khi có đơn mới (`SendNotificationRequest`).
    -   `update-status-order-topic`: Bulk update trạng thái đơn hàng.
*   **Cơ chế nghiệp vụ (Order Flow)**:
    1.  **Đặt hàng**:
        -   Checkout (Cart) -> Validate Stock -> Gửi message vào `order-topic`.
        -   Consumer đọc message -> Lưu Order xuống DB (Status: PENDING) -> Trừ kho (Call `stock-service`).
    2.  **Xác nhận & Giao hàng**:
        -   Shop Owner xác nhận đơn hàng -> Hệ thống gọi API GHN tạo đơn vận chuyển (`createShippingOrder`).
        -   Cập nhật mã vận đơn GHN vào hệ thống.
    3.  **Hoàn thành**:
        -   Khi status = `CONFIRMED` -> Gọi `ShopLedgerService` để cộng tiền vào ví Shop.

### 2.4. Trang Trí Shop (Shop Decoration)
*   **Mô tả**: Kéo thả widget để thiết kế giao diện trang chủ Shop.
*   **Service**: `user-service`
*   **Controller**: `ShopDecorationController`
*   **Thư viện Frontend (Libraries)**:
    -   **Kéo & Thả (Editor)**:
        -   `@dnd-kit/core`: Core drag & drop logic.
        -   `@dnd-kit/sortable`: Sorting strategy cho danh sách widget.
        -   `@dnd-kit/utilities`: Utilities hỗ trợ CSS transform.
    -   **Giao diện & Widget (UI)**:
        -   `react-bootstrap`: UI Components blocks (Card, Modal, Tabs) để tạo form config cho widget.
        -   `swiper`: Tạo Slider/Carousel cho **Banner Widget** (hiển thị trang chủ).
        -   `sweetalert2`: Confirm dialog.
        -   `react-hot-toast`: Notifications.
*   **Cấu Trúc Sự Kiện (Events Flow)**:
    1.  **Add Widget (`addWidget`)**:
        -   Tạo object mới với unique `id` (`Date.now()`).
        -   Thêm vào state `decorationConfig`.
    2.  **Drag & Drop (`handleDragEnd`)**:
        -   Sự kiện `onDragEnd` từ `DndContext` được gọi khi thả chuột.
        -   Sử dụng hàm `arrayMove` (từ dnd-kit) để hoán đổi vị trí oldIndex -> newIndex trong mảng state.
    3.  **Update Config (`updateWidget`)**:
        -   Các widget con (Banner, ProductList) trigger `onChange`.
        -   Parent component update state dựa trên logic bất biến (immutability): `map(item => item.id === id ? newData : item)`.
    4.  **Lưu Cấu Hình (`handleSave`)**:
        -   Sự kiện Click nút "Lưu thay đổi".
        -   Frontend gọi API `PUT /v1/user/shops/decoration/me` với Body là chuỗi JSON của toàn bộ `decorationConfig`.
        -   Header `Content-Type: application/json` được set thủ công trong `api/user.js` để đảm bảo backend nhận đúng định dạng.
    5.  **Upload Ảnh Decoration**:
        -   Endpoint: `POST /v1/user/shops/decoration/upload`.
        -   Return: URL ảnh (từ Cloudinary/FileStorage) để gán vào Banner Widget.
*   **Cơ chế nghiệp vụ**:
    -   Lưu cấu hình giao diện dưới dạng chuỗi **JSON** trong database (`ShopDecoration` entity).
    -   Frontend render dynamic components dựa trên JSON này.

### 2.5. Ví & Doanh Thu (Wallet & Ledger)
*   **Mô tả**: Xem doanh thu, lịch sử giao dịch, yêu cầu rút tiền.
*   **Service**: `order-service` (Ledger), `user-service` (Wallet info).
*   **Controller**: `LedgerController`
*   **Cơ chế nghiệp vụ**:
    -   **Ghi nhận doanh thu**: Chỉ khi đơn hàng `CONFIRMED`, hệ thống tính toán:
        `Doanh thu = Giá trị đơn - Phí sàn - Voucher (nếu có)`.
    -   **Sổ cái (Ledger)**: Lưu log biến động số dư (`ShopLedgerEntry`).
    -   **Rút tiền**: Shop Owner tạo request -> Admin duyệt -> Trừ tiền trong ví.

## 3. Tổng Hợp Kỹ Thuật

| Hạng mục | Chi tiết |
| :--- | :--- |
| **Message Queue** | **Kafka** (Topics: `order-topic`, `notification-topic`, `update-status-order-topic`) |
| **External APIs** | **GHN** (Vận chuyển), **VNPay** (Thanh toán), **Cloudinary** (Lưu trữ ảnh), **Gemini AI** (Sinh mô tả sản phẩm) |
| **Frameworks** | Spring Boot 3.x, Spring Cloud OpenFeign (gọi chéo service) |
| **Database** | PostgreSQL, Redis (Caching cart/session) |
| **Frontend** | ReactJS (Vite), TailwindCSS, Mermaid (Biểu đồ) |


## 4. Database Schema & Entities

Dưới đây là danh sách các Database Tables (Entities) liên quan trực tiếp đến chức năng Shop Owner, phân chia theo Service:

### 4.1. User Service (DB: `user_db`)
*   **`ShopOwner`**: Lưu thông tin cơ bản của Shop (Tên, Email, SĐT, Avatar).
*   **`Address`**: Lưu địa chỉ của Shop và User (Liên kết với ID Quận/Huyện GHN).
*   **`ShopDecoration`**: Lưu cấu hình giao diện trang trí shop (JSON).
*   **`ShopCoin`**: Quản lý xu thưởng của Shop (nếu có chương trình KHTT).
*   **`ShopFollow`**: Lưu danh sách User đang theo dõi Shop.
*   **`ShopSubscription`**: Lưu thông tin gói dịch vụ mà Shop đăng ký.

### 4.2. Stock Service (DB: `stock_db`)
*   **`Product`**: Lưu thông tin sản phẩm (Tên, Giá, Mô tả).
*   **`Size`**: Lưu các biến thể (Variants) của sản phẩm kèm số lượng tồn kho.
*   **`InventoryLog`**: Ghi log nhập/xuất kho (Audit trail).
*   **`Review`**: Lưu đánh giá sản phẩm của người mua.
*   **`FlashSaleProduct`**: Cấu hình sản phẩm tham gia Flash Sale của Shop.

### 4.3. Order Service (DB: `order_db`)
*   **`Order`**: Đơn hàng chính, lưu trạng thái (`PENDING`, `CONFIRMED`, `DELIVERED`...), tổng tiền, phương thức thanh toán.
*   **`OrderItem`**: Chi tiết từng sản phẩm trong đơn hàng.
*   **`ShippingOrder`**: Lưu thông tin vận chuyển GHN (Mã vận đơn, phí ship thực tế).
*   **`ShopLedger`**: Sổ cái tổng hợp tài chính của Shop (Số dư ví).
*   **`ShopLedgerEntry`**: Chi tiết giao dịch (Cộng tiền đơn hàng, Trừ phí dịch vụ, Rút tiền).
*   **`ShopVoucher`**: Voucher do Shop tự tạo (Giảm giá, Freeship).

## 5. Lưu ý Quan Trọng
- **Địa chỉ Shop**: Bắt buộc phải mapping đúng ID Quận/Huyện/Xã của GHN thì mới tính được phí ship.
- **Tồn kho**: Cơ chế trừ kho là **Optimistic Locking** hoặc check tồn kho trước khi trừ để tránh oversell.
- **Rollback**: Nếu đơn hàng bị Hủy (CANCELLED) hoặc Hoàn trả (RETURNED), hệ thống có quy trình `rollbackOrderStock` để cộng lại tồn kho.
