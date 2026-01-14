import React, { useEffect, useState } from 'react';
import '../../assets/admin/css/AdminDashboard.css';
import { getDashboardStats, getRevenueChartData, getRecentOrders, getTopCategories } from '../../api/adminAnalyticsApi';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const AdminDashboard = () => {
    const handleExportPDF = () => {
        const input = document.querySelector('.admin-dashboard');
        html2canvas(input, { scale: 2 }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const finalImgWidth = pdfWidth - 20;
            const finalImgHeight = (canvas.height * finalImgWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 10, 10, finalImgWidth, finalImgHeight);
            pdf.save('dashboard-report.pdf');
        });
    };
    const [dashboardStats, setDashboardStats] = useState({
        totalSales: 0,
        totalOrders: 0,
        totalUsers: 0,
        totalProducts: 0,
        totalViews: 0,
        conversionRate: 0
    });
    const [revenueData, setRevenueData] = useState([]);
    const [recentOrdersList, setRecentOrdersList] = useState([]);
    const [topCategoriesList, setTopCategoriesList] = useState([]);
    const [loading, setLoading] = useState(true);

    // Default: Last 30 days
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const fetchData = async () => {
        try {
            setLoading(true); // constant refresh feedback might be annoying, but good for explicit filter
            const [stats, revenue, orders, categories] = await Promise.all([
                getDashboardStats(startDate, endDate),
                getRevenueChartData(startDate, endDate),
                getRecentOrders(),
                getTopCategories(startDate, endDate)
            ]);
            setDashboardStats(stats);
            setRevenueData(revenue);
            setRecentOrdersList(orders);
            setTopCategoriesList(categories);
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const intervalId = setInterval(fetchData, 10000);
        return () => clearInterval(intervalId);
    }, [startDate, endDate]); // Re-run setup when dates change

    // Static data for fallback or unimplemented sections
    const activeUsers = [
        { country: 'United States', users: 2758, percentage: 36, flag: '🇺🇸', color: '#FF6B35' },
        { country: 'United Kingdom', users: 1839, percentage: 24, flag: '🇬🇧', color: '#667eea' },
        { country: 'Indonesia', users: 1333, percentage: 17.3, flag: '🇮🇩', color: '#37B7C3' },
        { country: 'Russia', users: 1454, percentage: 19, flag: '🇷🇺', color: '#FDC830' }
    ];

    const conversionMetrics = [
        { label: 'Site Visits (Base)', value: (dashboardStats.totalSiteVisits || 0).toLocaleString(), percentage: '100%', color: '#667eea' },
        { label: 'Product Views', value: (dashboardStats.totalViews || 0).toLocaleString(), percentage: `${(dashboardStats.productViewRate || 0).toFixed(1)}%`, color: '#60a5fa' },
        { label: 'Added to Cart', value: (dashboardStats.totalAddToCart || 0).toLocaleString(), percentage: `${(dashboardStats.addToCartRate || 0).toFixed(1)}%`, color: '#fb923c' },
        { label: 'Orders Completed', value: (dashboardStats.totalOrders || 0).toLocaleString(), percentage: `${(dashboardStats.orderCompletionRate || 0).toFixed(1)}%`, color: '#4ade80' }
    ];

    const trafficSources = [
        { source: 'Direct Traffic', percentage: 40, color: '#FF6B35' },
        { source: 'Organic Search', percentage: 30, color: '#37B7C3' },
        { source: 'Social Media', percentage: 15, color: '#F7931E' },
        { source: 'Referral Traffic', percentage: 10, color: '#FDC830' },
        { source: 'Email Campaigns', percentage: 5, color: '#A78BFA' }
    ];

    const recentActivity = [
        {
            type: 'purchase',
            message: 'Maxwell Shaw purchased 2 items totaling 120.000 VND',
            time: '12 min ago',
            icon: '🛍️',
            color: '#FF6B35'
        },
        {
            type: 'update',
            message: 'The stock of "Smart TV" was updated from 600.000 VND to 450.000 VND',
            time: '1:32 AM',
            icon: '📦',
            color: '#667eea'
        }
    ];

    // Formatting helper
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + ' VND';
    };

    return (
        <div className="admin-dashboard">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1a1a2e' }}>Dashboard Overview</h2>
                <div className="d-flex gap-2 bg-white p-2 rounded shadow-sm">
                    <button
                        className="btn btn-sm btn-outline-danger d-flex align-items-center gap-2"
                        onClick={handleExportPDF}
                        title="Export to PDF"
                    >
                        <i className="bi bi-file-earmark-pdf"></i> Export PDF
                    </button>
                    <div className="vr mx-1"></div>
                    <input
                        type="date"
                        className="form-control form-control-sm"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{ border: '1px solid #eee' }}
                    />
                    <span className="align-self-center text-muted">-</span>
                    <input
                        type="date"
                        className="form-control form-control-sm"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{ border: '1px solid #eee' }}
                    />
                </div>
            </div>

            {/* First Row: Stats + Top Categories */}
            <div className="row-1">
                <div className="stats-section">
                    <div className="stat-card-compact">
                        <div className="stat-icon-compact stat-icon-sales">
                            <i className="fas fa-dollar-sign"></i>
                        </div>
                        <div className="stat-info-compact">
                            <span className="stat-label-compact">Total Sales</span>
                            <h2 className="stat-value-compact">{loading ? '...' : formatCurrency(dashboardStats.totalSales)}</h2>
                            <span className="stat-change positive">
                                +3.2% vs last month
                            </span>
                        </div>
                    </div>

                    <div className="stat-card-compact">
                        <div className="stat-icon-compact stat-icon-orders">
                            <i className="fas fa-shopping-cart"></i>
                        </div>
                        <div className="stat-info-compact">
                            <span className="stat-label-compact">Total Orders</span>
                            <h2 className="stat-value-compact">{loading ? '...' : dashboardStats.totalOrders}</h2>
                            <span className="stat-change positive">
                                +5.5% vs last month
                            </span>
                        </div>
                    </div>

                    <div className="stat-card-compact">
                        <div className="stat-icon-compact stat-icon-visitors">
                            <i className="fas fa-users"></i>
                        </div>
                        <div className="stat-info-compact">
                            <span className="stat-label-compact">Total Users</span>
                            <h2 className="stat-value-compact">{loading ? '...' : dashboardStats.totalUsers}</h2>
                            <span className="stat-change positive">
                                +2.4% vs last month
                            </span>
                        </div>
                    </div>
                </div>

                <div className="card categories-card-compact">
                    <div className="card-header">
                        <h3 className="card-title">Top Categories</h3>
                        <button className="btn-link">See All</button>
                    </div>
                    <div className="card-body">
                        <div className="category-donut-compact" style={{
                            background: topCategoriesList.length > 0
                                ? `conic-gradient(${topCategoriesList.reduce((acc, cat, index, array) => {
                                    const prevPercentage = array.slice(0, index).reduce((p, c) => p + c.percentage, 0);
                                    const currentEnd = prevPercentage + cat.percentage;
                                    const degreeStart = (prevPercentage / 100) * 360;
                                    const degreeEnd = (currentEnd / 100) * 360;
                                    return `${acc}${index === 0 ? 'from 0deg, ' : ''}${cat.color} ${degreeStart}deg ${degreeEnd}deg${index < array.length - 1 ? ', ' : ''}`;
                                }, '')})`
                                : '#e9ecef'
                        }}>
                            <div className="donut-center-compact">
                                <span className="donut-value-compact">{loading ? '...' : formatCurrency(dashboardStats.totalSales)}</span>
                            </div>
                        </div>
                        <div className="categories-list-compact">
                            {topCategoriesList.length > 0 ? (
                                topCategoriesList.map((category, index) => (
                                    <div key={index} className="category-item-compact">
                                        <div className="category-info">
                                            <div className="category-color" style={{ backgroundColor: category.color }}></div>
                                            <span className="category-name">{category.name}</span>
                                        </div>
                                        <span className="category-value">{formatCurrency(category.value)} ({category.percentage}%)</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center">No category data</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Second Row: Revenue Analytics + Monthly Target */}
            <div className="row-2">
                <div className="card chart-card">
                    <div className="card-header">
                        <div>
                            <h3 className="card-title">Revenue Analytics</h3>
                            <div className="chart-legend">
                                <span className="legend-item"><span className="legend-dot revenue"></span> Revenue</span>
                                <span className="legend-item"><span className="legend-dot order"></span> Order</span>
                            </div>
                        </div>
                        <button className="btn-action">Last 30 Days</button>
                    </div>
                    <div className="card-body">
                        <div className="chart-placeholder">
                            {/* Simple SVG Chart Implementation based on data */}
                            <div className="chart-visual" style={{ display: 'flex', height: '200px', gap: '10px' }}>
                                {(() => {
                                    const sanitizedData = revenueData.map(d => ({
                                        ...d,
                                        revenue: Number(d.revenue) || 0
                                    }));
                                    const maxRevenue = Math.max(...sanitizedData.map(d => d.revenue), 1);


                                    return sanitizedData.map((data, index) => (
                                        <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                                            <div style={{
                                                width: '100%',
                                                flex: 1,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'flex-end',
                                                alignItems: 'center'
                                            }}>
                                                {data.revenue > 0 && (
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        marginBottom: '4px',
                                                        color: '#333',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {formatCurrency(data.revenue).replace(/\.00$/, '')}
                                                    </span>
                                                )}
                                                <div style={{
                                                    width: '100%',
                                                    height: `${(data.revenue / maxRevenue) * 90}%`,
                                                    backgroundColor: '#FF6B35',
                                                    borderRadius: '4px 4px 0 0',
                                                    minHeight: '4px',
                                                    transition: 'height 0.3s ease'
                                                }} title={`Revenue: ${formatCurrency(data.revenue)} - Date: ${data.date}`}></div>
                                            </div>
                                            <span style={{
                                                fontSize: '10px',
                                                marginTop: '5px',
                                                color: '#888',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {new Date(data.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
                                            </span>
                                        </div>
                                    ));
                                })()}
                                {revenueData.length === 0 && <p className="text-center w-100">No data available for chart</p>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card target-card">
                    <div className="card-header">
                        <h3 className="card-title">Monthly Target</h3>
                        <button className="btn-menu">
                            <i className="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                    <div className="card-body">
                        <div className="target-gauge">
                            <div className="gauge-circle">
                                <span className="gauge-value">85%</span>
                                <span className="gauge-label">+8.2% from last month</span>
                            </div>
                        </div>
                        <div className="target-info">
                            <p className="target-message">
                                <span className="fire-icon">🎯</span> <strong>Great Progress!</strong> We reached 85% from our monthly target, keep it up!
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Third Row: Active User + Conversion Rate + Traffic Sources */}
            <div className="row-3">
                <div className="card users-card-compact">
                    <div className="card-header">
                        <h3 className="card-title">Active User</h3>
                    </div>
                    <div className="card-body">
                        {/* Static Active Users for now */}
                        <div className="users-list-compact">
                            {activeUsers.map((user, index) => (
                                <div key={index} className="user-item-compact">
                                    <div className="user-info">
                                        <span className="user-flag">{user.flag}</span>
                                        <span className="user-country">{user.country}</span>
                                    </div>
                                    <div className="user-stats-compact">
                                        <span className="user-percentage">{user.percentage}%</span>
                                        <div className="user-progress-compact">
                                            <div
                                                className="progress-fill-compact"
                                                style={{ width: `${user.percentage}% `, backgroundColor: user.color }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card conversion-card">
                    <div className="card-header">
                        <h3 className="card-title">Conversion Rate</h3>
                    </div>
                    <div className="card-body">
                        {/* Static Conversion Metrics */}
                        <div className="conversion-metrics">
                            {conversionMetrics.map((metric, index) => (
                                <div key={index} className="conversion-item" style={{
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    background: '#f8f9fa',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between'
                                }}>
                                    <div className="conversion-header" style={{ marginBottom: '10px' }}>
                                        {metric.icon && <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{metric.icon}</div>}
                                        <span className="conversion-label" style={{ fontSize: '0.85rem', fontWeight: '600', color: '#555' }}>{metric.label}</span>
                                    </div>
                                    <div className="d-flex flex-column align-items-center justify-content-center mt-2">
                                        <h3 className="conversion-value" style={{ fontSize: '1.75rem', color: metric.color }}>{metric.percentage}</h3>
                                        <span style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>{metric.value} count</span>
                                    </div>
                                    <div className="progress mt-3" style={{ height: '6px', backgroundColor: '#e9ecef', borderRadius: '3px' }}>
                                        <div
                                            className="progress-bar"
                                            style={{
                                                width: metric.percentage,
                                                backgroundColor: metric.color,
                                                borderRadius: '3px'
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card traffic-card-compact">
                    <div className="card-header">
                        <h3 className="card-title">Traffic Sources</h3>
                    </div>
                    <div className="card-body">
                        {/* Static Traffic Sources */}
                        <div className="traffic-list-compact">
                            {trafficSources.map((source, index) => (
                                <div key={index} className="traffic-item-compact">
                                    <div className="traffic-info">
                                        <div className="traffic-color" style={{ backgroundColor: source.color }}></div>
                                        <span className="traffic-name">{source.source}</span>
                                    </div>
                                    <span className="traffic-percentage">{source.percentage}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Fourth Row: Recent Orders + Recent Activity */}
            <div className="row-4">
                <div className="card orders-card-compact">
                    <div className="card-header">
                        <h3 className="card-title">Recent Orders</h3>
                        <button className="btn-action-sm">All Categories</button>
                    </div>
                    <div className="card-body">
                        <div className="table-responsive">
                            <table className="orders-table-compact">
                                <thead>
                                    <tr>
                                        <th>No</th>
                                        <th>Order ID</th>
                                        <th>Customer</th>
                                        <th>Total</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentOrdersList.map((order, index) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td>
                                                <span className="order-id">{order.id}</span>
                                            </td>
                                            <td>
                                                <div className="customer-cell-compact">
                                                    <span>{order.userId ? order.userId.substring(0, 8) + '...' : 'Guest'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="order-total">{formatCurrency(order.totalPrice)}</span>
                                            </td>
                                            <td>
                                                <span className={`status-badge-sm status-${order.orderStatus ? order.orderStatus.toLowerCase() : 'default'}`}>
                                                    {order.orderStatus}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {recentOrdersList.length === 0 && <tr><td colSpan="5" className="text-center">No recent orders</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="card activity-card">
                    <div className="card-header">
                        <h3 className="card-title">Recent Activity</h3>
                    </div>
                    <div className="card-body">
                        <div className="activity-list">
                            {recentActivity.map((activity, index) => (
                                <div key={index} className="activity-item">
                                    <div className="activity-icon" style={{ backgroundColor: activity.color + '20' }}>
                                        <span>{activity.icon}</span>
                                    </div>
                                    <div className="activity-content">
                                        <p className="activity-message">{activity.message}</p>
                                        <span className="activity-time">{activity.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
