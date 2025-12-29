package com.example.stockservice.service.ai;

import com.example.stockservice.dto.ContentGenerationRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class ContentGenerationService {

    private final ChatClient chatClient;

    public ContentGenerationService(ChatModel chatModel) {
        this.chatClient = ChatClient.builder(chatModel).build();
    }

    public String generateProductDescription(ContentGenerationRequest request) {
        String promptText = buildProductDescriptionPrompt(request);

        if (request.getImages() != null && !request.getImages().isEmpty()) {
            return callAiWithImages(promptText, request.getImages());
        }

        return callAi(promptText);
    }

    public String generateReviewReply(ContentGenerationRequest request) {
        String prompt = buildReviewReplyPrompt(request);
        return callAi(prompt);
    }

    private String callAi(String prompt) {
        try {
            return chatClient.prompt()
                    .user(prompt)
                    .call()
                    .content();
        } catch (Exception e) {
            log.error("AI Generation Error", e);
            throw new RuntimeException("Failed to generate content: " + e.getMessage());
        }
    }

    private String buildProductDescriptionPrompt(ContentGenerationRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("Bạn là một chuyên gia marketing content cho thương mại điện tử.\n");
        sb.append("Hãy viết một mô tả sản phẩm hấp dẫn, chuẩn SEO (HTML format) cho sản phẩm sau:\n\n");
        sb.append("Tên sản phẩm: ").append(request.getProductName()).append("\n");

        if (request.getKeywords() != null && !request.getKeywords().isEmpty()) {
            sb.append("Từ khóa trọng tâm: ").append(request.getKeywords()).append("\n");
        }

        if (request.getImages() != null && !request.getImages().isEmpty()) {
            sb.append(
                    "LƯU Ý QUAN TRỌNG: Dựa vào các hình ảnh được cung cấp, hãy miêu tả chi tiết về màu sắc, kiểu dáng, chất liệu và các đặc điểm nổi bật nhìn thấy được.\n");
        }

        if (request.getAttributes() != null && !request.getAttributes().isEmpty()) {
            sb.append("Thông số kỹ thuật/Đặc điểm:\n");
            request.getAttributes().forEach((k, v) -> sb.append("- ").append(k).append(": ").append(v).append("\n"));
        }

        sb.append("\nYÊU CẦU:\n");
        sb.append("- Viết bằng Tiếng Việt (trừ khi có yêu cầu khác).\n");
        sb.append("- Sử dụng các thẻ HTML cơ bản như <p>, <ul>, <li>, <strong>, <em> để trình bày đẹp mắt.\n");
        sb.append("- Giọng văn: ").append(request.getTone() != null ? request.getTone() : "Chuyên nghiệp, lôi cuốn")
                .append(".\n");
        sb.append("- Tập trung vào lợi ích của sản phẩm đối với khách hàng.\n");
        sb.append("- KHÔNG bao gồm markdown code block ```html, chỉ trả về nội dung HTML raw inside.\n");

        return sb.toString();
    }

    private String buildReviewReplyPrompt(ContentGenerationRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("Bạn là chủ shop online thân thiện và chuyên nghiệp.\n");
        sb.append("Hãy viết câu trả lời cho đánh giá của khách hàng sau:\n\n");

        sb.append("Khách hàng: ").append(request.getCustomerName() != null ? request.getCustomerName() : "Khách hàng")
                .append("\n");
        sb.append("Đánh giá: ").append(request.getRating()).append(" sao\n");
        sb.append("Nội dung: \"").append(request.getReviewComment()).append("\"\n");

        sb.append("\nYÊU CẦU:\n");
        sb.append("- Viết bằng Tiếng Việt.\n");
        sb.append("- Giọng văn: ")
                .append(request.getTone() != null ? request.getTone() : "Thân thiện, biết ơn, cầu thị").append(".\n");

        if (request.getRating() != null && request.getRating() >= 4) {
            sb.append("- Cảm ơn khách đã ủng hộ và khen ngợi.\n");
            sb.append("- Mời khách quay lại ủng hộ lần sau.\n");
        } else {
            sb.append("- Xin lỗi về trải nghiệm chưa tốt (nếu có).\n");
            sb.append("- Cam kết cải thiện dịch vụ/sản phẩm.\n");
            sb.append("- Đề nghị khách nhắn tin riêng để hỗ trợ giải quyết (nếu cần).\n");
        }

        sb.append("- Ngắn gọn, súc tích (dưới 100 từ).\n");
        sb.append("- KHÔNG dùng markdown, chỉ trả về text thuần.\n");

        return sb.toString();
    }

    private String callAiWithImages(String promptText, java.util.List<String> base64Images) {
        try {
            var userMessage = new org.springframework.ai.chat.messages.UserMessage(
                    promptText,
                    base64Images.stream()
                            .map(img -> {
                                try {
                                    byte[] imageBytes = java.util.Base64.getDecoder().decode(img);
                                    return new org.springframework.ai.model.Media(
                                            org.springframework.util.MimeTypeUtils.IMAGE_PNG,
                                            new org.springframework.core.io.ByteArrayResource(imageBytes));
                                } catch (Exception e) {
                                    throw new RuntimeException("Invalid image data", e);
                                }
                            })
                            .collect(java.util.stream.Collectors.toList()));

            return chatClient.prompt()
                    .messages(userMessage)
                    .call()
                    .content();
        } catch (Exception e) {
            log.error("AI Multimodal Error", e);
            throw new RuntimeException("Failed to generate content with images: " + e.getMessage());
        }
    }
}
