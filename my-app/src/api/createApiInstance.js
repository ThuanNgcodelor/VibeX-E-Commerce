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
    ];

    api.interceptors.response.use(
        (response) => response,
        (error) => {
            const status = error?.response?.status;
            if (status === 401) {
                const reqUrl = error?.config?.url || "";
                const currentPath = window.location.pathname;
                // Check if URL matches any public endpoint pattern
                // reqUrl can be relative (e.g., "/shop-owners/123") or full path
                const isPublicEndpoint = PUBLIC_401_ALLOWLIST.some((p) => {
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
                if (isPublicEndpoint || onAuthPage || onPublicPage) {
                    // Nếu có token invalid ở trang public, xóa token nhưng không redirect
                    if (hasToken && !isPublicEndpoint) {
                        Cookies.remove("accessToken");
                    }
                    return Promise.reject(error);
                }

                // Chỉ redirect khi KHÔNG ở trang public và có token (token invalid/expired)
                if (hasToken) {
                    Cookies.remove("accessToken");
                    const current = window.location.pathname + window.location.search;
                    window.location.href = `/login?from=${encodeURIComponent(current)}`;
                    return;
                }
                
                // Guest không có token ở trang không public → chỉ reject error, không redirect
                return Promise.reject(error);
            }
            return Promise.reject(error);
        }
    );

    return api;
};

export default createApiInstance;