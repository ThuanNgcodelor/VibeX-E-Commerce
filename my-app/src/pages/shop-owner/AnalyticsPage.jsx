import React, { useState, useEffect } from 'react';
import Chart from 'chart.js/auto';
import { getSalesAnalytics, exportSalesReport } from '../../api/order'; // Import export
import { getShopStats } from '../../api/product';
import { getShopOwnerInfo } from '../../api/user';
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
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const chartRef = React.useRef(null);
    const chartInstance = React.useRef(null);
    const pieChartRef = React.useRef(null);
    const pieChartInstance = React.useRef(null);

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
        } catch (error) {
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
        </div>
    );
}