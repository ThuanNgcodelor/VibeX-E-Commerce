import React, { useState, useEffect } from 'react';
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

// Format notification from API to frontend format
const formatNotification = (notification, t) => {
  const now = new Date();
  const createdAt = new Date(notification.creationTimestamp);
  const diffMs = now - createdAt;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let timeAgo = '';
  if (diffMins < 1) {
    timeAgo = t('shopOwner.notifications.justNow');
  } else if (diffMins < 60) {
    timeAgo = diffMins === 1 
      ? t('shopOwner.notifications.minuteAgo', { count: diffMins })
      : t('shopOwner.notifications.minutesAgo', { count: diffMins });
  } else if (diffHours < 24) {
    timeAgo = diffHours === 1
      ? t('shopOwner.notifications.hourAgo', { count: diffHours })
      : t('shopOwner.notifications.hoursAgo', { count: diffHours });
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
      color = 'primary';
      title = t('shopOwner.notifications.newOrder');
    } else if (msg.includes('paid') || msg.includes('thanh toán')) {
      type = 'order';
      icon = 'fa-check-circle';
      color = 'success';
      title = t('shopOwner.notifications.orderPaid');
    } else if (msg.includes('shipped') || msg.includes('vận chuyển')) {
      type = 'order';
      icon = 'fa-truck';
      color = 'info';
      title = t('shopOwner.notifications.orderShipped');
    } else if (msg.includes('cancelled') || msg.includes('cancel') || msg.includes('hủy')) {
      type = 'order';
      icon = 'fa-times-circle';
      color = 'danger';
      title = t('shopOwner.notifications.orderCancelled');
    } else if (msg.includes('review') || msg.includes('rating') || msg.includes('đánh giá')) {
      type = 'order';
      icon = 'fa-star';
      color = 'warning';
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
      color = 'secondary';
      title = t('shopOwner.notifications.systemNotification');
    }
  }

  return {
    id: notification.id,
    type,
    title,
    message: notification.message,
    time: timeAgo,
    isRead: notification.isRead,
    icon,
    color,
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
          setShopId(user.id); // For shop owner, userId is the same as shopId
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

  const handleMarkAsRead = async (id, orderId) => {
    try {
      await markNotificationAsRead(id);
      // Update will be handled via WebSocket update event, but we can optimistically update
      setNotifications(prev => prev.map(n => n.id === id ? {...n, isRead: true} : n));
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
      
      // If notification has orderId, navigate to order page
      if (orderId) {
        handleViewOrder(orderId);
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
      alert(t('shopOwner.notifications.markReadFailed'));
      // Refresh on error to sync state
      await refreshNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllShopNotificationsAsRead();
      // Update will be handled via WebSocket update event, but we can optimistically update
      setNotifications(prev => prev.map(n => ({...n, isRead: true})));
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      alert(t('shopOwner.notifications.markAllReadFailed'));
      // Refresh on error to sync state
      await refreshNotifications();
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      // Update will be handled via WebSocket update event, but we can optimistically update
      setNotifications(prev => prev.filter(n => n.id !== id));
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    } catch (err) {
      console.error('Error deleting notification:', err);
      alert(t('shopOwner.notifications.deleteFailed'));
      // Refresh on error to sync state
      await refreshNotifications();
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm(t('shopOwner.notifications.deleteConfirm'))) {
      return;
    }

    try {
      await deleteAllShopNotifications();
      // Update will be handled via WebSocket update event, but we can optimistically update
      setNotifications([]);
      window.dispatchEvent(new CustomEvent('notificationsUpdated'));
    } catch (err) {
      console.error('Error deleting all notifications:', err);
      alert(t('shopOwner.notifications.deleteAllFailed'));
      // Refresh on error to sync state
      await refreshNotifications();
    }
  };

  const handleViewOrder = (orderId) => {
    if (orderId) {
      navigate(`/shop-owner/orders/bulk-shipping?orderId=${orderId}`);
    }
  };

  const getTimeAgoColor = (time) => {
    if (time.includes('minute') || time.includes('hour') || time === 'Just now') {
      return '#ee4d2d';
    }
    return '#6c757d';
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div style={{textAlign: 'center', padding: '60px 20px'}}>
          <div className="spinner-border" role="status">
            <span className="sr-only">{t('common.loading')}</span>
          </div>
          <p style={{marginTop: '16px', color: '#666'}}>{t('shopOwner.notifications.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div style={{textAlign: 'center', padding: '60px 20px'}}>
          <i className="fas fa-exclamation-circle" style={{fontSize: '64px', color: '#dc3545', marginBottom: '16px', display: 'block'}}></i>
          <h5 style={{color: '#dc3545', marginBottom: '8px'}}>{t('shopOwner.notifications.errorLoading')}</h5>
          <p style={{color: '#666'}}>{error}</p>
          <button className="btn btn-primary-shop" onClick={() => window.location.reload()}>
            {t('shopOwner.notifications.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>
            <div>
              <h1>{t('shopOwner.notifications.title')}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <p className="text-muted" style={{ margin: 0 }}>
                  {unreadCount > 0 ? (
                    <span style={{color: '#ee4d2d', fontWeight: '600'}}>
                      {unreadCount === 1 
                        ? t('shopOwner.notifications.unreadCount', { count: unreadCount })
                        : t('shopOwner.notifications.unreadCountPlural', { count: unreadCount })
                      }
                    </span>
                  ) : (
                    t('shopOwner.notifications.allRead')
                  )}
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
                    ● {t('shopOwner.notifications.realtime')}
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
                    ● {t('shopOwner.notifications.offline')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div>
            {unreadCount > 0 && (
              <button 
                className="btn btn-primary-shop"
                onClick={handleMarkAllAsRead}
                style={{marginRight: '10px'}}
              >
                <i className="fas fa-check-double"></i> {t('shopOwner.notifications.markAllAsRead')}
              </button>
            )}
            {notifications.length > 0 && (
              <button 
                className="btn btn-outline-danger"
                onClick={handleDeleteAll}
              >
                <i className="fas fa-trash"></i> {t('shopOwner.notifications.deleteAll')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="card" style={{marginBottom: '20px'}}>
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder={t('shopOwner.notifications.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{width: '100%'}}
              />
            </div>
            <div className="col-md-6">
              <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                <button 
                  className={`btn ${filter === 'all' ? 'btn-primary-shop' : 'btn-outline-secondary'}`}
                  onClick={() => setFilter('all')}
                >
                  {t('shopOwner.notifications.all')} ({notifications.length})
                </button>
                <button 
                  className={`btn ${filter === 'unread' ? 'btn-primary-shop' : 'btn-outline-secondary'}`}
                  onClick={() => setFilter('unread')}
                >
                  {t('shopOwner.notifications.unread')} ({unreadCount})
                </button>
                <button 
                  className={`btn ${filter === 'order' ? 'btn-primary-shop' : 'btn-outline-secondary'}`}
                  onClick={() => setFilter('order')}
                >
                  {t('shopOwner.notifications.orders')}
                </button>
                <button 
                  className={`btn ${filter === 'product' ? 'btn-primary-shop' : 'btn-outline-secondary'}`}
                  onClick={() => setFilter('product')}
                >
                  {t('shopOwner.notifications.products')}
                </button>
                <button 
                  className={`btn ${filter === 'system' ? 'btn-primary-shop' : 'btn-outline-secondary'}`}
                  onClick={() => setFilter('system')}
                >
                  {t('shopOwner.notifications.system')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="card">
        <div className="card-body" style={{padding: 0}}>
          {filteredNotifications.length === 0 ? (
            <div style={{textAlign: 'center', padding: '60px 20px'}}>
              <i className="fas fa-bell-slash" style={{fontSize: '64px', color: '#ddd', marginBottom: '16px', display: 'block'}}></i>
              <h5 style={{color: '#666', marginBottom: '8px'}}>{t('shopOwner.notifications.noNotifications')}</h5>
              <p style={{color: '#999'}}>{t('shopOwner.notifications.noNotificationsDesc')}</p>
            </div>
          ) : (
            <div className="notification-list">
              {filteredNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.isRead ? '' : 'unread'}`}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: notification.isRead ? 'white' : '#f8f9ff'
                  }}
                  onClick={() => handleMarkAsRead(notification.id, notification.orderId)}
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
                      backgroundColor: `var(--bs-${notification.color})`,
                      opacity: notification.isRead ? 0.6 : 1
                    }}
                  >
                    <i 
                      className={`fas ${notification.icon}`} 
                      style={{color: 'white', fontSize: '20px'}}
                    ></i>
                  </div>

                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px'}}>
                      <h6 style={{margin: 0, fontWeight: notification.isRead ? 500 : 600, color: notification.isRead ? '#333' : '#000'}}>
                        {notification.title}
                      </h6>
                      <span style={{fontSize: '12px', color: getTimeAgoColor(notification.time)}}>
                        {notification.time}
                      </span>
                    </div>
                    <p style={{margin: 0, color: '#666', fontSize: '14px', lineHeight: '1.5'}}>
                      {notification.message}
                    </p>

                    {notification.type === 'order' && notification.orderId && (
                      <button 
                        className="btn btn-sm btn-outline-primary mt-2"
                        style={{fontSize: '12px'}}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewOrder(notification.orderId);
                        }}
                      >
                        <i className="fas fa-eye"></i> {t('shopOwner.notifications.viewOrder')}
                      </button>
                    )}
                  </div>

                  <div style={{display: 'flex', gap: '8px', flexShrink: 0}}>
                    {!notification.isRead && (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#ee4d2d',
                        marginTop: '8px'
                      }}></div>
                    )}
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notification.id);
                      }}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          .notification-item:hover {
            background: #f5f5f5 !important;
          }

          .notification-item.unread {
            border-left: 4px solid #ee4d2d;
          }

          .btn-outline-danger:hover {
            background-color: #dc3545;
            border-color: #dc3545;
          }
        `}
      </style>
    </div>
  );
}
