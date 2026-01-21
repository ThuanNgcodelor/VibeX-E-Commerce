import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1";
const api = createApiInstance(API_URL);

/**
 * Lấy danh sách tất cả sản phẩm
 * @returns {Promise} - Promise trả về danh sách sản phẩm
 */
export const fetchProducts = () => {
    return api.get("/stock/product/list");
};

/**
 * Lấy danh sách sản phẩm có phân trang
 * @param {number} pageNo - Số trang (mặc định: 1)
 * @param {number} pageSize - Số lượng sản phẩm mỗi trang 
 * @returns {Promise} - Promise trả về danh sách sản phẩm có phân trang
 */
export const fetchProductsPage = (pageNo = 1, pageSize = 20) => {
    return api.get(`/stock/product/listPage?pageNo=${pageNo}&pageSize=${pageSize}`);
};

/**
 * Tìm kiếm sản phẩm theo từ khóa
 * @param {string} keyword - Từ khóa tìm kiếm
 * @param {number} pageNo - Số trang (mặc định: 1)
 * @param {number} pageSize - Số lượng sản phẩm mỗi trang 
 * @returns {Promise} - Promise trả về kết quả tìm kiếm
 */
export const searchProducts = (keyword = "", pageNo = 1, pageSize = 20) => {
    return api.get(`/stock/product/search?keyword=${encodeURIComponent(keyword)}&pageNo=${pageNo}&pageSize=${pageSize}`);
};

/**
 * Xóa sản phẩm khỏi giỏ hàng
 * @param {string} cartItemId - ID của item trong giỏ hàng
 * @returns {Promise<boolean>} - Promise trả về true nếu xóa thành công
 */
export const removeCartItem = async (cartItemId) => {
    try {
        await api.delete(`/stock/cart/item/remove/${cartItemId}`);
        return true;
    } catch {
        return false;
    }
};

/**
 * Lấy thông tin sản phẩm theo ID
 * @param {string} productId - ID của sản phẩm
 * @returns {Promise} - Promise trả về thông tin sản phẩm
 */
export const fetchProductById = (productId) => {
    return api.get(`/stock/product/getProductById/${productId}`);
};

/**
 * Lấy ảnh sản phẩm theo ID
 * @param {string} imageId - ID của ảnh
 * @returns {Promise<ArrayBuffer>} - Promise trả về dữ liệu ảnh dạng arraybuffer
 */
export const fetchProductImageById = (imageId) => {
    return api.get(`/file-storage/get/${imageId}`, {
        responseType: "arraybuffer",
    });
};

/**
 * Thêm sản phẩm vào giỏ hàng
 * @param {Object} data - Dữ liệu sản phẩm cần thêm vào giỏ hàng
 * @returns {Promise} - Promise trả về kết quả thêm vào giỏ hàng
 */
export const fetchAddToCart = async (data) => {
    try {
        const response = await api.post(`/stock/cart/item/add`, data);
        return response.data;
    } catch (err) {
        throw err;
    }
};

/**
 * Cập nhật số lượng sản phẩm trong giỏ hàng
 * @param {Object} data - Dữ liệu cập nhật (cartItemId, quantity)
 * @returns {Promise} - Promise trả về kết quả cập nhật
 */
export const updateCartItemQuantity = async (data) => {
    try {
        const response = await api.put(`/stock/cart/item/update`, data);
        return response.data;
    } catch (err) {
        throw err;
    }
};
/**
 * Get shop statistics (product count, average rating)
 * @param {string} shopId
 * @returns {Promise<{productCount: number, avgRating: number}>}
 */
export const getShopStats = async (shopId) => {
    const res = await api.get(`/stock/product/public/shop/${shopId}/stats`);
    return res.data;
};

/**
 * Get products for a shop (public)
 * @param {string} shopId
 * @param {number} pageNo
 * @param {number} pageSize
 */
export const getShopProducts = async (shopId, pageNo = 1, pageSize = 12) => {
    const res = await api.get(`/stock/product/public/shop/${shopId}/products`, {
        params: { pageNo, pageSize }
    });
    return res.data;
};

// Recommendations
export const fetchPersonalizedRecommendations = (page = 1, limit = 12) => {
    return api.get(`/stock/analytics/recommendations/personalized?page=${page}&limit=${limit}`);
};

export const fetchTrendingProducts = (page = 1, limit = 12) => {
    return api.get(`/stock/analytics/recommendations/trending?page=${page}&limit=${limit}`);
};