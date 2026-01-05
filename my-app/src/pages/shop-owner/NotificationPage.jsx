import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getNotificationsByShopId,
  markNotificationAsRead,
  deleteNotification,
  deleteAllShopNotifications,
  markAllShopNotificationsAsRead
} from '../../api/notification';
import useWebSocketNotification from '../../hooks/useWebSocketNotification.js';
import { getUser } from '../../api/user.js';
import '../../components/shop-owner/ShopOwnerLayout.css';
import './ShopNotification.css'; // Import the new CSS file

// Format notification from API to frontend format
const formatNotification = (notification, t) => {
  const now = new Date();
  const createdAt = new Date(notification.creationTimestamp);
  const diffMs = now - createdAt;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeAgo = '';
  let timeClass = '';

  if (diffMins < 1) {
    timeAgo = t('shopOwner.notifications.justNow');
    timeClass = 'recent';
  } else if (diffMins < 60) {
    timeAgo = diffMins === 1
      ? t('shopOwner.notifications.minuteAgo', { count: diffMins })
      : t('shopOwner.notifications.minutesAgo', { count: diffMins });
    timeClass = 'recent';
  } else if (diffHours < 24) {
    timeAgo = diffHours === 1
      ? t('shopOwner.notifications.hourAgo', { count: diffHours })
      : t('shopOwner.notifications.hoursAgo', { count: diffHours });
    timeClass = diffHours < 3 ? 'recent' : '';
  } else {
    timeAgo = diffDays === 1
      ? t('shopOwner.notifications.dayAgo', { count: diffDays })
      : t('shopOwner.notifications.daysAgo', { count: diffDays });
  }

  let type = 'order';
  let icon = 'fa-shopping-cart';
  let color = 'primary';
  let title = t('shopOwner.notifications.newOrder');

  if (notification.message) {
    const msg = notification.message.toLowerCase();
    if (msg.includes('new order') || msg.includes('đơn hàng mới')) {
      type = 'order';
      icon = 'fa-shopping-cart';
      color = 'primary'; // Blue
      title = t('shopOwner.notifications.newOrder');
    } else if (msg.includes('paid') || msg.includes('thanh toán')) {
      type = 'order';
      icon = 'fa-check-circle';
      color = 'success'; // Green
      title = t('shopOwner.notifications.orderPaid');
    } else if (msg.includes('shipped') || msg.includes('vận chuyển')) {
      type = 'order';
      icon = 'fa-truck';
      color = 'info'; // Cyan
      title = t('shopOwner.notifications.orderShipped');
    } else if (msg.includes('cancelled') || msg.includes('cancel') || msg.includes('hủy')) {
      type = 'order';
      icon = 'fa-times-circle';
      color = 'danger'; // Red
      title = t('shopOwner.notifications.orderCancelled');
    } else if (msg.includes('review') || msg.includes('rating') || msg.includes('đánh giá')) {
      type = 'review';
      icon = 'fa-star';
      color = 'warning'; // Yellow
      title = t('shopOwner.notifications.newReview');
    } else if (msg.includes('out of stock') || msg.includes('hết hàng') || msg.includes('sắp hết hàng')) {
      type = 'product';
      icon = 'fa-exclamation-triangle';
      color = 'warning';
      title = msg.includes('sắp hết hàng') || msg.includes('low stock')
        ? t('shopOwner.notifications.lowStockAlert')
        : t('shopOwner.notifications.outOfStock');
    } else if (msg.includes('added') || msg.includes('thêm')) {
      type = 'product';
      icon = 'fa-plus-circle';
      color = 'success';
      title = t('shopOwner.notifications.productAdded');
    } else {
      type = 'system';
      icon = 'fa-bell';
      color = 'secondary'; // Grey
      title = t('shopOwner.notifications.systemNotification');
    }
  }

  return {
    id: notification.id,
    type,
    title,
    message: notification.message,
    time: timeAgo,
    timeClass,
    isRead: notification.isRead,
    icon,
    color, // maps to bootstrap colors: primary, success, danger, warning, info, secondary
    orderId: notification.orderId
  };
};

export default function NotificationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, unread, order, product, system
  const [searchQuery, setSearchQuery] = useState('');
  const [shopId, setShopId] = useState(null);

  // WebSocket for real-time notifications (shop owner)
  const { notifications: wsNotifications, connected: wsConnected } = useWebSocketNotification(shopId, true);

  // Fetch initial notifications from API
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get user info to get shopId
        const user = await getUser();
        if (user && user.id) {
          setShopId(user.id);
        }

        // Backend automatically extracts userId from JWT token and queries by shopId
        const data = await getNotificationsByShopId();
        const formattedNotifications = Array.isArray(data)
          ? data.map(n => formatNotification(n, t))
          : [];
        setNotifications(formattedNotifications);
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setError(err.message || t('shopOwner.notifications.errorLoading'));
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [t]);

  // Merge WebSocket real-time notifications with API notifications
  useEffect(() => {
    if (wsNotifications && wsNotifications.length > 0) {
      // Format WebSocket notifications
      const formattedWsNotifications = wsNotifications.map(n => formatNotification(n, t));

      // Merge with existing notifications, avoiding duplicates
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const newNotifications = formattedWsNotifications.filter(n => !existingIds.has(n.id));
        return [...newNotifications, ...prev];
      });

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    }
  }, [wsNotifications, t]);

  // Handle notification update events from WebSocket (mark as read, delete, etc.)
  useEffect(() => {
    const handleNotificationUpdate = (event) => {
      const updateEvent = event.detail;

      switch (updateEvent.updateType) {
        case 'MARKED_AS_READ':
          // Update notification to read
          setNotifications(prev =>
            prev.map(n =>
              n.id === updateEvent.notificationId
                ? { ...n, isRead: true }
                : n
            )
          );
          break;

        case 'DELETED':
          // Remove notification from list
          setNotifications(prev =>
            prev.filter(n => n.id !== updateEvent.notificationId)
          );
          break;

        case 'MARKED_ALL_AS_READ':
          // Mark all as read
          setNotifications(prev =>
            prev.map(n => ({ ...n, isRead: true }))
          );
          break;

        case 'DELETED_ALL':
          // Clear all notifications
          setNotifications([]);
          break;

        default:
          break;
      }

      // Refresh notification count in header
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    };

    window.addEventListener('notificationUpdate', handleNotificationUpdate);

    return () => {
      window.removeEventListener('notificationUpdate', handleNotificationUpdate);
    };
  }, []);

  // Refresh notifications after actions
  const refreshNotifications = async () => {
    try {
      // Backend automatically extracts userId from JWT token and queries by shopId
      const data = await getNotificationsByShopId();
      const formattedNotifications = Array.isArray(data)
        ? data.map(n => formatNotification(n, t))
        : [];
      setNotifications(formattedNotifications);
    } catch (err) {
      console.error('Error refreshing notifications:', err);
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    const matchesFilter = filter === 'all'
      ? true
      : filter === 'unread'
        ? !notification.isRead
        : notification.type === filter;

    const matchesSearch = notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.message.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = async (e, notification) => {
    const { id, orderId } = notification;
    e.stopPropagation(); // Prevent triggering row click if clicking specific button
    try {
      await markNotificationAsRead(id);
      // Update will be handled via WebSocket update event, but we can optimistically update
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));

      // If notification has orderId, navigate to order page
      if (orderId) {
        handleViewOrder(orderId);
      } else if (notification.type === 'product' && notification.message.toLowerCase().includes('sắp hết hàng')) {
        // Navigate to Inventory for low stock
        navigate('/shop-owner/inventory');
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
      // alert(t('shopOwner.notifications.markReadFailed'));
      // Refresh on error to sync state
      await refreshNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllShopNotificationsAsRead();
      // Update will be handled via WebSocket update event, but we can optimistically update
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: t('shopOwner.notifications.markAllReadFailed')
      });
      // Refresh on error to sync state
      await refreshNotifications();
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();

    const result = await Swal.fire({
      title: t('shopOwner.notifications.deleteConfirmTitle', 'Xóa thông báo?'),
      text: t('shopOwner.notifications.deleteConfirm'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: t('common.delete', 'Xóa'),
      cancelButtonText: t('common.cancel', 'Hủy')
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await deleteNotification(id);
      // Update will be handled via WebSocket update event, but we can optimistically update
      setNotifications(prev => prev.filter(n => n.id !== id));
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));

      Swal.fire({
        icon: 'success',
        title: t('common.deleted', 'Đã xóa'),
        showConfirmButton: false,
        timer: 1000
      });
    } catch (err) {
      console.error('Error deleting notification:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: t('shopOwner.notifications.deleteFailed')
      });
      // Refresh on error to sync state
      await refreshNotifications();
    }
  };

  const handleDeleteAll = async () => {
    const result = await Swal.fire({
      title: t('shopOwner.notifications.deleteAllConfirmTitle', 'Xóa tất cả?'),
      text: t('shopOwner.notifications.deleteAllConfirm'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: t('common.deleteAll', 'Xóa hết'),
      cancelButtonText: t('common.cancel', 'Hủy')
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      await deleteAllShopNotifications();
      // Update will be handled via WebSocket update event, but we can optimistically update
      setNotifications([]);
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));

      Swal.fire({
        icon: 'success',
        title: t('common.deletedAll', 'Đã xóa tất cả'),
        showConfirmButton: false,
        timer: 1000
      });
    } catch (err) {
      console.error('Error deleting all notifications:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: t('shopOwner.notifications.deleteAllFailed')
      });
      // Refresh on error to sync state
      await refreshNotifications();
    }
  };

  const handleViewOrder = (orderId) => {
    if (orderId) {
      navigate(`/shop-owner/orders/bulk-shipping?orderId=${orderId}`);
    }
  };

  if (loading) {
    return (
      <div className="shop-notification-page">
        <div className="loading-state">
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">{t('common.loading')}</span>
          </div>
          <p className="mt-3 text-muted">{t('shopOwner.notifications.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shop-notification-page">
        <div className="error-state">
          <i className="fas fa-exclamation-circle error-icon"></i>
          <h5 className="text-danger">{t('shopOwner.notifications.errorLoading')}</h5>
          <p className="text-muted">{error}</p>
          <button className="btn-retry" onClick={() => window.location.reload()}>
            {t('shopOwner.notifications.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-notification-page">
      {/* Header */}
      <div className="notification-header-section">
        <div className="notification-title-wrapper">
          <h1>{t('shopOwner.notifications.title')}</h1>
          <div className="notification-badges">
            {unreadCount > 0 ? (
              <span className="badge-unread-count">
                {unreadCount === 1
                  ? t('shopOwner.notifications.unreadCount', { count: unreadCount })
                  : t('shopOwner.notifications.unreadCountPlural', { count: unreadCount })
                }
              </span>
            ) : (
              <span className="text-muted text-sm">{t('shopOwner.notifications.allRead')}</span>
            )}

            {wsConnected ? (
              <span className="badge-status connected">
                <i className="fas fa-wifi"></i> {t('shopOwner.notifications.realtime')}
              </span>
            ) : (
              <span className="badge-status disconnected">
                <i className="fas fa-wifi-slash"></i> {t('shopOwner.notifications.offline')}
              </span>
            )}
          </div>
        </div>

        <div className="notification-actions">
          {unreadCount > 0 && (
            <button className="btn-mark-all" onClick={handleMarkAllAsRead}>
              <i className="fas fa-check-double"></i>
              <span>{t('shopOwner.notifications.markAllAsRead')}</span>
            </button>
          )}
          {notifications.length > 0 && (
            <button className="btn-delete-all" onClick={handleDeleteAll}>
              <i className="fas fa-trash-alt"></i>
              <span>{t('shopOwner.notifications.deleteAll')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="notification-filters-card">
        <div className="filter-row">
          <div className="search-wrapper">
            <i className="fas fa-search search-icon"></i>
            <input
              type="text"
              className="search-input"
              placeholder={t('shopOwner.notifications.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="filter-buttons">
            {[
              { id: 'all', label: t('shopOwner.notifications.all') },
              { id: 'unread', label: t('shopOwner.notifications.unread') },
              { id: 'order', label: t('shopOwner.notifications.orders') },
              { id: 'product', label: t('shopOwner.notifications.products') },
              { id: 'system', label: t('shopOwner.notifications.system') }
            ].map(filterBtn => (
              <button
                key={filterBtn.id}
                className={`filter-btn ${filter === filterBtn.id ? 'active' : 'inactive'}`}
                onClick={() => setFilter(filterBtn.id)}
              >
                {filterBtn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="notification-list-card">
        {filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-bell-slash empty-icon"></i>
            <h5 className="empty-title">{t('shopOwner.notifications.noNotifications')}</h5>
            <p className="empty-desc">{t('shopOwner.notifications.noNotificationsDesc')}</p>
          </div>
        ) : (
          <ul className="notification-list">
            {filteredNotifications.map(notification => (
              <li
                key={notification.id}
                className={`notification-item ${notification.isRead ? '' : 'unread'}`}
                onClick={(e) => handleMarkAsRead(e, notification)}
              >
                <div className={`notification-icon-box bg-${notification.color}`}>
                  <i className={`fas ${notification.icon}`}></i>
                </div>

                <div className="notification-content">
                  <div className="notification-header">
                    <h6 className="notification-title">{notification.title}</h6>
                    <span className={`notification-time ${notification.timeClass}`}>
                      {notification.time}
                    </span>
                  </div>

                  <p className="notification-message">{notification.message}</p>

                  <div className="notification-actions-hover">
                    {notification.orderId && (
                      <button
                        className="btn-view-order"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewOrder(notification.orderId);
                        }}
                      >
                        {t('shopOwner.notifications.viewOrder')}
                      </button>
                    )}
                  </div>

                  {!notification.isRead && <div className="unread-dot"></div>}
                </div>

                <button
                  className="btn-item-action"
                  title={t('shopOwner.notifications.delete')}
                  onClick={(e) => handleDelete(e, notification.id)}
                >
                  <i className="fas fa-times"></i>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
