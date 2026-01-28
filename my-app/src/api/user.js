import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1/user";
const api = createApiInstance(API_URL);

/**
 * Lấy danh sách tất cả người dùng (Admin only)
 * @returns {Promise<Array>} - Promise trả về danh sách người dùng
 */
export const getAllUser = async (params) => {
    try {
        const response = await api.get("/getAll", { params });
        return response.data;
    } catch {
        throw new Error("Failed to fetch users");
    }
};



/**
 * Lấy danh sách đơn hàng của người dùng hiện tại
 * @returns {Promise<Array>} - Promise trả về danh sách đơn hàng
 */
export const getOrdersByUser = async () => {
    try {
        const response = await api.get("/order/getOrderByUserId");
        return response.data;
    } catch {
        throw new Error("Failed to fetch orders");
    }
};

/**
 * Xóa người dùng theo ID (Admin only) - DEPRECATED
 * @param {string} id - ID của người dùng cần xóa
 * @returns {Promise} - Promise trả về kết quả xóa
 */
// export async function deleteUserById(id) {
//     const { data } = await api.delete(`/deleteUserById/${id}`);
//     return data;
// }

/**
 * Toggle active status của user (Lock/Unlock account)
 * @param {string} id - ID của user
 * @returns {Promise} - Promise trả về user đã cập nhật
 */
export async function toggleUserActive(id) {
    const { data } = await api.put(`/toggleActive/${id}`);
    return data;
}

/**
 * Lấy thông tin giỏ hàng của người dùng hiện tại
 * @returns {Promise} - Promise trả về thông tin giỏ hàng
 */
export const getCart = async () => {
    try {
        const response = await api.get("/cart");
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Lấy thông tin người dùng hiện tại
 * @returns {Promise} - Promise trả về thông tin người dùng
 */
export const getUser = async () => {
    try {
        const response = await api.get("/information");
        return response.data;
    } catch (error) {
        throw error;
    }
};

/**
 * Kiểm tra email đã tồn tại chưa
 * @param {string} email - Email cần kiểm tra
 * @returns {Promise<boolean>} - Promise trả về true nếu email đã tồn tại
 */
export const checkEmailExists = async (email) => {
    const res = await api.get(`/getUserByEmail/${encodeURIComponent(email)}`, {
        validateStatus: (s) => s === 200 || s === 404,
    });
    return res.status === 200;
};

/**
 * Lấy thông tin người dùng theo ID
 * @param {string} userId - ID của người dùng
 * @returns {Promise} - Promise trả về thông tin người dùng
 */
export const getUserById = async (userId) => {
    try {
        const response = await api.get(`/getUserById/${userId}`);
        return response.data;
    } catch {
        throw new Error("Failed to fetch user");
    }
};

/**
 * Cập nhật thông tin người dùng
 * @param {Object} data - Dữ liệu người dùng cần cập nhật
 * @param {File} file - File ảnh avatar (optional)
 * @returns {Promise} - Promise trả về thông tin người dùng đã cập nhật
 */
export const updateUser = async (data, file) => {
    const requestData = {
        id: data.id,
        email: data.email,
        username: data.username,
        userDetails: {
            firstName: data.userDetails?.firstName ?? data.firstName ?? "",
            lastName: data.userDetails?.lastName ?? data.lastName ?? "",
            phoneNumber: data.userDetails?.phoneNumber ?? data.phoneNumber ?? "",
            gender: data.userDetails?.gender ?? data.gender ?? null,
            birthDate: data.userDetails?.birthDate ?? data.birthDate ?? null
        }
    };
    if (data.password && String(data.password).trim()) {
        requestData.password = String(data.password).trim();
    }
    const fd = new FormData();
    fd.append(
        "request",
        new Blob([JSON.stringify(requestData)], { type: "application/json" }),
        "request.json"
    );

    if (file) fd.append("file", file);

    const response = await api.put("/update", fd, {
        transformRequest: [(payload, headers) => {
            delete headers.common?.["Content-Type"];
            delete headers.post?.["Content-Type"];
            delete headers.put?.["Content-Type"];
            delete headers["Content-Type"];
            return payload;
        }],
    });
    return response.data;
};


/**
 * Lấy thông tin shop owner hiện tại
 * @returns {Promise} - Promise trả về thông tin shop owner
 */
export const getShopOwnerInfo = async () => {
    try {
        const response = await api.get("/shop-owners/info");
        return response.data;
    } catch {
        throw new Error("Failed to fetch shop owner information");
    }
};

/**
 * Lấy thông tin shop owner theo user ID
 * @param {string} userId - ID của người dùng
 * @returns {Promise} - Promise trả về thông tin shop owner
 */
export const getShopOwnerByUserId = async (userId) => {
    try {
        const response = await api.get(`/shop-owners/${encodeURIComponent(userId)}`);
        return response.data;
    } catch {
        throw new Error("Failed to fetch shop owner");
    }
};

/**
 * Cập nhật thông tin shop owner
 * @param {Object} data - Dữ liệu shop owner cần cập nhật
 * @param {File} file - File ảnh logo shop (optional)
 * @param {File} headerImage - File ảnh bìa shop (optional)
 * @returns {Promise} - Promise trả về thông tin shop owner đã cập nhật
 */
export const updateShopOwner = async (data, file, headerImage) => {
    try {
        const requestData = {
            shopName: data.shopName,
            ownerName: data.ownerName,
            email: data.email,
            address: data.address,
            phone: data.phone,
            provinceId: data.provinceId,
            provinceName: data.provinceName,
            districtId: data.districtId,
            districtName: data.districtName,
            wardCode: data.wardCode,
            wardName: data.wardName,
            streetAddress: data.streetAddress, // Ensure comma here
            headerStyle: data.headerStyle
        };

        const fd = new FormData();
        fd.append(
            "request",
            new Blob([JSON.stringify(requestData)], { type: "application/json" }),
            "request.json"
        );

        if (file) fd.append("file", file);
        if (headerImage) fd.append("headerImage", headerImage);

        const response = await api.put("/shop-owners/update", fd, {
            transformRequest: [(payload, headers) => {
                delete headers.common?.["Content-Type"];
                delete headers.put?.["Content-Type"];
                delete headers["Content-Type"];
                return payload;
            }],
        });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to update shop owner");
    }
};

/**
 * Cập nhật địa chỉ
 * @param {Object} data - Dữ liệu địa chỉ cần cập nhật
 * @returns {Promise} - Promise trả về địa chỉ đã cập nhật
 */
export const updateAddress = async (data) => {
    try {
        const response = await api.put("/address/update", data);
        return response.data;
    } catch {
        throw new Error("Failed to update address");
    }
};

/**
 * Tạo địa chỉ mới
 * @param {Object} data - Dữ liệu địa chỉ cần tạo
 * @returns {Promise} - Promise trả về địa chỉ đã tạo
 */
export const createAddress = async (data) => {
    try {
        const response = await api.post("/address/save", data);
        return response.data;
    } catch {
        throw new Error("Failed to create address");
    }
};

/**
 * Lấy tất cả địa chỉ của người dùng hiện tại
 * @returns {Promise<Array>} - Promise trả về danh sách địa chỉ
 */
export const getAllAddress = async () => {
    try {
        const response = await api.get("/address/getAllAddresses");
        return response.data;
    } catch {
        throw new Error("Failed to fetch address");
    }
};

/**
 * Xóa địa chỉ
 * @param {string} id - ID của địa chỉ cần xóa
 * @returns {Promise<boolean>} - Promise trả về true nếu xóa thành công
 */
export const deleteAddress = async (id) => {
    try {
        const response = await api.delete(`/address/deleteAddressById/${id}`);
        return response.data;
    } catch {
        return false;
    }
};

/**
 * Lấy thông tin địa chỉ theo ID
 * @param {string} id - ID của địa chỉ
 * @returns {Promise} - Promise trả về thông tin địa chỉ
 */
export const getAddressId = async (id) => {
    try {
        const response = await api.get(`/address/getAddressById/${id}`);
        return response.data;
    } catch {
        throw new Error("Failed to fetch address");
    }
};

/**
 * Đặt địa chỉ làm mặc định
 * @param {string} id - ID của địa chỉ
 * @returns {Promise} - Promise trả về kết quả cập nhật
 */
export const setDefaultAddress = async (id) => {
    try {
        const response = await api.put(`/address/setDefaultAddress/${id}`);
        return response.data;
    } catch {
        throw new Error("Failed to set default address");
    }
};

/**
 * Tạo yêu cầu role mới
 * @param {Object} data - Dữ liệu yêu cầu role
 * @returns {Promise} - Promise trả về yêu cầu đã tạo
 */
export const createRoleRequest = async (data) => {
    try {
        const response = await api.post("/role-requests", data);
        return response.data;
    } catch {
        throw new Error("Failed to create role request");
    }
};

/**
 * Tạo shop owner và gửi role request (tự động tạo role request PENDING)
 * @param {Object} data - Dữ liệu đăng ký shop owner đầy đủ
 * @param {Object} data.roleRequest - { role: "SHOP_OWNER", reason: "..." }
 * @param {Object} data.shopDetails - { shopName, ownerName, phone, provinceId, provinceName, districtId, districtName, wardCode, wardName, streetAddress, latitude?, longitude? }
 * @returns {Promise} - Promise trả về kết quả đăng ký
 */
export const createShopOwnerRegistration = async (data) => {
    try {
        const response = await api.post("/role-requests/createShopOwner", data);
        return response.data;
    } catch (error) {
        const errorMessage = error.response?.data?.message || error.message || "Failed to create shop owner registration";
        throw new Error(errorMessage);
    }
};

/**
 * Lấy danh sách yêu cầu role của người dùng hiện tại
 * @returns {Promise<Array>} - Promise trả về danh sách yêu cầu role
 */
export const getUserRoleRequests = async () => {
    try {
        const response = await api.get("/role-requests/user");
        return response.data;
    } catch {
        throw new Error("Failed to fetch user role requests");
    }
};

/**
 * Tạo địa chỉ mặc định cho testing (Debug)
 * @returns {Promise} - Promise trả về kết quả tạo
 */
export const createDefaultAddressForTest = async () => {
    try {
        const response = await api.post('/location/debug/create-default-address');
        return response.data;
    } catch {
        throw new Error("Failed to create default address");
    }
};

/**
 * Kiểm tra người dùng có địa chỉ mặc định chưa
 * @returns {Promise<boolean>} - Promise trả về true nếu có địa chỉ mặc định
 */
export const checkDefaultAddress = async () => {
    try {
        const response = await api.get('/location/check-default-address');
        return response.data;
    } catch {
        throw new Error("Failed to check default address");
    }
};
/**
 * Follow a shop
 * @param {string} shopId
 */
export const followShop = async (shopId) => {
    return api.post(`/follow/${encodeURIComponent(shopId)}`, {});
};

/**
 * Unfollow a shop
 * @param {string} shopId
 */
export const unfollowShop = async (shopId) => {
    return api.delete(`/follow/${encodeURIComponent(shopId)}`);
};

/**
 * Get follower count for a shop
 * @param {string} shopId
 */
export const getFollowerCount = async (shopId) => {
    const res = await api.get(`/follow/${encodeURIComponent(shopId)}/count`);
    return res.data;
};

/**
 * Check if current user is following a shop
 * @param {string} shopId
 */
export const checkIsFollowing = async (shopId) => {
    const res = await api.get(`/follow/${encodeURIComponent(shopId)}/status`);
    return res.data;
};

/**
 * Get shop decoration config
 * @param {string} shopId
 */
export const getShopDecoration = async (shopId) => {
    try {
        const res = await api.get(`/shops/${encodeURIComponent(shopId)}/decoration`);
        return res.data;
    } catch {
        return null;
    }
};

/**
 * Get current shop decoration config
 */
export const getMyShopDecoration = async () => {
    try {
        const res = await api.get("/shops/decoration/me");
        return res.data;
    } catch {
        throw new Error("Failed to load decoration config");
    }
};

/**
 * Save shop decoration config
 * @param {Array} config
 */
export const saveShopDecoration = async (config) => {
    const response = await api.put("/shops/decoration/me", JSON.stringify(config), {
        headers: {
            "Content-Type": "application/json",
        },
    });
    return response.data;
};

/**
 * Upload shop decoration image
 * @param {File} file
 * @returns {Promise<string>} - Promise returns image URL
 */
export const uploadShopDecorationImage = async (file) => {
    const fd = new FormData();
    fd.append("file", file);

    const response = await api.post("/shops/decoration/upload", fd, {
        headers: {
            "Content-Type": "multipart/form-data",
        },
    });
    return response.data;
};

/**
 * Lấy số dư ví của người dùng
 * @returns {Promise} - Promise trả về thông tin ví (bao gồm balanceAvailable)
 */
export const getWalletBalance = async () => {
    try {
        const response = await api.get("/wallet/balance");
        return response.data;
    } catch {
        throw new Error("Failed to fetch wallet balance");
    }
};