# AI Content Generation Service Documentation

## 1. Tổng Quan (Overview)
`ContentGenerationService` là thành phần core trong **stock-service** chịu trách nhiệm tạo nội dung tự động bằng AI. Service này sử dụng **Spring AI** để giao tiếp với các mô hình ngôn ngữ lớn (LLM) như OpenAI, Ollama, etc.

## 2. Các Tính Năng Chính

### 2.1. Tạo Mô Tả Sản Phẩm (Product Description)
Tự động tạo mô tả sản phẩm chuẩn SEO, định dạng HTML dựa trên tên, thuộc tính và hình ảnh sản phẩm.

**Luồng xử lý:**
1.  **Input:** Nhận `ContentGenerationRequest` (Tên, từ khóa, attributes, ảnh base64...).
2.  **Prompt Engineering:**
    *   Xây dựng prompt chi tiết với vai trò "Chuyên gia Marketing".
    *   Yêu cầu định dạng đầu ra là **HTML** (thẻ `<p>`, `<ul>`, `<li>`...) để hiển thị trực tiếp lên web.
    *   Tự động chèn thông số kỹ thuật (`attributes`) vào nội dung.
    *   Xử lý đa ngôn ngữ (Tiếng Việt/Tiếng Anh) dựa trên field `language`.
3.  **Multimodal Analysis (Nếu có ảnh):**
    *   Nếu request có danh sách hình ảnh (Base64), service sẽ gửi cả ảnh và text prompt lên AI.
    *   Giúp AI "nhìn" thấy sản phẩm để miêu tả chính xác màu sắc, kiểu dáng thực tế.
4.  **Output:** Trả về chuỗi HTML mô tả sản phẩm.

### 2.2. Gợi Ý Phản Hồi Đánh Giá (Review Reply)
Tự động tạo câu trả lời cho các đánh giá của khách hàng, giúp chủ shop tiết kiệm thời gian chăm sóc khách hàng.

**Luồng xử lý:**
1.  **Input:** Tên khách hàng, số sao (rating), nội dung đánh giá (`reviewComment`).
2.  **Sentiment Analysis (Phân loại cảm xúc):**
    *   **Rating >= 4 sao:** Prompt hướng AI viết giọng điệu cảm ơn, tri ân, mời quay lại.
    *   **Rating < 4 sao:** Prompt hướng AI viết giọng điệu xin lỗi, cầu thị, cam kết khắc phục.
3.  **Output:** Trả về câu trả lời text thuần (không phải markdown) để chủ shop có thể copy/edit nhanh.

## 3. Kiến Trúc Kỹ Thuật

### 3.1. Spring AI Integration
Service sử dụng thư viện **Spring AI** (cụ thể là `spring-ai-ollama-spring-boot-starter`) để kết nối với AI Model.

*   **Library:** `org.springframework.ai:spring-ai-ollama-spring-boot-starter` (Version 1.0.0-M4)
*   **Interface:** Sử dụng `ChatClient` - một interface cấp cao của Spring AI giúp code không phụ thuộc vào implementation cụ thể (Ollama, OpenAI, Azure...).

### 3.2. Cách gửi Prompt sang AI
Service sử dụng Fluent API của `ChatClient` để gửi yêu cầu. Có 2 cách gửi chính:

**Cách 1: Gửi Text Prompt (Cơ bản)**
```java
private String callAi(String prompt) {
    return chatClient.prompt()
            .user(prompt)   // Set nội dung user message
            .call()         // Thực hiện gọi API
            .content();     // Lấy nội dung trả về (String)
}
```

**Cách 2: Gửi Multimodal (Text + Ảnh)**
Sử dụng `UserMessage` để đóng gói cả text và hình ảnh (Binary/Base64).
```java
var userMessage = new UserMessage(
    promptText, // Nội dung text
    List.of(new Media(MimeTypeUtils.IMAGE_PNG, imageResource)) // Danh sách ảnh
);

return chatClient.prompt()
        .messages(userMessage) // Gửi message phức hợp
        .call()
        .content();
```

### 3.2. Cấu Trúc Prompt
Prompt được xây dựng động (`StringBuilder`) dựa trên dữ liệu đầu vào để tối ưu hóa kết quả.

**Ví dụ Prompt Template (Product Description):**
> "Bạn là một chuyên gia marketing content cho thương mại điện tử.
> Hãy viết một mô tả sản phẩm hấp dẫn, chuẩn SEO (HTML format) cho sản phẩm sau:
> Tên sản phẩm: {productName}
> Từ khóa trọng tâm: {keywords}
> Thông số kỹ thuật:
> - {key}: {value}
> YÊU CẦU:
> - Viết bằng Tiếng Việt.
> - Sử dụng thẻ HTML cơ bản.
> - KHÔNG bao gồm markdown code block."

### 3.3. Định dạng dữ liệu trả về (Output Format)
Mặc dù hàm `chatClient.call().content()` luôn trả về một `String`, nhưng nội dung bên trong sẽ khác nhau tùy tính năng:

*   **Product Description:** Trả về chuỗi **HTML** (các thẻ `<p>`, `<ul>`...).
    *   *Tại sao?* Prompt đã yêu cầu cụ thể "HTML format" để Frontend có thể sử dụng `dangerouslySetInnerHTML` (React) hiển thị ngay mà không cần xử lý thêm.
*   **Review Reply:** Trả về chuỗi **Plain Text** (văn bản thuần).
    *   *Tại sao?* Prompt yêu cầu "KHÔNG dùng markdown" để chủ shop có thể edit dễ dàng trong ô input text.

## 4. Hướng Dẫn Sử Dụng API

### Endpoint: Generate Description
**POST** `/v1/stock/shop-assistant/generate-description`

**Request Body:**
```json
{
  "productName": "Áo Thun Nam Basic",
  "keywords": "cotton, thoáng mát, mùa hè",
  "attributes": {
    "Chất liệu": "100% Cotton",
    "Màu sắc": "Trắng, Đen"
  },
  "tone": "Trẻ trung",
  "language": "vi",
  "images": ["<base64_image_string>"] 
}
```

### Endpoint: Generate Reply
**POST** `/v1/stock/shop-assistant/generate-reply`

**Request Body:**
```json
{
  "customerName": "Nguyễn Văn A",
  "rating": 5,
  "reviewComment": "Sản phẩm rất đẹp, giao hàng nhanh!",
  "tone": "Thân thiện"
}
```
