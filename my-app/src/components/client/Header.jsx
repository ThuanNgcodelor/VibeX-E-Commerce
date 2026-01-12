import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logoLight from "../../assets/images/logo.png";
import NavLink from "./NavLink";
import LanguageSwitcher from "../common/LanguageSwitcher";
import Cookies from "js-cookie";
import { useEffect, useState, useCallback, useRef } from "react";
import { useCart } from "../../contexts/CartContext.jsx";
import { getCart, getUser } from "../../api/user.js";
import { getUserRole, isAuthenticated, logout } from "../../api/auth.js";
import { getNotificationsByUserId, markNotificationAsRead } from "../../api/notification.js";
import { fetchProducts } from "../../api/product.js";

export default function Header() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { cart, setCart } = useCart();
  const [, setLoading] = useState(true);
  const [, setError] = useState(null);
  const token = Cookies.get("accessToken");

  const [roles, setRoles] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const [userData, setUserData] = useState(null);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const searchRef = useRef(null);

  const [mobileOpen, setMobileOpen] = useState(false);
  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const r = getUserRole();
    const list = Array.isArray(r) ? r : r ? [r] : [];
    setRoles(list);
  }, [token]);

  useEffect(() => {
    // Chỉ gọi getUser() khi có token thực sự
    if (!token) {
      setUserData(null);
      return;
    }

    // Có token thì mới gọi API
    getUser().then(setUserData).catch((err) => {
      // Silently fail if 401 (guest or invalid token)
      if (err?.response?.status === 401) {
        // Token invalid - clear it
        Cookies.remove("accessToken");
        setUserData(null);
      } else {
        console.error('Error fetching user:', err);
        setUserData(null);
      }
    });
  }, [token]);

  useEffect(() => {
    if (!token) {
      setCart(null);
      setLoading(false);
      setError(null);
      return;
    }
    async function fetchTotalCart() {
      try {
        setLoading(true);
        const data = await getCart();
        setCart(data);
      } catch (e) {
        // Silently fail if 401 (invalid token)
        if (e?.response?.status !== 401) {
          setError(e);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchTotalCart();
  }, [token, setCart]);

  // Search suggestions with history
  const [searchHistory, setSearchHistory] = useState([]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const fetchSuggestions = async () => {
        try {
          const { getAutocomplete } = await import('../../api/searchApi');
          const response = await getAutocomplete(searchQuery, 10);

          // Transform suggestions to match current format
          const suggestions = response.suggestions.map(s => ({
            id: s.productId || s.text,
            name: s.text,
            type: s.type // 'product', 'history', 'keyword'
          }));

          setSearchSuggestions(suggestions);
          setShowSearchSuggestions(true);
        } catch (error) {
          console.error('Error fetching autocomplete:', error);
        }
      };

      const timeoutId = setTimeout(fetchSuggestions, 300);
      return () => clearTimeout(timeoutId);
    } else {
      // Empty query - show search history if available
      if (token) {
        const loadHistory = async () => {
          try {
            const { getSearchHistory } = await import('../../api/searchApi');
            const response = await getSearchHistory(5);
            const historyItems = (response.history || []).map(h => ({
              id: h,
              name: h,
              type: 'history'
            }));
            setSearchHistory(historyItems);
            setSearchSuggestions(historyItems);
            // Don't auto-show, only show when focused
          } catch (error) {
            console.error('Error loading search history:', error);
          }
        };
        loadHistory();
      }
      setSearchSuggestions([]);
      setShowSearchSuggestions(false);
    }
  }, [searchQuery, token]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchSuggestions(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasRole = (role) => roles.includes(role);
  const handleGoToCart = () => { closeMobile(); navigate("/cart"); };

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minutes ago`;
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString('en-US');
    } catch (error) {
      return 'Unknown';
    }
  };

  const formatNotification = (notification) => {
    let title = 'Order Notification';
    if (notification.orderId) {
      title = `Order #${notification.orderId.substring(0, 8)}`;
    }
    return {
      id: notification.id,
      title,
      message: notification.message || 'There is an update about your order',
      time: formatTimeAgo(notification.creationTimestamp),
      isRead: notification.isRead || false,
      orderId: notification.orderId
    };
  };

  useEffect(() => {
    if (!isAuthenticated() || !token) {
      setNotifications([]);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const user = await getUser();
        if (!user || !user.id) return;

        const data = await getNotificationsByUserId(user.id);
        const orderNotifications = Array.isArray(data)
          ? data.filter(n => n.orderId).slice(0, 3).map(formatNotification)
          : [];
        setNotifications(orderNotifications);
      } catch (err) {
        // Silently fail if 401 (invalid token)
        if (err?.response?.status !== 401) {
          console.error('Error fetching notifications in header:', err);
        }
        setNotifications([]);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    const handleNotificationsUpdated = () => { fetchNotifications(); };
    window.addEventListener('notificationsUpdated', handleNotificationsUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener('notificationsUpdated', handleNotificationsUpdated);
    };
  }, [token]);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const itemCount = cart?.items ? cart.items.length : 0;

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setShowSearchSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (suggestion.type === 'shop') {
      navigate(`/shop?q=${encodeURIComponent(suggestion.name.replace("Find Shop '", "").replace("'", ""))}`);
    } else if (suggestion.type === 'history' || suggestion.type === 'keyword') {
      // For history/keyword, set as search query and navigate
      navigate(`/shop?q=${encodeURIComponent(suggestion.name)}`);
    } else {
      // Product type
      navigate(`/product/${suggestion.id}`);
    }
    setSearchQuery("");
    setShowSearchSuggestions(false);
  };

  const handleRemoveHistoryItem = async (e, item) => {
    e.stopPropagation();
    try {
      const { removeSearchHistoryItem } = await import('../../api/searchApi');
      await removeSearchHistoryItem(item.name);
      // Reload history
      setSearchHistory(prev => prev.filter(h => h.name !== item.name));
      setSearchSuggestions(prev => prev.filter(s => s.name !== item.name));
    } catch (error) {
      console.error('Error removing history item:', error);
    }
  };

  return (
    <header style={{ background: '#ee4d2d' }}>
      {/* Top Bar - Shopee Style */}
      <div style={{ background: '#ee4d2d', padding: '4px 0', fontSize: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap">
            {/* Left links */}
            <div className="d-none d-md-flex gap-3 align-items-center" style={{ fontSize: '12px' }}>
              {/* Shop Owner: Show Seller Center + Shopee Live */}
              {hasRole("ROLE_SHOP_OWNER") && (
                <>
                  <Link to="/shop-owner" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>
                    {t('header.sellerCenter')}
                  </Link>
                  <Link to="/live/manage" style={{
                    color: 'white',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(255,255,255,0.15)',
                    padding: '4px 10px',
                    borderRadius: '4px'
                  }}>
                    🔴 {t('header.shopeeLive')}
                  </Link>
                </>
              )}
              {/* Logged-in Client without Shop Owner: Show Register Shop Owner link */}
              {isAuthenticated() && !hasRole("ROLE_SHOP_OWNER") && (
                <Link to="/register-shopowner" style={{
                  color: 'white',
                  textDecoration: 'none',
                  opacity: 0.9,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🏪 {t('header.registerShopOwner')}
                </Link>
              )}
              {/* Watch Live & Game - visible to authenticated users only */}
              {isAuthenticated() && (
                <>
                  <Link to="/live" style={{
                    color: 'white',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(255,255,255,0.15)',
                    padding: '4px 10px',
                    borderRadius: '4px'
                  }}>
                    🔴 {t('header.watchLive')}
                  </Link>
                  <Link to="/game" style={{
                    color: 'white',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(255,255,255,0.15)',
                    padding: '4px 10px',
                    borderRadius: '4px'
                  }}>
                    🎮 Game
                  </Link>
                </>
              )}
            </div>
            {/* Right links */}
            <div className="d-flex gap-3 align-items-center flex-wrap" style={{ fontSize: '12px' }}>
              {isAuthenticated() && (
                <div ref={notificationRef} className="position-relative">
                  <Link to="/information/notifications" style={{ color: 'white', textDecoration: 'none', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <i className="fa fa-bell"></i>
                    <span className="d-none d-md-inline">{t('header.notifications')}</span>
                    {unreadCount > 0 && (
                      <span
                        className="badge rounded-pill"
                        style={{
                          background: 'white',
                          color: '#ee4d2d',
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 5px',
                          marginLeft: '4px'
                        }}
                      >
                        {unreadCount}
                      </span>
                    )}
                  </Link>
                </div>
              )}
              <Link
                to="#"
                style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}
                onClick={(e) => {
                  e.preventDefault();
                  // Dispatch custom event to open AI Chat
                  window.dispatchEvent(new CustomEvent('open-ai-chat'));
                }}
              >
                {t('header.support')}
              </Link>
              <LanguageSwitcher />
              {isAuthenticated() ? (
                <div className="account-dropdown-container" style={{ position: 'relative' }}>
                  <div
                    style={{
                      color: 'white',
                      textDecoration: 'none',
                      opacity: 0.9,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <i className="fa fa-user-circle"></i>
                    <span className="d-none d-md-inline">{userData?.username || t('header.account')}</span>
                  </div>
                  <div
                    className="account-dropdown-menu"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      minWidth: '180px',
                      background: 'white',
                      borderRadius: '2px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                      zIndex: 1000,
                      marginTop: '10px',
                      opacity: 0,
                      visibility: 'hidden',
                      transition: 'opacity 0.2s, visibility 0.2s',
                      paddingTop: '8px',
                      paddingBottom: '8px'
                    }}
                  >
                    {/* Arrow */}
                    <div style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '20px',
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderBottom: '6px solid white'
                    }}></div>

                    <Link
                      to="/information"
                      style={{
                        display: 'block',
                        padding: '10px 16px',
                        color: '#333',
                        textDecoration: 'none',
                        fontSize: '14px',
                        transition: 'background 0.2s, color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fafafa';
                        e.currentTarget.style.color = '#ee4d2d';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#333';
                      }}
                    >
                      {t('header.myAccount') || 'Tài Khoản Của Tôi'}
                    </Link>

                    <Link
                      to="/information/orders"
                      style={{
                        display: 'block',
                        padding: '10px 16px',
                        color: '#333',
                        textDecoration: 'none',
                        fontSize: '14px',
                        transition: 'background 0.2s, color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fafafa';
                        e.currentTarget.style.color = '#ee4d2d';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#333';
                      }}
                    >
                      {t('header.myOrders') || 'Đơn Mua'}
                    </Link>

                    <button
                      onClick={() => {
                        logout();
                        navigate('/login');
                        window.location.reload();
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 16px',
                        color: '#333',
                        textDecoration: 'none',
                        fontSize: '14px',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.2s, color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fafafa';
                        e.currentTarget.style.color = '#ee4d2d';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#333';
                      }}
                    >
                      {t('header.logout') || 'Đăng Xuất'}
                    </button>
                  </div>

                  <style>{`
                    .account-dropdown-container:hover .account-dropdown-menu {
                      opacity: 1 !important;
                      visibility: visible !important;
                    }
                  `}</style>
                </div>
              ) : (
                <>
                  <Link to="/register" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>
                    {t('header.signUp')}
                  </Link>
                  <div style={{ color: 'rgba(255,255,255,0.5)' }}>|</div>
                  <Link to="/login" style={{ color: 'white', textDecoration: 'none', opacity: 0.9 }}>
                    {t('header.signIn')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Header - Shopee Style */}
      <div className="container py-3" style={{ maxWidth: '1200px' }}>
        <div className="row align-items-center g-3">
          {/* Logo */}
          <div className="col-auto">
            <Link to="/" onClick={closeMobile} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'white',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: '#ee4d2d',
                fontSize: '20px'
              }}>
                V
              </div>
              <span className="d-none d-md-inline" style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>Vibe</span>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="col-auto d-lg-none ms-auto">
            <button className="btn p-0" onClick={openMobile} style={{ color: 'white', border: 'none', background: 'transparent' }}>
              <i className="fa fa-bars fs-5" />
            </button>
          </div>

          {/* Desktop: Search */}
          <div className="col d-none d-lg-block" ref={searchRef} style={{ position: 'relative' }}>
            <form
              onSubmit={handleSearchSubmit}
              className="d-flex position-relative"
              style={{ height: '40px' }}
            >
              <input
                type="text"
                className="form-control"
                placeholder={t('header.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowSearchSuggestions(true)}
                style={{
                  height: '100%',
                  border: 'none',
                  borderRadius: '2px 0 0 2px',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  fontSize: '14px',
                  outline: 'none',
                  background: 'white'
                }}
              />
              <button
                type="submit"
                style={{
                  height: '100%',
                  border: 'none',
                  borderRadius: '0 2px 2px 0',
                  background: '#fb5533',
                  color: 'white',
                  padding: '0 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <i className="fa fa-search"></i>
              </button>
            </form>

            {/* Search Suggestions Dropdown */}
            {showSearchSuggestions && searchSuggestions.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'white',
                borderRadius: '2px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 1000,
                marginTop: '4px',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {searchSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: idx < searchSuggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
                      transition: 'background 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      {/* Icon based on type */}
                      {suggestion.type === 'history' && (
                        <i className="fa fa-history" style={{ color: '#999', fontSize: '14px' }}></i>
                      )}
                      {suggestion.type === 'product' && (
                        <i className="fa fa-box" style={{ color: '#999', fontSize: '14px' }}></i>
                      )}
                      {suggestion.type === 'keyword' && (
                        <i className="fa fa-search" style={{ color: '#999', fontSize: '14px' }}></i>
                      )}

                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', color: '#222' }}>
                          {suggestion.name}
                        </div>
                        {suggestion.type === 'product' && (
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                            {t('header.product')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Remove button for history items */}
                    {suggestion.type === 'history' && (
                      <button
                        onClick={(e) => handleRemoveHistoryItem(e, suggestion)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#999',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontSize: '16px',
                          lineHeight: 1
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ee4d2d'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#999'}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Desktop: Icons */}
          <div className="col-auto d-none d-lg-flex align-items-center" style={{ gap: '20px' }}>
            {/* Cart */}
            <button
              onClick={handleGoToCart}
              className="btn p-0 position-relative border-0"
              style={{ background: 'transparent', color: 'white' }}
            >
              <i className="fa fa-shopping-cart" style={{ fontSize: '24px' }}></i>
              {itemCount > 0 && (
                <span
                  className="position-absolute badge rounded-pill"
                  style={{
                    top: '-8px',
                    right: '-12px',
                    background: 'white',
                    color: '#ee4d2d',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    minWidth: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileOpen && (
        <>
          <div
            className="position-fixed top-0 start-0 w-100 h-100 bg-dark"
            style={{ opacity: 0.5, zIndex: 1040 }}
            onClick={closeMobile}
          />
          <div
            className="offcanvas offcanvas-start show"
            style={{ zIndex: 1050, visibility: 'visible', background: 'white' }}
          >
            <div className="offcanvas-header border-bottom">
              <img src={logoLight} width="120" alt="Logo" />
              <button
                type="button"
                className="btn-close"
                onClick={closeMobile}
              />
            </div>
            <div className="offcanvas-body">
              <ul className="navbar-nav">
                <NavLink to="/" close={closeMobile}>{t('header.home')}</NavLink>
                <NavLink to="/shop" close={closeMobile}>{t('header.shop')}</NavLink>
                <NavLink to="/contact" close={closeMobile}>{t('header.contact')}</NavLink>
                {hasRole("ROLE_SHOP_OWNER") && (
                  <li className="nav-item mt-2">
                    <Link
                      to="/shop-owner"
                      className="nav-link fw-bold text-primary"
                      onClick={closeMobile}
                    >
                      <i className="fa fa-store me-2"></i>{t('header.myShop')}
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
