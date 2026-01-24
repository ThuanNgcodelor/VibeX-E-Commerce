import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { getTrendingKeywords, searchProducts } from '../../api/searchApi';
import { fetchProductImageById } from '../../api/product';

export default function TopSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [trendingData, setTrendingData] = useState([]); // [{keyword, image}]
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const keywords = await getTrendingKeywords(6);
        if (Array.isArray(keywords) && keywords.length > 0) {
          const dataWithImages = await Promise.all(keywords.map(async (keyword) => {
            try {
              const searchRes = await searchProducts({ query: keyword, size: 1 });
              let imageUrl = null;
              let sales = '0'; // Default if not found

              if (searchRes.products && searchRes.products.length > 0) {
                const p = searchRes.products[0];
                sales = p.soldCount > 0 ? p.soldCount : (Math.floor(Math.random() * 500) + 100);

                // Get the image
                let imgIdToFetch = null;
                if (p.imageIds && p.imageIds.length > 0) {
                  imgIdToFetch = p.imageIds[0];
                } else if (p.imageId) {
                  imgIdToFetch = p.imageId;
                }

                if (imgIdToFetch) {
                  try {
                    const imgRes = await fetchProductImageById(imgIdToFetch);
                    const contentType = imgRes.headers["content-type"] || "image/jpeg";
                    const blob = new Blob([imgRes.data], { type: contentType });
                    imageUrl = URL.createObjectURL(blob);
                  } catch (e) {
                    console.error('Error load img for', keyword, e);
                  }
                }
              }
              return { keyword, imageUrl, sales };
            } catch (err) {
              return { keyword, imageUrl: null, sales: '?' };
            }
          }));
          setTrendingData(dataWithImages);
        } else {
          setTrendingData([]);
        }
      } catch (error) {
        console.error("TopSearch error", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || trendingData.length === 0) return null;

  return (
    <div style={{ background: 'white', padding: '24px 0', marginTop: '8px' }}>
      <div className="container" style={{ maxWidth: '1200px' }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 style={{ fontSize: '18px', color: '#333', fontWeight: 600, margin: 0, textTransform: 'uppercase' }}>
            {t('home.topSearch')}
          </h4>
          <Link to="/shop" style={{ color: '#ee4d2d', textDecoration: 'none', fontSize: '14px' }}>
            {t('home.viewAll')}
          </Link>
        </div>

        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
          {trendingData.map((item, index) => (
            <Link
              key={index}
              to={`/shop?q=${encodeURIComponent(item.keyword)}`}
              style={{
                width: '180px',          // Fixed width
                minWidth: '180px',       // Prevent shrinking
                maxWidth: '180px',       // Prevent growing
                background: 'white',
                border: '1px solid #f0f0f0',
                borderRadius: '2px',
                textDecoration: 'none',
                transition: 'all 0.2s',
                flexShrink: 0,
                position: 'relative',
                display: 'block',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#ee4d2d';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(238,77,45,0.15)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#f0f0f0';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Badge Top */}
              <div
                style={{
                  position: 'absolute',
                  top: '0',
                  left: '0',
                  zIndex: 2,
                  background: index < 3 ? '#ee4d2d' : 'rgba(0,0,0,0.5)',
                  color: 'white',
                  width: '32px',
                  height: '34px',
                  clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)', // Ribbon shape
                  display: 'flex',
                  justifyContent: 'center',
                  paddingTop: '2px',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                #{index + 1}
              </div>

              {/* Image Area - Fixed 1:1 Aspect Ratio */}
              <div style={{
                position: 'relative',
                width: '180px',           // Fixed width
                height: '180px',          // Fixed height (square)
                background: '#f5f5f5',
                overflow: 'hidden'
              }}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.keyword} style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',   // Crop to fit, no distortion
                    objectPosition: 'center'
                  }} />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ccc',
                    fontSize: '40px'
                  }}>
                    {item.keyword.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Overlay text at bottom of image */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '100%',
                  background: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  padding: '4px 8px',
                  fontSize: '12px',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {t('search.sold')} {item.sales}
                </div>
              </div>

              {/* Keyword Name - Fixed height with ellipsis */}
              <div style={{
                padding: '10px',
                height: '64px',          // Fixed height for consistent card size
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div style={{
                  fontSize: '14px',
                  color: '#333',
                  fontWeight: 500,
                  textTransform: 'capitalize',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,      // Max 2 lines
                  WebkitBoxOrient: 'vertical',
                  lineHeight: '1.4',
                  maxHeight: '39px',       // 2 lines * 1.4 line-height * 14px
                  textAlign: 'left'
                }}>
                  {item.keyword}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#999',
                  textAlign: 'left',
                  whiteSpace: 'nowrap'
                }}>
                  {t('home.topSearch')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
