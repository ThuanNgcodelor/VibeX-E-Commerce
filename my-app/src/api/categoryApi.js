import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1/stock/category";
const api = createApiInstance(API_URL);

/**
 * API quản lý danh mục sản phẩm
 */
const categoryApi = {
    /**
     * Lấy tất cả danh mục
     * @returns {Promise} - Promise trả về danh sách tất cả danh mục
     */
    getAll: () => api.get(`/getAll`).then(r => r.data),

    /**
     * Lấy danh mục theo ID
     * @param {string} id - ID của danh mục
     * @returns {Promise} - Promise trả về thông tin danh mục
     */
    getById: (id) => api.get(`/getCategoryById/${id}`).then(r => r.data),

    /**
     * Tạo danh mục mới
     * @param {FormData} formData - FormData chứa request và image
     * @returns {Promise} - Promise trả về danh mục đã tạo
     */
    create: (formData) => api.post(`/create`, formData, {
        transformRequest: [(payload, headers) => {
            // Remove Content-Type to let browser set it with boundary
            delete headers.common?.["Content-Type"];
            delete headers.post?.["Content-Type"];
            delete headers["Content-Type"];
            return payload;
        }],
    }).then(r => r.data),

    /**
     * Cập nhật danh mục
     * @param {FormData} formData - FormData chứa request và image
     * @returns {Promise} - Promise trả về danh mục đã cập nhật
     */
    update: (formData) => api.put(`/update`, formData, {
        transformRequest: [(payload, headers) => {
            // Remove Content-Type to let browser set it with boundary
            delete headers.common?.["Content-Type"];
            delete headers.put?.["Content-Type"];
            delete headers["Content-Type"];
            return payload;
        }],
    }).then(r => r.data),

    /**
     * Xóa danh mục
     * @param {string} id - ID của danh mục cần xóa
     * @returns {Promise} - Promise trả về kết quả xóa
     */
    remove: (id) => api.delete(`/deleteCategoryById/${id}`),
};

export default categoryApi;