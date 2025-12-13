import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1";
const api = createApiInstance(API_URL);

/**
 * Thêm sản phẩm mới (Shop Owner)
 * @param {Object} productData - Dữ liệu sản phẩm
 * @param {File[]} images - Mảng các file ảnh của sản phẩm
 * @returns {Promise} - Promise trả về sản phẩm đã tạo
 */
export const addProduct = async (productData, images) => {
    try {
        const formData = new FormData();

        formData.append('request', new Blob([JSON.stringify(productData)], {
            type: 'application/json'
        }));

        if (images && images.length > 0) {
            images.forEach((image) => {
                formData.append('file', image);
            });
        }

        const res = await api.post("/stock/product/create", formData, {
            headers: {
                "Content-Type": "multipart/form-data"
            }
        });
        return res.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to add product");
    }
};

/**
 * Cập nhật sản phẩm (Shop Owner)
 * @param {Object} productData - Dữ liệu sản phẩm cần cập nhật
 * @param {File[]} images - Mảng các file ảnh mới (nếu có)
 * @returns {Promise} - Promise trả về sản phẩm đã cập nhật
 */
export const updateProduct = async (productData, images) => {
    try {
        const formData = new FormData();

        formData.append('request', new Blob([JSON.stringify(productData)], {
            type: 'application/json'
        }));

        if (images && images.length > 0) {
            images.forEach((image) => {
                formData.append('file', image);
            });
        }

        const res = await api.put("/stock/product/update", formData, {
            headers: {
                "Content-Type": "multipart/form-data"
            }
        });
        return res.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to update product");
    }
};

/**
 * Lấy danh sách sản phẩm của shop owner (có phân trang)
 * @param {number} pageNo - Số trang (mặc định: 1)
 * @param {number} pageSize - Số lượng sản phẩm mỗi trang (mặc định: 6)
 * @returns {Promise} - Promise trả về danh sách sản phẩm
 */
export const getProducts = async (pageNo = 1, pageSize = 6) => {
    try {
        const res = await api.get("/stock/product/listPageShopOwner", {
            params: { pageNo, pageSize }
        });
        return res.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to fetch products");
    }
};

/**
 * Tìm kiếm sản phẩm của shop owner
 * @param {string} keyword - Từ khóa tìm kiếm
 * @param {number} pageNo - Số trang (mặc định: 1)
 * @param {number} pageSize - Số lượng sản phẩm mỗi trang (mặc định: 6)
 * @returns {Promise} - Promise trả về kết quả tìm kiếm
 */
export const searchProducts = async (keyword = '', pageNo = 1, pageSize = 6) => {
    try {
        const res = await api.get("/stock/product/searchShopOwner", {
            params: { keyword, pageNo, pageSize }
        });
        return res.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to search products");
    }
};

/**
 * Lấy thông tin sản phẩm theo ID (Shop Owner)
 * @param {string} id - ID của sản phẩm
 * @returns {Promise} - Promise trả về thông tin sản phẩm
 */
export const getProductById = async (id) => {
    try {
        const res = await api.get(`/stock/product/getProductById/${id}`);
        return res.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to fetch product");
    }
};

/**
 * Xóa sản phẩm (Shop Owner)
 * @param {string} id - ID của sản phẩm cần xóa
 * @returns {Promise} - Promise trả về kết quả xóa
 */
export const deleteProduct = async (id) => {
    try {
        const res = await api.delete(`/stock/product/deleteProductById/${id}`);
        return res.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to delete product");
    }
};

/**
 * Lấy thống kê sản phẩm cho Shop Owner (bao gồm banned/suspended)
 * @returns {Promise} - Promise trả về thống kê sản phẩm
 */
export const getProductStats = async () => {
    try {
        const res = await api.get("/stock/product/shop-owner/stats");
        return res.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to fetch product stats");
    }
};

/**
 * Lấy thống kê đơn hàng và doanh thu cho Dashboard
 * @returns {Promise} - Promise trả về thống kê dashboard
 */
export const getDashboardStats = async () => {
    try {
        const res = await api.get("/order/shop-owner/dashboard-stats");
        return res.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to fetch dashboard stats");
    }
};