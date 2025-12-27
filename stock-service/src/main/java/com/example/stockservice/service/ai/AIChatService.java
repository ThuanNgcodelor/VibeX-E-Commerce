package com.example.stockservice.service.ai;

import com.example.stockservice.dto.AIChatRequest;
import com.example.stockservice.dto.AIChatResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class AIChatService {

    private final ChatClient chatClient;
    private final LanguageFilter languageFilter;

    // Lưu conversation history (conversationId -> list of messages)
    private final Map<String, List<ChatMessage>> conversationHistory = new ConcurrentHashMap<>();
    
    // Record để lưu message
    private record ChatMessage(String role, String content) {}

    private static final String SYSTEM_PROMPT = """
        ROLE:
        Bạn là VIBE AI, trợ lý mua sắm thông minh của VIBE E-commerce.
        Bạn thân thiện, hữu ích và chuyên nghiệp.
        
        CONTEXT:
        - Thời gian hiện tại: {current_time}
        - Ngày: {current_date} ({day_of_week})
        - Ngôn ngữ ưu tiên: {language}
        
        QUAN TRỌNG - CÁCH SỬ DỤNG TOOLS:
        1. Khi user hỏi về sản phẩm, tìm kiếm, giá cả → BẮT BUỘC gọi tool searchProducts hoặc getProductPrice
        2. Khi user hỏi về sale, giảm giá, khuyến mãi → BẮT BUỘC gọi tool getDiscountedProducts
        3. KHÔNG BAO GIỜ tự bịa dữ liệu sản phẩm
        4. Nếu user nói "tìm X", "sản phẩm X", "có X không" → Gọi searchProducts(keyword=X)
        
        QUY TẮC TRẢ LỜI:
        - KHÔNG hiển thị ID sản phẩm
        - Chỉ hiển thị: tên, giá, % giảm giá (nếu có)
        - Tối đa 5 sản phẩm
        - Format: **Tên SP** - Giá: XXX₫ (Giảm X%)
        
        QUY TẮC NGÔN NGỮ:
        - Tiếng Việt → trả lời tiếng Việt
        - English → reply in English
        - KHÔNG dùng tiếng Trung, Nhật, Hàn
        
        {conversation_history}
        """;

    public AIChatService(ChatModel chatModel, LanguageFilter languageFilter, ProductTools productTools) {
        this.languageFilter = languageFilter;

        // Build ChatClient với các tools
        this.chatClient = ChatClient.builder(chatModel)
                .defaultFunctions(
                        "searchProducts",
                        "getProductPrice", 
                        "getDiscountedProducts",
                        "getProductDetails"
                )
                .build();
    }

    public AIChatResponse chat(AIChatRequest request) {
        try {
            String userMessage = request.getMessage();
            
            // 1. Check blocked languages
            if (languageFilter.containsBlockedLanguage(userMessage)) {
                boolean isVi = languageFilter.isVietnamese(userMessage);
                return AIChatResponse.builder()
                        .message(languageFilter.getBlockedLanguageError(isVi))
                        .type("error")
                        .success(false)
                        .error("BLOCKED_LANGUAGE")
                        .build();
            }

            // 2. Determine language
            boolean isVietnamese = languageFilter.isVietnamese(userMessage);
            String language = isVietnamese ? "Tiếng Việt" : "English";

            // 3. Get or create conversation ID
            String conversationId = request.getConversationId();
            if (conversationId == null || conversationId.isEmpty()) {
                conversationId = UUID.randomUUID().toString();
            }

            // 4. Build context with time
            LocalDateTime now = LocalDateTime.now();
            String currentTime = now.format(DateTimeFormatter.ofPattern("HH:mm"));
            String currentDate = now.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
            String dayOfWeek = now.format(DateTimeFormatter.ofPattern("EEEE", new Locale("vi", "VN")));

            // 5. Get conversation history
            List<ChatMessage> history = conversationHistory.computeIfAbsent(
                conversationId, k -> new ArrayList<>()
            );
            
            // Build history string for prompt
            StringBuilder historyBuilder = new StringBuilder();
            if (!history.isEmpty()) {
                historyBuilder.append("\nLỊCH SỬ HỘI THOẠI:\n");
                // Keep last 6 messages for context
                int startIdx = Math.max(0, history.size() - 6);
                for (int i = startIdx; i < history.size(); i++) {
                    ChatMessage msg = history.get(i);
                    if ("user".equals(msg.role())) {
                        historyBuilder.append("User: ").append(msg.content()).append("\n");
                    } else {
                        historyBuilder.append("AI: ").append(msg.content()).append("\n");
                    }
                }
            }

            String systemPrompt = SYSTEM_PROMPT
                    .replace("{current_time}", currentTime)
                    .replace("{current_date}", currentDate)
                    .replace("{day_of_week}", dayOfWeek)
                    .replace("{language}", language)
                    .replace("{conversation_history}", historyBuilder.toString());

            log.info("Processing: '{}' (ConvId: {}, History: {} msgs)", 
                    userMessage, conversationId.substring(0, 8), history.size());

            // 6. Call AI with Function Calling
            String aiResponse = chatClient.prompt()
                    .system(systemPrompt)
                    .user(userMessage)
                    .call()
                    .content();

            // 7. Filter blocked language from response
            if (aiResponse != null) {
                aiResponse = languageFilter.filterBlockedLanguage(aiResponse);
            }

            // 8. Save to history
            history.add(new ChatMessage("user", userMessage));
            history.add(new ChatMessage("assistant", aiResponse));
            
            // Keep history size manageable (max 20 messages)
            while (history.size() > 20) {
                history.removeFirst();
            }

            log.info("AI Response: {}", aiResponse);

            return AIChatResponse.builder()
                    .message(aiResponse)
                    .conversationId(conversationId)
                    .type("text")
                    .success(true)
                    .build();

        } catch (Exception e) {
            log.error("Error in AI chat: ", e);
            return AIChatResponse.builder()
                    .message("Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.")
                    .type("error")
                    .success(false)
                    .error(e.getMessage())
                    .build();
        }
    }

    public void clearConversation(String conversationId) {
        conversationHistory.remove(conversationId);
        log.info("Cleared conversation: {}", conversationId);
    }
}
