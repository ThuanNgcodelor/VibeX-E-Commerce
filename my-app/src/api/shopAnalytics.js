import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1/stock/analytics/shop";
const api = createApiInstance(API_URL);

// ==================== SHOP ANALYTICS APIs (Phase 4) ====================

/**
 * Get complete shop behavior analytics overview
 * Includes: total views/carts/purchases, top products, funnel, abandoned products
 * 
 * @returns {Promise<Object>} ShopAnalyticsDTO
 */
export const getShopBehaviorAnalytics = async () => {
    try {
        const response = await api.get('/overview');
        return response.data;
    } catch (e) {
        console.error('Get shop behavior analytics failed:', e);
        throw e;
    }
};

/**
 * Get top viewed products for the shop
 * 
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Array>} Array of TopProductDTO
 */
export const getTopViewedProducts = async (limit = 10) => {
    try {
        const response = await api.get('/top-products', { params: { limit } });
        return response.data;
    } catch (e) {
        console.error('Get top viewed products failed:', e);
        return [];
    }
};

/**
 * Get conversion funnel data
 * Shows: Views → Add to Cart → Purchase metrics
 * 
 * @returns {Promise<Object>} ConversionFunnelDTO
 */
export const getConversionFunnel = async () => {
    try {
        const response = await api.get('/funnel');
        return response.data;
    } catch (e) {
        console.error('Get conversion funnel failed:', e);
        return {
            views: 0,
            carts: 0,
            purchases: 0,
            viewToCartRate: 0,
            cartToPurchaseRate: 0,
            overallConversionRate: 0
        };
    }
};

/**
 * Get abandoned products (high views, low purchases)
 * 
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Array>} Array of AbandonedProductDTO
 */
export const getAbandonedProducts = async (limit = 10) => {
    try {
        const response = await api.get('/abandoned', { params: { limit } });
        return response.data;
    } catch (e) {
        console.error('Get abandoned products failed:', e);
        return [];
    }
};

export default {
    getShopBehaviorAnalytics,
    getTopViewedProducts,
    getConversionFunnel,
    getAbandonedProducts
};
