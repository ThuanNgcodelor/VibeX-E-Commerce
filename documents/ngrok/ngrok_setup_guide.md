# Ngrok Solution - Chi tiết Flow & Chuẩn bị

## Phân tích vấn đề hiện tại

### Flow OAuth hiện tại (LAN - KHÔNG hoạt động)
```mermaid
sequenceDiagram
    participant User as 👤 Client (Máy khác)
    participant Browser as 🌐 Browser
    participant Docker as 🐳 Docker (localhost:80)
    participant Auth as 🔐 Auth Service
    participant Google as 🔑 Google OAuth

    User->>Browser: Truy cập http://26.X.X.X (Radmin IP)
    Browser->>Docker: GET /
    Docker->>Browser: Return frontend
    Browser->>Auth: Click "Login Google"
    Auth->>Google: Redirect to Google Login
    Google->>Browser: User login thành công
    Google->>Browser: Redirect to http://localhost/oauth2/callback ❌
    Note over Browser: ERR_CONNECTION_REFUSED<br/>vì localhost trên máy client<br/>không phải máy host!
```

### Flow OAuth với Ngrok (Hoạt động)
```mermaid
sequenceDiagram
    participant User as 👤 Client (Bất kỳ máy nào)
    participant Browser as 🌐 Browser
    participant Ngrok as 🚇 Ngrok Tunnel
    participant Docker as 🐳 Docker (localhost:80)
    participant Auth as 🔐 Auth Service
    participant Google as 🔑 Google OAuth

    User->>Browser: Truy cập https://abc123.ngrok-free.app
    Browser->>Ngrok: GET /
    Ngrok->>Docker: Forward to localhost:80
    Docker->>Browser: Return frontend (via Ngrok)
    Browser->>Auth: Click "Login Google"
    Auth->>Google: Redirect to Google Login
    Google->>Browser: User login thành công
    Google->>Browser: Redirect to https://abc123.ngrok-free.app/oauth2/callback ✅
    Browser->>Ngrok: GET /oauth2/callback
    Ngrok->>Docker: Forward to localhost:80
    Docker->>Auth: Process callback
    Auth->>Browser: Login success! ✅
```

---

## Ngrok là gì?

Ngrok tạo một **tunnel an toàn** từ public internet → localhost của bạn.

```
Internet (Public URL)
        ↓
   Ngrok Cloud
        ↓
[Tunnel qua firewall/NAT]
        ↓
  Máy bạn (localhost:80)
```

**Ngrok cung cấp:**
- Public URL (HTTPS): `https://abc123.ngrok-free.app`
- URL này ai cũng truy cập được (không cần VPN)
- Tự động có SSL certificate

---

## Chuẩn bị

### 1. Tài khoản Ngrok (FREE)
- Đăng ký: https://dashboard.ngrok.com/signup
- Lấy authtoken (sẽ dùng khi setup)

### 2. Cài đặt Ngrok trên máy HOST
- Download: https://ngrok.com/download
- Chọn Windows → Unzip → Đặt `ngrok.exe` vào thư mục bất kỳ (VD: `C:\ngrok\`)

### 3. Kiểm tra Docker đang chạy
```cmd
docker ps
```
Đảm bảo thấy container `my-app` listen port `80`.

---

## Các bước thực hiện

### Bước 1: Xác thực Ngrok

Mở CMD và chạy:
```cmd
cd C:\ngrok
ngrok config add-authtoken YOUR_AUTHTOKEN_HERE
```
*(Lấy authtoken từ https://dashboard.ngrok.com/get-started/your-authtoken)*

### Bước 2: Khởi động Ngrok tunnel

```cmd
ngrok http 80
```

**Output sẽ giống như:**
```
Session Status                online
Account                       your-email@gmail.com (Plan: Free)
Version                       3.x.x
Region                        Asia Pacific (ap)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://a1b2c3d4e5f6.ngrok-free.app -> http://localhost:80

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

> [!IMPORTANT]
> Ghi lại URL **`https://a1b2c3d4e5f6.ngrok-free.app`** (URL của bạn sẽ khác).

**Lưu ý:** 
- URL này thay đổi **MỖI LẦN khởi động lại ngrok** (trừ khi upgrade plan có giá)
- Giữ cửa sổ CMD này **mở** (đừng tắt)

### Bước 3: Cập nhật biến môi trường Docker

Mở file `docker-compose.yml`, sửa phần `auth-service`:

```yaml
auth-service:
  <<: *spring-boot-common
  build: ./auth-service
  container_name: auth-service
  environment:
    - SPRING_CLOUD_CONFIG_URI=http://config-server:8888
    - EUREKA_URI=http://eureka-server:8761/eureka
    - SPRING_DATA_REDIS_HOST=redis
    # ===== Thay URL ngrok vào đây =====
    - GOOGLE_REDIRECT_URI=https://a1b2c3d4e5f6.ngrok-free.app/oauth2/callback
    - FACEBOOK_REDIRECT_URI=https://a1b2c3d4e5f6.ngrok-free.app/oauth2/callback
  depends_on:
    gateway:
      condition: service_started
```

**Lưu file** và rebuild:
```cmd
cd D:\CP2496H07_GROUP1
docker-compose down
docker-compose up -d --build auth-service
```

### Bước 4: Cập nhật Google Cloud Console

1. Truy cập: https://console.cloud.google.com/
2. **APIs & Services** → **Credentials**
3. Click vào **OAuth 2.0 Client ID** của bạn
4. Trong **Authorized JavaScript origins**, thêm:
   ```
   https://a1b2c3d4e5f6.ngrok-free.app
   ```
5. Trong **Authorized redirect URIs**, thêm:
   ```
   https://a1b2c3d4e5f6.ngrok-free.app/oauth2/callback
   ```
6. Click **Save**

### Bước 5: Test

Trên **BẤT KỲ máy nào** (có internet):
1. Mở trình duyệt
2. Truy cập: `https://a1b2c3d4e5f6.ngrok-free.app`
3. Click **Login with Google**
4. ✅ Thành công!

---

## Những điểm cần lưu ý

### ⚠️ URL thay đổi mỗi lần restart ngrok

Khi tắt ngrok và mở lại:
```cmd
ngrok http 80
```
→ URL mới: `https://xyz789.ngrok-free.app` (khác URL cũ)

**Phải làm lại:**
1. Sửa `docker-compose.yml` → thay URL mới
2. Rebuild `auth-service`
3. Cập nhật Google Cloud Console (thêm redirect URI mới hoặc xóa cũ)

**Giải pháp:**
- **Ngrok Free Domain:** Đăng ký 1 subdomain cố định (vd: `vibex-demo.ngrok-free.app`)
  ```cmd
  ngrok http 80 --domain=vibex-demo.ngrok-free.app
  ```
  → Miễn phí nhưng phải verify email
  
- **Ngrok Paid Plan:** $10/tháng cho static domain

### ⚠️ Ngrok Free tier limitations

- Bandwidth: 1GB/tháng
- Requests: 20,000 requests/tháng
- 1 tunnel đồng thời
- Có banner "Visit Site" (người dùng phải click thêm 1 lần)

### ⚠️ Tốc độ & latency

Traffic flow:
```
User → Internet → Ngrok Cloud (Singapore/Tokyo) → Ngrok client → localhost
```
→ Chậm hơn so với LAN trực tiếp (~100-300ms thêm)

### ⚠️ Bảo mật

- Ngrok thấy được **tất cả traffic** (SSL terminated tại ngrok)
- **KHÔNG dùng cho production**
- Chỉ dùng cho demo/development

---

## Alternative: Ngrok + Static Domain (Khuyên dùng)

Nếu không muốn thay URL mỗi lần:

### Bước 1: Claim free static domain

1. Đăng nhập: https://dashboard.ngrok.com/
2. **Cloud Edge** → **Domains**
3. Click **+ Create Domain** → **Create**
4. Ví dụ được domain: `vibex-demo.ngrok-free.app`

### Bước 2: Khởi động với domain cố định

```cmd
ngrok http 80 --domain=vibex-demo.ngrok-free.app
```

### Bước 3: Cấu hình Docker & Google OAuth

Giờ dùng URL **cố định** này:
- `docker-compose.yml`: `GOOGLE_REDIRECT_URI=https://vibex-demo.ngrok-free.app/oauth2/callback`
- Google Console: `https://vibex-demo.ngrok-free.app/oauth2/callback`

**Lợi ích:** Chỉ cần setup 1 lần, không phải sửa mỗi lần restart!

---

## Checklist tổng quan

- [ ] **1. Đăng ký tài khoản Ngrok** (https://dashboard.ngrok.com/signup)
- [ ] **2. Download ngrok.exe** (https://ngrok.com/download)
- [ ] **3. Lấy authtoken** từ dashboard
- [ ] **4. Chạy `ngrok config add-authtoken`**
- [ ] **5. (Tùy chọn) Claim free static domain** trong dashboard
- [ ] **6. Chạy `ngrok http 80`** → Lấy URL
- [ ] **7. Sửa `docker-compose.yml`** → Thay `GOOGLE_REDIRECT_URI`
- [ ] **8. Rebuild Docker:** `docker-compose up -d --build auth-service`
- [ ] **9. Cập nhật Google Cloud Console** → Thêm redirect URI
- [ ] **10. Test:** Truy cập ngrok URL và login Google

---

## Script tự động (Tùy chọn)

Tạo file `start-ngrok.bat`:
```batch
@echo off
echo Starting ngrok tunnel...
cd C:\ngrok
ngrok http 80 --domain=vibex-demo.ngrok-free.app
```

Mỗi lần demo, chỉ cần double-click `start-ngrok.bat`.
