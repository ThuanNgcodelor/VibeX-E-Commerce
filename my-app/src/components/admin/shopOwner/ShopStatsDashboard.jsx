import React from 'react';
import '../../../assets/admin/css/ShopStatsDashboard.css';

export default function ShopStatsDashboard({ shop }) {
    // Mock data cho biểu đồ - sẽ thay bằng API call sau
    // Parse Data from Shop Prop
    // Revenue Trend
    const revenueTrend = shop.revenueTrend || [];
    const revenueData = revenueTrend.length > 0
        ? revenueTrend.map(item => ({
            month: `T${item.month}`,
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
            <div className="dashboard-header">
                <h3 className="dashboard-title">
                    <i className="fas fa-chart-line me-2"></i>
                    Thống Kê: {shop.shopName}
                </h3>
                <span className="verified-badge-large">
                    {shop.verified ? (
                        <>
                            <i className="fas fa-check-circle text-success"></i> Đã xác minh
                        </>
                    ) : (
                        <>
                            <i className="fas fa-clock text-warning"></i> Chưa xác minh
                        </>
                    )}
                </span>
            </div>

            {/* Summary Cards */}
            <div className="summary-cards">
                <div className="summary-card revenue">
                    <div className="card-icon">
                        <i className="fas fa-money-bill-wave"></i>
                    </div>
                    <div className="card-content">
                        <h4 className="card-value">{formatCurrency(stats.revenue.total)}</h4>
                        <p className="card-label">Tổng Doanh Thu</p>
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
                        <p className="card-label">Tổng Đơn Hàng</p>
                        <span className="card-detail">
                            {stats.orders.byStatus.delivered} đã giao
                        </span>
                    </div>
                </div>

                <div className="summary-card products">
                    <div className="card-icon">
                        <i className="fas fa-box"></i>
                    </div>
                    <div className="card-content">
                        <h4 className="card-value">{stats.products.total}</h4>
                        <p className="card-label">Tổng Sản Phẩm</p>
                        <span className="card-detail">
                            {stats.products.active} đang bán
                        </span>
                    </div>
                </div>

                <div className="summary-card categories">
                    <div className="card-icon">
                        <i className="fas fa-tags"></i>
                    </div>
                    <div className="card-content">
                        <h4 className="card-value">{stats.categories}</h4>
                        <p className="card-label">Danh Mục</p>
                        <span className="card-detail">
                            {stats.products.byCategory.length} loại
                        </span>
                    </div>
                </div>
            </div>

            {/* Revenue Trend Chart */}
            <div className="chart-section">
                <div className="section-header">
                    <h4>Xu Hướng Doanh Thu 6 Tháng Gần Đây</h4>
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
                            <div className="text-center w-100 py-3 text-muted">Chưa có dữ liệu doanh thu</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="row g-3">
                {/* Products by Category */}
                <div className="col-md-6">
                    <div className="chart-section">
                        <div className="section-header">
                            <h4>Sản Phẩm Theo Danh Mục</h4>
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
                                <div className="text-center py-3 text-muted">Chưa có dữ liệu danh mục</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Order Status Distribution */}
                <div className="col-md-6">
                    <div className="chart-section">
                        <div className="section-header">
                            <h4>Phân Bố Trạng Thái Đơn Hàng</h4>
                        </div>
                        <div className="status-chart">
                            <div className="status-item">
                                <div className="status-info">
                                    <span className="status-dot pending"></span>
                                    <span className="status-name">Chờ xử lý</span>
                                </div>
                                <span className="status-count">{stats.orders.byStatus.pending}</span>
                            </div>
                            <div className="status-item">
                                <div className="status-info">
                                    <span className="status-dot processing"></span>
                                    <span className="status-name">Đang xử lý</span>
                                </div>
                                <span className="status-count">{stats.orders.byStatus.processing}</span>
                            </div>
                            <div className="status-item">
                                <div className="status-info">
                                    <span className="status-dot shipped"></span>
                                    <span className="status-name">Đang giao</span>
                                </div>
                                <span className="status-count">{stats.orders.byStatus.shipped}</span>
                            </div>
                            <div className="status-item">
                                <div className="status-info">
                                    <span className="status-dot delivered"></span>
                                    <span className="status-name">Đã giao</span>
                                </div>
                                <span className="status-count">{stats.orders.byStatus.delivered}</span>
                            </div>
                            <div className="status-item">
                                <div className="status-info">
                                    <span className="status-dot cancelled"></span>
                                    <span className="status-name">Đã hủy</span>
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
