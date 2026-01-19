/**
 * React Hook để quản lý WebSocket connection cho hệ thống thông báo (notifications)
 * 
 * Hook này:
 * - Kết nối WebSocket qua Gateway để nhận thông báo real-time
 * - Tự động subscribe vào topic dựa trên user type (client hoặc shop owner)
 * - Quản lý state của notifications và connection status
 * - Tự động cleanup khi component unmount
 * 
 * @param {string} userId - ID của user hiện tại
 * @param {boolean} isShopOwner - true nếu user là shop owner, false nếu là client
 * @returns {Object} { notifications: Array, connected: boolean }
 */
import { useEffect, useRef, useState } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import Cookies from 'js-cookie';

const useWebSocketNotification = (userId, isShopOwner = false) => {
  // State để lưu danh sách notifications đã nhận
  const [notifications, setNotifications] = useState([]);

  // State để track trạng thái kết nối WebSocket
  const [connected, setConnected] = useState(false);

  // Ref để lưu STOMP client instance, dùng ref để không trigger re-render khi thay đổi
  const stompClientRef = useRef(null);

  /**
   * useEffect hook: Tự động kết nối WebSocket khi component mount hoặc userId/isShopOwner thay đổi
   * 
   * Flow:
   * 1. Kiểm tra userId có tồn tại không
   * 2. Xác định WebSocket URL dựa trên environment (dev/prod)
   * 3. Tạo SockJS socket và STOMP client
   * 4. Thêm JWT token vào headers để authenticate
   * 5. Khi connect thành công, subscribe vào các topics
   * 6. Cleanup khi component unmount
   */
  useEffect(() => {
    // Nếu không có userId, không làm gì cả
    if (!userId) {
      return;
    }

    /**
     * Xác định WebSocket URL dựa trên môi trường
     * 
     * Tại sao đi qua Gateway?
     * - Gateway (port 8080) là entry point duy nhất, xử lý routing và authentication
     * - Không kết nối trực tiếp tới notification-service để đảm bảo security
     * - Gateway sẽ forward request tới notification-service sau khi verify JWT
     * 
     * Development: http://localhost:8080/ws/notifications (Gateway local)
     * Production: https://domain.com/api/ws/notifications (qua reverse proxy)
     */
    const getWebSocketUrl = () => {
      // WebSocket path đi qua nginx proxy, nginx route /ws/** tới gateway
      // Gateway có route /ws/notifications/** -> notification-service
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const host = window.location.host;
      return `${protocol}//${host}/ws/notifications`;
    };

    // Lấy WebSocket URL
    const wsUrl = getWebSocketUrl();

    // Tạo SockJS socket - wrapper cho WebSocket, hỗ trợ fallback cho các browser cũ
    const socket = new SockJS(wsUrl);

    // Tạo STOMP client - protocol layer trên WebSocket để gửi/nhận messages
    const stompClient = new Client({
      webSocketFactory: () => socket,  // Factory function trả về socket
      reconnectDelay: 5000,              // Đợi 5s trước khi reconnect
      heartbeatIncoming: 4000,           // Nhận heartbeat mỗi 4s để biết connection còn sống
      heartbeatOutgoing: 4000,           // Gửi heartbeat mỗi 4s

      /**
       * Callback khi WebSocket kết nối thành công
       * Đây là nơi subscribe vào các topics để nhận messages
       */
      onConnect: () => {
        console.log('WebSocket connected via Gateway');
        setConnected(true);

        /**
         * Xác định topic dựa trên loại user
         * - Shop Owner: /topic/shop/{userId} - nhận thông báo của shop
         * - Client: /topic/user/{userId} - nhận thông báo của user
         * 
         * Backend sẽ gửi notification tới topic này khi có event mới
         */
        const destination = isShopOwner
          ? `/topic/shop/${userId}`
          : `/topic/user/${userId}`;

        /**
         * Subscribe vào topic để nhận notifications
         * Mỗi khi có notification mới, callback này sẽ được gọi
         */
        const subscription = stompClient.subscribe(destination, (message) => {
          try {
            // Parse JSON message từ server
            const notification = JSON.parse(message.body);
            console.log('Received real-time notification:', notification);

            /**
             * Cập nhật state: thêm notification mới vào đầu mảng
             * Kiểm tra duplicate để tránh thêm notification trùng lặp
             */
            setNotifications(prev => {
              // Kiểm tra xem notification đã tồn tại chưa (tránh duplicate)
              const exists = prev.some(n => n.id === notification.id);
              if (exists) {
                return prev; // Không thêm nếu đã có
              }
              // Thêm notification mới vào đầu mảng (mới nhất ở trên)
              return [notification, ...prev];
            });

            /**
             * Dispatch custom event để các component khác có thể lắng nghe
             * Ví dụ: Header component có thể update notification badge
             * Component khác có thể listen: window.addEventListener('realtimeNotification', ...)
             */
            window.dispatchEvent(new CustomEvent('realtimeNotification', {
              detail: notification
            }));

            /**
             * Hiển thị browser notification (nếu user đã cho phép)
             * Browser sẽ hiển thị popup notification ở góc màn hình
             */
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('New Notification', {
                body: notification.message,
                icon: '/favicon.ico'
              });
            }
          } catch (error) {
            console.error('Error parsing notification:', error);
          }
        });

        // Lưu subscription vào ref để có thể unsubscribe khi cleanup
        stompClientRef.current.subscription = subscription;

        /**
         * Subscribe vào topic updates để nhận các event update notification
         * Ví dụ: khi notification được đánh dấu là đã đọc, bị xóa, etc.
         * 
         * Topic: /topic/shop/{userId}/updates hoặc /topic/user/{userId}/updates
         */
        const updatesDestination = isShopOwner
          ? `/topic/shop/${userId}/updates`
          : `/topic/user/${userId}/updates`;

        const updatesSubscription = stompClient.subscribe(updatesDestination, (message) => {
          try {
            const updateEvent = JSON.parse(message.body);
            console.log('Received notification update event:', updateEvent);

            /**
             * Dispatch custom event để components có thể handle update
             * Ví dụ: Header có thể update số lượng unread notifications
             */
            window.dispatchEvent(new CustomEvent('notificationUpdate', {
              detail: updateEvent
            }));
          } catch (error) {
            console.error('Error parsing update event:', error);
          }
        });

        // Lưu updates subscription để cleanup
        stompClientRef.current.updatesSubscription = updatesSubscription;
      },
      /**
       * Callback khi có lỗi STOMP protocol
       * STOMP là messaging protocol trên WebSocket
       */
      onStompError: (frame) => {
        console.error('STOMP error:', frame);
        setConnected(false);
      },

      /**
       * Callback khi WebSocket bị disconnect
       * Có thể do network issue, server restart, etc.
       */
      onDisconnect: () => {
        console.log('WebSocket disconnected');
        setConnected(false);
      },

      /**
       * Callback khi có lỗi WebSocket connection
       * Khác với STOMP error, đây là lỗi ở tầng WebSocket
       */
      onWebSocketError: (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      }
    });

    /**
     * Thêm JWT token vào headers để authenticate
     * Gateway sẽ verify token này và forward request tới notification-service
     * Nếu không có token, connection sẽ bị reject
     */
    const token = Cookies.get('accessToken');
    if (token) {
      stompClient.connectHeaders = {
        Authorization: `Bearer ${token}`
      };
    } else {
      console.warn('No JWT token found in Cookies. WebSocket connection may fail authentication.');
    }

    // Kích hoạt STOMP client - bắt đầu kết nối WebSocket
    stompClient.activate();

    // Lưu client vào ref để có thể access từ cleanup function
    stompClientRef.current = stompClient;

    /**
     * Cleanup function: Chạy khi component unmount hoặc dependencies thay đổi
     * Quan trọng: Phải unsubscribe và disconnect để tránh memory leak
     */
    return () => {
      if (stompClientRef.current) {
        // Unsubscribe từ notification topic
        if (stompClientRef.current.subscription) {
          stompClientRef.current.subscription.unsubscribe();
        }
        // Unsubscribe từ updates topic
        if (stompClientRef.current.updatesSubscription) {
          stompClientRef.current.updatesSubscription.unsubscribe();
        }
        // Ngắt kết nối WebSocket
        stompClientRef.current.deactivate();
        stompClientRef.current = null;
      }
    };
  }, [userId, isShopOwner]); // Chạy lại effect khi userId hoặc isShopOwner thay đổi

  // Return state để component có thể sử dụng
  return { notifications, connected };
};

export default useWebSocketNotification;

