import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  getNotificationsByUserId,
  markNotificationAsRead,
  deleteNotification,
  deleteAllNotifications as deleteAllNotificationsAPI,
  markAllNotificationsAsRead
} from '../../../api/notification.js';
import { getUser } from '../../../api/user.js';
import useWebSocketNotification from '../../../hooks/useWebSocketNotification.js';

// Format time from timestamp
// Format time from timestamp
const formatTimeAgo = (timestamp, t, i18n) => {
  if (!timestamp) return t('notifications.unknown');

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('notifications.justNow');
    if (diffMins < 60) return diffMins === 1 ? t('notifications.minuteAgo', { count: diffMins }) : t('notifications.minutesAgo', { count: diffMins });
    if (diffHours < 24) return diffHours === 1 ? t('notifications.hourAgo', { count: diffHours }) : t('notifications.hoursAgo', { count: diffHours });
    if (diffDays < 7) return diffDays === 1 ? t('notifications.dayAgo', { count: diffDays }) : t('notifications.daysAgo', { count: diffDays });

    // Use the current language/locale
    const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
    return date.toLocaleDateString(locale);
  } catch {
    return t('notifications.unknown');
  }
};

// Format data from backend to UI format
const formatNotification = (notification, t, i18n) => {
  let type = 'system';
  let icon = 'fa-bell';
  let title = notification.title || t('notifications.systemNotification');

  // Determine Icon & Type based on notification type
  if (notification.orderId) {
    type = 'order';
    icon = 'fa-shopping-cart';
    title = t('notifications.orderTitle', { id: notification.orderId.substring(0, 8) });
  } else if (notification.type === 'SHOP_ANNOUNCEMENT') {
    type = 'shop';
    icon = 'fa-bullhorn';
  } else if (notification.type === 'SHOP_FLASH_SALE') {
    type = 'shop';
    icon = 'fa-bolt';
  } else if (notification.type === 'SHOP_NEW_PRODUCT') {
    type = 'shop';
    icon = 'fa-box-open';
  } else if (notification.type === 'SHOP_PROMOTION') {
    type = 'shop';
    icon = 'fa-ticket-alt';
  }

  // Use provided title if available, otherwise fallback
  if (notification.title) {
    title = notification.title;
  }

  return {
    id: notification.id,
    type, // 'order' | 'shop' | 'system'
    title,
    message: notification.message || t('notifications.orderUpdated'),
    time: formatTimeAgo(notification.creationTimestamp, t, i18n),
    isRead: notification.isRead || false,
    icon,
    color: 'primary',
    orderId: notification.orderId,
    actionUrl: notification.actionUrl,
    originalTimestamp: notification.creationTimestamp,
    rawType: notification.type
  };
};

export default function NotificationPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // all, unread, order
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    type: null, // 'single' | 'all'
    targetId: null,
    message: '',
    confirmButtonText: t('notifications.deleteButton'),
    cancelButtonText: t('notifications.cancelButton')
  });

  // WebSocket for real-time notifications
  const { notifications: wsNotifications, connected: wsConnected } = useWebSocketNotification(userId, false);

  // Fetch initial notifications from API
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError(null);
        const user = await getUser();
        if (!user || !user.id) {
          throw new Error('Unable to get user information');
        }

        setUserId(user.id);
        const data = await getNotificationsByUserId(user.id);
        // Only get notifications with orderId (orders)
        // Get all notifications, don't filter just by orderId
        const notificationsData = Array.isArray(data) ? data : [];
        const formattedNotifications = notificationsData.map(n => formatNotification(n, t, i18n));
        setNotifications(formattedNotifications);
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setError(err.message || 'Unable to load notifications');
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  // Merge WebSocket real-time notifications with API notifications
  useEffect(() => {
    if (wsNotifications && wsNotifications.length > 0) {
      // Format WebSocket notifications
      const formattedWsNotifications = wsNotifications
        .filter(n => n.orderId) // Only order notifications
        .map(n => formatNotification(n, t, i18n));

      // Merge with existing notifications, avoiding duplicates
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const newNotifications = formattedWsNotifications.filter(n => !existingIds.has(n.id));
        return [...newNotifications, ...prev];
      });

      // Dispatch event to notify Header component
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    }
  }, [wsNotifications]);

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
      const user = await getUser();
      if (user && user.id) {
        const data = await getNotificationsByUserId(user.id);
        // Get all notifications, don't filter just by orderId
        const notificationsData = Array.isArray(data) ? data : [];
        const formattedNotifications = notificationsData.map(n => formatNotification(n, t, i18n));
        setNotifications(formattedNotifications);
        // Dispatch event to notify Header to refresh
        window.dispatchEvent(new CustomEvent('notificationsUpdated'));
      }
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

  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      // Update will be handled via WebSocket update event, but we can optimistically update
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    } catch (err) {
      console.error('Error marking notification as read:', err);
      alert(t('notifications.failedToMarkRead'));
      // Refresh on error to sync state
      await refreshNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      // Update will be handled via WebSocket update event, but we can optimistically update
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    } catch (err) {
      console.error('Error marking all as read:', err);
      alert(t('notifications.failedToMarkAllRead'));
      // Refresh on error to sync state
      await refreshNotifications();
    }
  };

  const openConfirm = (type, targetId = null) => {
    const message = type === 'all'
      ? t('notifications.deleteAllConfirm')
      : t('notifications.deleteConfirm');
    const confirmText = type === 'all' ? t('notifications.deleteAllButton') : t('notifications.deleteButton');
    const cancelText = t('notifications.cancelButton');
    setConfirmModal({ open: true, type, targetId, message, confirmButtonText: confirmText, cancelButtonText: cancelText });
  };

  const closeConfirm = () => setConfirmModal({ open: false, type: null, targetId: null, message: '', confirmButtonText: t('notifications.deleteButton'), cancelButtonText: t('notifications.cancelButton') });

  const handleDelete = async (id) => {
    openConfirm('single', id);
  };

  const handleDeleteAll = () => {
    openConfirm('all');
  };

  const confirmAction = async () => {
    if (confirmModal.type === 'single' && confirmModal.targetId) {
      try {
        await deleteNotification(confirmModal.targetId);
        setNotifications(prev => prev.filter(n => n.id !== confirmModal.targetId));
        window.dispatchEvent(new CustomEvent('notificationsUpdated'));
      } catch (err) {
        console.error('Error deleting notification:', err);
        await refreshNotifications();
      } finally {
        closeConfirm();
      }
    } else if (confirmModal.type === 'all') {
      try {
        await deleteAllNotificationsAPI();
        setNotifications([]);
        window.dispatchEvent(new CustomEvent('notificationsUpdated'));
      } catch (err) {
        console.error('Error deleting all notifications:', err);
        await refreshNotifications();
      } finally {
        closeConfirm();
      }
    }
  };

  const handleViewOrder = (orderId) => {
    navigate(`/information/orders?orderId=${orderId}`);
  };

  const getTimeAgoColor = (time) => {
    if (time.includes('minute') || time.includes('hour') || time === t('notifications.justNow')) {
      return '#ee4d2d';
    }
    return '#6c757d';
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#ee4d2d', marginBottom: '16px' }}></i>
        <p>{t('notifications.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <i className="fas fa-exclamation-triangle fa-3x" style={{ color: '#ffc107', marginBottom: '16px' }}></i>
        <p style={{ color: '#666' }}>{error}</p>
        <button
          className="btn btn-primary mt-3"
          onClick={() => window.location.reload()}
        >
          {t('notifications.tryAgain')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        borderBottom: '2px solid #ee4d2d',
        paddingBottom: '16px'
      }}>
        <div>
          <div>
            <h2 style={{ margin: 0, color: '#333', fontWeight: 600 }}>
              {t('notifications.title')}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                {unreadCount === 1 ? t('notifications.unreadCount', { count: unreadCount }) : t('notifications.unreadCountPlural', { count: unreadCount })}
              </p>
              {wsConnected ? (
                <span style={{
                  fontSize: '10px',
                  color: '#28a745',
                  backgroundColor: '#d4edda',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 500
                }}>
                </span>
              ) : (
                <span style={{
                  fontSize: '10px',
                  color: '#dc3545',
                  backgroundColor: '#f8d7da',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 500
                }}>
                  {t('notifications.offline')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {unreadCount > 0 && (
            <button
              className="btn btn-sm"
              onClick={handleMarkAllAsRead}
              style={{ backgroundColor: '#ee4d2d', color: 'white', border: 'none' }}
            >
              <i className="fas fa-check-double me-1"></i>
              {t('notifications.markAllAsRead')}
            </button>
          )}
          {notifications.length > 0 && (
            <button
              className="btn btn-sm btn-outline-danger"
              onClick={handleDeleteAll}
            >
              <i className="fas fa-trash me-1"></i>
              {t('notifications.deleteAll')}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <button
          className="btn btn-sm"
          onClick={() => setFilter('all')}
          style={{
            backgroundColor: filter === 'all' ? '#ee4d2d' : 'white',
            color: filter === 'all' ? 'white' : '#ee4d2d',
            border: filter === 'all' ? 'none' : '1px solid #ee4d2d'
          }}
        >
          {t('notifications.all')} ({notifications.length})
        </button>
        <button
          className="btn btn-sm"
          onClick={() => setFilter('unread')}
          style={{
            backgroundColor: filter === 'unread' ? '#ee4d2d' : 'white',
            color: filter === 'unread' ? 'white' : '#ee4d2d',
            border: filter === 'unread' ? 'none' : '1px solid #ee4d2d'
          }}
        >
          {t('notifications.unread')} ({unreadCount})
        </button>
        <button
          className="btn btn-sm"
          onClick={() => setFilter('order')}
          style={{
            backgroundColor: filter === 'order' ? '#ee4d2d' : 'white',
            color: filter === 'order' ? 'white' : '#ee4d2d',
            border: filter === 'order' ? 'none' : '1px solid #ee4d2d'
          }}
        >
          <i className="fas fa-shopping-cart me-1"></i>
          {t('notifications.orders')} ({notifications.length})
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px' }}>
        <div className="input-group">
          <span className="input-group-text">
            <i className="fas fa-search"></i>
          </span>
          <input
            type="text"
            className="form-control"
            placeholder={t('notifications.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Notification List */}
      {filteredNotifications.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <i className="fas fa-bell-slash" style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }}></i>
          <p style={{ color: '#999', fontSize: '16px', margin: 0 }}>
            {t('notifications.noNotificationsFound')}
          </p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
          {filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={notification.isRead ? '' : 'unread'}
              style={{
                padding: '20px',
                borderBottom: '1px solid #eee',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: notification.isRead ? 'white' : '#f8f9ff',
                borderLeft: notification.isRead ? 'none' : '4px solid #ee4d2d'
              }}
              onClick={() => {
                handleMarkAsRead(notification.id);
                if (notification.actionUrl) {
                  navigate(notification.actionUrl);
                }
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: notification.isRead ? '#f0f0f0' : '#ffede8',
                  opacity: 1
                }}
              >
                <i
                  className={`fas ${notification.icon}`}
                  style={{ color: notification.isRead ? '#999' : '#ee4d2d', fontSize: '20px' }}
                ></i>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <h6 style={{ margin: 0, marginBottom: '4px', fontWeight: notification.isRead ? 500 : 600, color: notification.isRead ? '#333' : '#000' }}>
                      {notification.title}
                    </h6>
                    <p style={{ margin: 0, color: '#666', fontSize: '14px', lineHeight: '1.5', marginBottom: '8px' }}>
                      {notification.message}
                    </p>
                    <span style={{ fontSize: '12px', color: getTimeAgoColor(notification.time) }}>
                      {notification.time}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    {notification.type === 'order' && notification.orderId && (
                      <button
                        className="btn btn-sm"
                        style={{
                          fontSize: '12px',
                          backgroundColor: notification.isRead ? '#6c757d' : '#ee4d2d',
                          color: 'white',
                          border: 'none'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewOrder(notification.orderId);
                        }}
                      >
                        <i className="fas fa-eye me-1"></i> {t('notifications.viewOrder')}
                      </button>
                    )}
                    {notification.type === 'shop' && notification.actionUrl && (
                      <button
                        className="btn btn-sm"
                        style={{
                          fontSize: '12px',
                          backgroundColor: notification.isRead ? '#6c757d' : '#ee4d2d',
                          color: 'white',
                          border: 'none'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(notification.actionUrl);
                        }}
                      >
                        <i className="fas fa-external-link-alt me-1"></i> {t('common.view')}
                      </button>
                    )}
                    <button
                      className="btn btn-sm"
                      style={{
                        fontSize: '12px',
                        backgroundColor: 'transparent',
                        color: '#ee4d2d',
                        border: '1px solid #ee4d2d'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notification.id);
                      }}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 4,
              width: '100%',
              maxWidth: 420,
              padding: '20px 24px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.12)'
            }}
          >
            <p style={{ margin: '0 0 20px 0', fontSize: 16, color: '#333', textAlign: 'center' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={closeConfirm}
                style={{
                  minWidth: 100,
                  padding: '10px 16px',
                  border: '1px solid #ddd',
                  background: 'white',
                  color: '#555',
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {t('notifications.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmAction}
                style={{
                  minWidth: 100,
                  padding: '10px 16px',
                  border: 'none',
                  background: '#ee4d2d',
                  color: 'white',
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {t('notifications.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

