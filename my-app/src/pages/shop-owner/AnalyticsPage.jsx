import React, { useState, useEffect } from 'react';
import Chart from 'chart.js/auto';
import { getSalesAnalytics, exportSalesReport } from '../../api/order'; // Import export
import { getShopStats } from '../../api/product';
import { getShopOwnerInfo } from '../../api/user';
import { getShopBehaviorAnalytics } from '../../api/shopAnalytics'; // NEW: Phase 4
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast'; // Import toast
import '../../components/shop-owner/ShopOwnerLayout.css';

export default function AnalyticsPage() {
    const { t } = useTranslation();
    const [stats, setStats] = useState({
        todayRevenue: 0,
        todayOrders: 0,
        todayProducts: 0,
        avgRating: 0,
        growth: '0%',
        chartLabels: [],
        chartData: [],
        topProducts: [],
        ordersByStatus: {},
        averageOrderValue: 0
    });

    // NEW: Behavior Analytics State (Phase 4)
    const [behaviorStats, setBehaviorStats] = useState({
        totalViews: 0,
        totalCarts: 0,
        totalPurchases: 0,
        conversionRate: 0,
        topViewedProducts: [],
        conversionFunnel: null,
        abandonedProducts: []
    });

    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const chartRef = React.useRef(null);
    const chartInstance = React.useRef(null);
    const pieChartRef = React.useRef(null);
    const pieChartInstance = React.useRef(null);
    // NEW: Funnel chart ref (Phase 4)
    const funnelChartRef = React.useRef(null);
    const funnelChartInstance = React.useRef(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const userInfo = await getShopOwnerInfo();
            const shopId = userInfo.userId;

            const analyticsData = await getSalesAnalytics(dateRange.startDate, dateRange.endDate);
            const shopStats = await getShopStats(shopId);

            setStats({
                todayRevenue: analyticsData.todayRevenue || 0,
                todayOrders: analyticsData.todayOrders || 0,
                todayProducts: analyticsData.todayProducts || 0,
                avgRating: shopStats.avgRating || 0,
                growth: analyticsData.growth || '0%',
                chartLabels: analyticsData.chartLabels || [],
                chartData: analyticsData.chartData || [],
                topProducts: analyticsData.topProducts || [],
                ordersByStatus: analyticsData.ordersByStatus || {},
                averageOrderValue: analyticsData.averageOrderValue || 0,
                totalCancelled: analyticsData.totalCancelled || 0,
                totalReturned: analyticsData.totalReturned || 0
            });

            // NEW: Fetch Behavior Analytics (Phase 4)
            try {
                const behaviorData = await getShopBehaviorAnalytics();
                setBehaviorStats({
                    totalViews: behaviorData.totalViews || 0,
                    totalCarts: behaviorData.totalCarts || 0,
                    totalPurchases: behaviorData.totalPurchases || 0,
                    conversionRate: behaviorData.conversionRate || 0,
                    topViewedProducts: behaviorData.topViewedProducts || [],
                    conversionFunnel: behaviorData.conversionFunnel || null,
                    abandonedProducts: behaviorData.abandonedProducts || []
                });
            } catch (error) {
                console.log("Behavior analytics not available:", error);
                // Don't show error toast - behavior analytics is optional
            }

        } catch (error) {
            console.error("Failed to fetch analytics:", error);
            toast.error("Failed to load analytics");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDateRange(prev => ({ ...prev, [name]: value }));
    };

    const handleFilter = () => {
        fetchData();
    };

    const handleExport = async () => {
        try {
            const blob = await exportSalesReport(dateRange.startDate, dateRange.endDate);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `sales_report_${dateRange.startDate}_${dateRange.endDate}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Report downloaded");
        } catch {
            toast.error("Failed to export report");
        }
    };

    // Initialize/Update Line Chart
    useEffect(() => {
        if (loading || !chartRef.current) return;

        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        const ctx = chartRef.current.getContext('2d');
        const labels = stats.chartLabels.length > 0 ? stats.chartLabels : ['No Data'];
        const data = stats.chartData.length > 0 ? stats.chartData : [0];

        chartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: t('shopOwner.analytics.revenueLabel'),
                    data: data,
                    borderColor: '#4e73df',
                    backgroundColor: 'rgba(78, 115, 223, 0.05)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#4e73df'
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) label += ': ';
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false, drawBorder: false } },
                    y: {
                        ticks: {
                            callback: function (value) {
                                if (value >= 1000000) return (value / 1000000) + 'M';
                                if (value >= 1000) return (value / 1000) + 'k';
                                return value;
                            }
                        },
                        grid: {
                            color: 'rgb(234, 236, 244)',
                            zeroLineColor: 'rgb(234, 236, 244)',
                            drawBorder: false,
                            borderDash: [2],
                            zeroLineBorderDash: [2]
                        }
                    }
                }
            }
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [stats, loading]);

    // Initialize/Update Pie Chart
    useEffect(() => {
        if (loading || !pieChartRef.current) return;

        if (pieChartInstance.current) {
            pieChartInstance.current.destroy();
        }

        const ctx = pieChartRef.current.getContext('2d');
        const statusData = stats.ordersByStatus || {};
        const labels = Object.keys(statusData);
        const data = Object.values(statusData);

        if (labels.length === 0) {
            labels.push("No Data");
            data.push(1);
        }

        pieChartInstance.current = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796'],
                    hoverBackgroundColor: ['#2e59d9', '#17a673', '#2c9faf', '#dda20a', '#be2617', '#60616f'],
                    hoverBorderColor: "rgba(234, 236, 244, 1)",
                }],
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            },
        });

        return () => {
            if (pieChartInstance.current) {
                pieChartInstance.current.destroy();
            }
        };
    }, [stats, loading]);

    useEffect(() => {
        if (loading || !funnelChartRef.current || !behaviorStats.conversionFunnel) return;

        if (funnelChartInstance.current) {
            funnelChartInstance.current.destroy();
        }

        const ctx = funnelChartRef.current.getContext('2d');
        const funnel = behaviorStats.conversionFunnel;

        funnelChartInstance.current = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Views', 'Add to Cart', 'Purchases'],
                datasets: [{
                    label: 'Customer Journey',
                    data: [funnel.views, funnel.carts, funnel.purchases],
                    backgroundColor: [
                        'rgba(78, 115, 223, 0.8)',  // Blue for Views
                        'rgba(28, 200, 138, 0.8)',  // Green for Carts
                        'rgba(155, 89, 182, 0.8)'   // Purple for Purchases
                    ],
                    borderColor: [
                        'rgba(78, 115, 223, 1)',
                        'rgba(28, 200, 138, 1)',
                        'rgba(155, 89, 182, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // Horizontal bar chart
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.dataset.label + ': ' + context.parsed.x.toLocaleString();
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                if (value >= 1000) return (value / 1000) + 'k';
                                return value;
                            }
                        }
                    }
                }
            }
        });

        return () => {
            if (funnelChartInstance.current) {
                funnelChartInstance.current.destroy();
            }
        };
    }, [behaviorStats, loading]);


    if (loading && !stats.todayRevenue) { // Only show full loader on initial load
        return <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
            </div>
        </div>;
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header d-flex justify-content-between align-items-center flex-wrap gap-3">
                <h1>{t('shopOwner.analytics.title')}</h1>
                <div className="d-flex gap-2">
                    <input
                        type="date"
                        name="startDate"
                        className="form-control"
                        value={dateRange.startDate}
                        onChange={handleDateChange}
                    />
                    <input
                        type="date"
                        name="endDate"
                        className="form-control"
                        value={dateRange.endDate}
                        onChange={handleDateChange}
                    />
                    <button className="btn btn-primary" onClick={handleFilter}>
                        <i className="fas fa-filter me-1"></i> {t('shopOwner.analytics.filter')}
                    </button>
                    <button className="btn btn-success" onClick={handleExport}>
                        <i className="fas fa-file-download me-1"></i> {t('shopOwner.analytics.export')}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="todo-cards" style={{ marginBottom: '30px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="todo-card">
                    <div className="count" style={{ fontSize: '24px', color: '#4e73df' }}>
                        {stats.todayRevenue.toLocaleString()}₫
                    </div>
                    <div className="label">
                        <i className="fas fa-dollar-sign"></i> {t('shopOwner.analytics.revenue')}
                    </div>
                    <div className={`badge ${stats.growth.startsWith('+') ? 'bg-success' : 'bg-danger'}`} style={{ marginTop: '5px' }}>
                        {stats.growth}
                    </div>
                </div>
                <div className="todo-card">
                    <div className="count" style={{ fontSize: '28px' }}>{stats.todayOrders}</div>
                    <div className="label">
                        <i className="fas fa-shopping-cart"></i> {t('shopOwner.analytics.orders')}
                    </div>
                </div>
                <div className="todo-card">
                    <div className="count" style={{ fontSize: '24px', color: '#1cc88a' }}>
                        {stats.averageOrderValue.toLocaleString()}₫
                    </div>
                    <div className="label">
                        <i className="fas fa-chart-line"></i> {t('shopOwner.analytics.avgOrderValue')}
                    </div>
                </div>
                <div className="todo-card">
                    <div className="count" style={{ fontSize: '28px' }}>
                        {stats.avgRating.toFixed(1)} <span style={{ fontSize: '16px', color: '#f6c23e' }}><i className="fas fa-star"></i></span>
                    </div>
                    <div className="label"><i className="fas fa-star"></i> {t('shopOwner.analytics.rating')}</div>
                </div>
            </div>

            <div className="row">
                {/* Revenue Chart */}
                <div className="col-lg-8 mb-4">
                    <div className="analytics-section h-100">
                        <div className="section-title">{t('shopOwner.analytics.revenueChartTitle')}</div>
                        <div className="analytics-content">
                            <div style={{ height: '350px', width: '100%' }}>
                                <canvas ref={chartRef}></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Pie Chart */}
                <div className="col-lg-4 mb-4">
                    <div className="analytics-section h-100">
                        <div className="section-title">{t('shopOwner.analytics.orderStatus')}</div>
                        <div className="analytics-content">
                            <div style={{ height: '300px', width: '100%' }}>
                                <canvas ref={pieChartRef}></canvas>
                            </div>
                            <div className="mt-3 text-center small text-muted">
                                {t('shopOwner.analytics.cancelled')}: {stats.totalCancelled} | {t('shopOwner.analytics.returned')}: {stats.totalReturned}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Products */}
            <div className="analytics-section" style={{ marginTop: '20px' }}>
                <div className="section-title">{t('shopOwner.analytics.topProductsTitle')}</div>
                <div className="table-responsive">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>{t('shopOwner.analytics.product')}</th>
                                <th>{t('shopOwner.analytics.sold')}</th>
                                <th>{t('shopOwner.analytics.revenue')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.topProducts.length > 0 ? (
                                stats.topProducts.map((product, index) => (
                                    <tr key={index}>
                                        <td>{product.productName}</td>
                                        <td>{product.sold}</td>
                                        <td>{product.revenue.toLocaleString()}₫</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="3" className="text-center text-muted">{t('shopOwner.analytics.noData')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ========== NEW: BEHAVIOR ANALYTICS SECTIONS (Phase 4) ========== */}

            {/* Section Header */}
            <div className="dashboard-header mt-5 mb-3">
                <h2><i className="fas fa-chart-bar me-2"></i>{t('shopOwner.analytics.behaviorAnalytics', 'Behavior Analytics')}</h2>
            </div>

            {/* Behavior Stats Cards */}
            <div className="todo-cards" style={{ marginBottom: '30px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div className="todo-card">
                    <div className="count" style={{ fontSize: '28px', color: '#4e73df' }}>
                        {behaviorStats.totalViews.toLocaleString()}
                    </div>
                    <div className="label">
                        <i className="fas fa-eye"></i> {t('shopOwner.analytics.totalViews', 'Total Views')}
                    </div>
                </div>
                <div className="todo-card">
                    <div className="count" style={{ fontSize: '28px', color: '#1cc88a' }}>
                        {behaviorStats.totalCarts.toLocaleString()}
                    </div>
                    <div className="label">
                        <i className="fas fa-shopping-cart"></i> {t('shopOwner.analytics.totalCarts', 'Add to Cart')}
                    </div>
                </div>
                <div className="todo-card">
                    <div className="count" style={{ fontSize: '28px', color: '#9b59b6' }}>
                        {behaviorStats.totalPurchases.toLocaleString()}
                    </div>
                    <div className="label">
                        <i className="fas fa-credit-card"></i> {t('shopOwner.analytics.totalPurchases', 'Purchases')}
                    </div>
                </div>
                <div className="todo-card">
                    <div className="count" style={{ fontSize: '28px', color: '#f39c12' }}>
                        {behaviorStats.conversionRate.toFixed(2)}%
                    </div>
                    <div className="label">
                        <i className="fas fa-chart-line"></i> {t('shopOwner.analytics.conversionRate', 'Conversion Rate')}
                    </div>
                </div>
            </div>

            <div className="row">
                {/* Conversion Funnel Chart */}
                <div className="col-lg-6 mb-4">
                    <div className="analytics-section h-100">
                        <div className="section-title">{t('shopOwner.analytics.conversionFunnel', 'Conversion Funnel')}</div>
                        <div className="analytics-content">
                            <div style={{ height: '300px', width: '100%' }}>
                                <canvas ref={funnelChartRef}></canvas>
                            </div>
                            {behaviorStats.conversionFunnel && (
                                <div className="mt-3 text-center small">
                                    <span className="me-3">
                                        <i className="fas fa-eye text-primary"></i> → <i className="fas fa-shopping-cart text-success"></i>: {behaviorStats.conversionFunnel.viewToCartRate.toFixed(2)}%
                                    </span>
                                    <span>
                                        <i className="fas fa-shopping-cart text-success"></i> → <i className="fas fa-credit-card text-purple"></i>: {behaviorStats.conversionFunnel.cartToPurchaseRate.toFixed(2)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Top Viewed Products */}
                <div className="col-lg-6 mb-4">
                    <div className="analytics-section h-100">
                        <div className="section-title">{t('shopOwner.analytics.topViewedProducts', 'Top Viewed Products')}</div>
                        <div className="analytics-content">
                            <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                <table className="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>{t('shopOwner.analytics.product', 'Product')}</th>
                                            <th>{t('shopOwner.analytics.views', 'Views')}</th>
                                            <th>CVR%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {behaviorStats.topViewedProducts.length > 0 ? (
                                            behaviorStats.topViewedProducts.slice(0, 5).map((product, index) => (
                                                <tr key={index}>
                                                    <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {product.productName}
                                                    </td>
                                                    <td>{product.viewCount.toLocaleString()}</td>
                                                    <td>
                                                        <span className={`badge ${product.conversionRate > 5 ? 'bg-success' : product.conversionRate > 2 ? 'bg-warning' : 'bg-danger'}`}>
                                                            {product.conversionRate.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="3" className="text-center text-muted">{t('shopOwner.analytics.noData', 'No Data')}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Abandoned Products Section */}
            {behaviorStats.abandonedProducts.length > 0 && (
                <div className="analytics-section" style={{ marginTop: '20px', borderLeft: '4px solid #f39c12', backgroundColor: '#fff8e6' }}>
                    <div className="section-title" style={{ color: '#f39c12' }}>
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        {t('shopOwner.analytics.abandonedProducts', 'Products Needing Attention')}
                    </div>
                    <div className="table-responsive">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{t('shopOwner.analytics.product', 'Product')}</th>
                                    <th>{t('shopOwner.analytics.views', 'Views')}</th>
                                    <th>{t('shopOwner.analytics.carts', 'Carts')}</th>
                                    <th>{t('shopOwner.analytics.purchases', 'Purchases')}</th>
                                    <th>{t('shopOwner.analytics.issue', 'Issue')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {behaviorStats.abandonedProducts.map((product, index) => (
                                    <tr key={index}>
                                        <td>{product.productName}</td>
                                        <td>{product.viewCount.toLocaleString()}</td>
                                        <td>{product.cartCount.toLocaleString()}</td>
                                        <td>{product.purchaseCount.toLocaleString()}</td>
                                        <td>
                                            <small className="text-muted">{product.issue}</small>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="alert alert-warning mt-3 mb-0">
                        <i className="fas fa-lightbulb me-2"></i>
                        <strong>{t('shopOwner.analytics.suggestion', 'Suggestion')}:</strong> {t('shopOwner.analytics.abandonedSuggestion', 'Consider reviewing price, product description, or images for these products')}
                    </div>
                </div>
            )}
        </div>
    );
}