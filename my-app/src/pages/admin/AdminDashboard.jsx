import React, { useEffect, useState } from 'react';
import '../../assets/admin/css/AdminDashboard.css';
import { getDashboardStats, getRevenueChartData, getRecentOrders, getTopCategories, getConversionTrend, getUserLocationStats } from '../../api/adminAnalyticsApi';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

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
    const [conversionTrendData, setConversionTrendData] = useState([]);
    const [userLocationStats, setUserLocationStats] = useState([]);
    const [loading, setLoading] = useState(true);

    // Charts Ref
    const conversionChartRef = React.useRef(null);
    const conversionChartInstance = React.useRef(null);


    // UI Toggles & Filters
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [showAllOrders, setShowAllOrders] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("All");

    // Default: Start of current month
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // Set to 1st day of month
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const loadData = async () => {
        try {
            setLoading(true);
            setLoading(true);
            const [stats, revenue, orders, categories, conversionTrend, locationStats] = await Promise.all([
                getDashboardStats(startDate, endDate),
                getRevenueChartData(startDate, endDate),
                getRecentOrders(selectedCategory),
                getTopCategories(startDate, endDate),
                getConversionTrend(startDate, endDate),
                getUserLocationStats()
            ]);
            setDashboardStats(stats);
            setRevenueData(revenue);
            setTopCategoriesList(categories);
            setRecentOrdersList(orders);
            setConversionTrendData(conversionTrend);
            setUserLocationStats(locationStats);
        } catch (error) {
            console.error("Error loading dashboard data:", error);
            // setError("Failed to load dashboard data"); // setError not defined in component, ignoring
        } finally {
            setLoading(false);
        }
    };

    const fetchRecentOrders = async (category) => {
        try {
            const orders = await getRecentOrders(category);
            setRecentOrdersList(orders);
        } catch (error) {
            console.error("Error loading recent orders:", error);
            // setError("Failed to load recent orders");
        }
    }

    // Effect for initial load and date changes
    useEffect(() => {
        loadData();
        // Removed setInterval to prevent continuous reloading
    }, [startDate, endDate]);

    // Effect for category filter change
    useEffect(() => {
        if (!loading) { // Avoid double fetch on initial load if possible, or just let it be
            fetchRecentOrders(selectedCategory);
        }
    }, [selectedCategory]);

    // Draw Chart when data changes
    useEffect(() => {
        if (conversionChartInstance.current) {
            conversionChartInstance.current.destroy();
        }

        if (conversionChartRef.current && conversionTrendData.length > 0) {
            const ctx = conversionChartRef.current.getContext('2d');

            conversionChartInstance.current = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: conversionTrendData.map(d => new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })),
                    datasets: [
                        {
                            label: 'Visits',
                            data: conversionTrendData.map(d => d.visits),
                            borderColor: '#667eea',
                            backgroundColor: 'rgba(102, 126, 234, 0.1)',
                            yAxisID: 'y',
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Orders',
                            data: conversionTrendData.map(d => d.orders),
                            borderColor: '#F7931E',
                            backgroundColor: 'rgba(247, 147, 30, 0.1)',
                            yAxisID: 'y1',
                            tension: 0.4
                        },
                        {
                            label: 'Conversion Rate (%)',
                            data: conversionTrendData.map(d => d.conversionRate),
                            borderColor: '#4ade80',
                            backgroundColor: 'transparent',
                            yAxisID: 'y1',
                            borderDash: [5, 5],
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'Visits' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: {
                                drawOnChartArea: false,
                            },
                            title: { display: true, text: 'Orders / Rate (%)' }
                        },
                    }
                }
            });
        }
    }, [conversionTrendData]);

    // Static data for fallback or unimplemented sections
    // Derived Active Users from API
    const activeUsers = userLocationStats.length > 0 ? userLocationStats.slice(0, 5).map(stat => ({
        country: stat.province,
        users: stat.count,
        percentage: dashboardStats.totalUsers > 0 ? ((stat.count / dashboardStats.totalUsers) * 100).toFixed(1) : 0,
        flag: '📍', // Generic pin icon for province
        color: '#FF6B35' // Could randomize or map colors
    })) : [
        // Fallback or empty state if no data
        { country: 'No Data', users: 0, percentage: 0, flag: '🏳️', color: '#e9ecef' }
    ];

    const conversionMetrics = [
        { label: 'Site Visits (Base)', value: (dashboardStats.totalSiteVisits || 0).toLocaleString(), percentage: '100%', color: '#667eea' },
        { label: 'Product Views', value: (dashboardStats.totalViews || 0).toLocaleString(), percentage: `${(dashboardStats.productViewRate || 0).toFixed(1)}%`, color: '#60a5fa' },
        { label: 'Added to Cart', value: (dashboardStats.totalAddToCart || 0).toLocaleString(), percentage: `${(dashboardStats.addToCartRate || 0).toFixed(1)}%`, color: '#fb923c' },
        { label: 'Orders Completed', value: (dashboardStats.totalOrders || 0).toLocaleString(), percentage: `${(dashboardStats.orderCompletionRate || 0).toFixed(1)}%`, color: '#4ade80' }
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
            <div className="dashboard-header d-flex justify-content-between align-items-center mb-4">
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
                            <span className={`stat-change ${(!dashboardStats.salesGrowth || dashboardStats.salesGrowth >= 0) ? 'positive' : 'negative'}`}>
                                {dashboardStats.salesGrowth !== undefined
                                    ? <>{Number(dashboardStats.salesGrowth).toFixed(1)}% vs last period</>
                                    : '+0% vs last month'}
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
                            <span className={`stat-change ${(!dashboardStats.ordersGrowth || dashboardStats.ordersGrowth >= 0) ? 'positive' : 'negative'}`}>
                                {dashboardStats.ordersGrowth !== undefined
                                    ? <>{Number(dashboardStats.ordersGrowth).toFixed(1)}% vs last period</>
                                    : '+0% vs last month'}
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
                            {/* User growth unavailable currently, keeping static or hiding */}
                            {/* <span className="stat-change positive">
                                +2.4% vs last month
                            </span> */}
                        </div>
                    </div>
                </div>

                <div className="card categories-card-compact">
                    <div className="card-header">
                        <h3 className="card-title">Top Categories</h3>
                        <button
                            className="btn-link text-decoration-none"
                            onClick={() => setShowAllCategories(!showAllCategories)}
                        >
                            {showAllCategories ? "See Less" : "See All"}
                        </button>
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
                                (showAllCategories ? topCategoriesList : topCategoriesList.slice(0, 3)).map((category, index) => (
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
                                                style={{ width: `${user.percentage}% `, backgroundColor: '#37B7C3' }}
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
                        <div className="conversion-chart-container" style={{ position: 'relative', height: '300px', width: '100%' }}>
                            <canvas ref={conversionChartRef}></canvas>
                            {conversionTrendData.length === 0 && !loading && (
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                                    <p className="text-muted">No trend data available for this period.</p>
                                    <small>Note: Historical visit data is not available before today.</small>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Fourth Row: Recent Orders + Recent Activity */}
            <div className="row-4">
                <div className="card orders-card-compact">
                    <div className="card-header d-flex justify-content-between align-items-center">
                        <h3 className="card-title mb-0">Recent Orders</h3>
                        <div className="d-flex align-items-center gap-2">
                            <select
                                className="form-select form-select-sm"
                                style={{ width: '150px' }}
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                <option value="All">All Categories</option>
                                {topCategoriesList.map((cat, idx) => (
                                    <option key={idx} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                            <button
                                className="btn-action-sm"
                                onClick={() => setShowAllOrders(!showAllOrders)}
                            >
                                {showAllOrders ? "See Less" : "See All"}
                            </button>
                        </div>
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
                                    {(showAllOrders ? recentOrdersList : recentOrdersList.slice(0, 3)).map((order, index) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td>
                                                <span className="order-id">{order.id}</span>
                                            </td>
                                            <td>
                                                <div className="customer-cell-compact">
                                                    <span>{order.customerName || (order.userId ? order.userId.substring(0, 8) + '...' : 'Guest')}</span>
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
