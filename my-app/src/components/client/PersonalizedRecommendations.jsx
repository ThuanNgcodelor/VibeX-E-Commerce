import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { isAuthenticated } from "../../api/auth.js";
import { getRecentlyViewed } from "../../api/tracking.js";
import { fetchProductById, fetchProductImageById, fetchProducts } from "../../api/product.js";
import imgFallback from "../../assets/images/shop/6.png";
import Loading from "./Loading.jsx";

/**
 * PersonalizedRecommendations - "Có thể bạn quan tâm"
 * Hiển thị sản phẩm đề xuất dựa trên hành vi người dùng
 * Chỉ render khi người dùng đã đăng nhập
 */
export default function PersonalizedRecommendations() {
    const { t } = useTranslation();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [imageUrls, setImageUrls] = useState({});
    const [recommendReason, setRecommendReason] = useState("");
    const createdUrlsRef = useRef([]);

    const isLoggedIn = isAuthenticated();

    useEffect(() => {
        if (!isLoggedIn) {
            setLoading(false);
            return;
        }

        const loadRecommendations = async () => {
            try {
                // Get recently viewed product IDs
                const recentlyViewedIds = await getRecentlyViewed(5);

                if (!recentlyViewedIds || recentlyViewedIds.length === 0) {
                    setProducts([]);
                    setLoading(false);
                    return;
                }

                // Get first viewed product for recommendation reason
                let firstProductName = "";
                try {
                    const firstRes = await fetchProductById(recentlyViewedIds[0]);
                    firstProductName = firstRes.data?.name || "";

                    // Get category of first product
                    const categoryId = firstRes.data?.categoryId;

                    if (categoryId) {
                        // Fetch products from same category
                        const allProducts = await fetchProducts();
                        const categoryProducts = allProducts.data
                            .filter(p => p.categoryId === categoryId && !recentlyViewedIds.includes(p.id))
                            .slice(0, 12);

                        setProducts(categoryProducts);
                        setRecommendReason(firstProductName);
                    } else {
                        // Fallback: get random products
                        const allProducts = await fetchProducts();
                        const randomProducts = allProducts.data
                            .filter(p => !recentlyViewedIds.includes(p.id))
                            .sort(() => Math.random() - 0.5)
                            .slice(0, 12);

                        setProducts(randomProducts);
                        setRecommendReason(firstProductName);
                    }
                } catch (error) {
                    console.error("Failed to get recommendations:", error);
                    setProducts([]);
                }
            } catch (error) {
                console.error("Failed to load recommendations:", error);
                setProducts([]);
            } finally {
                setLoading(false);
            }
        };

        loadRecommendations();
    }, [isLoggedIn]);

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
                    try {
                        if (product.imageId) {
                            const res = await fetchProductImageById(product.imageId);
                            const contentType = res.headers?.["content-type"] || "image/png";
                            const blob = new Blob([res.data], { type: contentType });
                            const url = URL.createObjectURL(blob);
                            newUrls[product.id] = url;
                            tempCreatedUrls.push(url);
                        } else {
                            newUrls[product.id] = imgFallback;
                        }
                    } catch {
                        newUrls[product.id] = imgFallback;
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

    // Don't render if not logged in
    if (!isLoggedIn) return null;

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
        <div style={{
            background: 'linear-gradient(180deg, #fff5f4 0%, #ffffff 100%)',
            padding: '24px 0',
            marginTop: '8px',
            borderTop: '2px solid #ee4d2d'
        }}>
            <div className="container" style={{ maxWidth: '1200px' }}>
                {/* Header */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <span style={{ fontSize: '20px' }}>🎯</span>
                            <h4 style={{
                                fontSize: '16px',
                                color: '#ee4d2d',
                                textTransform: 'uppercase',
                                margin: 0,
                                fontWeight: 600
                            }}>
                                {t('recommendations.forYou', 'Có thể bạn quan tâm')}
                            </h4>
                        </div>
                        {recommendReason && (
                            <p style={{
                                fontSize: '13px',
                                color: '#757575',
                                margin: 0,
                                marginLeft: '28px'
                            }}>
                                {t('recommendations.because', 'Vì bạn đã xem')}: {recommendReason}
                            </p>
                        )}
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
                                            src={imageUrls[product.id] || imgFallback}
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
                                        {/* AI Badge */}
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: '4px',
                                                left: '4px',
                                                background: 'linear-gradient(135deg, #667eea, #764ba2)',
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
        </div>
    );
}
