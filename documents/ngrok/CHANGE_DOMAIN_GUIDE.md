# Hướng Dẫn Thay Đổi Domain (Ngrok/Deploy)

Tài liệu này liệt kê tất cả các vị trí cần cập nhật khi bạn thay đổi domain (ví dụ: từ `https://old.ngrok-free.app` sang `https://new.ngrok-free.app` hoặc domain thật).

## 1. Frontend (`my-app/.env.production`)
Đây là nơi quan trọng nhất để Google OAuth redirect đúng về frontend của bạn.

- **File:** `my-app/.env.production`
- **Thay đổi:** `VITE_GOOGLE_REDIRECT_URI`

```properties
# Thay thế domain cũ bằng domain mới
VITE_GOOGLE_REDIRECT_URI=https://<DOMAIN_MOI>/oauth2/callback
```
> **Lưu ý:** Sau khi sửa file này, BẮT BUỘC phải rebuild container frontend:
> `docker-compose up -d --build my-app`

---

## 2. Docker Compose (`docker-compose.yml`)
Cấu hình cho các services backend (Auth, Payment) biết domain hiện tại để xử lý callback.

- **File:** `docker-compose.yml`

### Service: `auth-service`
Cần sửa để validate redirect URI từ frontend.
```yaml
environment:
  - GOOGLE_REDIRECT_URI=https://<DOMAIN_MOI>/oauth2/callback
  - FACEBOOK_REDIRECT_URI=https://<DOMAIN_MOI>/oauth2/callback
```

### Service: `payment-service`
Cần sửa để VNPAY và MOMO trả kết quả thanh toán về đúng địa chỉ.
```yaml
environment:
  - VNPAY_RETURN_URL=https://<DOMAIN_MOI>/payment/vnpay/return
  - MOMO_RETURN_URL=https://<DOMAIN_MOI>/payment/momo/return
  - MOMO_IPN_URL=https://<DOMAIN_MOI>/v1/payment/momo/ipn
```

> **Lưu ý:** Sau khi sửa, cần recreate các service:
> `docker-compose up -d auth-service payment-service`

---

## 3. WebSocket Configuration (`WebSocketConfig.java`)
Cần sửa để tránh lỗi CORS (Cross-Origin Resource Sharing) khi kết nối socket từ domain mới.

- **File:** `notification-service/src/main/java/com/example/notificationservice/config/WebSocketConfig.java`
- **Thay đổi:** Thêm domain mới vào `allowedOrigins`.

```java
allowedOrigins = new String[]{
    // ...
    "https://<DOMAIN_MOI>", // Thêm dòng này
    // ...
};
```
> **Lưu ý:** Sau khi sửa code Java, cần rebuild notification-service:
> `docker-compose up -d --build notification-service`

---

## 4. Google Cloud Console (Quan trọng)
Google chặn tất cả các redirect không được khai báo.

1. Truy cập: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Chọn OAuth 2.0 configuration của bạn.
3. **Authorized JavaScript origins:** Thêm `https://<DOMAIN_MOI>`
4. **Authorized redirect URIs:** Thêm `https://<DOMAIN_MOI>/oauth2/callback`
5. Lưu lại.

---

## 5. Cổng Thanh Toán (VNPAY / MOMO)
Nếu bạn đang dùng môi trường Sandbox/Test, có thể không cần đăng ký IPn URL cứng.
Tuy nhiên, nếu deploy thật, bạn cần vào Dashboard của VNPAY/MOMO để cập nhật IPN URL nếu họ yêu cầu whitelist domain.

---

## 6. AI Service (Ollama)
Cấu hình kết nối tới Ollama hiện tại đang dùng IP mạng LAN (ví dụ: `26.20.xx.xx`). Nếu bạn đổi mạng Wifi hoặc đổi máy chủ chạy Ollama, cần cập nhật IP này.

- **File:** `docker-compose.yml`
- **Thay đổi:** `OLLAMA_BASE_URL` cho `stock-service`

```yaml
stock-service:
  environment:
    - OLLAMA_BASE_URL=http://<NEW_IP>:11434
```

---

## Tóm tắt quy trình đổi Domain

1.  **Dừng ngrok cũ, chạy ngrok mới** -> Có Domain mới.
2.  **Sửa `my-app/.env.production`** -> Rebuild `my-app`.
3.  **Sửa `docker-compose.yml`** (auth, payment) -> Restart services.
4.  **Cập nhật Google Console Credential**.
5.  **(Tuỳ chọn)** Sửa `WebSocketConfig.java` nếu CORS chặn.
6.  **Kiểm tra IP Ollama** nếu đổi mạng.
