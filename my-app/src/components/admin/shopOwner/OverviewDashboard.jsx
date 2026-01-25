import React from 'react';
import '../../../assets/admin/css/OverviewDashboard.css';

export default function OverviewDashboard({ shops }) {
    // Calculate overview statistics
    const totalShops = shops.length;
    const totalRevenue = shops.reduce((sum, shop) => sum + shop.totalRevenue, 0);
    const totalOrders = shops.reduce((sum, shop) => sum + shop.totalOrders, 0);
    const totalProducts = shops.reduce((sum, shop) => sum + shop.totalProducts, 0);
    const verifiedShops = shops.filter(shop => shop.verified).length;

    // Top shops by revenue
    const topShopsByRevenue = [...shops]
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 5);

    // Top shops by products
    const topShopsByProducts = [...shops]
        .sort((a, b) => b.totalProducts - a.totalProducts)
        .slice(0, 5);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    const maxRevenue = Math.max(...topShopsByRevenue.map(s => s.totalRevenue));
    const maxProducts = Math.max(...topShopsByProducts.map(s => s.totalProducts));

    return (
        <div className="overview-dashboard">
            <div className="dashboard-header">
                <h3 className="dashboard-title">
                    <i className="fas fa-chart-pie me-2"></i>
                    System Overview
                </h3>
                <p className="dashboard-subtitle">General statistics of all shop owners</p>
            </div>

            {/* System Summary Cards */}
            <div className="overview-summary">
                <div className="overview-card shops">
                    <div className="card-icon">
                        <i className="fas fa-store"></i>
                    </div>
                    <div className="card-content">
                        <h4 className="card-value">{totalShops}</h4>
                        <p className="card-label">Total Shops</p>
                        <span className="card-detail">
                            {verifiedShops} verified
                        </span>
                    </div>
                </div>

                <div className="overview-card revenue">
                    <div className="card-icon">
                        <i className="fas fa-money-bill-wave"></i>
                    </div>
                    <div className="card-content">
                        <h4 className="card-value">{formatCurrency(totalRevenue)}</h4>
                        <p className="card-label">Total Revenue</p>
                        <span className="card-detail">
                            From all shops
                        </span>
                    </div>
                </div>

                <div className="overview-card orders">
                    <div className="card-icon">
                        <i className="fas fa-shopping-cart"></i>
                    </div>
                    <div className="card-content">
                        <h4 className="card-value">{totalOrders.toLocaleString()}</h4>
                        <p className="card-label">Total Orders</p>
                        <span className="card-detail">
                            Average {Math.floor(totalOrders / (totalShops || 1))}/shop
                        </span>
                    </div>
                </div>

                <div className="overview-card products">
                    <div className="card-icon">
                        <i className="fas fa-box"></i>
                    </div>
                    <div className="card-content">
                        <h4 className="card-value">{totalProducts.toLocaleString()}</h4>
                        <p className="card-label">Total Products</p>
                        <span className="card-detail">
                            Average {Math.floor(totalProducts / (totalShops || 1))}/shop
                        </span>
                    </div>
                </div>
            </div>

            {/* Revenue Comparison Chart */}
            <div className="chart-section">
                <div className="section-header">
                    <h4>
                        <i className="fas fa-trophy me-2"></i>
                        Top 5 Shops by Revenue
                    </h4>
                </div>
                <div className="revenue-comparison-chart">
                    {topShopsByRevenue.map((shop, index) => (
                        <div key={shop.id} className="shop-revenue-bar">
                            <div className="shop-rank">#{index + 1}</div>
                            <div className="shop-details">
                                <div className="shop-name-row">
                                    <span className="shop-name">{shop.shopName}</span>
                                    {shop.verified && <i className="fas fa-check-circle verified-icon" style={{ color: '#1DA1F2' }}></i>}
                                </div>
                                <div className="revenue-bar-container">
                                    <div
                                        className="revenue-bar-fill"
                                        style={{ width: `${(shop.totalRevenue / (maxRevenue || 1)) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="shop-stats-row">
                                    <span className="revenue-amount">{formatCurrency(shop.totalRevenue)}</span>
                                    <span className="order-count">{shop.totalOrders} orders</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Product Distribution Chart */}
            <div className="chart-section">
                <div className="section-header">
                    <h4>
                        <i className="fas fa-boxes me-2"></i>
                        Top 5 Shops by Product Count
                    </h4>
                </div>
                <div className="product-distribution-chart">
                    {topShopsByProducts.map((shop, index) => (
                        <div key={shop.id} className="shop-product-bar">
                            <div className="shop-rank">#{index + 1}</div>
                            <div className="shop-details">
                                <div className="shop-name-row">
                                    <span className="shop-name">{shop.shopName}</span>
                                    {shop.verified && <i className="fas fa-check-circle verified-icon" style={{ color: '#1DA1F2' }}></i>}
                                </div>
                                <div className="product-bar-container">
                                    <div
                                        className="product-bar-fill"
                                        style={{ width: `${(shop.totalProducts / (maxProducts || 1)) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="shop-stats-row">
                                    <span className="product-count">{shop.totalProducts} products</span>
                                    <span className="owner-name">{shop.ownerName}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="quick-stats-grid">
                <div className="stat-box">
                    <div className="stat-icon">
                        <i className="fas fa-percentage"></i>
                    </div>
                    <div className="stat-info">
                        <h5>{((verifiedShops / (totalShops || 1)) * 100).toFixed(1)}%</h5>
                        <p>Verification Rate</p>
                    </div>
                </div>

                <div className="stat-box">
                    <div className="stat-icon">
                        <i className="fas fa-chart-line"></i>
                    </div>
                    <div className="stat-info">
                        <h5>{formatCurrency(totalRevenue / (totalShops || 1))}</h5>
                        <p>Avg Revenue/Shop</p>
                    </div>
                </div>

                <div className="stat-box">
                    <div className="stat-icon">
                        <i className="fas fa-box-open"></i>
                    </div>
                    <div className="stat-info">
                        <h5>{Math.floor(totalProducts / (totalShops || 1))}</h5>
                        <p>Avg Products/Shop</p>
                    </div>
                </div>

                <div className="stat-box">
                    <div className="stat-icon">
                        <i className="fas fa-receipt"></i>
                    </div>
                    <div className="stat-info">
                        <h5>{Math.floor(totalOrders / (totalShops || 1))}</h5>
                        <p>Avg Orders/Shop</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
