import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1/stock";
const api = createApiInstance(API_URL);

/**
 * Get current user's cart from stock-service directly
 * @returns {Promise} - Promise returns cart data
 */
export const getCart = async () => {
    try {
        const response = await api.get("/cart/user");
        return response.data;
    } catch {
        throw new Error("Failed to fetch cart data");
    }
};
