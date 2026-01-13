import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1";
const api = createApiInstance(API_URL);

/**
 * Track product view (Fire and forget)
 * @param {string} productId 
 */
export const trackProductView = (productId) => {
    // We don't await this because we don't want to block the UI
    try {
        api.post(`/stock/analytics/view/${productId}`);
    } catch (e) {
        console.warn("Tracking failed", e);
    }
};

// Helper to get or create a session ID stored in session storage
const getSessionId = () => {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
};

/**
 * Track site visit (homepage load)
 */
export const trackSiteVisit = () => {
    try {
        const sessionId = getSessionId();
        api.post(`/stock/analytics/visit?sessionId=${sessionId}`);
    } catch (e) {
        console.warn("Tracking failed", e);
    }
};

/**
 * Track add to cart event
 */
export const trackAddToCart = () => {
    try {
        api.post('/stock/analytics/cart-add');
    } catch (e) {
        console.warn("Tracking failed", e);
    }
};

/**
 * Get internal stats for testing (Optional)
 * @param {string} shopId
 */
export const getProducViewStats = async (productId) => {
    try {
        const response = await api.get(`/stock/analytics/product/${productId}/views`);
        return response.data;
    } catch (error) {
        console.error("Failed to fetch product stats", error);
        return 0;
    }
}
