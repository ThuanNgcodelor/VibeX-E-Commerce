import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { isAuthenticated } from "../../api/auth.js";
import { getRecentlyViewedProducts } from "../../api/recommendation.js";
import imgFallback from "../../assets/images/shop/6.png";

/**
 * RecentlyViewed - Hiển thị sản phẩm đã xem gần đây
 * Chỉ render khi người dùng đã đăng nhập VÀ có data
 */
export default function RecentlyViewed() {
    const { t } = useTranslation();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef(null);

    // Check authentication
    const isLoggedIn = isAuthenticated();

    useEffect(() => {
        if (!isLoggedIn) {
            setLoading(false);
            return;
        }

        const loadRecentlyViewed = async () => {
            try {
                // Get recently viewed products with details
                const data = await getRecentlyViewedProducts(10);

                if (Array.isArray(data) && data.length > 0) {
                    setProducts(data);
                } else {
                    setProducts([]);
                }
            } catch (error) {
                console.error("Failed to load recently viewed:", error);
                setProducts([]);
            } finally {
                setLoading(false);
            }
        };

        loadRecentlyViewed();
    }, [isLoggedIn]);



    const formatVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";

    const scroll = (direction) => {
        if (scrollRef.current) {
            const scrollAmount = 200;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    // Don't render if not logged in or no products
    if (!isLoggedIn || loading) return null;
    if (products.length === 0) return null;

    return (
        <div style={{ background: 'white', padding: '16px 0', marginTop: '8px' }}>
            <div className="container" style={{ maxWidth: '1200px' }}>
                {/* Header */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: '20px' }}>⏰</span>
                        <h4 style={{
                            fontSize: '16px',
                            color: '#333',
                            textTransform: 'uppercase',
                            margin: 0,
                            fontWeight: 600
                        }}>
                            {t('recommendations.recentlyViewed', 'Đã xem gần đây')}
                        </h4>
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
                        {t('recommendations.viewMore', 'Xem tiếp')}
                    </Link>
                </div>

                {/* Scrollable Products */}
                <div style={{ position: 'relative' }}>
                    {/* Left Arrow */}
                    <button
                        onClick={() => scroll('left')}
                        style={{
                            position: 'absolute',
                            left: '-20px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: '1px solid #ddd',
                            background: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                    >
                        ←
                    </button>

                    {/* Products Container */}
                    <div
                        ref={scrollRef}
                        style={{
                            display: 'flex',
                            gap: '12px',
                            overflowX: 'auto',
                            scrollBehavior: 'smooth',
                            paddingBottom: '8px',
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none'
                        }}
                    >
                        {products.map((product) => (
                            <Link
                                key={product.id}
                                to={`/product/${product.id}`}
                                style={{
                                    textDecoration: 'none',
                                    flexShrink: 0,
                                    width: '160px',
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
                                        src={product.imageId ? `/v1/file-storage/get/${product.imageId}` : imgFallback}
                                        onError={(e) => { e.currentTarget.src = imgFallback; }}
                                        alt={product.name}
                                        loading="lazy"
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                </div>
                                <div style={{ padding: '8px' }}>
                                    <div style={{
                                        fontSize: '12px',
                                        color: '#333',
                                        marginBottom: '4px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {product.name}
                                    </div>
                                    <div style={{ fontSize: '14px', color: '#ee4d2d', fontWeight: 600 }}>
                                        {formatVND(product.price)}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Right Arrow */}
                    <button
                        onClick={() => scroll('right')}
                        style={{
                            position: 'absolute',
                            right: '-20px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10,
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: '1px solid #ddd',
                            background: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                    >
                        →
                    </button>
                </div>
            </div>
        </div>
    );
}
