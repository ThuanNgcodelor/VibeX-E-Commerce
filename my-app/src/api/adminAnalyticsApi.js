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

export const getDashboardStats = async () => {
    try {
        const response = await api.get("/dashboard");
        return response.data;
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        throw error;
    }
};

export const getRevenueChartData = async () => {
    try {
        const response = await api.get("/revenue-chart");
        return response.data;
    } catch (error) {
        console.error("Error fetching revenue chart data:", error);
        throw error;
    }
};

export const getRecentOrders = async () => {
    try {
        const response = await api.get("/recent-orders");
        return response.data;
    } catch (error) {
        console.error("Error fetching recent orders:", error);
        throw error;
    }
};

export const getTopCategories = async () => {
    try {
        const response = await api.get("/top-categories");
        return response.data;
    } catch (error) {
        console.error("Error fetching top categories:", error);
        throw error;
    }
};

