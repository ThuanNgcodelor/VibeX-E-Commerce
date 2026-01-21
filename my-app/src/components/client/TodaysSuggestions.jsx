import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import imgFallback from "../../assets/images/shop/6.png";
import Loading from "./Loading.jsx";
import {
  fetchProductImageById,
  fetchPersonalizedRecommendations,
} from "../../api/product.js";

const USE_OBJECT_URL = true;

const arrayBufferToDataUrl = (buffer, contentType) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++)
    binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return `data:${contentType || "image/png"};base64,${base64}`;
};

export default function TodaysSuggestions() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [imageUrls, setImageUrls] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Track created URLs for cleanup
  const createdUrlsRef = useRef([]);

  const pageSize = 24; // Use a multiple of 6 (2, 3, 4, 6 col)

  const loadProductsData = async (currentPage) => {
    try {
      if (currentPage === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      // Using fetchPersonalizedRecommendations (Personalized API)
      const res = await fetchPersonalizedRecommendations(currentPage, pageSize);

      let newProducts = [];
      // Backend for recommendations returns List<RecommendationResponse> directly as res.data
      if (Array.isArray(res.data)) {
        newProducts = res.data.map(p => {
          // Calculate discount if not provided or format structure
          const originalPrice = p.originalPrice || 0;
          const price = p.price || 0;
          const discount = (originalPrice > price)
            ? Math.round(((originalPrice - price) / originalPrice) * 100 * 10) / 10
            : 0;

          return {
            ...p,
            id: p.productId, // Map productId from RecommendationResponse to id for UI
            discountPercent: discount,
          };
        });
      }

      // If fewer items than pageSize, we reached the end
      if (newProducts.length < pageSize) {
        setHasMore(false);
      }

      if (newProducts.length > 0) {
        // Load images for NEW products only
        const newUrls = {};

        await Promise.all(
          newProducts.map(async (product) => {
            try {
              if (product.imageId) {
                // Fetch image
                const resImg = await fetchProductImageById(product.imageId);
                const contentType = resImg.headers?.["content-type"] || "image/png";

                if (USE_OBJECT_URL) {
                  const blob = new Blob([resImg.data], { type: contentType });
                  const url = URL.createObjectURL(blob);
                  newUrls[product.id] = url;
                  createdUrlsRef.current.push(url);
                } else {
                  newUrls[product.id] = arrayBufferToDataUrl(resImg.data, contentType);
                }
              } else {
                // No image ID
                newUrls[product.id] = imgFallback;
              }
            } catch (err) {
              console.warn("Failed to load image for product", product.id);
              newUrls[product.id] = imgFallback;
            }
          })
        );

        setImageUrls(prev => ({ ...prev, ...newUrls }));

        if (currentPage === 1) {
          setProducts(newProducts);
        } else {
          setProducts(prev => [...prev, ...newProducts]);
        }
      } else {
        if (currentPage === 1) setProducts([]);
        setHasMore(false);
      }

    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
      if (currentPage === 1) setProducts([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadProductsData(1);

    // Cleanup function
    return () => {
      // Revoke all URLs on unmount
      if (USE_OBJECT_URL && createdUrlsRef.current.length) {
        createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        createdUrlsRef.current = [];
      }
    };
  }, []);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadProductsData(nextPage);
  };

  const formatVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";

  const calculateDiscount = (original, current) => {
    if (!original || original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  };

  if (loading) {
    return (
      <div style={{ background: 'white', padding: '24px 0', marginTop: '8px' }}>
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div className="text-center py-5">
            <Loading />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', padding: '24px 0', marginTop: '8px' }}>
      <div className="container" style={{ maxWidth: '1200px' }}>
        {/* Header */}
        <div style={{
          borderBottom: '4px solid #ee4d2d',
          paddingBottom: '16px',
          marginBottom: '24px',
          position: 'relative',
          textAlign: 'center'
        }}>
          <h4 style={{
            fontSize: '18px',
            color: '#ee4d2d',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            margin: 0,
            display: 'inline-block',
            background: 'white',
            padding: '0 20px',
          }}>
            {t('home.todaysSuggestions')}
          </h4>
        </div>

        <div className="row g-2">
          {products.map((product) => {
            const discount = calculateDiscount(product.originalPrice, product.price);
            return (
              <div className="col-6 col-md-4 col-lg-2" key={product.id}>
                <Link
                  to={`/product/${product.id}`}
                  style={{
                    textDecoration: 'none',
                    display: 'block',
                    background: 'white',
                    border: '1px solid transparent',
                    boxShadow: '0 1px 2px 0 rgba(0,0,0,.1)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    height: '100%',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#ee4d2d';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.zIndex = 1;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.zIndex = 'auto';
                  }}
                >
                  {/* Image Container */}
                  <div style={{ position: 'relative', paddingBottom: '100%' }}>
                    <img
                      src={imageUrls[product.id] || imgFallback}
                      onError={(e) => {
                        e.currentTarget.src = imgFallback;
                      }}
                      alt={product.name}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />

                    {/* Discount Badge */}
                    {discount > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          backgroundColor: 'rgba(255, 212, 36, .9)',
                          padding: '4px 6px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2,
                          lineHeight: 1
                        }}
                      >
                        <span style={{ color: '#ee4d2d', fontWeight: 700, fontSize: '12px' }}>{discount}%</span>
                        <span style={{ color: 'white', textTransform: 'uppercase', fontWeight: 700, fontSize: '12px' }}>GIẢM</span>
                      </div>
                    )}

                    {/* Overlay "Yêu thích" - Mockup based on screenshot */}
                    {/* <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: '-4px',
                        background: '#ee4d2d',
                        color: 'white',
                        fontSize: '10px',
                        padding: '2px 6px 2px 4px',
                        borderRadius: '0 2px 2px 0',
                        fontWeight: 500
                    }}>
                        Yêu thích
                    </div> */}
                  </div>

                  {/* Content */}
                  <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', height: 'calc(100% - 100%)' }}>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#333',
                        marginBottom: '8px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '14px',
                        minHeight: '28px'
                      }}
                      title={product.name}
                    >
                      {product.name}
                    </div>

                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '16px', color: '#ee4d2d', fontWeight: 600 }}>
                        {formatVND(product.price)}
                      </div>
                      {product.soldCount > 0 && (
                        <div style={{ fontSize: '10px', color: '#757575' }}>
                          Đã bán {product.soldCount >= 1000 ? `${(product.soldCount / 1000).toFixed(1)}k` : product.soldCount}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Load More Button */}
        {hasMore && (
          <div className="text-center mt-4">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              style={{
                background: 'white',
                border: '1px solid #ddd',
                color: '#555',
                padding: '8px 40px',
                borderRadius: '4px',
                fontSize: '14px',
                cursor: 'pointer',
                minWidth: '240px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!loadingMore) {
                  e.currentTarget.style.background = '#f8f8f8';
                  e.currentTarget.style.borderColor = '#ccc';
                }
              }}
              onMouseLeave={(e) => {
                if (!loadingMore) {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = '#ddd';
                }
              }}
            >
              {loadingMore ? 'Loading...' : t('home.viewMore', 'Xem thêm')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
