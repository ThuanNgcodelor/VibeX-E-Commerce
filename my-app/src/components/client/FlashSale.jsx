import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import flashSaleAPI from '../../api/flashSale/flashSaleAPI';
import { fetchProductImageById, fetchProductById } from '../../api/product';

export default function FlashSale({ isPage = false }) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState({});
  const [timeLeft, setTimeLeft] = useState(null); // { hours, minutes, seconds }

  // Timer interval ref
  const timerRef = useRef(null);

  useEffect(() => {
    loadSessions();
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadProducts(selectedSessionId);
      startCountdown(selectedSessionId);
    }
  }, [selectedSessionId, sessions]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      // Fetch ALL public sessions (Admin created)
      const allSessions = await flashSaleAPI.getPublicSessions();

      if (allSessions && allSessions.length > 0) {
        // Sort by start time
        const sorted = allSessions.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
        setSessions(sorted);

        // Find currently active session or the first upcoming one
        const now = new Date();
        const active = sorted.find(s => new Date(s.startTime) <= now && new Date(s.endTime) > now);

        if (active) {
          setSelectedSessionId(active.id);
        } else if (sorted.length > 0) {
          // If no active session, select the first one (upcoming)
          setSelectedSessionId(sorted[0].id);
        }
      } else {
        setSessions([]);
      }
    } catch (error) {
      console.error('Failed to load flash sale sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async (sessionId) => {
    try {
      setLoading(true);
      const productsData = await flashSaleAPI.getPublicSessionProducts(sessionId);
      const approved = productsData.filter(p => p.status === 'APPROVED');

      // Fetch full product details to get real stock
      const detailedProducts = await Promise.all(approved.map(async (p) => {
        try {
          const detailRes = await fetchProductById(p.productId);
          const detail = detailRes.data;

          // Calculate total physical stock from sizes
          let totalStock = 0;
          if (detail && detail.sizes && Array.isArray(detail.sizes)) {
            totalStock = detail.sizes.reduce((sum, s) => sum + (Number(s.stock) || 0), 0);
          }

          return { ...p, productStock: totalStock };
        } catch (err) {
          console.error("Failed to fetch product detail:", p.productId);
          return { ...p, productStock: 0 };
        }
      }));

      setProducts(detailedProducts);
      loadProductImages(detailedProducts);
    } catch (error) {
      console.error('Failed to load products for session:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProductImages = async (products) => {
    const urls = {};
    for (const product of products) {
      if (product.productImageId && !imageUrls[product.productId]) { // Avoid refetching if already exists
        try {
          const imgRes = await fetchProductImageById(product.productImageId);
          const contentType = imgRes.headers["content-type"] || "image/jpeg";
          const blob = new Blob([imgRes.data], { type: contentType });
          urls[product.productId] = URL.createObjectURL(blob);
        } catch (err) {
          console.error(`Failed to load image for product ${product.productId}:`, err);
        }
      }
    }
    setImageUrls(prev => ({ ...prev, ...urls }));
  };

  const startCountdown = (sessionId) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const updateTimer = () => {
      const now = new Date();
      const start = new Date(session.startTime);
      const end = new Date(session.endTime);

      let target;
      if (now < start) {
        target = start; // Counting down to start
      } else if (now >= start && now < end) {
        target = end; // Counting down to end
      } else {
        setTimeLeft(null); // Ended
        return;
      }

      const diff = target - now;
      if (diff <= 0) {
        // If transitioning from UPCOMING -> ONGOING, reload to update UI
        // If ONGOING -> ENDED, also reload
        loadSessions();
        return;
      }

      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0')
      });
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
  };

  const getSessionStatus = (session) => {
    if (!session) return 'ENDED';
    const now = new Date();
    const start = new Date(session.startTime);
    const end = new Date(session.endTime);

    if (now >= start && now < end) return 'ONGOING';
    if (now < start) return 'UPCOMING';
    return 'ENDED';
  };

  const formatVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";

  // Check if current selected session is upcoming
  const isSelectedSessionUpcoming = () => {
    const session = sessions.find(s => s.id === selectedSessionId);
    if (!session) return false;
    return new Date() < new Date(session.startTime);
  };

  // Don't render if no sessions found
  if (!loading && sessions.length === 0) {
    if (isPage) {
      return (
        <div style={{
          background: 'white',
          padding: '40px',
          textAlign: 'center',
          marginTop: '8px',
          borderRadius: '8px'
        }}>
          <i className="fa fa-bolt" style={{ fontSize: '48px', color: '#ccc', marginBottom: '16px' }}></i>
          <h3 style={{ color: '#555', fontWeight: 500 }}>{t('flashSale.noFlashSale', 'There are no Flash Sale programs yet.')}</h3>
          <p style={{ color: '#888' }}>{t('flashSale.comeBackLater', ' Please come back later.!')}</p>
          <Link to="/" style={{
            display: 'inline-block',
            marginTop: '16px',
            padding: '8px 24px',
            background: '#ee4d2d',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px'
          }}>
            {t('flashSale.backToHome', 'Back to home')}
          </Link>
        </div>
      );
    }
    return null;
  }

  return (
    <div style={{ marginTop: '8px' }}>
      {/* Header & Timeline */}
      <div style={{ background: 'white', marginBottom: '0' }}>
        {/* Title Bar (only if not full page or if we want to show countdown specifically here) */}
        {!isPage && sessions.length > 0 && (
          <div className="container" style={{ maxWidth: '1200px', padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}>
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="fa fa-bolt" style={{ color: '#ee4d2d', fontSize: '24px' }}></i>
                  <h4 style={{ fontSize: '20px', color: '#ee4d2d', fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>
                    {t('flashSale.flashSale', 'FLASH SALE')}
                  </h4>
                </div>

                {/* Countdown for Homepage view */}
                {timeLeft && getSessionStatus(sessions.find(s => s.id === selectedSessionId)) === 'ONGOING' && (
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ color: '#333', fontSize: '14px' }}>{t('flashSale.endingIn', 'End')}</span>
                    <div className="d-flex gap-1">
                      <span style={{ background: 'black', color: 'white', padding: '2px 4px', borderRadius: '2px', fontWeight: 'bold' }}>{timeLeft.hours}</span>
                      <span style={{ fontWeight: 'bold' }}>:</span>
                      <span style={{ background: 'black', color: 'white', padding: '2px 4px', borderRadius: '2px', fontWeight: 'bold' }}>{timeLeft.minutes}</span>
                      <span style={{ fontWeight: 'bold' }}>:</span>
                      <span style={{ background: 'black', color: 'white', padding: '2px 4px', borderRadius: '2px', fontWeight: 'bold' }}>{timeLeft.seconds}</span>
                    </div>
                  </div>
                )}
              </div>

              <Link to="/flash-sale" style={{ color: '#ee4d2d', textDecoration: 'none', fontSize: '14px' }}>
                {t('flashSale.viewAll', 'Xem tất cả')} →
              </Link>
            </div>
          </div>
        )}

        {/* Timeline Bar - Shopee Style (Only on Full Page) */}
        {isPage && (
          <div style={{ background: '#333', color: 'white' }}>
            <div className="container" style={{ maxWidth: '1200px', padding: 0 }}>
              <div className="d-flex justify-content-center overflow-auto" style={{ scrollbarWidth: 'none' }}>
                {sessions.map(session => {
                  const status = getSessionStatus(session);
                  const isSelected = session.id === selectedSessionId;

                  return (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      style={{
                        flex: '1 0 140px',
                        maxWidth: '200px',
                        textAlign: 'center',
                        padding: '12px 8px',
                        cursor: 'pointer',
                        background: isSelected ? '#ee4d2d' : 'transparent',
                        opacity: isSelected ? 1 : 0.7,
                        transition: 'all 0.2s',
                        borderRight: '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      <div style={{ fontSize: '18px', fontWeight: 600 }}>{formatTime(session.startTime)}</div>
                      <div style={{ fontSize: '12px' }}>
                        {status === 'ONGOING' ? t('flashSale.ongoing', 'In progress') :
                          status === 'UPCOMING' ? t('flashSale.upcoming', 'Coming soon') : t('flashSale.ended', 'End')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ background: isPage ? 'transparent' : 'white', padding: '24px 0' }}>
        <div className="container" style={{ maxWidth: '1200px' }}>

          {/* Banner/Timer section for Page View */}
          {isPage && timeLeft && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '4px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px', border: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: '16px', fontWeight: 500, color: '#ee4d2d', textTransform: 'uppercase' }}>
                {getSessionStatus(sessions.find(s => s.id === selectedSessionId)) === 'ONGOING' ? t('flashSale.ongoing', 'In progress') : t('flashSale.upcoming', 'Coming soon')}
              </div>
              {getSessionStatus(sessions.find(s => s.id === selectedSessionId)) === 'ONGOING' && (
                <div className="d-flex align-items-center gap-2">
                  <span style={{ color: '#333' }}>{t('flashSale.endingIn', 'End')}</span>
                  <div className="d-flex gap-1" style={{ fontSize: '16px' }}>
                    <span style={{ background: '#333', color: 'white', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{timeLeft.hours}</span>
                    <span style={{ fontWeight: 'bold' }}>:</span>
                    <span style={{ background: '#333', color: 'white', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{timeLeft.minutes}</span>
                    <span style={{ fontWeight: 'bold' }}>:</span>
                    <span style={{ background: '#333', color: 'white', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{timeLeft.seconds}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Product List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <i className="fa fa-spinner fa-spin" style={{ fontSize: '24px', color: '#ee4d2d' }}></i>
            </div>
          ) : products.length > 0 ? (
            <div className="row g-2">
              {products.map((product) => {
                const isUpcoming = isSelectedSessionUpcoming();
                const percentage = Math.min(((product.soldCount || 0) / (product.flashSaleStock || 1)) * 100, 100);
                const discountPercent = Math.round(((product.originalPrice - product.salePrice) / product.originalPrice) * 100);

                return (
                  <div key={product.id} className={isPage ? "col-lg-2 col-md-3 col-6" : "col-auto"} style={!isPage ? { width: '180px' } : {}}>
                    <Link
                      to={!isUpcoming ? `/product/${product.productId}` : '#'}
                      style={{
                        display: 'block',
                        background: 'white',
                        border: '1px solid #f0f0f0',
                        borderRadius: '4px',
                        padding: '12px',
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                        height: '100%',
                        cursor: isUpcoming ? 'default' : 'pointer',
                        position: 'relative' // Ensure positioning context
                      }}
                      onMouseEnter={(e) => {
                        if (!isUpcoming) {
                          e.currentTarget.style.borderColor = '#ee4d2d';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(238,77,45,0.15)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#f0f0f0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ position: 'relative', marginBottom: '8px' }}>
                        {/* Image */}
                        <div
                          style={{
                            width: '100%',
                            paddingBottom: '100%',
                            background: '#f5f5f5',
                            borderRadius: '4px',
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          {imageUrls[product.productId] ? (
                            <img
                              src={imageUrls[product.productId]}
                              alt={product.productName}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                            />
                          ) : (
                            <i className="fa fa-image" style={{
                              position: 'absolute', top: '50%', left: '50%',
                              transform: 'translate(-50%, -50%)', fontSize: '32px', color: '#ccc'
                            }}></i>
                          )}

                          {/* Overlay for Upcoming */}
                          {isUpcoming && (
                            <div style={{
                              position: 'absolute',
                              top: 0, left: 0, right: 0, bottom: 0,
                              background: 'rgba(0,0,0,0.05)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                            </div>
                          )}
                        </div>

                        {/* Discount Tag */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: 'rgba(255, 212, 36, .9)',
                            color: '#ee4d2d',
                            padding: '2px 6px',
                            borderRadius: '2px',
                            fontSize: '11px',
                            fontWeight: 600
                          }}
                        >
                          -{discountPercent}%
                        </div>
                      </div>

                      {/* Product Name */}
                      <div style={{
                        fontSize: '14px',
                        color: '#333',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '1.2em',
                        height: '2.4em'
                      }}>
                        {product.productName || product.name}
                      </div>

                      {/* Price info */}
                      <div style={{ fontSize: '16px', fontWeight: 600, color: '#ee4d2d', marginBottom: '4px', textAlign: 'left' }}>
                        {formatVND(product.salePrice)}
                      </div>

                      <div style={{ fontSize: '12px', color: '#888', textDecoration: 'line-through', marginBottom: '8px', textAlign: 'left' }}>
                        {formatVND(product.originalPrice)}
                      </div>

                      {/* Stock Bar or Status Button */}
                      {!isUpcoming ? (
                        (product.flashSaleStock - (product.soldCount || 0) <= 0) ? (
                          <div style={{
                            textAlign: 'center',
                            background: '#ccc',
                            color: 'white',
                            padding: '4px 0',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600
                          }}>
                            {t('flashSale.soldOut', 'Out of stock')}
                          </div>
                        ) : (
                          <div style={{ position: 'relative', marginTop: '8px' }}>
                            <div style={{
                              background: '#ffbda6',
                              borderRadius: '8px',
                              height: '16px',
                              width: '100%',
                              position: 'relative',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                background: '#ee4d2d',
                                height: '100%',
                                borderRadius: '8px',
                                width: `${Math.max(0, Math.min(100, ((product.productStock || 0) / (product.flashSaleStock + (product.soldCount || 0))) * 100))}%`,
                                transition: 'width 0.5s ease'
                              }}></div>
                            </div>
                            <div style={{
                              position: 'absolute',
                              top: '0',
                              left: '0',
                              width: '100%',
                              height: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              color: 'white',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              textShadow: '0 0 2px rgba(0,0,0,0.2)'
                            }}>
                              {t('flashSale.remaining', 'Remaining:')} {product.productStock || 0}
                            </div>
                          </div>
                        )
                      ) : (
                        <div style={{
                          textAlign: 'center',
                          background: '#f0f0f0',
                          color: '#888',
                          padding: '4px 0',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600
                        }}>
                          {t('flashSale.comingSoon', 'Coming soon')}
                        </div>
                      )}
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
              {t('flashSale.noProducts', 'No products are available during this time slot.')}
            </div>
          )}
        </div>

        {/* View All button for Homepage (if in horizontal scroll mode) */}
        {!isPage && products.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Link to="/flash-sale" className="btn-view-all" style={{
              display: 'inline-block',
              padding: '8px 40px',
              background: 'white',
              border: '1px solid #e0e0e0',
              color: '#555',
              textDecoration: 'none',
              borderRadius: '4px',
              transition: 'all 0.2s'
            }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f8f8f8';
                e.target.style.borderColor = '#ccc';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'white';
                e.target.style.borderColor = '#e0e0e0';
              }}>
              {t('flashSale.viewAll', 'View all')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
