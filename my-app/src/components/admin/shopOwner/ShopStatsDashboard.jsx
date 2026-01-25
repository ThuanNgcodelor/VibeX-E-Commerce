import React from 'react';
import '../../../assets/admin/css/ShopStatsDashboard.css';
import Swal from 'sweetalert2';

export default function ShopStatsDashboard({ shop, onToggleStatus, onVerifyShop }) {
    // Mock data cho biểu đồ - sẽ thay bằng API call sau
    // Parse Data from Shop Prop

    const handleLockToggle = () => {
        const isLocked = shop.status === 'LOCKED';
        const action = isLocked ? 'Unlock' : 'Lock';

        Swal.fire({
            title: `Are you sure you want to ${action.toLowerCase()} this shop?`,
            text: isLocked ? "The shop will be active again." : "The shop will be disabled and cannot sell products.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: isLocked ? '#28a745' : '#d33', // Green for unlock, Red for lock
            cancelButtonColor: '#6c757d',
            confirmButtonText: `Yes, ${action} it!`
        }).then((result) => {
            if (result.isConfirmed) {
                if (onToggleStatus) {
                    onToggleStatus(shop.id);
                    Swal.fire(
                        `${action}ed!`,
                        `The shop has been ${action.toLowerCase()}ed.`,
                        'success'
                    );
                }
            }
        });
    };

    const handleVerifyToggle = () => {
        Swal.fire({
            title: 'Verify this shop?',
            text: "This will mark the shop as verified and legitimate.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, verify it!'
        }).then((result) => {
            if (result.isConfirmed) {
                if (onVerifyShop) {
                    onVerifyShop(shop.id);
                    Swal.fire(
                        'Verified!',
                        'The shop has been verified.',
                        'success'
                    );
                }
            }
        });
    };

    // Revenue Trend
    const revenueTrend = shop.revenueTrend || [];
    const revenueData = revenueTrend.length > 0
        ? revenueTrend.map(item => ({
            month: `M${item.month}`,
            revenue: item.revenue || 0
        }))
        : []; // Or default/empty chart

    // Product Category Stats
    const colors = ['#FF6B35', '#F7931E', '#FDC830', '#37B7C3', '#667eea', '#e35d5b', '#4299e1'];
    const categoryStats = shop.productCategoryStats || [];
    const categoryData = categoryStats.map((item, index) => ({
        name: item.categoryName,
        count: item.count,
        color: colors[index % colors.length]
    }));

    // Order Status Distribution
    const statusStats = shop.orderStatusDistribution || [];
    const getStatusCount = (status) => {
        // Handle various statuses that map to UI groups if needed, or exact match
        const found = statusStats.find(s => s.status === status);
        return found ? found.count : 0;
    };

    const stats = {
        revenue: {
            total: shop.totalRevenue,
            trend: revenueTrend.length > 0 ? '' : 'N/A', // Calc trend if needed
            monthly: revenueData
        },
        orders: {
            total: shop.totalOrders,
            byStatus: {
                pending: getStatusCount('PENDING'),
                processing: getStatusCount('CONFIRMED') + getStatusCount('PROCESSING'), // Map both to processing
                shipped: getStatusCount('SHIPPED') + getStatusCount('READY_TO_SHIP'),
                delivered: getStatusCount('DELIVERED') + getStatusCount('COMPLETED'), // Completed usually means delivered+finalized
                cancelled: getStatusCount('CANCELLED'),
                returned: getStatusCount('RETURNED')
            }
        },
        products: {
            total: shop.totalProducts,
            active: shop.totalProducts, // Assuming all active for now or fetch specific invalid
            inactive: 0,
            byCategory: categoryData
        },
        categories: categoryData.length
    };

    // Fallback if no revenue data to avoid map errors
    const chartData = stats.revenue.monthly.length > 0 ? stats.revenue.monthly : [];


    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount);
    };

    const maxRevenue = stats.revenue.monthly.length > 0
        ? Math.max(...stats.revenue.monthly.map(m => m.revenue))
        : 0;

    return (
        <div className="shop-stats-dashboard">
            <div className="dashboard-header d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-3">
                    <h3 className="dashboard-title mb-0">
                        <i className="fas fa-chart-line me-2"></i>
                        Statistics: {shop.shopName}
                    </h3>
                    <span className="verified-badge-large">
                        {shop.status === 'LOCKED' ? (
                            <>
                                <i className="fas fa-lock text-danger"></i> Locked
                            </>
                        ) : (
                            shop.verified ? (
                                <span style={{ color: '#1DA1F2', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <i className="fas fa-check-circle"></i> Verified
                                </span>
                            ) : (
                                <>
                                    <i className="fas fa-clock text-warning"></i> Unverified
                                </>
                            )
                        )}
                    </span>
                </div>

                <div className="d-flex gap-2">
                    {!shop.verified && shop.status !== 'LOCKED' && (
                        <button
                            className="btn btn-primary d-flex align-items-center gap-2"
                            onClick={handleVerifyToggle}
                        >
                            <i className="fas fa-check-circle"></i>
                            Verify Shop
                        </button>
                    )}
                    <button
                        className={`btn ${shop.status === 'LOCKED' ? 'btn-success' : 'btn-danger'} d-flex align-items-center gap-2`}
                        onClick={handleLockToggle}
                    >
                        <i className={`fas ${shop.status === 'LOCKED' ? 'fa-lock-open' : 'fa-lock'}`}></i>
                        {shop.status === 'LOCKED' ? 'Unlock Shop' : 'Lock Shop'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="summary-cards">
                <div className="summary-card revenue">
                    <div className="card-icon">
                        <i className="fas fa-money-bill-wave"></i>
                    </div>
                    <div className="card-content">
                        <h4 className="card-value">{formatCurrency(stats.revenue.total)}</h4>
                        <p className="card-label">Total Revenue</p>
                        <span className="card-trend positive">
                            <i className="fas fa-arrow-up"></i> {stats.revenue.trend}
                        </span>
                    </div>
                </div>

                <div className="summary-card orders">
                    <div className="card-icon">
                        <i className="fas fa-shopping-cart"></i>
                    </div>
                    <div className="card-content">
                        <h4 className="card-value">{stats.orders.total}</h4>
                        <p className="card-label">Total Orders</p>
                        <span className="card-detail">
                            {stats.orders.byStatus.delivered} delivered
                        </span>
                    </div>
                </div>

                <div className="summary-card products">
                    <div className="card-icon">
                        <i className="fas fa-box"></i>
                    </div>
                    <div className="card-content">
                        <h4 className="card-value">{stats.products.total}</h4>
                        <p className="card-label">Total Products</p>
                        <span className="card-detail">
                            {stats.products.active} active
                        </span>
                    </div>
                </div>

                <div className="summary-card categories">
                    <div className="card-icon">
                        <i className="fas fa-tags"></i>
                    </div>
                    <div className="card-content">
                        <h4 className="card-value">{stats.categories}</h4>
                        <p className="card-label">Categories</p>
                        <span className="card-detail">
                            {stats.products.byCategory.length} types
                        </span>
                    </div>
                </div>
            </div>

            {/* Revenue Trend Chart */}
            <div className="chart-section">
                <div className="section-header">
                    <h4>Revenue Trend (Last 6 Months)</h4>
                </div>
                <div className="revenue-chart">
                    <div className="chart-bars">
                        {stats.revenue.monthly.length > 0 ? (
                            stats.revenue.monthly.map((data, index) => (
                                <div key={index} className="bar-container">
                                    <div className="bar-wrapper">
                                        <div
                                            className="bar"
                                            style={{ height: `${maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0}%` }}
                                        >
                                            <span className="bar-value">{(data.revenue / 1000000).toFixed(0)}M</span>
                                        </div>
                                    </div>
                                    <span className="bar-label">{data.month}</span>
                                </div>
                            ))
                        ) : (
                            <div className="text-center w-100 py-3 text-muted">No revenue data available</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="row g-3">
                {/* Products by Category */}
                <div className="col-md-6">
                    <div className="chart-section">
                        <div className="section-header">
                            <h4>Products by Category</h4>
                        </div>
                        <div className="category-chart">
                            {stats.products.byCategory.length > 0 ? (
                                stats.products.byCategory.map((category, index) => (
                                    <div key={index} className="category-item">
                                        <div className="category-info">
                                            <div
                                                className="category-color"
                                                style={{ backgroundColor: category.color }}
                                            ></div>
                                            <span className="category-name">{category.name}</span>
                                        </div>
                                        <div className="category-stats">
                                            <span className="category-count">{category.count}</span>
                                            <div className="category-bar">
                                                <div
                                                    className="category-fill"
                                                    style={{
                                                        width: `${stats.products.total > 0 ? (category.count / stats.products.total) * 100 : 0}%`,
                                                        backgroundColor: category.color
                                                    }}
                                                ></div>
                                            </div>
                                            <span className="category-percent">
                                                {stats.products.total > 0 ? ((category.count / stats.products.total) * 100).toFixed(1) : 0}%
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-3 text-muted">No category data available</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Order Status Distribution */}
                <div className="col-md-6">
                    <div className="chart-section">
                        <div className="section-header">
                            <h4>Order Status Distribution</h4>
                        </div>
                        <div className="status-chart">
                            <div className="status-item">
                                <div className="status-info">
                                    <span className="status-dot pending"></span>
                                    <span className="status-name">Pending</span>
                                </div>
                                <span className="status-count">{stats.orders.byStatus.pending}</span>
                            </div>
                            <div className="status-item">
                                <div className="status-info">
                                    <span className="status-dot processing"></span>
                                    <span className="status-name">Processing</span>
                                </div>
                                <span className="status-count">{stats.orders.byStatus.processing}</span>
                            </div>
                            <div className="status-item">
                                <div className="status-info">
                                    <span className="status-dot shipped"></span>
                                    <span className="status-name">Shipping</span>
                                </div>
                                <span className="status-count">{stats.orders.byStatus.shipped}</span>
                            </div>
                            <div className="status-item">
                                <div className="status-info">
                                    <span className="status-dot delivered"></span>
                                    <span className="status-name">Delivered</span>
                                </div>
                                <span className="status-count">{stats.orders.byStatus.delivered}</span>
                            </div>
                            <div className="status-item">
                                <div className="status-info">
                                    <span className="status-dot cancelled"></span>
                                    <span className="status-name">Cancelled</span>
                                </div>
                                <span className="status-count">{stats.orders.byStatus.cancelled}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
