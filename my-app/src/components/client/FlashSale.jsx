import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function FlashSale() {
  const { t } = useTranslation();
  const flashSaleProducts = [
    { id: 1, name: 'Product 1', discount: 48, price: 265000, originalPrice: 510000, image: '🛍️', sold: 85 },
    { id: 2, name: 'Product 2', discount: 31, price: 40500, originalPrice: 59000, image: '📱', sold: 92 },
    { id: 3, name: 'Product 3', discount: 33, price: 26000, originalPrice: 39000, image: '💻', sold: 78 },
    { id: 4, name: 'Product 4', discount: 32, price: 29000, originalPrice: 43000, image: '⌚', sold: 65 },
    { id: 5, name: 'Product 5', discount: 17, price: 25000, originalPrice: 30000, image: '👟', sold: 45 },
    { id: 6, name: 'Product 6', discount: 74, price: 9000, originalPrice: 35000, image: '👔', sold: 98 }
  ];

  const formatVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";

  return (
    <div style={{ background: 'white', padding: '24px 0', marginTop: '8px' }}>
      <div className="container" style={{ maxWidth: '1200px' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2">
            <i className="fa fa-clock" style={{ color: '#ee4d2d', fontSize: '20px' }}></i>
            <h4 style={{ fontSize: '18px', color: '#ee4d2d', fontWeight: 600, margin: 0 }}>
              {t('home.flashSale')}
            </h4>
          </div>
          <Link to="/shop" style={{ color: '#ee4d2d', textDecoration: 'none', fontSize: '14px' }}>
            {t('home.viewAll')}
          </Link>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
          {flashSaleProducts.map((product) => (
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              style={{
                minWidth: 'clamp(150px, 20vw, 180px)',
                background: 'white',
                border: '1px solid #f0f0f0',
                borderRadius: '4px',
                padding: '12px',
                textDecoration: 'none',
                transition: 'all 0.2s',
                flexShrink: 0
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
              <div style={{ position: 'relative', marginBottom: '8px' }}>
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
                    position: 'relative'
                  }}
                >
                  {product.image}
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    left: '4px',
                    background: '#ee4d2d',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                >
                  12-12
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: '#ee4d2d',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                >
                  -{product.discount}%
                </div>
              </div>
              
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '16px', color: '#ee4d2d', fontWeight: 600 }}>
                  {formatVND(product.price)}
                </div>
                <div style={{ fontSize: '12px', color: '#999', textDecoration: 'line-through' }}>
                  {formatVND(product.originalPrice)}
                </div>
              </div>
              
              <div style={{ marginTop: '8px' }}>
                <div style={{ 
                  height: '4px', 
                  background: '#f0f0f0', 
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginBottom: '4px'
                }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${product.sold}%`,
                      background: '#ee4d2d',
                      transition: 'width 0.3s'
                    }}
                  />
                </div>
                <div style={{ fontSize: '11px', color: '#999' }}>
                  {product.sold >= 90 ? t('home.hotSelling') : t('home.soldPercent', { percent: product.sold })}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

