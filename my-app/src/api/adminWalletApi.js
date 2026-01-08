import createApiInstance from "./createApiInstance";

// Prefix for Admin Wallet endpoints
const API_URL = "/v1/user/wallet/admin";
const api = createApiInstance(API_URL);

/**
 * Get Admin Wallet Balance
 * Returns: { adminId, balanceAvailable, totalCommission, totalSubscriptionRevenue, ... }
 */
export const getAdminWalletBalance = async () => {
    try {
        const response = await api.get("/balance");
        return response.data;
    } catch (error) {
        console.error("Error fetching admin wallet balance:", error);
        throw error;
    }
};

/**
 * Get Admin Wallet Entries (History)
 * Query Params: page, size
 */
export const getAdminWalletEntries = async (page = 0, size = 20) => {
    try {
        const response = await api.get("/entries", {
            params: { page, size }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching admin wallet entries:", error);
        throw error;
    }
};
