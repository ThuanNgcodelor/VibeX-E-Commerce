import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1";
const api = createApiInstance(API_URL);

/**
 * Generate product description using AI
 * @param {Object} data - { productName, keywords, attributes, tone, language }
 */
export const generateProductDescription = async (data) => {
    try {
        const response = await api.post('/stock/shop-assistant/generate-description', data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Generate review reply using AI
 * @param {Object} data - { reviewComment, rating, customerName, tone, language }
 */
export const generateReviewReply = async (data) => {
    try {
        const response = await api.post('/stock/shop-assistant/generate-reply', data);
        console.log("AI REPLY RESPONSE", response)
        return response.data;
    } catch (error) {
        throw error;
    }
};
