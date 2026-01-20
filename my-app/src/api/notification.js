import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1/notifications";
const api = createApiInstance(API_URL);

/**
 * Lấy tất cả thông báo của người dùng hiện tại
 * @returns {Promise<Array>} - Promise trả về danh sách thông báo
 */
export const getNotificationsByUserId = async () => {
    try {
        const response = await api.get(`/getAllByUserId`);
        return response.data;
    } catch {
        throw new Error("Failed to fetch notifications");
    }
};

/**
 * Lấy tất cả thông báo của shop owner hiện tại
 * @returns {Promise<Array>} - Promise trả về danh sách thông báo của shop
 */
export const getNotificationsByShopId = async () => {
    try {
        const response = await api.get(`/getAllByShopId`);
        return response.data;
    } catch {
        throw new Error("Failed to fetch shop notifications");
    }
};

/**
 * Đánh dấu thông báo là đã đọc
 * @param {string} notificationId - ID của thông báo
 * @returns {Promise} - Promise trả về kết quả cập nhật
 */
export const markNotificationAsRead = async (notificationId) => {
    try {
        const response = await api.put(`/markAsRead/${notificationId}`);
        return response.data;
    } catch {
        throw new Error("Failed to mark notification as read");
    }
};

/**
 * Xóa một thông báo
 * @param {string} notificationId - ID của thông báo cần xóa
 * @returns {Promise} - Promise trả về kết quả xóa
 */
export const deleteNotification = async (notificationId) => {
    try {
        const response = await api.delete(`/delete/${notificationId}`);
        return response.data;
    } catch {
        throw new Error("Failed to delete notification");
    }
};

/**
 * Xóa tất cả thông báo của người dùng hiện tại
 * @returns {Promise} - Promise trả về kết quả xóa
 */
export const deleteAllNotifications = async () => {
    try {
        const response = await api.delete(`/deleteAllByUserId`);
        return response.data;
    } catch {
        throw new Error("Failed to delete all notifications");
    }
};

/**
 * Xóa tất cả thông báo của shop owner hiện tại
 * @returns {Promise} - Promise trả về kết quả xóa
 */
export const deleteAllShopNotifications = async () => {
    try {
        const response = await api.delete(`/deleteAllByShopId`);
        return response.data;
    } catch (error) {
        throw new Error("Failed to delete all shop notifications");
    }
};

/**
 * Đánh dấu tất cả thông báo của người dùng là đã đọc
 * @returns {Promise} - Promise trả về kết quả cập nhật
 */
export const markAllNotificationsAsRead = async () => {
    try {
        const response = await api.put(`/markAllAsReadByUserId`);
        return response.data;
    } catch (error) {
        throw new Error("Failed to mark all notifications as read");
    }
};

/**
 * Đánh dấu tất cả thông báo của shop owner là đã đọc
 * @returns {Promise} - Promise trả về kết quả cập nhật
 */
export const markAllShopNotificationsAsRead = async () => {
    try {
        const response = await api.put(`/markAllAsReadByShopId`);
        return response.data;
    } catch (error) {
        throw new Error("Failed to mark all shop notifications as read");
    }
};

// =============== NEW BROADCAST FUNCTIONS ===============

/**
 * Admin: Gửi thông báo đến tất cả users
 * @param {Object} data - { title, message, type, actionUrl }
 * @returns {Promise<Object>} - { success, sentCount, message }
 */
export const adminBroadcast = async (data) => {
    try {
        const response = await api.post(`/admin/broadcast`, data);
        return response.data;
    } catch (error) {
        throw new Error("Failed to send broadcast notification");
    }
};

/**
 * Shop Owner: Gửi thông báo đến tất cả followers
 * @param {Object} data - { title, message, type, actionUrl }
 * @returns {Promise<Object>} - { success, sentCount, message }
 */
export const shopNotifyFollowers = async (data) => {
    try {
        const response = await api.post(`/shop/notify-followers`, data);
        return response.data;
    } catch (error) {
        throw new Error("Failed to notify followers");
    }
};

