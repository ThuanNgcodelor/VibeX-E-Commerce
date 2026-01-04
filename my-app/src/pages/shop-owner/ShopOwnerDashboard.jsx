import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../components/shop-owner/ShopOwnerLayout.css';
import { getProductStats, getDashboardStats } from '../../api/shopOwner';

export default function ShopOwnerDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    pending: 0,
    confirmed: 0,
    readyToShip: 0,
    shipped: 0,
    delivered: 0,
    completed: 0,
    cancelled: 0,
    returned: 0,
    salesToday: 0,
    bannedProducts: 0,
    outOfStockProducts: 0
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [productStats, dashboardStats] = await Promise.all([
          getProductStats(),
          getDashboardStats()
        ]);

        setStats({
          pending: dashboardStats.pending || 0,
          confirmed: dashboardStats.confirmed || 0,
          readyToShip: dashboardStats.readyToShip || 0,
          shipped: dashboardStats.shipped || 0,
          delivered: dashboardStats.delivered || 0,
          completed: dashboardStats.completed || 0,
          cancelled: dashboardStats.cancelled || 0,
          returned: dashboardStats.returned || 0,
          salesToday: dashboardStats.salesToday || 0,
          bannedProducts: productStats.bannedProducts || 0,
          outOfStockProducts: productStats.outOfStockProducts || 0
        });
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  /* Removed local TodoCard, using the one defined at bottom */


  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>{t('shopOwner.dashboard.title')}</h1>
      </div>

      <div className="row g-4">
        {/* Main Content Area (Left Column) */}
        <div className="col-lg-8">

          {/* To-Do List Section */}
          <div className="dashboard-section bg-white p-4 rounded shadow-sm">
            <div className="section-title d-flex justify-content-between align-items-center mb-4">
              <span style={{ fontSize: '1.125rem', fontWeight: '500' }}>{t('shopOwner.dashboard.todoList')}</span>
              <span className="text-muted small">{t('shopOwner.dashboard.thingsToDo')}</span>
            </div>

            <div className="row g-0 text-center">
              <div className="col-3 border-end position-relative">
                <TodoCard
                  count={stats.pending}
                  label={t('shopOwner.dashboard.toProcess')}
                  link="/shop-owner/orders/bulk-shipping?status=PENDING"
                  specialClass="no-border"
                />
              </div>
              <div className="col-3 border-end position-relative">
                <TodoCard
                  count={stats.confirmed + stats.readyToShip}
                  label={t('shopOwner.dashboard.preparing', 'Đang chuẩn bị')}
                  link="/shop-owner/orders/bulk-shipping?status=CONFIRMED"
                />
              </div>
              <div className="col-3 border-end position-relative">
                <TodoCard
                  count={stats.shipped + stats.delivered + stats.completed}
                  label={t('shopOwner.dashboard.processed')}
                  link="/shop-owner/orders/bulk-shipping?status=SHIPPED"
                />
              </div>
              <div className="col-3 border-end position-relative">
                <TodoCard
                  count={stats.cancelled + stats.returned}
                  label={t('shopOwner.dashboard.cancelledReturn')}
                  link="/shop-owner/orders/returns"
                />
              </div>
              <div className="col-3 position-relative">
                <TodoCard
                  count={stats.bannedProducts}
                  label={t('shopOwner.dashboard.suspendedProducts')}
                  link="/shop-owner/products"
                />
              </div>
            </div>
          </div>

          {/* Business Insights Section */}
          <div className="dashboard-section bg-white p-4 rounded shadow-sm mt-4">
            <div className="section-title d-flex justify-content-between align-items-center mb-4">
              <span style={{ fontSize: '1.125rem', fontWeight: '500' }}>{t('shopOwner.dashboard.businessInsights')}</span>
              <Link to="/shop-owner/analytics" className="view-more-link text-decoration-none" style={{ fontSize: '0.9rem' }}>
                {t('shopOwner.dashboard.viewMore')} <i className="fas fa-chevron-right small"></i>
              </Link>
            </div>

            <p className="text-muted small mb-4">
              {t('shopOwner.dashboard.today')} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} {t('shopOwner.dashboard.changedVsYesterday')}
            </p>

            <div className="row">
              <div className="col-md-6 border-end">
                <div className="p-3">
                  <h5 className="text-muted mb-2 small">{t('shopOwner.dashboard.salesToday')}</h5>
                  <h2 style={{ color: '#ee4d2d' }}>{formatCurrency(stats.salesToday)}</h2>
                </div>
              </div>
              <div className="col-md-6">
                <div className="p-3">
                  <h5 className="text-muted mb-2 small">{t('shopOwner.dashboard.orders')}</h5>
                  <h2>{stats.pending + stats.confirmed + stats.readyToShip + stats.shipped + stats.delivered + stats.completed + stats.cancelled + stats.returned}</h2>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (Marketing/News) */}
        <div className="col-lg-4">
          {/* Featured News */}
          <div className="dashboard-section bg-white p-4 rounded shadow-sm">
            <div className="section-title d-flex justify-content-between align-items-center mb-4">
              <span style={{ fontSize: '1.125rem', fontWeight: '500' }}>{t('shopOwner.dashboard.announcements')}</span>
              <a href="#" className="view-more-link text-decoration-none" style={{ fontSize: '0.9rem' }}>
                {t('shopOwner.dashboard.viewMore')} <i className="fas fa-chevron-right small"></i>
              </a>
            </div>

            <div className="promo-card bg-light p-3 rounded mb-3 d-flex align-items-center justify-content-between" style={{ cursor: 'pointer' }}>
              <div className="promo-content">
                <h6 className="mb-1 fw-bold" style={{ fontSize: '0.9rem' }}>{t('shopOwner.dashboard.salesExplosion')}</h6>
                <p className="mb-1 small text-danger fw-bold">
                  <i className="fas fa-mobile-alt me-1"></i>
                  {t('shopOwner.dashboard.maximizeCapital')}
                </p>
                <div className="promo-highlight small text-muted" style={{ fontSize: '0.8rem' }}>
                  {t('shopOwner.dashboard.noMortgageRequired')}
                </div>
              </div>
              <div className="promo-icon text-muted" style={{ fontSize: '2rem' }}>
                <i className="fas fa-chart-line"></i>
              </div>
            </div>

            {/* Placeholders for other news */}
            <div className="news-item py-2 border-bottom">
              <div className="text-dark small fw-bold">{t('shopOwner.dashboard.newOperationFeatures')}</div>
              <div className="text-muted small" style={{ fontSize: '0.8rem' }}>{t('shopOwner.dashboard.easilyTrackBestSelling')}</div>
            </div>
            <div className="news-item py-2">
              <div className="text-dark small fw-bold">{t('shopOwner.dashboard.optimizeBidsOnPromoDays')}</div>
              <div className="text-muted small" style={{ fontSize: '0.8rem' }}>{t('shopOwner.dashboard.boostVisibilityDuringSuperSales')}</div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

const TodoCard = ({ count, label, link, specialClass }) => (
  <Link to={link} className={`d-block text-decoration-none py-2 ${specialClass}`} style={{ color: 'inherit' }}>
    <div className="count fw-bold" style={{ fontSize: '1.5rem', color: '#ee4d2d' }}>{count}</div>
    <div className="label text-muted small mt-1">
      {label}
    </div>
  </Link>
);
