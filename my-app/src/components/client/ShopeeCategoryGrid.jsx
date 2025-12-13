import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function ShopeeCategoryGrid() {
  const { t } = useTranslation();
  const categories = [
    { id: 1, name: "Men's Fashion", icon: '👔', link: '/shop?category=men', color: '#4A90E2' },
    { id: 2, name: 'Phones & Accessories', icon: '📱', link: '/shop?category=phone', color: '#50C878' },
    { id: 3, name: 'Electronics', icon: '💻', link: '/shop?category=electronics', color: '#FF6B6B' },
    { id: 4, name: 'Computers & Laptops', icon: '💻', link: '/shop?category=laptop', color: '#9B59B6' },
    { id: 5, name: 'Cameras & Camcorders', icon: '📷', link: '/shop?category=camera', color: '#E67E22' },
    { id: 6, name: 'Watches', icon: '⌚', link: '/shop?category=watch', color: '#3498DB' },
    { id: 7, name: "Men's Shoes", icon: '👟', link: '/shop?category=shoes', color: '#1ABC9C' },
    { id: 8, name: 'Home Appliances', icon: '🔌', link: '/shop?category=home', color: '#E74C3C' },
    { id: 9, name: 'Sports & Travel', icon: '⚽', link: '/shop?category=sports', color: '#F39C12' },
    { id: 10, name: 'Cars & Bikes', icon: '🏍️', link: '/shop?category=vehicles', color: '#16A085' },
    { id: 11, name: "Women's Fashion", icon: '👗', link: '/shop?category=women', color: '#E91E63' },
    { id: 12, name: 'Mom & Baby', icon: '👶', link: '/shop?category=baby', color: '#FFC107' },
    { id: 13, name: 'Home & Living', icon: '🏠', link: '/shop?category=living', color: '#795548' },
    { id: 14, name: 'Beauty', icon: '💄', link: '/shop?category=beauty', color: '#EC407A' },
    { id: 15, name: 'Health', icon: '💊', link: '/shop?category=health', color: '#66BB6A' },
    { id: 16, name: "Women's Shoes", icon: '👠', link: '/shop?category=womenshoes', color: '#AB47BC' },
    { id: 17, name: "Women's Bags", icon: '👜', link: '/shop?category=bag', color: '#FF7043' },
    { id: 18, name: "Women's Accessories & Jewelry", icon: '💍', link: '/shop?category=jewelry', color: '#FFA726' },
  ];

  return (
    <div style={{ background: 'white', padding: '24px 0', marginTop: '8px' }}>
      <div className="container" style={{ maxWidth: '1200px' }}>
        <h4 style={{ 
          fontSize: '16px', 
          color: '#757575', 
          marginBottom: '16px', 
          textTransform: 'uppercase',
          fontWeight: 500
        }}>
          {t('home.categories')}
        </h4>
        <div className="row g-2">
          {categories.map((cat) => (
            <div key={cat.id} className="col-6 col-md-4 col-lg-2">
              <Link
                to={cat.link}
                style={{
                  textDecoration: 'none',
                  display: 'block'
                }}
              >
                <div
                  style={{
                    background: 'white',
                    border: '1px solid #f0f0f0',
                    borderRadius: '4px',
                    padding: '16px 8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '100%'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#ee4d2d';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(238,77,45,0.15)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#f0f0f0';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>
                    {cat.icon}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#333',
                      lineHeight: '1.3'
                    }}
                  >
                    {cat.name}
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

