import createApiInstance from "./createApiInstance";
const API_URL = "/v1";
const api = createApiInstance(API_URL);

/**
 * Chuyển đổi object và file thành FormData
 * @param {Object} requestObj - Object dữ liệu request
 * @param {File} file - File ảnh (optional)
 * @returns {FormData} - FormData đã được tạo
 */
const toMultipart = (requestObj, file) => {
    const fd = new FormData();
    fd.append(
        "request",
        new Blob([JSON.stringify(requestObj)], { type: "application/json" })
    );
    if (file) fd.append("file", file);
    return fd;
};

/**
 * API quản lý sản phẩm cho Admin
 */
const productAdminApi = {
    /**
     * Lấy danh sách tất cả sản phẩm
     * @returns {Promise} - Promise trả về danh sách sản phẩm
     */
    async list() {
        const res = await api.get("/stock/product/list");
        return res.data;
    },

    async getProducts() {
        const res = await api.get("/stock/product/listPageShopOwner?pageSize=1000&pageNo=1");
        return res.data;
    },

    /**
     * Lấy danh sách sản phẩm có phân trang
     * @param {Object} options - Tùy chọn phân trang
     * @param {number} options.pageNo - Số trang (mặc định: 1)
     * @param {number} options.pageSize - Số lượng sản phẩm mỗi trang (mặc định: 10)
     * @returns {Promise} - Promise trả về danh sách sản phẩm có phân trang
     */
    async page({ pageNo = 1, pageSize = 10 } = {}) {
        const res = await api.get("/stock/product/page", { params: { pageNo, pageSize } });
        return res.data;
    },

    /**
     * Tạo sản phẩm mới
     * @param {Object} request - Dữ liệu sản phẩm
     * @param {File} file - File ảnh sản phẩm (optional)
     * @returns {Promise} - Promise trả về sản phẩm đã tạo
     */
    async create(request, file) {
        const res = await api.post(
            "/stock/product/create",
            toMultipart(request, file),
            { headers: { "Content-Type": "multipart/form-data" } }
        );
        return res.data;
    },

    /**
     * Cập nhật sản phẩm
     * @param {Object} request - Dữ liệu sản phẩm cần cập nhật
     * @param {File} file - File ảnh mới (optional)
     * @returns {Promise} - Promise trả về sản phẩm đã cập nhật
     */
    async update(request, file) {
        const res = await api.put(
            "/stock/product/update",
            toMultipart(request, file),
            { headers: { "Content-Type": "multipart/form-data" } }
        );
        return res.data;
    },

    /**
     * Xóa sản phẩm
     * @param {string} id - ID của sản phẩm cần xóa
     * @returns {Promise} - Promise trả về kết quả xóa
     */
    async remove(id) {
        await api.delete(`/stock/category/deleteCategoryById/${id}`);
    },

    /**
     * Lấy thông tin sản phẩm theo ID
     * @param {string} id - ID của sản phẩm
     * @returns {Promise} - Promise trả về thông tin sản phẩm
     */
    async getById(id) {
        const res = await api.get(`/stock/product/getProductById/${id}`);
        return res.data;
    },

    /**
     * Tìm kiếm sản phẩm
     * @param {string} keyword - Từ khóa tìm kiếm
     * @param {number} pageNo - Số trang (mặc định: 1)
     * @returns {Promise} - Promise trả về kết quả tìm kiếm
     */
    async search(keyword, pageNo = 1) {
        const res = await api.get("/stock/product/search", { params: { keyword, pageNo } });
        return res.data;
    }
};

export default productAdminApi;
