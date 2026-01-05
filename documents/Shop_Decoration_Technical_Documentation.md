# Tài Liệu Kỹ Thuật: Tính Năng Trang Trí Shop (Shop Decoration)

## 1. Tổng Quan
Tính năng Trang Trí Shop cho phép Shop Owner tự thiết kế giao diện trang chủ cửa hàng của mình bằng cách kéo thả các Widget (Banner, Video, Danh sách sản phẩm). Cấu hình giao diện này được lưu trữ dưới dạng JSON và được render động ở phía User.

## 2. Kiến Trúc Hệ Thống

### 2.1. Backend (`user-service`)

#### Database Schema
*   **Table**: `shop_decorations`
*   **Entity**: `ShopDecoration`
    *   `id` (Long): Khóa chính.
    *   `shop_id` (String): ID của Shop Owner (Unique).
    *   `content` (TEXT): Chuỗi JSON chứa toàn bộ cấu hình giao diện.
    *   `created_at`, `updated_at`: Timestamp.

#### API Endpoints (`ShopDecorationController`)
| Method | Endpoint | Role | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/user/shops/decoration/me` | Shop Owner | Lấy cấu hình trang trí hiện tại của Shop đang đăng nhập. |
| `PUT` | `/v1/user/shops/decoration/me` | Shop Owner | Lưu cấu hình trang trí mới (Body: JSON String). |
| `POST` | `/v1/user/shops/decoration/upload` | Shop Owner | Upload ảnh (banner) lên server/cloud, trả về URL. |
| `GET` | `/v1/user/shops/{shopId}/decoration` | Public | Lấy cấu hình trang trí của một Shop bất kỳ để hiển thị cho User. |

#### Service Logic (`ShopDecorationService`)
*   **Save**: Kiểm tra xem Shop đã có record trong bảng `shop_decorations` chưa. Nếu chưa -> Tạo mới; Nếu có -> Cập nhật cột `content`.
*   **Get**: Tìm theo `shopId`. Nếu không thấy -> Trả về cấu hình mặc định (hoặc null).

### 2.2. Frontend (`my-app`)

#### Components Chính
1.  **`ShopDecorationPage.jsx`**: Trang quản lý chính.
    *   Quản lý state `decorationConfig` (Mảng các widget).
    *   Xử lý logic: Thêm, Xóa, Sửa, Lưu cấu hình.
2.  **`DecorationRenderer.jsx`**: Component hiển thị.
    *   Nhận input là `config` (JSON).
    *   Dựa vào `widget.type` để render component tương ứng (Banner, Video, ProductList).
3.  **`WidgetSelector.jsx`**: Menu bên trái để chọn widget thêm vào.
4.  **`PreviewArea.jsx`**: Khu vực hiển thị demo và thực hiện kéo thả (Drag & Drop).

#### Cấu Trúc Data (JSON)
Cấu hình được lưu dưới dạng một mảng các Widget Object:

```json
[
  {
    "id": 1704356789000,
    "type": "banner",
    "data": {
      "images": [
        { "url": "https://example.com/banner1.jpg", "link": "/promotion-1" },
        { "url": "https://example.com/banner2.jpg", "link": "/promotion-2" }
      ]
    }
  },
  {
    "id": 1704356799000,
    "type": "products",
    "data": {
      "title": "Sản phẩm bán chạy",
      "productIds": ["prod_1", "prod_2", "prod_3"]
    }
  },
  {
    "id": 1704356899000,
    "type": "video",
    "data": {
      "url": "https://youtube.com/watch?v=abcxyz"
    }
  }
]
```

## 3. Quy Trình Nghiệp Vụ (Flow)

### 3.1. Chỉnh sửa trang trí (Shop Owner)
1.  **Load**: Vào trang `ShopDecorationPage`. Gọi API `GET .../me`.
    *   Nếu có data -> Parse JSON -> Set state.
    *   Nếu chưa có -> Set state rỗng.
2.  **Edit**:
    *   **Thêm Widget**: Chọn từ menu -> Push vào mảng state.
    *   **Sửa Widget**: Click vào widget -> Mở form edit (Update field `data` trong object).
    *   **Upload Ảnh**: Gọi API Upload -> Nhận URL -> Lưu vào `data` của widget banner.
    *   **Sắp xếp**: Dùng thư viện (như `dnd-kit`) để drag & drop -> Cập nhật lại thứ tự mảng.
3.  **Save**: Click "Lưu".
    *   Frontend `JSON.stringify` state -> Gọi API `PUT .../me`.
    *   Backend lưu chuỗi này vào DB.

### 3.2. Hiển thị (User/Client)
1.  User vào trang chi tiết Shop (`ShopDetailPage`).
2.  Frontend gọi API `GET .../{shopId}/decoration`.
3.  Backend trả về JSON string.
4.  Frontend dùng `DecorationRenderer` để duyệt mảng widget:
    *   `type == 'banner'` -> Render `Swiper` Slider.
    *   `type == 'products'` -> Gọi API `getProductsByIds` để lấy thông tin chi tiết (giá, tên, ảnh) và render Grid sản phẩm.
    *   `type == 'video'` -> Render iframe Youtube.

## 4. Các Vấn Đề Cần Lưu Ý
*   **Performance**: Widget "Sản phẩm" chỉ lưu danh sách `id`. Khi render, cần gọi API lấy chi tiết. Nếu danh sách quá dài, cần implement lazy loading hoặc batch fetching để tránh chậm.
*   **Security**: Validate `video url` để tránh XSS hoặc nhúng link độc hại.
*   **Mobile**: Đảm bảo các widget (đặc biệt là Banner) responsive tốt trên mobile.
