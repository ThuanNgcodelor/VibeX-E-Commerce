import createApiInstance from "./createApiInstance.js";

// Use relative URL - Vite proxy (dev) / Nginx (prod) handles routing
const API_URL = "/v1/notifications/live";
const api = createApiInstance(API_URL);

// ==================== ROOM MANAGEMENT ====================

/**
 * Tạo phòng live mới
 * @param {Object} data - { title, description, thumbnailUrl }
 * @returns {Promise<Object>} - LiveRoom với streamKey
 */
export const createLiveRoom = async (data) => {
    try {
        const response = await api.post('/rooms', data);
        return response.data;
    } catch (error) {
        console.error('Error creating live room:', error);
        throw error;
    }
};

/**
 * Lấy danh sách phòng đang live (public)
 * @param {number} page - Số trang
 * @param {number} size - Số phần tử mỗi trang
 * @returns {Promise<Object>} - Page<LiveRoomDto>
 */
export const getLiveRooms = async (page = 0, size = 10) => {
    try {
        const response = await api.get(`/rooms?page=${page}&size=${size}`);
        return response.data;
    } catch (error) {
        console.error('Error getting live rooms:', error);
        throw error;
    }
};

/**
 * Lấy chi tiết phòng live (public)
 * @param {string} roomId - ID của phòng
 * @returns {Promise<Object>} - LiveRoomDto
 */
export const getLiveRoom = async (roomId) => {
    try {
        const response = await api.get(`/rooms/${roomId}`);
        return response.data;
    } catch (error) {
        console.error('Error getting live room:', error);
        throw error;
    }
};

/**
 * Lấy chi tiết phòng live với stream key (chỉ shop owner)
 * @param {string} roomId - ID của phòng
 * @returns {Promise<Object>} - LiveRoomDto với streamKey
 */
export const getLiveRoomDetails = async (roomId) => {
    try {
        const response = await api.get(`/rooms/${roomId}/details`);
        return response.data;
    } catch (error) {
        console.error('Error getting live room details:', error);
        throw error;
    }
};

/**
 * Lấy danh sách phòng của shop owner
 * @param {number} page - Số trang
 * @param {number} size - Số phần tử mỗi trang
 * @returns {Promise<Object>} - Page<LiveRoomDto>
 */
export const getMyLiveRooms = async (page = 0, size = 10) => {
    try {
        const response = await api.get(`/my-rooms?page=${page}&size=${size}`);
        return response.data;
    } catch (error) {
        console.error('Error getting my live rooms:', error);
        throw error;
    }
};

/**
 * Bắt đầu live
 * @param {string} roomId - ID của phòng
 * @returns {Promise<Object>} - LiveRoomDto
 */
export const startLive = async (roomId) => {
    try {
        const response = await api.put(`/rooms/${roomId}/start`);
        return response.data;
    } catch (error) {
        console.error('Error starting live:', error);
        throw error;
    }
};

/**
 * Kết thúc live
 * @param {string} roomId - ID của phòng
 * @returns {Promise<Object>} - LiveRoomDto
 */
export const endLive = async (roomId) => {
    try {
        const response = await api.put(`/rooms/${roomId}/end`);
        return response.data;
    } catch (error) {
        console.error('Error ending live:', error);
        throw error;
    }
};

// ==================== PRODUCT MANAGEMENT ====================

/**
 * Thêm sản phẩm vào live room
 * @param {string} roomId - ID của phòng
 * @param {Object} data - { productId, livePrice, quantityLimit, displayOrder }
 * @returns {Promise<Object>} - LiveProductDto
 */
export const addProductToLive = async (roomId, data) => {
    try {
        const response = await api.post(`/rooms/${roomId}/products`, data);
        return response.data;
    } catch (error) {
        console.error('Error adding product to live:', error);
        throw error;
    }
};

/**
 * Lấy danh sách sản phẩm trong live room
 * @param {string} roomId - ID của phòng
 * @returns {Promise<Array>} - List<LiveProductDto>
 */
export const getLiveProducts = async (roomId) => {
    try {
        const response = await api.get(`/rooms/${roomId}/products`);
        return response.data;
    } catch (error) {
        console.error('Error getting live products:', error);
        throw error;
    }
};

/**
 * Highlight sản phẩm
 * @param {string} roomId - ID của phòng
 * @param {string} productId - ID của sản phẩm
 * @returns {Promise<Object>} - LiveProductDto
 */
export const featureProduct = async (roomId, productId) => {
    try {
        const response = await api.put(`/rooms/${roomId}/products/${productId}/feature`);
        return response.data;
    } catch (error) {
        console.error('Error featuring product:', error);
        throw error;
    }
};

/**
 * Xóa sản phẩm khỏi live room
 * @param {string} roomId - ID của phòng
 * @param {string} productId - ID của sản phẩm
 * @returns {Promise<void>}
 */
export const removeProductFromLive = async (roomId, productId) => {
    try {
        await api.delete(`/rooms/${roomId}/products/${productId}`);
    } catch (error) {
        console.error('Error removing product from live:', error);
        throw error;
    }
};

// ==================== CHAT ====================

/**
 * Lấy tin nhắn gần đây
 * @param {string} roomId - ID của phòng
 * @returns {Promise<Array>} - List<LiveChatDto>
 */
export const getRecentChats = async (roomId) => {
    try {
        const response = await api.get(`/rooms/${roomId}/chat`);
        return response.data;
    } catch (error) {
        console.error('Error getting recent chats:', error);
        throw error;
    }
};

/**
 * Gửi tin nhắn chat (REST fallback)
 * @param {string} roomId - ID của phòng
 * @param {string} message - Nội dung tin nhắn
 * @returns {Promise<Object>} - LiveChatDto
 */
export const sendChatMessage = async (roomId, message) => {
    try {
        const response = await api.post(`/rooms/${roomId}/chat`, { message });
        return response.data;
    } catch (error) {
        console.error('Error sending chat message:', error);
        throw error;
    }
};

// ==================== WEBSOCKET URL ====================

/**
 * Lấy WebSocket URL cho live room
 * @returns {string} - WebSocket URL (dynamic based on current location)
 */
export const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws/live`;
};

/**
 * Lấy HLS stream URL
 * @param {string} streamKey - Stream key của phòng
 * @returns {string} - HLS URL (use nginx-rtmp service)
 */
export const getStreamUrl = (streamKey) => {
    // In production (Docker), use relative URL so it goes through Nginx proxy (my-app:80 -> nginx-rtmp:8080)
    // This works for localhost, LAN, and Ngrok (standard ports 80/443)
    const lanIp = import.meta.env.VITE_LAN_IP;
    const isHttps = window.location.protocol === 'https:';

    // Only use LAN IP if we are NOT on HTTPS, or if we want to risk Mixed Content (not recommended)
    // If on HTTPS (Ngrok), we MUST use the proxy to avoid Mixed Content block
    if (lanIp && !isHttps) {
        // Direct LAN access for HLS (bypassing Nginx proxy for performance is better on LAN)
        return `http://${lanIp}:8088/hls/${streamKey}.m3u8`;
    }

    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // Don't append port 8088, let Nginx proxy handle /hls route
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${protocol}//${hostname}${port}/hls/${streamKey}.m3u8`;
};

// ==================== LIVE CART (stock-service) ====================

const stockApi = createApiInstance('/v1/stock/cart');

/**
 * Thêm sản phẩm từ Live vào giỏ hàng với giá live
 * @param {Object} data - { productId, sizeId, quantity, liveRoomId, liveProductId, livePrice, originalPrice }
 * @returns {Promise<Object>} - RedisCartItemDto
 */
export const addLiveItemToCart = async (data) => {
    try {
        const response = await stockApi.post('/item/add-live', data);
        return response.data;
    } catch (error) {
        console.error('Error adding live item to cart:', error);
        throw error;
    }
};
