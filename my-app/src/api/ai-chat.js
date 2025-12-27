import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1/stock/ai-chat";
const api = createApiInstance(API_URL);

// AI Chat API - Giao tiếp với Ollama qua stock-service

/**
 * Gửi tin nhắn tới AI chatbot
 * @param {string} message - Nội dung tin nhắn
 * @param {string} conversationId - ID conversation (optional)
 * @param {string} userId - User ID (optional, for cart actions)
 * @returns {Promise<{message: string, conversationId: string, type: string, products: array, success: boolean}>}
 */
export const sendAIChatMessage = async (message, conversationId = null, userId = null) => {
    const response = await api.post('/message', {
        message,
        conversationId,
        userId
    });
    return response.data;
};

/**
 * Xóa lịch sử hội thoại AI
 * @param {string} conversationId - ID của conversation cần xóa
 */
export const clearAIConversation = async (conversationId) => {
    await api.delete(`/conversation/${conversationId}`);
};

/**
 * Kiểm tra trạng thái AI service
 * @returns {Promise<string>}
 */
export const checkAIHealth = async () => {
    const response = await api.get('/health');
    return response.data;
};
