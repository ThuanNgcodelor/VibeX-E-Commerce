import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../../../assets/admin/css/Sidebar.css"

const Sidebar = ({ isOpen = true, toggleSidebar }) => {
    const location = useLocation();
    const [isDesignOpen, setIsDesignOpen] = useState(false);

    const isActive = (path) => {
        return location.pathname === path;
    };

    const isDropdownActive = (paths) => {
        return paths.some((path) => location.pathname === path);
    };

    const toggleDesign = () => {
        setIsDesignOpen(!isDesignOpen);
    };

    return (
        <ul className={`sidebar-ezmart ${isOpen ? '' : 'toggled'}`}>
            {/* Brand */}
            <div className="sidebar-brand-ezmart">
                <Link className="d-flex align-items-center text-decoration-none" to="/admin" style={{ overflow: 'hidden' }}>
                    <div className="brand-icon">
                        <i className="fas fa-th"></i>
                    </div>
                    <span className="brand-text ml-2">Vibe</span>
                </Link>
                <div className="sidebar-toggle-btn" onClick={toggleSidebar} style={{ cursor: 'pointer', padding: '0 5px' }}>
                    <i className="fas fa-bars" style={{ fontSize: '1.2rem', color: '#2c3e50' }}></i>
                </div>
            </div>

            {/* Dashboard */}
            <li className="nav-item-ezmart">
                <Link
                    className={`nav-link-ezmart ${isActive("/admin") ? "active" : ""}`}
                    to="/admin"
                >
                    <i className="fas fa-tachometer-alt"></i>
                    <span>Dashboard</span>
                </Link>
            </li>

            {/* Suspicious Activity */}
            <li className="nav-item-ezmart">
                <Link
                    className={`nav-link-ezmart ${isActive("/admin/suspicious-activity") ? "active" : ""}`}
                    to="/admin/suspicious-activity"
                >
                    <i className="fas fa-exclamation-triangle"></i>
                    <span>Suspicious Activity</span>
                </Link>
            </li>

            {/* User */}
            <li className="nav-item-ezmart">
                <Link
                    className={`nav-link-ezmart ${isActive("/admin/tables/datatables") ? "active" : ""}`}
                    to="/admin/tables/datatables"
                >
                    <i className="fas fa-users"></i>
                    <span>User</span>
                </Link>
            </li>

            {/* Shop Owner */}
            <li className="nav-item-ezmart">
                <Link
                    className={`nav-link-ezmart ${isActive("/admin/shop-owners") ? "active" : ""}`}
                    to="/admin/shop-owners"
                >
                    <i className="fas fa-store"></i>
                    <span>Shop Owner</span>
                </Link>
            </li>

            {/* Role Request */}
            <li className="nav-item-ezmart">
                <Link
                    className={`nav-link-ezmart ${isActive("/admin/role-request") ? "active" : ""}`}
                    to="/admin/role-request"
                >
                    <i className="fas fa-clipboard-list"></i>
                    <span>Role Request</span>
                </Link>
            </li>

            {/* Design - Dropdown */}
            <li className="nav-item-dropdown">
                <button
                    className={`dropdown-toggle-ezmart ${isDropdownActive(["/admin/banner"]) ? "active" : ""} ${isDesignOpen ? "open" : ""}`}
                    onClick={toggleDesign}
                >
                    <div className="left-content">
                        <i className="fas fa-palette icon"></i>
                        <span>Design</span>
                    </div>
                    <i className="fas fa-chevron-down arrow"></i>
                </button>
                <div className={`dropdown-menu-ezmart ${isDesignOpen ? "open" : ""}`}>
                    <Link
                        className={`dropdown-item-ezmart ${isActive("/admin/banner") ? "active" : ""}`}
                        to="/admin/banner"
                    >
                        Banner
                    </Link>
                    <Link
                        className={`dropdown-item-ezmart ${isActive("/admin/ads") ? "active" : ""}`}
                        to="/admin/ads"
                    >
                        Advertisement
                    </Link>
                </div>
            </li>

            {/* Voucher */}
            <li className="nav-item-ezmart">
                <Link
                    className={`nav-link-ezmart ${isActive("/admin/voucher") ? "active" : ""}`}
                    to="/admin/voucher"
                >
                    <i className="fas fa-ticket-alt"></i>
                    <span>Voucher</span>
                </Link>
            </li>

            {/* Flash-Sale */}
            <li className="nav-item-ezmart">
                <Link
                    className={`nav-link-ezmart ${isActive("/admin/flash-sale") ? "active" : ""}`}
                    to="/admin/flash-sale"
                >
                    <i className="fas fa-bolt"></i>
                    <span>Flash Sale</span>
                </Link>
            </li>

            {/* Coin Management */}
            <li className="nav-item-ezmart">
                <Link
                    className={`nav-link-ezmart ${isActive("/admin/coins") ? "active" : ""}`}
                    to="/admin/coins"
                >
                    <i className="fas fa-coins"></i>
                    <span>Coin Management</span>
                </Link>
            </li>

            {/* Categories */}
            <li className="nav-item-ezmart">
                <Link
                    className={`nav-link-ezmart ${isActive("/admin/categories") ? "active" : ""}`}
                    to="/admin/categories"
                >
                    <i className="fas fa-tags"></i>
                    <span>Categories</span>
                </Link>
            </li>

            {/* Subscription */}
            <li className="nav-item-ezmart">
                <Link
                    className={`nav-link-ezmart ${isActive("/admin/subscription") ? "active" : ""}`}
                    to="/admin/subscription"
                >
                    <i className="fas fa-crown"></i>
                    <span>Subscription</span>
                </Link>
            </li>

            {/* Wallet */}
            <li className="nav-item-ezmart">
                <Link
                    className={`nav-link-ezmart ${isActive("/admin/wallet") ? "active" : ""}`}
                    to="/admin/wallet"
                >
                    <i className="fas fa-wallet"></i>
                    <span>Wallet</span>
                </Link>
            </li>
            {/* Logout */}
            <li className="nav-item-ezmart">
                <Link
                    className="nav-link-ezmart"
                    to="/admin/logout"
                >
                    <i className="fas fa-sign-out-alt"></i>
                    <span>Logout</span>
                </Link>
            </li>
        </ul>
    );
};

export default Sidebar;