import createApiInstance from "./createApiInstance";

// User Service API for subscriptions
const api = createApiInstance("/v1");

export const getActivePlans = async () => {
    try {
        const response = await api.get("/user/subscription-plan/active");
        return response.data;
    } catch {
        throw new Error("Failed to fetch subscription plans");
    }
};

export const getMySubscription = async (shopOwnerId) => {
    try {
        const response = await api.get(`/shop-subscriptions/shop/${shopOwnerId}`);
        return response.data;
    } catch  {
        throw new Error("Failed to fetch my subscription");
    }
};

export const subscribeToPlan = async (shopOwnerId, planId, duration) => {
    try {
        const response = await api.post(`/shop-subscriptions/shop/${shopOwnerId}/subscribe`, {
            planId,
            duration
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to subscribe");
    }
};

export const cancelSubscription = async (shopOwnerId) => {
    try {
        await api.post(`/shop-subscriptions/shop/${shopOwnerId}/cancel`);
        return true;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to cancel subscription");
    }
};