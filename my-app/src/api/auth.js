import Cookies from "js-cookie";
import createApiInstance from "./createApiInstance.js";

const API_URL = "/v1/auth";
const api = createApiInstance(API_URL);

/**
 * Gửi yêu cầu quên mật khẩu
 * @param {string} email - Email của người dùng
 * @returns {Promise} - Promise trả về kết quả gửi email
 */
export const forgotPassword = (email) =>
    api.post("/forgotPassword", { email });

/**
 * Xác thực OTP
 * @param {string} email - Email của người dùng
 * @param {string} otp - Mã OTP
 * @returns {Promise} - Promise trả về kết quả xác thực
 */
export const verifyOtp = (email, otp) =>
    api.post("/verifyOtp", { email, otp });

/**
 * Cập nhật mật khẩu mới
 * @param {string} email - Email của người dùng
 * @param {string} newPassword - Mật khẩu mới
 * @returns {Promise} - Promise trả về kết quả cập nhật
 */
export const updatePassword = (email, newPassword) =>
    api.post("/updatePassword", { email, newPassword });

/**
 * Đăng nhập
 * @param {Object} data - Dữ liệu đăng nhập { email/username, password }
 * @returns {Promise} - Promise trả về thông tin người dùng và token
 */
export const login = async (data) => {
    const response = await api.post("/login", data);
    const { token, refreshToken } = response.data;

    // Lưu accessToken
    Cookies.set("accessToken", token, {
        expires: 1, // 1 ngày
        path: '/',
        sameSite: 'lax',
        secure: window.location.protocol === 'https:'
    });

    // Lưu refreshToken nếu có
    if (refreshToken) {
        Cookies.set("refreshToken", refreshToken, {
            expires: 7, // 7 ngày
            path: '/',
            sameSite: 'lax',
            secure: window.location.protocol === 'https:'
        });
    }

    return response.data;
};

/**
 * Đăng nhập bằng Facebook
 * @param {string} token - Facebook OAuth Code
 * @returns {Promise} - Promise trả về thông tin người dùng và token
 */
export const facebookLogin = async (token) => {
    const response = await api.post("/login/facebook", { code: token });
    const { token: accessToken, refreshToken } = response.data;

    // Lưu accessToken
    Cookies.set("accessToken", accessToken, {
        expires: 1, // 1 ngày
        path: '/',
        sameSite: 'lax',
        secure: window.location.protocol === 'https:'
    });

    // Lưu refreshToken nếu có
    if (refreshToken) {
        Cookies.set("refreshToken", refreshToken, {
            expires: 7, // 7 ngày
            path: '/',
            sameSite: 'lax',
            secure: window.location.protocol === 'https:'
        });
    }

    return response.data;
};

/**
 * Đăng nhập bằng Google
 * @param {string} token - Google OAuth Code
 * @returns {Promise} - Promise trả về thông tin người dùng và token
 */
export const googleLogin = async (token) => {
    const response = await api.post("/login/google", { code: token });
    const { token: accessToken, refreshToken } = response.data;

    // Lưu accessToken
    Cookies.set("accessToken", accessToken, {
        expires: 1, // 1 ngày
        path: '/',
        sameSite: 'lax',
        secure: window.location.protocol === 'https:'
    });

    // Lưu refreshToken nếu có
    if (refreshToken) {
        Cookies.set("refreshToken", refreshToken, {
            expires: 7, // 7 ngày
            path: '/',
            sameSite: 'lax',
            secure: window.location.protocol === 'https:'
        });
    }

    return response.data;
};

/**
 * Đăng ký tài khoản mới
 * @param {Object} data - Dữ liệu đăng ký
 * @returns {Promise} - Promise trả về thông tin tài khoản đã tạo
 */
export const register = async (data) => {
    const response = await api.post("/register", data);
    return response.data;
};

/**
 * Lấy token từ cookie
 * @returns {string|null} - Token hoặc null nếu không có
 */
export const getToken = () => {
    return Cookies.get("accessToken") || null;
};

/**
 * Lấy refresh token từ cookie
 * @returns {string|null}
 */
export const getRefreshToken = () => {
    return Cookies.get("refreshToken") || null;
};

/**
 * Đăng xuất (xóa token)
 */
export const logout = () => {
    Cookies.remove("accessToken");
    Cookies.remove("refreshToken");
};

/**
 * Logic Refresh Token
 */
let isRefreshing = false;
let refreshPromise = null;

export const refreshAccessToken = async () => {
    if (isRefreshing && refreshPromise) {
        return refreshPromise;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        throw new Error("No refresh token available");
    }

    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            const response = await api.post("/refresh", { refreshToken });
            const { token, refreshToken: newRefreshToken } = response.data;

            if (!token) {
                throw new Error("No access token in refresh response");
            }

            // Cập nhật accessToken
            Cookies.set("accessToken", token, {
                expires: 1,
                path: '/',
                sameSite: 'lax',
                secure: window.location.protocol === 'https:'
            });

            // Cập nhật refreshToken nếu có mới
            if (newRefreshToken) {
                Cookies.set("refreshToken", newRefreshToken, {
                    expires: 7,
                    path: '/',
                    sameSite: 'lax',
                    secure: window.location.protocol === 'https:'
                });
            }
            return token;
        } catch (error) {
            logout();
            throw error;
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

/**
 * Lấy danh sách role từ token
 * @returns {string[]} - Mảng các role của người dùng
 */
export const getUserRole = () => {
    const token = getToken();
    if (!token) return [];

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));

        let roles = [];
        if (Array.isArray(payload.roles)) {
            roles = payload.roles;
        } else if (Array.isArray(payload.authorities)) {
            roles = payload.authorities;
        } else if (payload.role) {
            roles = [payload.role];
        }

        const normalized = [...new Set(
            roles
                .filter(Boolean)
                .map(String)
                .map(r => r.startsWith('ROLE_') ? r : `ROLE_${r.toUpperCase()}`)
        )];

        return normalized;
    } catch {
        return [];
    }
};

/**
 * Lấy primary role từ token và map sang format frontend
 * ROLE_ADMIN -> Admin
 * ROLE_SHOP_OWNER -> ShopOwner
 * ROLE_USER -> User
 */
export const getPrimaryRole = () => {
    const roles = getUserRole();
    if (roles.length === 0) return null;

    // Ưu tiên ADMIN
    if (roles.some(r => r === 'ROLE_ADMIN' || r.includes('ADMIN'))) {
        return 'Admin';
    }

    // Cuối cùng là USER
    if (roles.some(r => r === 'ROLE_USER' || r.includes('USER'))) {
        return 'User';
    }

    // Fallback
    return roles[0].replace('ROLE_', '');
};

/**
 * Kiểm tra người dùng đã đăng nhập chưa
 * @returns {boolean} - True nếu đã đăng nhập
 */
export const isAuthenticated = () => {
    return !!getToken();
};
