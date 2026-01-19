import createApiInstance from "../createApiInstance";


const API_URL = "/v1/user/ads";
const api = createApiInstance(API_URL);

const adAPI = {
    createRequest: async (data) => {
        // data: { shopId, title, description, adType, imageUrl, targetUrl, durationDays }
        const response = await api.post('/request', data);
        return response.data;
    },

    createSystemAd: async (data) => {
        const response = await api.post('/system', data);
        return response.data;
    },

    approveAd: async (id, placement) => {
        const response = await api.put(`/${id}/approve`, null, { params: { placement } });
        return response.data;
    },

    rejectAd: async (id, reason) => {
        const response = await api.put(`/${id}/reject`, null, { params: { reason } });
        return response.data;
    },

    getShopAds: async (shopId) => {
        const response = await api.get(`/shop/${shopId}`);
        return response.data;
    },

    getAllAds: async () => {
        const response = await api.get('/all');
        return response.data;
    },

    getActiveAds: async (placement) => {
        const response = await api.get('/active', { params: { placement } });
        return response.data;
    },

    deleteAd: async (id) => {
        await api.delete(`/${id}`);
    },
};

export default adAPI;
