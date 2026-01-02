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
        // Determine language for prompt
        String lang = request.getLanguage() != null ? request.getLanguage().toLowerCase() : "vi";
        boolean isEnglish = "en".equals(lang) || "english".equals(lang);

        StringBuilder sb = new StringBuilder();

        if (isEnglish) {
            sb.append("You are an e-commerce marketing expert.\n");
            sb.append(
                    "Write an attractive, SEO-optimized product description (HTML format) for the following product:\n\n");
            sb.append("Product name: ").append(request.getProductName()).append("\n");
        } else {
            sb.append("Bạn là một chuyên gia marketing content cho thương mại điện tử.\n");
            sb.append("Hãy viết một mô tả sản phẩm hấp dẫn, chuẩn SEO (HTML format) cho sản phẩm sau:\n\n");
            sb.append("Tên sản phẩm: ").append(request.getProductName()).append("\n");
        }

        if (request.getKeywords() != null && !request.getKeywords().isEmpty()) {
            sb.append(isEnglish ? "Key keywords: " : "Từ khóa trọng tâm: ").append(request.getKeywords()).append("\n");
        }

        if (request.getImages() != null && !request.getImages().isEmpty()) {
            sb.append(isEnglish
                    ? "IMPORTANT NOTE: Based on the provided images, describe in detail the colors, design, materials and outstanding features visible.\n"
                    : "LƯU Ý QUAN TRỌNG: Dựa vào các hình ảnh được cung cấp, hãy miêu tả chi tiết về màu sắc, kiểu dáng, chất liệu và các đặc điểm nổi bật nhìn thấy được.\n");
        }

        if (request.getAttributes() != null && !request.getAttributes().isEmpty()) {
            sb.append(isEnglish ? "Specifications/Features:\n" : "Thông số kỹ thuật/Đặc điểm:\n");
            request.getAttributes().forEach((k, v) -> sb.append("- ").append(k).append(": ").append(v).append("\n"));
        }

        sb.append(isEnglish ? "\nREQUIREMENTS:\n" : "\nYÊU CẦU:\n");
        sb.append(isEnglish
                ? "- Write in English.\n"
                : "- Viết bằng Tiếng Việt.\n");
        sb.append(isEnglish
                ? "- Use basic HTML tags like <p>, <ul>, <li>, <strong>, <em> for nice formatting.\n"
                : "- Sử dụng các thẻ HTML cơ bản như <p>, <ul>, <li>, <strong>, <em> để trình bày đẹp mắt.\n");
        sb.append(isEnglish ? "- Tone: " : "- Giọng văn: ")
                .append(request.getTone() != null ? request.getTone()
                        : (isEnglish ? "Professional, engaging" : "Chuyên nghiệp, lôi cuốn"))
                .append(".\n");
        sb.append(isEnglish
                ? "- Focus on product benefits for customers.\n"
                : "- Tập trung vào lợi ích của sản phẩm đối với khách hàng.\n");
        sb.append(isEnglish
                ? "- DO NOT include markdown code block ```html, just return raw HTML content.\n"
                : "- KHÔNG bao gồm markdown code block ```html, chỉ trả về nội dung HTML raw inside.\n");

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

    public String generateShopDecoration(ContentGenerationRequest request) {
        String prompt = buildDecorationPrompt(request);
        return callAi(prompt);
    }

    private String buildDecorationPrompt(ContentGenerationRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are an expert UI/UX designer and Shop Decorator.\n");
        sb.append("Generate a valid JSON configuration for a shop decoration based on the user's request.\n");
        sb.append("User Request: \"").append(request.getPlanningPrompt()).append("\"\n\n");

        sb.append("OUTPUT FORMAT:\n");
        sb.append("You must return ONLY a JSON object. No markdown, no comments.\n");
        sb.append("The JSON structure must match this EXACT format:\n");
        sb.append("{\n");
        sb.append("  \"style\": {\n");
        sb.append("    \"backgroundColor\": \"#hex\",\n");
        sb.append("    \"textColor\": \"#hex\",\n");
        sb.append("    \"fontFamily\": \"string\" (e.g., 'Roboto', 'Inter', 'Serif')\n");
        sb.append("  },\n");
        sb.append("  \"widgets\": [\n");
        sb.append("    {\n");
        sb.append("      \"id\": 1,\n");
        sb.append("      \"type\": \"banner\",\n");
        sb.append("      \"data\": {\n");
        sb.append("        \"images\": [\n");
        sb.append("          { \"url\": \"https://placehold.co/1200x400/png?text=Banner+Image\" }\n");
        sb.append("        ]\n");
        sb.append("      }\n");
        sb.append("    },\n");
        sb.append("    {\n");
        sb.append("      \"id\": 2,\n");
        sb.append("      \"type\": \"products\",\n");
        sb.append("      \"data\": {\n");
        sb.append("        \"title\": \"Featured Collection\",\n");
        sb.append("        \"productIds\": []\n");
        sb.append("      }\n");
        sb.append("    }\n");
        sb.append("  ]\n");
        sb.append("}\n\n");

        sb.append("RULES:\n");
        sb.append("1. 'widgets' array can contain 'banner', 'video', 'products' types.\n");
        sb.append(
                "2. For 'banner' images, use specific colors in the placeholder URL that match the theme (e.g., https://placehold.co/1200x400/ffcccb/ffffff?text=Summer+Sale).\n");
        sb.append(
                "3. For 'products', leave 'productIds' empty (the user will fill them later), but set a catchy 'title'.\n");
        sb.append(
                "4. For 'video', you can leave 'url' empty or put a relevant generic YouTube link if you know one, otherwise empty string.\n");
        sb.append("5. Limit to 3-5 widgets total.\n");
        sb.append("6. Return ONLY valid JSON. Do not wrap in ```json.\n");

        return sb.toString();
    }
}
