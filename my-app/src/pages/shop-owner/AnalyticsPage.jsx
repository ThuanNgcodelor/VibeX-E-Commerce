import React, { useState, useEffect } from 'react';
import Chart from 'chart.js/auto';
import { getSalesAnalytics } from '../../api/order';
import { getShopStats } from '../../api/product';
import { getShopOwnerInfo } from '../../api/user';
import '../../components/shop-owner/ShopOwnerLayout.css';

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayOrders: 0,
    todayProducts: 0,
    avgRating: 0,
    growth: '0%',
    chartLabels: [],
    chartData: [],
    topProducts: []
  });
  const [loading, setLoading] = useState(true);
  const chartRef = React.useRef(null);
  const chartInstance = React.useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Get user info to get shopId
        const userInfo = await getShopOwnerInfo();
        const shopId = userInfo.userId; // Assuming userId is shopId

        // 2. Get Sales Analytics (Revenue, Orders, Growth, Chart, Top Products)
        const analyticsData = await getSalesAnalytics();

        // 3. Get Shop Stats (Product Count, Avg Rating) - Optional if analytics covers it
        // AnalyticsDto has todayProducts (count), but we need Avg Rating
        const shopStats = await getShopStats(shopId);

        setStats({
          todayRevenue: analyticsData.todayRevenue || 0,
          todayOrders: analyticsData.todayOrders || 0,
          todayProducts: analyticsData.todayProducts || 0, // Or shopStats.productCount
          avgRating: shopStats.avgRating || 0,
          growth: analyticsData.growth || '0%',
          chartLabels: analyticsData.chartLabels || [],
          chartData: analyticsData.chartData || [],
          topProducts: analyticsData.topProducts || []
        });

      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Initialize/Update Chart
  useEffect(() => {
    if (loading || !chartRef.current) return;

    // Destroy existing chart if any
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');

    // Default data if empty
    const labels = stats.chartLabels.length > 0 ? stats.chartLabels : ['No Data'];
    const data = stats.chartData.length > 0 ? stats.chartData : [0];

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Revenue (VNĐ)',
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
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(context.parsed.y);
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false,
              drawBorder: false
            }
          },
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

  if (loading) {
    return <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Sales Analytics</h1>
      </div>

      {/* Stats Cards */}
      <div className="todo-cards" style={{ marginBottom: '30px' }}>
        <div className="todo-card">
          <div className="count" style={{ fontSize: '28px', color: '#4e73df' }}>
            {stats.todayRevenue.toLocaleString()}₫
          </div>
          <div className="label">
            <i className="fas fa-dollar-sign"></i>
            Today's Revenue
          </div>
          <div className={`badge ${stats.growth.startsWith('+') ? 'bg-success' : 'bg-danger'}`} style={{ marginTop: '10px' }}>
            {stats.growth}
          </div>
        </div>
        <div className="todo-card">
          <div className="count" style={{ fontSize: '32px' }}>{stats.todayOrders}</div>
          <div className="label">
            <i className="fas fa-shopping-cart"></i>
            Today's Orders
          </div>
        </div>
        <div className="todo-card">
          <div className="count" style={{ fontSize: '32px' }}>{stats.todayProducts}</div>
          <div className="label">
            <i className="fas fa-box"></i>
            Products on Sale
          </div>
        </div>
        <div className="todo-card">
          <div className="count" style={{ fontSize: '32px' }}>
            {stats.avgRating.toFixed(1)} <span style={{ fontSize: '16px', color: '#f6c23e' }}><i className="fas fa-star"></i></span>
          </div>
          <div className="label">
            <i className="fas fa-star"></i>
            Average Rating
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="analytics-section">
        <div className="section-title">Revenue Chart - Last 7 Days</div>
        <div className="analytics-content">
          <div style={{ height: '300px', width: '100%' }}>
            <canvas ref={chartRef}></canvas>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="analytics-section" style={{ marginTop: '20px' }}>
        <div className="section-title">Best Selling Products</div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Sold</th>
                <th>Revenue</th>
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
                  <td colSpan="3" className="text-center text-muted">No sales data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
