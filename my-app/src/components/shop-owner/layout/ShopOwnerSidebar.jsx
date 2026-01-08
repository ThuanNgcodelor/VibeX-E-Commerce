import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

const ShopOwnerSidebar = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const location = useLocation();
    const [expandedSections, setExpandedSections] = useState({
        orders: false,
        products: false,
        finance: false,
        marketing: false
    });

    // Auto-expand section if current route belongs to it (but not the main route)
    useEffect(() => {
        const path = location.pathname;

        // Check if current route is in orders section (only for sub-routes, not main /shop-owner)
        if (path.startsWith('/shop-owner/orders/')) {
            setExpandedSections(prev => ({
                ...prev,
                orders: true
            }));
        }

        // Check if current route is in products section
        if (path.startsWith('/shop-owner/products')) {
            setExpandedSections(prev => ({
                ...prev,
                products: true
            }));
        }

        // Check if current route is in finance section
        if (path.startsWith('/shop-owner/wallet') || path.startsWith('/shop-owner/subscription')) {
            setExpandedSections(prev => ({
                ...prev,
                finance: true
            }));
        }

        // Check if current route is in marketing section
        if (path.startsWith('/shop-owner/vouchers')) {
            setExpandedSections(prev => ({
                ...prev,
                marketing: true
            }));
        }
    }, [location.pathname]);

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const isActive = (path) => {
        const currentPath = location.pathname;

        // Exact match (including trailing slash)
        if (currentPath === path || currentPath === path + '/') {
            return true;
        }

        // For main dashboard (/shop-owner), only match exact (not sub-routes)
        if (path === '/shop-owner') {
            return currentPath === '/shop-owner' || currentPath === '/shop-owner/';
        }

        // For /shop-owner/products, only match exact (not sub-routes like /add or /edit/:id)
        if (path === '/shop-owner/products') {
            return currentPath === '/shop-owner/products' || currentPath === '/shop-owner/products/';
        }

        // For sub-routes (e.g., /shop-owner/orders/bulk-shipping), match exact
        // This ensures /shop-owner/orders/bulk-shipping doesn't match /shop-owner
        if (currentPath.startsWith(path)) {
            const nextChar = currentPath[path.length];
            // Match if path ends exactly here, or is followed by / or ?
            return !nextChar || nextChar === '/' || nextChar === '?';
        }

        return false;
    };

    const handleLinkClick = () => {
        if (window.innerWidth <= 768) {
            onClose();
        }
    };

    return (
        <nav className={`col-md-2 sidebar ${isOpen ? 'active' : ''}`}>
            {isOpen && (
                <button className="sidebar-close-btn" onClick={onClose}>
                    <i className="fas fa-times"></i>
                </button>
            )}
            <div className="sidebar-brand">
                <Link to="/shop-owner" onClick={onClose}>
                    <span className="sidebar-title">{t('shopOwner.sidebar.sellerCenter')}</span>
                </Link>
            </div>

            <div className="sidebar-menu">
                {/* Orders Management Section */}
                <div className="sidebar-section">
                    <div
                        className="sidebar-section-header"
                        onClick={() => toggleSection('orders')}
                    >
                        <span>{t('shopOwner.sidebar.orderManagement')}</span>
                        <i className={`fas fa-chevron-${expandedSections.orders ? 'up' : 'down'}`}></i>
                    </div>
                    {expandedSections.orders && (
                        <div className="sidebar-menu-items">
                            {/* <Link
              className={`sidebar-item ${isActive('/shop-owner/orders') ? 'active' : ''}`}
              to="/shop-owner/orders"
            >
              <i className="fas fa-list"></i>
              <span>Order List</span>
            </Link> */}
                            <Link
                                className={`sidebar-item ${isActive('/shop-owner/orders/bulk-shipping') ? 'active' : ''}`}
                                to="/shop-owner/orders/bulk-shipping"
                            >
                                <i className="fas fa-truck"></i>
                                <span>{t('shopOwner.sidebar.manageOrder')}</span>
                            </Link>
                            <Link
                                className={`sidebar-item ${isActive('/shop-owner/orders/returns') ? 'active' : ''}`}
                                to="/shop-owner/orders/returns"
                                onClick={handleLinkClick}
                            >
                                <i className="fas fa-undo-alt"></i>
                                <span>{t('shopOwner.sidebar.returnsRefunds')}</span>
                            </Link>

                        </div>
                    )}
                </div>

                {/* Product Management Section */}
                <div className="sidebar-section">
                    <div
                        className="sidebar-section-header"
                        onClick={() => toggleSection('products')}
                    >
                        <span>{t('shopOwner.sidebar.productManagement')}</span>
                        <i className={`fas fa-chevron-${expandedSections.products ? 'up' : 'down'}`}></i>
                    </div>
                    {expandedSections.products && (
                        <div className="sidebar-menu-items">
                            <Link
                                className={`sidebar-item ${isActive('/shop-owner/products') ? 'active' : ''}`}
                                to="/shop-owner/products"
                                onClick={handleLinkClick}
                            >
                                <i className="fas fa-box"></i>
                                <span>{t('shopOwner.sidebar.allProducts')}</span>
                            </Link>

                            <Link
                                className={`sidebar-item ${isActive('/shop-owner/inventory') ? 'active' : ''}`}
                                to="/shop-owner/inventory"
                                onClick={handleLinkClick}
                            >
                                <i className="fas fa-boxes"></i>
                                <span>{t('shopOwner.sidebar.inventory')}</span>
                            </Link>
                            <Link
                                className={`sidebar-item ${isActive('/shop-owner/products/add') ? 'active' : ''}`}
                                to="/shop-owner/products/add"
                                onClick={handleLinkClick}
                            >
                                <i className="fas fa-plus-circle"></i>
                                <span>{t('shopOwner.sidebar.addProduct')}</span>
                            </Link>
                            <Link
                                className={`sidebar-item ${isActive('/shop-owner/reviews') ? 'active' : ''}`}
                                to="/shop-owner/reviews"
                                onClick={handleLinkClick}
                            >
                                <i className="fas fa-star"></i>
                                <span>{t('shopOwner.sidebar.reviews')}</span>
                            </Link>

                        </div>
                    )}
                </div>

                {/* Analytics Section */}
                <div className="sidebar-section">
                    <Link
                        className={`sidebar-item ${isActive('/shop-owner/analytics') ? 'active' : ''}`}
                        to="/shop-owner/analytics"
                        onClick={handleLinkClick}
                    >
                        <i className="fas fa-chart-line"></i>
                        <span>{t('shopOwner.sidebar.salesAnalytics')}</span>
                    </Link>
                </div>

                <div className="sidebar-section">
                    <Link
                        className={`sidebar-item ${isActive('/shop-owner/flash-sale') ? 'active' : ''}`}
                        to="/shop-owner/flash-sale"
                        onClick={handleLinkClick}
                    >
                        <i className="fas fa-bolt"></i>
                        <span>{t('shopOwner.sidebar.flashSaleSidebar') || "Flash Sale"}</span>
                    </Link>
                </div>


                {/* Marketing Section */}
                <div className="sidebar-section">
                    <Link
                        className={`sidebar-item ${isActive('/shop-owner/ads') ? 'active' : ''}`}
                        to="/shop-owner/ads"
                        onClick={handleLinkClick}
                    >
                        <i className="fas fa-bullhorn"></i>
                        <span>Advertising</span>
                    </Link>
                </div>

                {/* Chat */}
                <div className="sidebar-section">
                    <Link
                        className={`sidebar-item ${isActive('/shop-owner/chat') ? 'active' : ''}`}
                        to="/shop-owner/chat"
                        onClick={handleLinkClick}
                    >
                        <i className="fas fa-comments"></i>
                        <span>{t('shopOwner.sidebar.customerMessages')}</span>
                    </Link>
                </div>

                {/* Notifications */}
                <div className="sidebar-section">
                    <Link
                        className={`sidebar-item ${isActive('/shop-owner/notifications') ? 'active' : ''}`}
                        to="/shop-owner/notifications"
                        onClick={handleLinkClick}
                    >
                        <i className="fas fa-bell"></i>
                        <span>{t('shopOwner.sidebar.notifications')}</span>
                    </Link>
                </div>

                {/* Livestream */}
                <div className="sidebar-section">
                    <Link
                        className={`sidebar-item ${isActive('/live/manage') ? 'active' : ''}`}
                        to="/live/manage"
                        onClick={handleLinkClick}
                        style={{
                            background: isActive('/live/manage') ? '' : 'linear-gradient(135deg, #ee4d2d 0%, #ff6b35 100%)',
                            color: isActive('/live/manage') ? '' : 'white',
                            borderRadius: '8px'
                        }}
                    >
                        <i className="fas fa-video"></i>
                        <span>🔴 Livestream</span>
                    </Link>
                </div>

                {/* Marketing Section */}
                <div className="sidebar-section">
                    <div
                        className="sidebar-section-header"
                        onClick={() => toggleSection('marketing')}
                    >
                        <span>{t('shopOwner.sidebar.marketing') || "Marketing Channel"}</span>
                        <i className={`fas fa-chevron-${expandedSections.marketing ? 'up' : 'down'}`}></i>
                    </div>
                    {expandedSections.marketing && (
                        <div className="sidebar-menu-items">
                            <Link
                                className={`sidebar-item ${isActive('/shop-owner/vouchers') ? 'active' : ''}`}
                                to="/shop-owner/vouchers"
                                onClick={handleLinkClick}
                            >
                                <i className="fas fa-ticket-alt"></i>
                                <span>{t('shopOwner.sidebar.vouchers') || "Vouchers"}</span>
                            </Link>
                        </div>
                    )}
                </div>

                {/* Finance Section */}
                <div className="sidebar-section">
                    <div
                        className="sidebar-section-header"
                        onClick={() => toggleSection('finance')}
                    >
                        <span>{t('shopOwner.sidebar.finance')}</span>
                        <i className={`fas fa-chevron-${expandedSections.finance ? 'up' : 'down'}`}></i>
                    </div>
                    {expandedSections.finance && (
                        <div className="sidebar-menu-items">
                            <Link
                                className={`sidebar-item ${isActive('/shop-owner/wallet') ? 'active' : ''}`}
                                to="/shop-owner/wallet"
                                onClick={handleLinkClick}
                            >
                                <i className="fas fa-wallet"></i>
                                <span>{t('shopOwner.sidebar.wallet')}</span>
                            </Link>
                            <Link
                                className={`sidebar-item ${isActive('/shop-owner/subscription') ? 'active' : ''}`}
                                to="/shop-owner/subscription"
                                onClick={handleLinkClick}
                            >
                                <i className="fas fa-crown"></i>
                                <span>{t('shopOwner.sidebar.subscription')}</span>
                            </Link>
                        </div>
                    )}
                </div>

                {/* Shop Decoration */}
                <div className="sidebar-section">
                    <Link
                        className={`sidebar-item ${isActive('/shop-owner/decoration') ? 'active' : ''}`}
                        to="/shop-owner/decoration"
                        onClick={handleLinkClick}
                    >
                        <i className="fas fa-paint-brush"></i>
                        <span>{t('shopDecoration') || 'Decoration'}</span>
                    </Link>
                </div>

                {/* Settings */}
                <div className="sidebar-section">
                    <Link
                        className={`sidebar-item ${isActive('/shop-owner/settings') ? 'active' : ''}`}
                        to="/shop-owner/settings"
                        onClick={handleLinkClick}
                    >
                        <i className="fas fa-cog"></i>
                        <span>{t('shopOwner.sidebar.settings')}</span>
                    </Link>
                </div>
            </div>
        </nav>
    );
};

export default ShopOwnerSidebar;