
// Wrapper helper
import createApiInstance from './createApiInstance';

const api = createApiInstance('/v1/user'); // user-service

const shopOwnerAdminApi = {
    // Get all shop owners with stats
    getAllShopOwnersWithStats: async (params) => {
        try {
            const response = await api.get('/shop-owners/admin/list', { params });
            return response.data;
        } catch (error) {
            console.error("Error fetching shop owner stats:", error);
            throw error;
        }
    },

    toggleShopStatus: async (userId) => {
        try {
            const response = await api.put(`/shop-owners/${userId}/status`);
            return response.data;
        } catch (error) {
            console.error("Error toggling shop status:", error);
            throw error;
        }
    },

    verifyShop: async (userId) => {
        try {
            const response = await api.put(`/shop-owners/${userId}/verify`);
            return response.data;
        } catch (error) {
            console.error("Error verifying shop:", error);
            throw error;
        }
    }
};

export default shopOwnerAdminApi;
