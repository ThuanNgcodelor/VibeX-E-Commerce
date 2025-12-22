import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1/order";
const api = createApiInstance(API_URL);

/**
 * Lấy thông tin địa chỉ theo ID
 * @param {string} addressId - ID của địa chỉ
 * @returns {Promise} - Promise trả về thông tin địa chỉ
 */
export const getAddressById = async (addressId) => {
    try {
        const response = await api.get(`/addresses/${addressId}`);
        return response.data;
    } catch {
        throw new Error("Failed to fetch address");
    }
};

/**
 * Lấy danh sách đơn hàng của người dùng hiện tại
 * @returns {Promise<Array>} - Promise trả về danh sách đơn hàng
 */
export const getOrdersByUser = async () => {
    try {
        const response = await api.get("/getOrderByUserId");
        return response.data;
    } catch {
        throw new Error("Failed to fetch orders");
    }
};

/**
 * Tạo đơn hàng từ giỏ hàng
 * @param {Object} orderData - Dữ liệu đơn hàng
 * @returns {Promise} - Promise trả về đơn hàng đã tạo
 */
export const createOrder = async (orderData) => {
    try {
        const response = await api.post("/create-from-cart", orderData);
        return response.data;
    } catch (error) {
        const errorData = error.response?.data;
        if (errorData) {
            throw {
                type: errorData.error || 'ORDER_FAILED',
                message: errorData.message || 'Failed to create order',
                details: errorData.details || null
            };
        }
        
        throw {
            type: 'NETWORK_ERROR',
            message: 'Network error occurred. Please try again.',
            details: null
        };
    }
};

/**
 * Lấy danh sách đơn hàng của người dùng
 * @returns {Promise<Array>} - Promise trả về danh sách đơn hàng
 */
export const getUserOrders = async () => {
    try {
        const response = await api.get("/user-orders");
        return response.data;
    } catch  {
        throw new Error("Failed to fetch orders");
    }
};

/**
 * Lấy thông tin đơn hàng theo ID
 * @param {string} orderId - ID của đơn hàng
 * @returns {Promise} - Promise trả về thông tin đơn hàng
 */
export const getOrderById = async (orderId) => {
    try {
        const response = await api.get(`/${orderId}`);
        return response.data;
    } catch  {
        throw new Error("Failed to fetch order");
    }
};

/**
 * Lấy tất cả đơn hàng (Admin only)
 * @returns {Promise<Array>} - Promise trả về danh sách tất cả đơn hàng
 */
export const getAllOrders = async () => {
    try {
        const response = await api.get("/getAll");
        return response.data;
    } catch {
        throw new Error("Failed to fetch orders");
    }
};

/**
 * Cập nhật trạng thái đơn hàng thành PROCESSING
 * @param {string} id - ID của đơn hàng
 * @returns {Promise} - Promise trả về kết quả cập nhật
 */
export async function updateOrderStatus(id) {
    const { data } = await api.put(`update-status/${id}?status=PROCESSING`);
    return data;
}

/**
 * Hủy đơn hàng (User)
 * @param {string} orderId - ID của đơn hàng cần hủy
 * @returns {Promise} - Promise trả về kết quả hủy đơn hàng
 */
export const cancelOrder = async (orderId, reason = "") => {
    try {
        const response = await api.put(`/cancel/${orderId}`, { reason });
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to cancel order");
    }
};

/**
 * Lấy danh sách đơn hàng của shop owner (có phân trang)
 * @param {string|null} status - Lọc theo trạng thái (optional)
 * @param {number} pageNo - Số trang (mặc định: 1)
 * @param {number} pageSize - Số lượng đơn hàng mỗi trang (mặc định: 10)
 * @returns {Promise} - Promise trả về danh sách đơn hàng
 */
export const getShopOwnerOrders = async (status = null, pageNo = 1, pageSize = 10) => {
    try {
        const params = { pageNo, pageSize };
        if (status) {
            if (Array.isArray(status)) {
                params.status = status;
            } else {
                params.status = status;
            }
        }

        if (Array.isArray(status)) {
            params.status = status.join(',');
        }

        const response = await api.get("/shop-owner/orders", { params });
        return response.data;
    } catch {
        throw new Error("Failed to fetch shop owner orders");
    }
};

/**
 * Hoàn trả đơn hàng (Shop Owner/Admin)
 * @param {string} orderId - ID của đơn hàng
 * @param {string} reason - Lý do hoàn trả
 * @returns {Promise} - Promise trả về kết quả hoàn trả
 */
export const returnOrder = async (orderId, reason = "") => {
    try {
        const response = await api.post(`/return/${orderId}?reason=${encodeURIComponent(reason)}`);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to return order");
    }
};


/**
 * Lấy thông tin đơn hàng của shop owner theo ID
 * @param {string} orderId - ID của đơn hàng
 * @returns {Promise} - Promise trả về thông tin đơn hàng
 */
export const getShopOwnerOrderById = async (orderId) => {
    try {
        const response = await api.get(`/shop-owner/orders/${orderId}`);
        return response.data;
    } catch {
        throw new Error("Failed to fetch shop owner order");
    }
};

/**
 * Cập nhật trạng thái đơn hàng (Shop Owner)
 * @param {string} orderId - ID của đơn hàng
 * @param {string} status - Trạng thái mới
 * @returns {Promise} - Promise trả về kết quả cập nhật
 */
export const updateOrderStatusForShopOwner = async (orderId, status) => {
    try {
        const response = await api.put(`/shop-owner/orders/${orderId}/status?status=${encodeURIComponent(status)}`);
        return response.data;
    } catch {
        throw new Error("Failed to update order status");
    }
};

/**
 * Get shipping order by orderId
 * @param {string} orderId
 */
export const getShippingByOrderId = async (orderId) => {
    try {
        const response = await api.get(`/shipping/${orderId}`);
        return response.data;
    } catch {
        throw new Error("Failed to fetch shipping order");
    }
};


/**
 * Client confirms receipt -> COMPLETE
 * @param {string} orderId
 */
export const confirmReceipt = async (orderId) => {
    try {
        const response = await api.post(`/confirm/${orderId}`);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Failed to confirm receipt");
    }
};

/**
 * Tính phí vận chuyển trước khi checkout
 * @param {string} addressId - ID của địa chỉ giao hàng
 * @param {Array} selectedItems - Danh sách sản phẩm đã chọn
 * @returns {Promise<number|null>} - Promise trả về phí vận chuyển hoặc null nếu lỗi
 */
export const calculateShippingFee = async (addressId, selectedItems) => {
    try {
        const firstProductId = selectedItems.length > 0 ? (selectedItems[0].productId || selectedItems[0].id) : null;
        
        // Map selectedItems to format expected by backend
        const selectedItemsData = selectedItems.map(item => ({
            productId: item.productId || item.id,
            sizeId: item.sizeId,
            quantity: item.quantity || 0,
            unitPrice: item.unitPrice || item.price || 0
        }));
        
        const requestData = {
            addressId: addressId,
            selectedItems: selectedItemsData, // Send selectedItems to calculate weight from actual product sizes
            productId: firstProductId // For backward compatibility
        };
        
        const response = await api.post("/calculate-shipping-fee", requestData);
        return response.data;
    } catch  {
        return null;
    }
};

/**
 * Lấy dữ liệu phân tích bán hàng cho shop owner
 * @returns {Promise<Object>} - Promise trả về dữ liệu analytics
 */
export const getSalesAnalytics = async () => {
    try {
        const response = await api.get("/shop-owner/analytics");
        return response.data;
    } catch  {
        throw new Error("Failed to fetch sales analytics");
    }
};

export const getAllShopOwnerOrders = async (status = null) => {
    try {
        const params = status ? { status } : {};
        const response = await api.get("/shop-owner/orders/all", { params });
        return response.data;
    } catch {
        throw new Error("Failed to fetch all shop owner orders");
    }
};