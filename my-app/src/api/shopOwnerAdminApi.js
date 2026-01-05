
// Wrapper helper
import createApiInstance from './createApiInstance';

const api = createApiInstance('/v1/user'); // user-service

const shopOwnerAdminApi = {
    // Get all shop owners with stats
    getAllShopOwnersWithStats: async () => {
        try {
            const response = await api.get('/shop-owners/admin/list');
            return response.data;
        } catch (error) {
            console.error("Error fetching shop owner stats:", error);
            throw error;
        }
    }
};

export default shopOwnerAdminApi;
