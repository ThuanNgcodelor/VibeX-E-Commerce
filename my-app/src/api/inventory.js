import createApiInstance from './createApiInstance';

const api = createApiInstance('/v1');

export const getInventoryLogs = async (params) => {
    try {
        const res = await api.get('/stock/inventory/logs', { params });
        return res.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Failed to fetch inventory logs');
    }
};

export const getLowStockProducts = async (threshold = 10) => {
    try {
        const res = await api.get('/stock/inventory/low-stock', { params: { threshold } });
        return res.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Failed to fetch low stock products');
    }
};

export const adjustStock = async (data) => {
    try {
        const res = await api.post('/stock/inventory/adjust', data);
        return res.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Failed to adjust stock');
    }
};

/**
 * Get product image URL by imageId
 * @param {string} imageId 
 * @returns {Promise<string>} Image blob URL
 */
export const getProductImageUrl = async (imageId) => {
    if (!imageId) return null;
    try {
        const res = await api.get(`/file-storage/get/${imageId}`, { responseType: 'blob' });
        return URL.createObjectURL(res.data);
    } catch (error) {
        console.error('Failed to fetch product image:', error);
        return null;
    }
};
