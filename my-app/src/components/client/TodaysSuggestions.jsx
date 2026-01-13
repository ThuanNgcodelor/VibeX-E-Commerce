import React, { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import imgFallback from "../../assets/images/shop/6.png";
import Loading from "./Loading.jsx";
import {
  fetchProductImageById,
  fetchProducts,
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
  const [imageUrls, setImageUrls] = useState({});
  const createdUrlsRef = useRef([]);

  const topProducts = useMemo(() => {
    const safe = Array.isArray(products) ? products.slice() : [];
    const withStock = safe.map((p) => {
      let totalStock = 0;
      if (p.sizes && Array.isArray(p.sizes)) {
        totalStock = p.sizes.reduce((sum, size) => {
          return sum + (Number(size.stock) || 0);
        }, 0);
      }
      return { ...p, stock: totalStock };
    });
    const inStock = withStock.filter((p) => p.stock > 0);
    const sorted = inStock.sort((a, b) => b.stock - a.stock);
    return sorted.slice(0, 20);
  }, [products]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetchProducts();
        setProducts(res.data ? res.data : []);
      } catch (error) {
        console.error("Failed to fetch products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  useEffect(() => {
    if (topProducts.length === 0) {
      setImageUrls({});
      return;
    }

    let isActive = true;
    const newUrls = {};
    const tempCreatedUrls = [];

    const loadImages = async () => {
      await Promise.all(
        topProducts.map(async (product) => {
          try {
            if (product.imageId) {
              const res = await fetchProductImageById(product.imageId);
              const contentType = res.headers?.["content-type"] || "image/png";
              if (USE_OBJECT_URL) {
                const blob = new Blob([res.data], { type: contentType });
                const url = URL.createObjectURL(blob);
                newUrls[product.id] = url;
                tempCreatedUrls.push(url);
              } else {
                newUrls[product.id] = arrayBufferToDataUrl(
                  res.data,
                  contentType
                );
              }
            } else {
              newUrls[product.id] = imgFallback;
            }
          } catch {
            newUrls[product.id] = imgFallback;
          }
        })
      );

      if (!isActive) return;

      if (USE_OBJECT_URL && createdUrlsRef.current.length) {
        createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      }
      createdUrlsRef.current = tempCreatedUrls;
      setImageUrls(newUrls);
    };

    loadImages();

    return () => {
      isActive = false;
      if (USE_OBJECT_URL && createdUrlsRef.current.length) {
        createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        createdUrlsRef.current = [];
      }
    };
  }, [topProducts]);

  const formatVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";
  const calculateDiscount = (original, current) => {
    if (!original || original === current) return 0;
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
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h4 style={{ fontSize: '16px', color: '#757575', textTransform: 'uppercase', margin: 0 }}>
            {t('home.todaysSuggestions')}
          </h4>
          <Link to="/shop" style={{ fontSize: '14px', color: '#ee4d2d', textDecoration: 'none' }}>
            {t('home.viewMore')}
          </Link>
        </div>
        
        <div className="row g-3">
          {topProducts.map((product) => {
            const discount = calculateDiscount(product.originalPrice, product.price);
            return (
              <div className="col-6 col-md-4 col-lg-2" key={product.id}>
                <Link
                  to={`/product/${product.id}`}
                  style={{
                    textDecoration: 'none',
                    display: 'block',
                    background: 'white',
                    border: '1px solid #f0f0f0',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    transition: 'all 0.2s'
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
                  <div style={{ position: 'relative', paddingBottom: '100%', background: '#f5f5f5' }}>
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
                    {discount > 0 && (
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
                        -{discount}%
                      </div>
                    )}
                  </div>
                  
                  <div style={{ padding: '8px' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#333',
                        marginBottom: '8px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '1.4',
                        minHeight: '36px'
                      }}
                    >
                      {product.name}
                    </div>
                    
                    <div>
                      <div style={{ fontSize: '16px', color: '#ee4d2d', fontWeight: 600 }}>
                        {formatVND(product.price)}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

