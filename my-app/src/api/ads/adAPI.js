import api from '../api';

const adAPI = {
    createRequest: async (data) => {
        // data: { shopId, title, description, adType, imageUrl, targetUrl, durationDays }
        const response = await api.post('/v1/user/ads/request', data);
        return response.data;
    },

    approveAd: async (id, placement) => {
        const response = await api.put(`/v1/user/ads/${id}/approve`, null, { params: { placement } });
        return response.data;
    },

    rejectAd: async (id, reason) => {
        const response = await api.put(`/v1/user/ads/${id}/reject`, null, { params: { reason } });
        return response.data;
    },

    getShopAds: async (shopId) => {
        const response = await api.get(`/v1/user/ads/shop/${shopId}`);
        return response.data;
    },

    getAllAds: async () => {
        const response = await api.get('/v1/user/ads/all');
        return response.data;
    },

    getActiveAds: async (placement) => {
        const response = await api.get('/v1/user/ads/active', { params: { placement } });
        return response.data;
    },

    deleteAd: async (id) => {
        await api.delete(`/v1/user/ads/${id}`);
    },
};

export default adAPI;
