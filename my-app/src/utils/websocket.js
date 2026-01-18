/**
 * WebSocket Utility cho Chat System
 * 
 * File này cung cấp các functions để:
 * - Kết nối WebSocket qua Gateway (không kết nối trực tiếp tới notification-service)
 * - Subscribe vào các topics để nhận chat messages real-time
 * - Quản lý connection lifecycle (connect, disconnect, reconnect)
 * 
 * Khác với useWebSocketNotification.js:
 * - useWebSocketNotification: React Hook, quản lý notifications
 * - websocket.js: Utility functions, quản lý chat messages
 * 
 * Cả 2 đều đi qua Gateway để đảm bảo security và consistency
 */

import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import Cookies from 'js-cookie';

// Global variables để quản lý connection
let stompClient = null;              // STOMP client instance (singleton)
let reconnectAttempts = 0;            // Số lần đã thử reconnect
const MAX_RECONNECT_ATTEMPTS = 5;    // Số lần reconnect tối đa

/**
 * Lấy JWT token từ cookies
 * Token này được dùng để authenticate WebSocket connection
 * 
 * @returns {string} JWT token hoặc empty string nếu không tìm thấy
 */
const getToken = () => {
  if (typeof window !== 'undefined' && Cookies) {
    return Cookies.get('accessToken') || '';
  }
  return '';
};

/**
 * Xác định WebSocket URL dựa trên môi trường
 * 
 * Logic giống với useWebSocketNotification.js:
 * - Production: Đi qua reverse proxy (/api/ws/notifications)
 * - Development: Kết nối trực tiếp tới Gateway (localhost:8080)
 *
 * - Gateway xử lý authentication (verify JWT)
 * - Gateway route request tới đúng service (notification-service)
 * - Đảm bảo security và consistency
 * 
 * @returns {string} WebSocket URL
 */
const getWebSocketUrl = () => {
  if (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') {
    // Production: Sử dụng protocol và host hiện tại
    // Ví dụ: https://shopee-fake.id.vn/api/ws/notifications
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const host = window.location.host;
    // Frontend chạy ở root, nhưng API được proxy qua /api
    return `${protocol}//${host}/api/ws/notifications`;
  } else {
    // Development: Kết nối trực tiếp tới Gateway
    // Gateway chạy ở localhost:8080
    return 'http://localhost/ws/notifications';
  }
};

/**
 * Kết nối WebSocket để nhận chat messages real-time
 * 
 * Flow:
 * 1. Lấy JWT token từ cookies
 * 2. Xác định WebSocket URL (qua Gateway)
 * 3. Tạo SockJS socket và STOMP client
 * 4. Khi connect thành công, tự động subscribe vào conversation updates
 * 5. Return Promise với STOMP client
 * 
 * @param {Function} onMessage - Callback được gọi khi nhận message từ conversation updates topic
 * @param {Function} onError - Callback được gọi khi có lỗi
 * @param {string} userId - User ID để subscribe vào conversations topic
 * @returns {Promise<Client>} Promise resolve với STOMP client instance
 */
export const connectWebSocket = (onMessage, onError, userId = null) => {
  return new Promise((resolve, reject) => {
    try {
      // Lấy JWT token để authenticate
      const token = getToken();
      if (!token) {
        reject(new Error('No token found'));
        return;
      }

      // Xác định WebSocket URL (đi qua Gateway)
      const wsUrl = getWebSocketUrl();

      // Tạo SockJS socket - wrapper cho WebSocket
      const socket = new SockJS(wsUrl);

      // Tạo STOMP client với các config
      const client = new Client({
        webSocketFactory: () => socket,  // Factory function trả về socket
        reconnectDelay: 5000,              // Đợi 5s trước khi reconnect
        heartbeatIncoming: 4000,           // Nhận heartbeat mỗi 4s
        heartbeatOutgoing: 4000,           // Gửi heartbeat mỗi 4s
        connectHeaders: {
          Authorization: `Bearer ${token}` // JWT token trong headers
        },

        /**
         * Callback khi WebSocket kết nối thành công
         * Đây là nơi subscribe vào các topics
         */
        onConnect: (frame) => {
          console.log('WebSocket connected via Gateway:', frame);
          reconnectAttempts = 0;  // Reset reconnect counter
          stompClient = client;    // Lưu client vào global variable

          /**
           * Tự động subscribe vào topic conversation updates
           * Topic: /topic/user/{userId}/conversations
           * 
           * Khi có conversation mới hoặc conversation được update (new message, read status, etc.),
           * server sẽ gửi event tới topic này
           */
          const subscribeUserId = userId;
          if (subscribeUserId) {
            client.subscribe(`/topic/user/${subscribeUserId}/conversations`, (message) => {
              console.log('Received conversation update:', message.body);
              if (onMessage) {
                try {
                  // Parse JSON và gọi callback
                  onMessage(JSON.parse(message.body));
                } catch (error) {
                  console.error('Error parsing conversation update:', error);
                }
              }
            });
          }

          // Resolve promise với client instance
          resolve(client);
        },
        /**
         * Callback khi có lỗi STOMP protocol
         */
        onStompError: (frame) => {
          console.error('STOMP error:', frame);
          if (onError) onError(frame);
          reject(frame);
        },

        /**
         * Callback khi có lỗi WebSocket connection
         * Tự động thử reconnect nếu chưa vượt quá MAX_RECONNECT_ATTEMPTS
         */
        onWebSocketError: (error) => {
          console.error('WebSocket error:', error);
          if (onError) onError(error);
          handleReconnect(onMessage, onError);
        },

        /**
         * Callback khi WebSocket bị disconnect
         */
        onDisconnect: () => {
          console.log('WebSocket disconnected');
          stompClient = null;
        }
      });

      // Kích hoạt STOMP client - bắt đầu kết nối
      client.activate();
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      reject(error);
    }
  });
};

/**
 * Subscribe vào topic để nhận messages của một conversation cụ thể
 * 
 * Khi user mở một conversation, cần subscribe vào topic này để nhận messages real-time
 * Topic: /topic/conversation/{conversationId}/messages
 * 
 * Backend sẽ gửi message tới topic này khi:
 * - Có message mới trong conversation
 * - Message được update (read status, delivery status, etc.)
 * 
 * @param {string} conversationId - ID của conversation cần subscribe
 * @param {Function} callback - Callback được gọi khi nhận message mới
 * @returns {Object|null} Subscription object (để unsubscribe sau) hoặc null nếu không connect
 */
export const subscribeToConversation = (conversationId, callback) => {
  // Kiểm tra WebSocket đã connect chưa
  if (!stompClient || !stompClient.connected) {
    console.warn('WebSocket not connected. Cannot subscribe to conversation messages.');
    return null;
  }

  // Topic để nhận messages của conversation này
  const destination = `/topic/conversation/${conversationId}/messages`;

  // Subscribe vào topic
  const subscription = stompClient.subscribe(destination, (message) => {
    try {
      // Parse JSON message
      const data = JSON.parse(message.body);
      console.log(`Received message on ${destination}:`, data);

      // Gọi callback với message data
      callback(data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  console.log(`Subscribed to conversation messages for conversation: ${conversationId}`);

  // Return subscription để có thể unsubscribe sau
  return subscription;
};

/**
 * Subscribe vào topic để nhận updates về danh sách conversations
 * 
 * Topic này được dùng để nhận thông báo khi:
 * - Có conversation mới
 * - Conversation được update (new message, unread count, etc.)
 * 
 * Lưu ý: Function này có thể không cần thiết vì connectWebSocket đã tự động subscribe
 * vào topic này rồi. Nhưng giữ lại để có thể subscribe thêm callback khác nếu cần.
 * 
 * @param {string} userId - ID của user
 * @param {Function} callback - Callback được gọi khi nhận update
 * @returns {Object|null} Subscription object hoặc null nếu không connect
 */
export const subscribeToConversations = (userId, callback) => {
  if (!stompClient || !stompClient.connected) {
    console.error('WebSocket not connected');
    return null;
  }

  // Topic để nhận updates về conversations của user
  const destination = `/topic/user/${userId}/conversations`;

  const subscription = stompClient.subscribe(destination, (message) => {
    try {
      const data = JSON.parse(message.body);
      callback(data);
    } catch (error) {
      console.error('Error parsing conversation update:', error);
    }
  });

  console.log(`Subscribed to conversations for user: ${userId}`);
  return subscription;
};

/**
 * Ngắt kết nối WebSocket
 * 
 * Nên gọi function này khi:
 * - Component unmount
 * - User logout
 * - Không cần WebSocket connection nữa
 */
export const disconnectWebSocket = () => {
  if (stompClient && stompClient.connected) {
    stompClient.deactivate();  // Ngắt kết nối
    stompClient = null;         // Clear reference
  }
};

/**
 * Xử lý tự động reconnect khi WebSocket bị disconnect
 * 
 * Strategy:
 * - Thử reconnect tối đa MAX_RECONNECT_ATTEMPTS lần
 * - Mỗi lần thử, đợi lâu hơn (exponential backoff)
 * - Nếu vượt quá số lần thử, dừng lại và báo lỗi
 * 
 * @param {Function} onMessage - Callback cho messages
 * @param {Function} onError - Callback cho errors
 */
const handleReconnect = (onMessage, onError) => {
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(`Reconnecting... Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

    // Exponential backoff: đợi 5s, 10s, 15s, 20s, 25s
    setTimeout(() => {
      connectWebSocket(onMessage, onError).catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, 5000 * reconnectAttempts);
  } else {
    // Đã thử quá nhiều lần, dừng lại
    console.error('Max reconnection attempts reached');
    if (onError) onError(new Error('Max reconnection attempts reached'));
  }
};

/**
 * Kiểm tra WebSocket có đang connected không
 * 
 * @returns {boolean} true nếu connected, false nếu không
 */
export const isConnected = () => {
  return stompClient && stompClient.connected;
};

