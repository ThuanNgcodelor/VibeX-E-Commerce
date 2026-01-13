import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getTrendingProductsWithDetails } from "../../api/recommendation.js";
import { fetchProductImageById } from "../../api/product.js";
import imgFallback from "../../assets/images/shop/6.png";
import Loading from "./Loading.jsx";

/**
 * TrendingProducts - Hiển thị sản phẩm xu hướng
 * Hiển thị cho cả Guest và User
 * Sử dụng Recommendation API để lấy full product details
 */
export default function TrendingProducts() {
    const { t } = useTranslation();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [imageUrls, setImageUrls] = useState({});
    const createdUrlsRef = useRef([]);

    useEffect(() => {
        const loadTrendingProducts = async () => {
            try {
                // Get trending products with full details from recommendation API
                const recommendedProducts = await getTrendingProductsWithDetails(12);
                setProducts(recommendedProducts || []);
            } catch (error) {
                console.error("Failed to load trending products:", error);
                setProducts([]);
            } finally {
                setLoading(false);
            }
        };

        loadTrendingProducts();
    }, []);

    // Load product images
    useEffect(() => {
        if (products.length === 0) {
            setImageUrls({});
            return;
        }

        let isActive = true;
        const newUrls = {};
        const tempCreatedUrls = [];

        const loadImages = async () => {
            await Promise.all(
                products.map(async (product) => {
                    const pid = product.productId || product.id;
                    try {
                        if (product.imageId) {
                            const res = await fetchProductImageById(product.imageId);
                            const contentType = res.headers?.["content-type"] || "image/png";
                            const blob = new Blob([res.data], { type: contentType });
                            const url = URL.createObjectURL(blob);
                            newUrls[pid] = url;
                            tempCreatedUrls.push(url);
                        } else {
                            newUrls[pid] = imgFallback;
                        }
                    } catch {
                        newUrls[pid] = imgFallback;
                    }
                })
            );

            if (!isActive) return;

            if (createdUrlsRef.current.length) {
                createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
            }
            createdUrlsRef.current = tempCreatedUrls;
            setImageUrls(newUrls);
        };

        loadImages();

        return () => {
            isActive = false;
            if (createdUrlsRef.current.length) {
                createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
                createdUrlsRef.current = [];
            }
        };
    }, [products]);

    const formatVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";
    const calculateDiscount = (original, current) => {
        if (!original || original === current) return 0;
        return Math.round(((original - current) / original) * 100);
    };

    // Don't render if no products (after loading)
    if (loading) {
        return (
            <div style={{ background: 'white', padding: '24px 0', marginTop: '8px' }}>
                <div className="container" style={{ maxWidth: '1200px' }}>
                    <div className="text-center py-4">
                        <Loading />
                    </div>
                </div>
            </div>
        );
    }

    if (products.length === 0) return null;

    return (
        <div style={{ background: 'white', padding: '24px 0', marginTop: '8px' }}>
            <div className="container" style={{ maxWidth: '1200px' }}>
                {/* Header */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: '20px' }}>📈</span>
                        <h4 style={{
                            fontSize: '16px',
                            color: '#333',
                            textTransform: 'uppercase',
                            margin: 0,
                            fontWeight: 600
                        }}>
                            {t('recommendations.trending', 'Sản phẩm xu hướng')}
                        </h4>
                        <span style={{
                            background: 'linear-gradient(135deg, #ff6b35, #ee4d2d)',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            animation: 'pulse 2s infinite'
                        }}>
                            🔥 Hot
                        </span>
                    </div>
                    <Link
                        to="/products"
                        style={{
                            fontSize: '14px',
                            color: '#ee4d2d',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        {t('home.viewMore', 'Xem thêm')}
                    </Link>
                </div>

                {/* Products Grid */}
                <div className="row g-3">
                    {products.map((product) => {
                        const pid = product.productId || product.id;
                        const discount = calculateDiscount(product.originalPrice, product.price);
                        return (
                            <div className="col-6 col-md-4 col-lg-2" key={pid}>
                                <Link
                                    to={`/product/${pid}`}
                                    style={{
                                        textDecoration: 'none',
                                        display: 'block',
                                        background: 'white',
                                        border: '1px solid #f0f0f0',
                                        borderRadius: '4px',
                                        overflow: 'hidden',
                                        transition: 'all 0.2s',
                                        position: 'relative'
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
                                            src={imageUrls[pid] || imgFallback}
                                            onError={(e) => { e.currentTarget.src = imgFallback; }}
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
                                        {/* Trending Badge */}
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '4px',
                                                left: '4px',
                                                background: 'linear-gradient(135deg, #ff6b35, #ee4d2d)',
                                                color: 'white',
                                                padding: '2px 6px',
                                                borderRadius: '2px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '2px'
                                            }}
                                        >
                                            🔥 {t('recommendations.trendingBadge', 'Xu hướng')}
                                        </div>
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

            {/* CSS Animation */}
            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>
        </div>
    );
}
