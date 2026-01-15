package com.example.stockservice.service.ai;

import com.example.stockservice.dto.AIChatRequest;
import com.example.stockservice.dto.AIChatResponse;
import com.example.stockservice.dto.ProductSuggestionDto;
import com.example.stockservice.repository.CategoryRepository;
import com.example.stockservice.service.product.ProductService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
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
@ConditionalOnClass(name = "org.springframework.ai.chat.model.ChatModel")
public class AIChatService {

    private final ChatClient chatClient;
    private final LanguageFilter languageFilter;
    private final CategoryRepository categoryRepository;

    // Lưu conversation history (conversationId -> list of messages)
    private final Map<String, List<ChatMessage>> conversationHistory = new ConcurrentHashMap<>();

    // Record để lưu message
    private record ChatMessage(String role, String content) {
    }

    private static final String SYSTEM_PROMPT = """
            ROLE:
            Bạn là VIBE AI, trợ lý mua sắm thông minh của VIBE E-commerce.
            Bạn thân thiện, hữu ích và chuyên nghiệp.

            CONTEXT:
            - Thời gian hiện tại: {current_time}
            - Ngày: {current_date} ({day_of_week})
            - Ngôn ngữ ưu tiên: {language}
            - User ID: {user_id}

            PRODUCT INVENTORY CONTEXT (DANH MỤC SẢN PHẨM CÓ SẴN):
            Cửa hàng hiện đang kinh doanh các danh mục sản phẩm sau:
            [{available_categories}]

            KHI SUY LUẬN SẢN PHẨM (INFER KEYWORDS), HÃY ƯU TIÊN CÁC SẢN PHẨM THUỘC CÁC DANH MỤC TRÊN!
            Ví dụ: Nếu user hỏi "cầu lông", nhưng shop chỉ có "Sport & Outdoor" (quần áo, giày) mà không bán "Vợt",
            thì hãy tìm "giày thể thao, quần áo thể thao" thay vì "vợt".

            CẢNH BÁO QUAN TRỌNG - ĐỌC KỸ

            BẠN TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ BỊA DỮ LIỆU!
            BẠN BẮT BUỘC PHẢI GỌI TOOL VÀ COPY CHÍNH XÁC KẾT QUẢ!

            AVAILABLE TOOLS VÀ CÁCH DÙNG:

            PRODUCT TOOLS:
            - "tìm sản phẩm X" → searchProducts(keyword="X")
            - "giá sản phẩm X" → getProductPrice(productName="X")
            - "sản phẩm giảm giá" → getDiscountedProducts()

            CONTEXTUAL SUGGESTIONS (TỰ ĐỘNG GỌI):
            Khi user đề cập đến hoạt động/scenario, BẠN PHẢI TỰ ĐỘNG GỌI suggestProductsByScenario:

            AI PHẢI TỰ SUY LUẬN (INFER) KEYWORDS TỪ HOẠT ĐỘNG:

            Quy tắc:
            1. PHÂN TÍCH hoạt động/scenario user muốn.
            2. ĐỐI CHIẾU với [PRODUCT INVENTORY CONTEXT] ở trên.
            3. TỰ SUY LUẬN các sản phẩm cần thiết (keywords) MÀ SHOP CÓ THỂ CÓ.
            4. GỌI suggestProductsByScenario với keywords đó.

            Ví dụ (Examples):
            - "đi biển" → suggestProductsByScenario(scenario="đồ bơi,kính râm,kem chống nắng,nón")
            - "đá bóng" → suggestProductsByScenario(scenario="giày đá bóng,quần áo thể thao,bóng đá,tất")
            - "chơi cầu lông" → suggestProductsByScenario(scenario="vợt cầu lông,giày cầu lông,áo thể thao")
            - "đi leo núi" → suggestProductsByScenario(scenario="giày leo núi,ba lô,gậy leo núi,áo khoác")
            - "đi picnic" → suggestProductsByScenario(scenario="thảm trải,đồ ăn nhanh,nước uống,lều")
            - "đi tiệc/party" → suggestProductsByScenario(scenario="váy dạ hội,giày cao gót,túi xách,trang sức")
            - "đi học" → suggestProductsByScenario(scenario="ba lô,sách,vở,bút,laptop")

            English Examples:
            - "soccer/football" → suggestProductsByScenario(scenario="soccer shoes,jersey,shorts,socks")
            - "hiking" → suggestProductsByScenario(scenario="hiking boots,backpack,jacket,water bottle")
            - "camping" → suggestProductsByScenario(scenario="tent,sleeping bag,lantern,camping chair")
            - "badminton" → suggestProductsByScenario(scenario="racket,shuttlecock,sport shoes")

            QUAN TRỌNG:
            - Với các hoạt động chưa có trong ví dụ, HÃY TỰ SUY LUẬN ít nhất 3-4 keywords liên quan nhất.

            QUAN TRỌNG:
            - KHÔNG HỎI LẠI USER, TỰ ĐỘNG GỌI FUNCTION NGAY!
            - Extract keywords phù hợp với scenario
            - Tool sẽ trả về products, bạn chỉ cần hiển thị

            ORDER TOOLS:
            - "đơn hàng của tôi" → getMyOrders(userId="{user_id}")
            - "đơn VNPAY/COD" → getOrdersByPayment(userId="{user_id}", paymentMethod="VNPAY" hoặc "COD")
            - "chi tiêu tháng này" → getSpendingStats(userId="{user_id}", period="month")
            - "chi tiêu tuần này" → getSpendingStats(userId="{user_id}", period="week")
            - "tổng đã chi" → getSpendingStats(userId="{user_id}", period="all")

            QUAN TRỌNG: Message từ tool có thể bằng tiếng Việt, nhưng bạn PHẢI dịch/format lại theo ngôn ngữ user.

            QUY TẮC NGÔN NGỮ (CRITICAL - LUÔN ĐỌC KỸ):
            - LUÔN LUÔN phát hiện ngôn ngữ của câu hỏi user (Vietnamese hoặc English)
            - LUÔN LUÔN trả lời CÙNG NGÔN NGỮ với user
            - Nếu user hỏi bằng tiếng Việt → trả lời tiếng Việt
            - Nếu user hỏi bằng English → reply in English
            - Tool responses có thể trả vềtiếng Việt, nhưng BẠN PHẢI DỊCH sang ngôn ngữ của user
            - KHÔNG dùng tiếng Trung, Nhật, Hàn

            EXAMPLES:
            User: "What products are on sale?" (English)
            → You MUST respond in English, even if tool returns Vietnamese

            User: "Sản phẩm nào đang giảm giá?" (Vietnamese)
            → You MUST respond in Vietnamese

            {conversation_history}
            """;

    private final FlashSaleTools flashSaleTools;
    private final AdvancedProductTools advancedProductTools;
    private final LiveSessionTools liveSessionTools;

    public AIChatService(ChatModel chatModel, LanguageFilter languageFilter, ProductTools productTools,
            ProductService productService, CategoryRepository categoryRepository,
            ContextualSuggestTool contextualSuggestTool, FlashSaleTools flashSaleTools,
            AdvancedProductTools advancedProductTools, LiveSessionTools liveSessionTools) {
        this.languageFilter = languageFilter;
        this.categoryRepository = categoryRepository;
        this.flashSaleTools = flashSaleTools;
        this.advancedProductTools = advancedProductTools;
        this.liveSessionTools = liveSessionTools;

        // Build ChatClient với các tools
        this.chatClient = ChatClient.builder(chatModel)
                .defaultFunctions(
                        // Product tools
                        "searchProducts",
                        "getProductPrice",
                        "getDiscountedProducts",
                        "getProductDetails",
                        // Order tools
                        "getMyOrders",
                        "getOrderStatus",
                        "getOrdersByPayment",
                        "getSpendingStats",
                        // Contextual suggestions
                        "suggestProductsByScenario",
                        // Flash Sale tools (NEW)
                        "getCurrentFlashSales",
                        "getFlashSaleProducts",
                        "checkProductInFlashSale",
                        "getUpcomingFlashSales",
                        // Advanced Product tools (NEW)
                        "getTrendingProducts",
                        "getNewArrivals",
                        "getProductsByCategory",
                        "getCategories"
                // Live Session tools (NEW) - TEMPORARILY DISABLED until notification-service
                // endpoint is fixed
                // "getActiveLiveSessions",
                // "searchLiveByKeyword",
                // "getLiveDetails"
                )
                .build();
    }

    private String getAvailableCategories() {
        try {
            return this.categoryRepository.findAll().stream()
                    .map(category -> category.getName())
                    .collect(java.util.stream.Collectors.joining(", "));
        } catch (Exception e) {
            log.error("Failed to fetch categories context", e);
            return "Fashion, Electronics, Home & Living"; // Fallback
        }
    }

    private String getFlashSaleContext() {
        try {
            var response = flashSaleTools.getCurrentFlashSales()
                    .apply(new FlashSaleTools.GetCurrentFlashSalesRequest());
            if (response.total() > 0) {
                return String.format("%d Flash Sale đang hoạt động", response.total());
            }
            return "Không có Flash Sale";
        } catch (Exception e) {
            log.warn("Could not fetch flash sale context", e);
            return "N/A";
        }
    }

    private String getLiveSessionContext() {
        // TEMPORARILY DISABLED - notification-service endpoint not ready
        return "Live Session feature đang được phát triển";

        /*
         * TODO: Re-enable when notification-service has proper endpoint
         * try {
         * var result = liveSessionTools.getActiveLiveSessions().apply(
         * new LiveSessionTools.GetActiveLiveSessionsRequest(5));
         * 
         * if (result.total() > 0) {
         * return result.total() + " phiên live đang hoạt động";
         * }
         * return "Không có phiên live nào";
         * } catch (Exception e) {
         * log.
         * warn("Failed to fetch live session context (notification-service may be down): {}"
         * , e.getMessage());
         * return "Không có thông tin live"; // Fallback - không crash
         * }
         */
    }

    // Product IN Stock
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

            // 3. Get available categories context
            String categoriesContext = getAvailableCategories();

            // 4. Get Flash Sale and Live context
            String flashSaleContext = getFlashSaleContext();
            String liveContext = getLiveSessionContext();

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
                    conversationId, k -> new ArrayList<>());

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

            // 6. Get userId from request
            String userId = request.getUserId();
            if (userId == null)
                userId = "not_logged_in";

            String systemPrompt = SYSTEM_PROMPT
                    .replace("{current_time}", currentTime)
                    .replace("{current_date}", currentDate)
                    .replace("{day_of_week}", dayOfWeek)
                    .replace("{language}", language)
                    .replace("{user_id}", userId)
                    .replace("{available_categories}", categoriesContext)
                    .replace("{flash_sale_context}", flashSaleContext)
                    .replace("{live_context}", liveContext)
                    .replace("{conversation_history}", historyBuilder.toString());

            log.info("Processing: '{}' (ConvId: {}, UserId: {}, History: {} msgs)",
                    userMessage, conversationId.substring(0, 8), userId, history.size());

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

            // 9. Check if products were stored by ANY tool (in ThreadLocal)
            List<ProductSuggestionDto> productSuggestions = null;

            // Check ContextualSuggestTool first
            productSuggestions = ContextualSuggestTool.getLastProducts();

            // If not found, check AdvancedProductTools
            if (productSuggestions == null || productSuggestions.isEmpty()) {
                productSuggestions = AdvancedProductTools.getLastProducts();
            }

            if (productSuggestions != null && !productSuggestions.isEmpty()) {
                log.info("Retrieved {} product suggestions from tools", productSuggestions.size());
                return AIChatResponse.builder()
                        .message(aiResponse)
                        .conversationId(conversationId)
                        .type("products")
                        .productSuggestions(productSuggestions)
                        .success(true)
                        .build();
            }

            return AIChatResponse.builder()
                    .message(aiResponse)
                    .conversationId(conversationId)
                    .type("text")
                    .success(true)
                    .build();

        } catch (Exception e) {
            log.error("Error in AI chat: ", e);
            ContextualSuggestTool.getLastProducts(); // Clean up ThreadLocal
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
