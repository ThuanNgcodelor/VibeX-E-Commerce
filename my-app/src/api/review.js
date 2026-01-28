import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1";
const api = createApiInstance(API_URL);

/**
 * Create a new review
 * @param {Object} data - Review data { productId, rating, comment, ... }
 * @returns {Promise}
 */
export const createReview = async (data) => {
    return api.post("/stock/reviews", data);
};

/**
 * Fetch reviews by product ID
 * @param {string} productId
 * @returns {Promise}
 */
export const fetchReviewsByProductId = (productId) => {
    return api.get(`/stock/reviews/product/${productId}`);
};

/**
 * Fetch reviews by shop ID
 * @param {string} shopId
 * @returns {Promise}
 */
export const getReviewsByShopId = (shopId, page = 0, size = 20) => {
    return api.get(`/stock/reviews/shop/${shopId}`, {
        params: { page, size }
    });
};

/**
 * Reply to a review
 * @param {string} reviewId
 * @param {string} reply
 * @returns {Promise}
 */
export const replyToReview = (reviewId, reply) => {
    return api.post(`/stock/reviews/${reviewId}/reply`, reply, {
        headers: { 'Content-Type': 'text/plain' }
    });
};