import axios from "axios";
import Cookies from "js-cookie";

const createApiInstance = (baseURL) => {
    const api = axios.create({
        baseURL,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    api.interceptors.request.use(
        (config) => {
            // Danh sách các endpoint auth public - không cần token
            const publicAuthEndpoints = [
                '/login',
                '/register',
                '/forgotPassword',
                '/verifyOtp',
                '/updatePassword',
                '/login/google',
                '/refresh', // Refresh endpoint
                '/order/track/',
            ];

            // Tạo full URL để kiểm tra
            const fullUrl = (baseURL || '') + (config.url || '');

            const isPublicAuthEndpoint = publicAuthEndpoints.some(endpoint =>
                fullUrl.includes(endpoint) || config.url?.includes(endpoint)
            );

            // Chỉ thêm token nếu không phải là public auth endpoint
            if (!isPublicAuthEndpoint) {
                const token = Cookies.get("accessToken");
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            }

            if (config.data instanceof FormData) {
                delete config.headers['Content-Type'];
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    const PUBLIC_401_ALLOWLIST = [
        "/user/vets/getAllVet",
        "/user/vets/search",
        "/stock/product/list",
        "/stock/product/getProductById", // Public - allow guest to view product details
        "/stock/category/getAll",
        "/file-storage/get",
        "/shop-owners/", // Public - allow guest to view shop owner info
        "/order/track/",
        "/stock/search/query", // Public - allow guest to search products
        "/stock/search/autocomplete", // Public - allow guest to use autocomplete
        "/auth/forgotPassword"
    ];

    api.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;
            const status = error?.response?.status;

            // Nếu lỗi 401 và không phải là request refresh
            if (status === 401 && !originalRequest._retry && !originalRequest.url.includes('/refresh')) {
                if (isPublicEndpoint(originalRequest.url)) {
                    return Promise.reject(error);
                }

                originalRequest._retry = true;

                try {
                    // Import dynamically to avoid circular dependency issues during initialization
                    const authModule = await import('./auth.js');
                    const newToken = await authModule.refreshAccessToken();

                    if (newToken) {
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;
                        return api(originalRequest);
                    }
                } catch (refreshError) {
                    // Refresh failed - logout user
                    const authModule = await import('./auth.js');
                    authModule.logout();
                    return Promise.reject(refreshError);
                }
            }

            if (status === 401) {
                const reqUrl = error?.config?.url || "";
                const currentPath = window.location.pathname;
                // Check if URL matches any public endpoint pattern
                // reqUrl can be relative (e.g., "/shop-owners/123") or full path
                const isPublicEndpointMatch = PUBLIC_401_ALLOWLIST.some((p) => {
                    // Remove leading slash for comparison
                    const pattern = p.replace(/^\//, '');
                    const urlPath = reqUrl.replace(/^\//, '');
                    return urlPath.includes(pattern) || reqUrl.includes(p);
                });
                // Thêm các trang auth/forgot password vào danh sách để không redirect
                const onAuthPage = ["/login", "/register", "/auth", "/forgot", "/verify-otp", "/reset-password"].some((p) => currentPath.startsWith(p));
                // Thêm các trang public (home, shop list, product detail) vào danh sách để không redirect
                const onPublicPage = currentPath === "/" || currentPath.startsWith("/shop") || currentPath.startsWith("/product/");

                // Kiểm tra xem có token trong cookie không
                const hasToken = Cookies.get("accessToken");

                // Nếu là public endpoint hoặc đang ở trang auth/public → chỉ reject, không redirect
                // QUAN TRỌNG: Không redirect khi ở trang public, kể cả khi có token invalid
                if (isPublicEndpointMatch || onAuthPage || onPublicPage) {
                    // Nếu có token invalid ở trang public, xóa token nhưng không redirect
                    if (hasToken && !isPublicEndpointMatch) {
                        Cookies.remove("accessToken");
                    }
                    return Promise.reject(error);
                }

                // If refresh token failed or other 401 issues, redirect to login
                // But wait, the refresh logic above handles the main 401 case.
                // This block is fallback or for public endpoints.
            }
            return Promise.reject(error);
        }
    );

    function isPublicEndpoint(url) {
        return PUBLIC_401_ALLOWLIST.some((p) => url.includes(p));
    }

    return api;
};

export default createApiInstance;