import React, { useState } from 'react';
import '../../../assets/admin/css/ShopOwnerList.css';

export default function ShopOwnerList({ shops, selectedShopId, onSelectShop }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterVerified, setFilterVerified] = useState('all');
    const [sortBy, setSortBy] = useState('name');

    // Filter shops
    const filteredShops = shops.filter(shop => {
        const matchesSearch =
            shop.shopName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            shop.ownerName.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter =
            filterVerified === 'all' ||
            (filterVerified === 'verified' && shop.verified) ||
            (filterVerified === 'unverified' && !shop.verified);

        return matchesSearch && matchesFilter;
    });

    // Sort shops
    const sortedShops = [...filteredShops].sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.shopName.localeCompare(b.shopName);
            case 'products':
                return b.totalProducts - a.totalProducts;
            case 'orders':
                return b.totalOrders - a.totalOrders;
            case 'revenue':
                return b.totalRevenue - a.totalRevenue;
            default:
                return 0;
        }
    });

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    const formatDate = (dateString) => {
        if (!dateString || dateString === 'N/A') return 'N/A';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
    };

    return (
        <div className="shop-owner-list-container">
            <div className="list-header">
                <h3 className="list-title">
                    <i className="fas fa-list me-2"></i>
                    Shop List ({sortedShops.length})
                </h3>
            </div>

            {/* Search and Filters */}
            <div className="list-controls">
                <div className="search-box">
                    <i className="fas fa-search"></i>
                    <input
                        type="text"
                        placeholder="Search shop or owner..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="filter-row">
                    <select
                        className="form-select"
                        value={filterVerified}
                        onChange={(e) => setFilterVerified(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="verified">✓ Verified</option>
                        <option value="unverified">⏳ Unverified</option>
                    </select>

                    <select
                        className="form-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="name">Sort: Name</option>
                        <option value="products">Sort: Products</option>
                        <option value="orders">Sort: Orders</option>
                        <option value="revenue">Sort: Revenue</option>
                    </select>
                </div>
            </div>

            {/* Shop List */}
            <div className="shop-list">
                {sortedShops.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-store-slash"></i>
                        <p>No shops found</p>
                    </div>
                ) : (
                    sortedShops.map(shop => (
                        <div
                            key={shop.id}
                            className={`shop-card ${selectedShopId === shop.id ? 'selected' : ''}`}
                            onClick={() => onSelectShop(shop.id)}
                        >
                            <div className="shop-header">
                                <div className="shop-avatar">
                                    {shop.imageUrl ? (
                                        <img src={shop.imageUrl} alt={shop.shopName} />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            {shop.shopName.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div className="shop-info">
                                    <h4 className="shop-name">
                                        {shop.shopName}
                                        {shop.verified && (
                                            <span className="verified-badge" title="Verified">
                                                <i className="fas fa-check-circle"></i>
                                            </span>
                                        )}
                                    </h4>
                                    <p className="owner-name">
                                        <i className="fas fa-user"></i> {shop.ownerName}
                                    </p>
                                </div>
                            </div>

                            <div className="shop-stats">
                                <div className="stat-item">
                                    <i className="fas fa-box text-primary"></i>
                                    <span className="stat-value">{shop.totalProducts}</span>
                                    <span className="stat-label">Products</span>
                                </div>
                                <div className="stat-item">
                                    <i className="fas fa-shopping-cart text-success"></i>
                                    <span className="stat-value">{shop.totalOrders}</span>
                                    <span className="stat-label">Orders</span>
                                </div>
                                <div className="stat-item">
                                    <i className="fas fa-money-bill-wave text-warning"></i>
                                    <span className="stat-value">{formatCurrency(shop.totalRevenue)}</span>
                                    <span className="stat-label">Revenue</span>
                                </div>
                            </div>

                            <div className="shop-footer">
                                <span className="join-date">
                                    <i className="fas fa-calendar-alt"></i>
                                    Joined: {formatDate(shop.createdAt)}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
