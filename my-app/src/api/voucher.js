import createApiInstance from "./createApiInstance.js";

const api = createApiInstance();

/**
 * Validate voucher và tính discount
 * @param {string} code - Mã voucher
 * @param {string} shopOwnerId - ID shop owner
 * @param {number} orderAmount - Tổng giá trị đơn hàng
 */
export const validateVoucher = async (code, shopOwnerId, orderAmount) => {
  const response = await api.get("/v1/order/vouchers/validate", {
    params: { code, shopOwnerId, orderAmount }
  });
  return response.data;
};

/**
 * Lấy danh sách voucher của shop
 * @param {string} shopOwnerId - ID shop owner
 */
export const getShopVouchers = async (shopOwnerId) => {
  const response = await api.get(`/v1/order/vouchers/shop/${shopOwnerId}`);
  return response.data;
};

/**
 * Lấy voucher theo code
 * @param {string} code - Mã voucher
 * @param {string} shopOwnerId - ID shop owner
 */
export const getVoucherByCode = async (code, shopOwnerId) => {
  const response = await api.get("/v1/order/vouchers/by-code", {
    params: { code, shopOwnerId }
  });
  return response.data;
};

export default {
  validateVoucher,
  getShopVouchers,
  getVoucherByCode
};


// --- Shop Owner Management APIs ---

/**
 * Tạo voucher mới
 * @param {Object} data
 */
export const createShopVoucher = async (data) => {
  return api.post("/v1/order/shop-vouchers", data);
};

/**
 * Lấy tất cả voucher của shop
 * @param {string} shopId
 */
export const getAllShopVouchers = async (shopId) => {
  return api.get(`/v1/order/shop-vouchers/shops/${shopId}`);
};

/**
 * Cập nhật voucher
 * @param {string} voucherId
 * @param {Object} data
 */
export const updateShopVoucher = async (voucherId, data) => {
  return api.put(`/v1/order/shop-vouchers/${voucherId}`, data);
};

/**
 * Xóa voucher
 * @param {string} voucherId
 */
export const deleteShopVoucher = async (voucherId) => {
  return api.delete(`/v1/order/shop-vouchers/${voucherId}`);
};

// Admin
const adminVoucherApi = {
  /**
   * Get all platform vouchers (Admin only)
   * @returns {Promise} - Promise returning list of all platform vouchers
   */
  getAll: () => api.get(`/v1/order/admin/platform-vouchers/getAll`).then(r => r.data),

  /**
   * Get platform voucher by ID (Admin only)
   * @param {string} id - Voucher ID
   * @returns {Promise} - Promise returning voucher details
   */
  getById: (id) => api.get(`/v1/order/admin/platform-vouchers/getById/${id}`).then(r => r.data),

  /**
   * Create new platform voucher (Admin only)
   * @param {Object} data - Voucher data
   * @returns {Promise} - Promise returning created voucher
   */
  create: (data) => api.post(`/v1/order/admin/platform-vouchers/create`, data).then(r => r.data),

  /**
   * Update existing platform voucher (Admin only)
   * @param {Object} data - Voucher update data (must include id)
   * @returns {Promise} - Promise returning updated voucher
   */
  update: (data) => api.put(`/v1/order/admin/platform-vouchers/update`, data).then(r => r.data),

  /**
   * Delete platform voucher (Admin only)
   * @param {string} id - Voucher ID to delete
   * @returns {Promise} - Promise returning delete result
   */
  remove: (id) => api.delete(`/v1/order/admin/platform-vouchers/delete/${id}`)
};

  // Named export for admin APIs
export { adminVoucherApi };