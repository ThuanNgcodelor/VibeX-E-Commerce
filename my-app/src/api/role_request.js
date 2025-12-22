import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1/user/role-requests";
const api = createApiInstance(API_URL);

/**
 * Lấy danh sách các yêu cầu role đang chờ duyệt (Admin only)
 * @returns {Promise<Array>} - Promise trả về danh sách yêu cầu
 */
export const getPendingRequests = async () => {
    try {
        const response = await api.get("/pending");
        return response.data;
    } catch {
        throw new Error("Failed to fetch pending requests");
    }
};

/**
 * Duyệt yêu cầu role (Admin only)
 * @param {string} id - ID của yêu cầu
 * @param {string} adminNote - Ghi chú của admin (mặc định: '')
 * @returns {Promise} - Promise trả về kết quả duyệt
 */
export async function approveRequest(id, adminNote = '') {
    try {
        const response = await api.post(`/${id}/approve`, null, {
            params: { adminNote }
        });
        return response.data;
    } catch {
        throw new Error("Failed to approve request");
    }
}

/**
 * Từ chối yêu cầu role (Admin only)
 * @param {string} id - ID của yêu cầu
 * @param {string} rejectionReason - Lý do từ chối
 * @returns {Promise} - Promise trả về kết quả từ chối
 */
export async function rejectRequest(id, rejectionReason) {
    try {
        const response = await api.post(`/${id}/reject`, null, {
            params: { rejectionReason }
        });
        return response.data;
    } catch {
        throw new Error("Failed to reject request");
    }
}

/**
 * Lấy thông tin yêu cầu role theo ID
 * @param {string} id - ID của yêu cầu
 * @returns {Promise} - Promise trả về thông tin yêu cầu
 */
export const getRoleRequestById = async (id) => {
    try {
        const response = await api.get(`/${id}`);
        return response.data;
    } catch {
        throw new Error("Failed to fetch role request");
    }
};

/**
 * Tạo shop owner mới với đầy đủ thông tin (shop, tax, identification)
 * @param {Object} registrationData - Dữ liệu đăng ký shop owner
 * @param {Object} registrationData.roleRequest - Thông tin yêu cầu role
 * @param {Object} registrationData.shopDetails - Thông tin shop
 * @param {Object} registrationData.taxInfo - Thông tin thuế
 * @param {Object} registrationData.identification - Thông tin định danh
 * @returns {Promise} - Promise trả về kết quả tạo shop owner
 */
const createShopOwner = async (registrationData, imageFront, imageBack) => {
    try {
        const formData = new FormData();

        // Append JSON data as separate fields
        formData.append('roleRequest', JSON.stringify(registrationData.roleRequest));
        formData.append('shopDetails', JSON.stringify(registrationData.shopDetails));
        formData.append('identification', JSON.stringify(registrationData.identification));
        formData.append('taxInfo', JSON.stringify(registrationData.taxInfo));

        // Append image files
        if (imageFront) formData.append('imageFront', imageFront);
        if (imageBack) formData.append('imageBack', imageBack);

        const response = await api.post("/createShopOwner", formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.error("Create shop owner error:", error);
        throw error;
    }
};
export default createShopOwner
