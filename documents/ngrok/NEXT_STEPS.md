# Các bước tiếp theo để hoàn tất Google OAuth qua Ngrok

## ✅ Đã hoàn thành

1. ✅ Cập nhật `docker-compose.yml` với ngrok redirect URIs:
   - `GOOGLE_REDIRECT_URI=https://unbrawny-suk-nonillatively.ngrok-free.dev/oauth2/callback`
   - `FACEBOOK_REDIRECT_URI=https://unbrawny-suk-nonillatively.ngrok-free.dev/oauth2/callback`

2. ✅ Rebuild `auth-service` container
3. ✅ Auth-service đã khởi động thành công
4. ✅ Lưu tài liệu hướng dẫn vào `documents/ngrok/ngrok_setup_guide.md`

---

## 🔴 CẦN LÀM TIẾP

### Bước 1: Khởi động Ngrok tunnel

Mở terminal mới và chạy:
```cmd
ngrok http 80 --domain=unbrawny-suk-nonillatively.ngrok-free.dev
```

> **Lưu ý:** Giữ terminal ngrok **luôn mở** khi demo.

### Bước 2: Cập nhật Google Cloud Console

1. Truy cập: https://console.cloud.google.com/
2. **APIs & Services** → **Credentials**
3. Click vào OAuth 2.0 Client ID hiện tại của bạn
4. Trong **Authorized JavaScript origins**, thêm:
   ```
   https://unbrawny-suk-nonillatively.ngrok-free.dev
   ```
5. Trong **Authorized redirect URIs**, thêm:
   ```
   https://unbrawny-suk-nonillatively.ngrok-free.dev/oauth2/callback
   ```
6. Click **Save**

### Bước 3: Test

1. Mở trình duyệt (bất kỳ máy nào có internet)
2. Truy cập: `https://unbrawny-suk-nonillatively.ngrok-free.dev`
3. Click **Login with Google**
4. Kiểm tra login thành công

---

## 📋 Checklist

- [ ] Ngrok tunnel đang chạy
- [ ] Google Cloud Console đã cập nhật redirect URI
- [ ] Test login Google thành công
- [ ] Test từ máy khác (không phải máy host)

---

## ⚠️ Troubleshooting

### Ngrok tunnel không kết nối?
```cmd
# Kiểm tra ngrok đã cài đặt:
ngrok version

# Kiểm tra authtoken:
ngrok config check
```

### Lỗi `redirect_uri_mismatch`?
- Đảm bảo URI trong Google Console **CHÍNH XÁC** khớp với URL ngrok
- Không có dấu `/` thừa ở cuối
- Phải là `https://` (không phải `http://`)

### Auth-service không nhận redirect URI mới?
```cmd
# Kiểm tra biến môi trường:
docker exec auth-service env | findstr REDIRECT
```

Kết quả phải thấy:
```
GOOGLE_REDIRECT_URI=https://unbrawny-suk-nonillatively.ngrok-free.dev/oauth2/callback
FACEBOOK_REDIRECT_URI=https://unbrawny-suk-nonillatively.ngrok-free.dev/oauth2/callback
```
