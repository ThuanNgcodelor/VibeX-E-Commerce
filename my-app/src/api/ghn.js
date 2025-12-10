import axios from 'axios';

const GHN_API_URL = 'https://dev-online-gateway.ghn.vn/shiip/public-api';
const GHN_TOKEN = '57404b9d-d3e9-11f0-a3d6-dac90fb956b5';
const GHN_SHOP_ID = '198371';

const ghnApi = axios.create({
    baseURL: GHN_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Token': GHN_TOKEN,
        'ShopId': GHN_SHOP_ID.toString()
    }
});

/**
 * Lấy danh sách tất cả tỉnh/thành phố
 * @returns {Promise<Array>} - Promise trả về danh sách tỉnh/thành phố
 */
export const getProvinces = async () => {
    try {
        const response = await ghnApi.get('/master-data/province');
        
        if (response.data?.code === 200 && response.data?.data) {
            return response.data.data;
        }
        return [];
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Failed to fetch provinces');
    }
};

/**
 * Lấy danh sách quận/huyện theo tỉnh/thành phố
 * @param {number} provinceId - ID của tỉnh/thành phố
 * @returns {Promise<Array>} - Promise trả về danh sách quận/huyện
 */
export const getDistricts = async (provinceId) => {
    try {
        const response = await ghnApi.get('/master-data/district', {
            params: { province_id: provinceId }
        });
        if (response.data?.code === 200 && response.data?.data) {
            return response.data.data;
        }
        return [];
    } catch {
        throw new Error('Failed to fetch districts');
    }
};

/**
 * Lấy danh sách phường/xã theo quận/huyện
 * @param {number} districtId - ID của quận/huyện
 * @returns {Promise<Array>} - Promise trả về danh sách phường/xã
 */
export const getWards = async (districtId) => {
    try {
        const response = await ghnApi.get('/master-data/ward', {
            params: { district_id: districtId }
        });
        if (response.data?.code === 200 && response.data?.data) {
            return response.data.data;
        }
        return [];
    } catch  {
        throw new Error('Failed to fetch wards');
    }
};

