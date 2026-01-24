import createApiInstance from "./createApiInstance";

// Ensure we use a path that starts with /v1 so Vite proxies it to the Gateway.
// We updated the backend controller to listen on /v1/order/admin/analytics
const API_URL = "/v1/order/admin/analytics";
const api = createApiInstance(API_URL);

export const getSuspiciousProducts = async () => {
    try {
        const response = await api.get("/suspicious");
        return response.data;
    } catch (error) {
        console.error("Error fetching suspicious products:", error);
        throw error;
    }
};

export const getDashboardStats = async (startDate, endDate) => {
    try {
        const response = await api.get("/dashboard", {
            params: { startDate, endDate }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        throw error;
    }
};

export const getRevenueChartData = async (startDate, endDate) => {
    try {
        const response = await api.get("/revenue-chart", {
            params: { startDate, endDate }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching revenue chart data:", error);
        throw error;
    }
};

export const getRecentOrders = async (category) => {
    try {
        const params = {};
        if (category && category !== 'All') {
            params.category = category;
        }
        const response = await api.get("/recent-orders", { params });
        return response.data;
    } catch (error) {
        console.error("Error fetching recent orders:", error);
        throw error;
    }
};

export const getTopCategories = async (startDate, endDate) => {
    try {
        const response = await api.get("/top-categories", {
            params: { startDate, endDate }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching top categories:", error);
        throw error;
    }
};

export const getConversionTrend = async (startDate, endDate) => {
    try {
        const response = await api.get("/conversion-trend", {
            params: { startDate, endDate }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching conversion trend:", error);
        throw error;
    }
};

export const getUserLocationStats = async () => {
    try {
        const response = await api.get("/user-locations");
        return response.data;
    } catch (error) {
        console.error("Error fetching user location stats:", error);
        throw error;
    }
};

export const warnShop = async (shopId) => {
    try {
        await api.post(`/warn-shop/${shopId}`);
    } catch (error) {
        console.error(`Error warning shop ${shopId}:`, error);
        throw error;
    }
};

