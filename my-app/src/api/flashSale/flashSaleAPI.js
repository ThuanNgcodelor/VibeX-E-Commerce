import createApiInstance from "../createApiInstance";

// Prefix for Admin Wallet endpoints
const API_URL = "/v1/stock/flash-sale";
const api = createApiInstance(API_URL);


const flashSaleAPI = {
    // --- Admin ---
    createSession: async (data) => {
        const response = await api.post('/session', data);
        return response.data;
    },
    openSession: async (sessionId) => {
        const response = await api.post(`/session/${sessionId}/open`);
        return response.data;
    },
    getAllSessions: async () => {
        const response = await api.get('/sessions');
        return response.data;
    },
    deleteSession: async (sessionId) => {
        const response = await api.delete(`/session/${sessionId}`);
        return response.data;
    },
    toggleSessionStatus: async (sessionId) => {
        const response = await api.put(`/session/${sessionId}/status`);
        return response.data;
    },
    getSessionProducts: async (sessionId) => {
        const response = await api.get(`/session/${sessionId}/products`);
        return response.data;
    },
    approveProduct: async (registrationId) => {
        const response = await api.post(`/approve/${registrationId}`);
        return response.data;
    },
    rejectProduct: async (registrationId, reason) => {
        const response = await api.post(`/reject/${registrationId}`, null, { params: { reason } });
        return response.data;
    },

    // --- Shop ---
    registerProduct: async (data) => {
        const response = await api.post('/register', data);
        return response.data;
    },
    getMyRegistrations: async () => {
        const response = await api.get('/my-registrations');
        return response.data;
    },
    deleteRegistration: async (registrationId) => {
        const response = await api.delete(`/registration/${registrationId}`);
        return response.data;
    },

    // --- User ---
    getCurrentSession: async () => {
        const response = await api.get('/public/current');
        return response.data;
    },
    getPublicSessions: async () => {
        const response = await api.get('/public/sessions');
        return response.data;
    },
    getPublicSessionProducts: async (sessionId) => {
        const response = await api.get(`/public/session/${sessionId}/products`);
        return response.data;
    }
};

export default flashSaleAPI;
