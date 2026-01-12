import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function TopSearch() {
  const { t } = useTranslation();
  const topProducts = [
    { id: 1, name: 'Bikini', sales: '9k+/month', image: '👙', category: 'Swimwear' },
    { id: 2, name: 'Halter Top', sales: '3k+/month', image: '👗', category: 'Fashion' },
    { id: 3, name: "Women's Swimwear", sales: '21k+/month', image: '👙', category: 'Swimwear' },
    { id: 4, name: 'Strapless Bra', sales: '45k+/month', image: '👙', category: 'Lingerie' },
    { id: 5, name: 'Mechanical Keyboard', sales: '17k+/month', image: '⌨️', category: 'Accessories' },
    { id: 6, name: 'Wireless Gaming Mouse', sales: '8k+/month', image: '🖱️', category: 'Gaming' }
  ];

  return (
    <div style={{ background: 'white', padding: '24px 0', marginTop: '8px' }}>
      <div className="container" style={{ maxWidth: '1200px' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 style={{ fontSize: '18px', color: '#333', fontWeight: 600, margin: 0 }}>
            {t('home.topSearch')}
          </h4>
          <Link to="/shop" style={{ color: '#ee4d2d', textDecoration: 'none', fontSize: '14px' }}>
            {t('home.viewAll')}
          </Link>
        </div>

        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
          {topProducts.map((product) => (
            <Link
              key={product.id}
              to={`/shop?q=${encodeURIComponent(product.name)}`}
              style={{
                minWidth: 'clamp(150px, 20vw, 180px)',
                background: 'white',
                border: '1px solid #f0f0f0',
                borderRadius: '4px',
                padding: '12px',
                textDecoration: 'none',
                transition: 'all 0.2s',
                flexShrink: 0,
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#ee4d2d';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(238,77,45,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#f0f0f0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  background: '#ee4d2d',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '2px',
                  fontSize: '10px',
                  fontWeight: 600
                }}
              >
                {t('home.top')}
              </div>

              <div
                style={{
                  width: '100%',
                  paddingBottom: '100%',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '48px',
                  marginBottom: '8px',
                  marginTop: '20px'
                }}
              >
                {product.image}
              </div>

              <div style={{ fontSize: '12px', color: '#ee4d2d', marginBottom: '4px', fontWeight: 500 }}>
                {t('search.sold')} {product.sales}
              </div>
              <div style={{ fontSize: '13px', color: '#333' }}>
                {product.name}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

