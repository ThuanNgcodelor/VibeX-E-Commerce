import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import Header from "../../components/client/Header.jsx";
import ShopInfoBar from "../../components/client/product/ShopInfoBar.jsx";
import { fetchProductById, fetchProductImageById, fetchAddToCart } from "../../api/product.js";
import { fetchReviewsByProductId } from "../../api/review.js";
import { getCart, getShopOwnerByUserId } from "../../api/user.js";
import { useCart } from "../../contexts/CartContext.jsx";
import { translateAttributeName, translateAttributeValue } from "../../utils/attributeTranslator.js";
import imgFallback from "../../assets/images/shop/6.png";

const USE_OBJECT_URL = true;

const arrayBufferToDataUrl = (buffer, contentType) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    return `data:${contentType};base64,${base64}`;
};

export default function ProductDetailPage() {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const { setCart } = useCart();
    const [product, setProduct] = useState(null);
    const [shopOwner, setShopOwner] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedSizeId, setSelectedSizeId] = useState(null);
    const [qty, setQty] = useState(1);
    const [imgUrl, setImgUrl] = useState(null);
    const [imageUrls, setImageUrls] = useState([]); // All images/videos
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [hoveredThumbnailIndex, setHoveredThumbnailIndex] = useState(null); // For hover preview
    const [lightboxOpen, setLightboxOpen] = useState(false); // Lightbox modal
    const [lightboxIndex, setLightboxIndex] = useState(0); // Current image in lightbox
    const [activeLightboxImages, setActiveLightboxImages] = useState([]); // Images currently in lightbox
    const createdUrlsRef = useRef([]);
    const [error, setError] = useState(null);
    const [posting, setPosting] = useState(false);
    const [detailTab, setDetailTab] = useState("spec");
    const [reviewFilter, setReviewFilter] = useState("All");
    const [reviews, setReviews] = useState([]);
    const [isFlashSale, setIsFlashSale] = useState(true);

    // Sync Flash Sale state with product data
    useEffect(() => {
        if (product && product.flashSaleRemaining !== undefined && product.flashSaleRemaining !== null) {
            setIsFlashSale(true);
        } else {
            setIsFlashSale(false);
        }
    }, [product]);

    // Note: ProductDetailPage is now public - guest can view products
    // But some actions (add to cart, buy now) require authentication
    useEffect(() => {
        const load = async () => {
            try {
                setError(null);
                const res = await fetchProductById(id);
                const p = res.data;
                setProduct(p);

                // Load shop owner info if userId exists
                if (p?.userId) {
                    try {
                        const shopData = await getShopOwnerByUserId(p.userId);
                        setShopOwner(shopData);
                    } catch (err) {
                        // Shop owner loading failed, continue without it
                        // Guest users may not have access, which is fine
                        console.log('Shop owner info not available:', err.message);
                    }
                }

                // Load all images/videos
                const allImageIds = [];
                if (p?.imageId) allImageIds.push(p.imageId);
                if (Array.isArray(p?.imageIds) && p.imageIds.length > 0) {
                    p.imageIds.forEach(id => {
                        if (id && !allImageIds.includes(id)) {
                            allImageIds.push(id);
                        }
                    });
                }

                if (allImageIds.length > 0) {
                    const loadedUrls = [];
                    for (let i = 0; i < allImageIds.length; i++) {
                        try {
                            const imgRes = await fetchProductImageById(allImageIds[i]);
                            const contentType = imgRes.headers["content-type"] || "image/jpeg";
                            let url;
                            if (USE_OBJECT_URL && imgRes.data) {
                                const blob = new Blob([imgRes.data], { type: contentType });
                                url = URL.createObjectURL(blob);
                                createdUrlsRef.current.push(url);
                            } else {
                                url = arrayBufferToDataUrl(imgRes.data, contentType);
                            }
                            loadedUrls.push({ url, type: contentType.startsWith('video/') ? 'video' : 'image' });
                            if (i === 0) {
                                setImgUrl(url);
                            }
                        } catch {
                            // Skip failed images
                        }
                    }
                    setImageUrls(loadedUrls);
                    if (loadedUrls.length > 0 && !imgUrl) {
                        setImgUrl(loadedUrls[0].url);
                    }
                }

                // Load reviews
                try {
                    const reviewsRes = await fetchReviewsByProductId(id);
                    setReviews(reviewsRes.data || []);
                } catch (err) {
                    console.error("Failed to load reviews", err);
                }
            } catch (e) {
                setError(e?.response?.data?.message || e.message || "Failed to load product");
            } finally {
                setLoading(false);
            }
        };
        load();
        return () => {
            if (USE_OBJECT_URL && createdUrlsRef.current.length) {
                createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
                createdUrlsRef.current = [];
            }
        };
    }, [id]);

    // Keyboard navigation for lightbox
    useEffect(() => {
        if (!lightboxOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft') {
                setLightboxIndex((prev) => (prev > 0 ? prev - 1 : activeLightboxImages.length - 1));
            } else if (e.key === 'ArrowRight') {
                setLightboxIndex((prev) => (prev < activeLightboxImages.length - 1 ? prev + 1 : 0));
            } else if (e.key === 'Escape') {
                setLightboxOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxOpen, activeLightboxImages.length]);

    const priceDisplay = useMemo(() => {
        if (!product) return "";
        const { price, originalPrice, discountPercent } = product;
        if (discountPercent && discountPercent > 0 && originalPrice && originalPrice > price) {
            return (
                <div className="d-flex align-items-center gap-2">
                    <span className="fs-4 fw-bold">
                        {price.toLocaleString("vi-VN")} ₫
                    </span>
                    <span className="text-decoration-line-through text-muted">
                        {originalPrice.toLocaleString("vi-VN")} ₫
                    </span>
                    <span className="badge bg-danger">-{discountPercent}%</span>
                </div>
            );
        }
        return (
            <span className="fs-4 fw-bold">
                {(product.price || 0).toLocaleString("vi-VN")} ₫
            </span>
        );
    }, [product]);

    const onAddToCart = async () => {
        if (!product) return;

        if (product.sizes && product.sizes.length > 0 && !selectedSizeId) {
            setError("Please select a size before adding to cart.");
            return;
        }

        try {
            setPosting(true);
            setError(null);

            const requestData = {
                productId: product.id,
                quantity: Number(qty) || 1,
                isFlashSale: isFlashSale
            };

            if (selectedSizeId) {
                requestData.sizeId = selectedSizeId;
            }

            await fetchAddToCart(requestData);
            const cart = await getCart();
            setCart(cart);

            window.dispatchEvent(new CustomEvent('cart-updated'));

        } catch (e) {
            if (e?.response?.status === 403 || e?.response?.status === 401) {
                // Redirect to login if not authenticated
                toast.error(t("auth.loginRequired"));
                navigate("/login");
            } else {
                let msg = e?.response?.data?.message || e.message || "Failed to add to cart";
                if (msg.includes("INSUFFICIENT_STOCK")) {
                    const available = msg.split(":")[1];
                    msg = t('cart.insufficientStock', `Insufficient stock. Only ${available} items available.`);
                }
                setError(msg);
            }
        } finally {
            setPosting(false);
        }
    };

    return (
        <div className="wrapper">
            <Header />
            <main className="main-content">
                <div className="container py-4">
                    {loading && <p>Loading product...</p>}
                    {error && <div className="alert alert-danger">{error}</div>}
                    {product && (
                        <>
                            <div className="row g-4" style={{ display: 'flex', alignItems: 'stretch' }}>
                                {/* Product Image Gallery - Left Side */}
                                <div className="col-md-5" style={{ display: 'flex' }}>
                                    <div className="bg-white border rounded-3 p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)', width: '100%', display: 'flex', flexDirection: 'column' }}>
                                        {/* Main Image/Video Display - Clickable to open lightbox */}
                                        <div
                                            className="d-flex justify-content-center align-items-center position-relative mb-3"
                                            style={{
                                                aspectRatio: '1 / 1',
                                                backgroundColor: '#fafafa',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                cursor: imageUrls.length > 0 ? 'pointer' : 'default'
                                            }}
                                            onClick={() => {
                                                if (imageUrls.length > 0) {
                                                    setActiveLightboxImages(imageUrls);
                                                    setLightboxIndex(currentImageIndex);
                                                    setLightboxOpen(true);
                                                }
                                            }}
                                        >
                                            {(() => {
                                                // Show hovered thumbnail preview if hovering, otherwise show current selected
                                                const displayIndex = hoveredThumbnailIndex !== null ? hoveredThumbnailIndex : currentImageIndex;
                                                const displayItem = imageUrls.length > 0 && imageUrls[displayIndex] ? imageUrls[displayIndex] : null;

                                                if (displayItem) {
                                                    return displayItem.type === 'video' ? (
                                                        <video
                                                            src={displayItem.url}
                                                            controls
                                                            style={{
                                                                width: "100%",
                                                                height: "100%",
                                                                objectFit: "cover"
                                                            }}
                                                        />
                                                    ) : (
                                                        <img
                                                            src={displayItem.url}
                                                            onError={(e) => (e.currentTarget.src = imgFallback)}
                                                            alt={product.name}
                                                            style={{
                                                                width: "100%",
                                                                height: "100%",
                                                                objectFit: "cover"
                                                            }}
                                                        />
                                                    );
                                                }
                                                return (
                                                    <img
                                                        src={imgUrl || imgFallback}
                                                        onError={(e) => (e.currentTarget.src = imgFallback)}
                                                        alt={product.name}
                                                        style={{
                                                            width: "100%",
                                                            height: "100%",
                                                            objectFit: "cover"
                                                        }}
                                                    />
                                                );
                                            })()}
                                        </div>

                                        {/* Thumbnails with Navigation */}
                                        {imageUrls.length > 1 && (
                                            <div className="position-relative">
                                                <div
                                                    className="d-flex gap-2 overflow-auto"
                                                    style={{
                                                        maxWidth: '100%',
                                                        scrollBehavior: 'smooth',
                                                        padding: '0 40px'
                                                    }}
                                                    id="thumbnail-scroll"
                                                >
                                                    {imageUrls.map((item, index) => (
                                                        <div
                                                            key={index}
                                                            onClick={() => setCurrentImageIndex(index)}
                                                            onMouseEnter={() => setHoveredThumbnailIndex(index)}
                                                            onMouseLeave={() => setHoveredThumbnailIndex(null)}
                                                            style={{
                                                                minWidth: '80px',
                                                                height: '80px',
                                                                border: currentImageIndex === index ? '3px solid #ee4d2d' : '1px solid #ddd',
                                                                borderRadius: '8px',
                                                                overflow: 'hidden',
                                                                cursor: 'pointer',
                                                                flexShrink: 0,
                                                                backgroundColor: '#fff',
                                                                transition: 'border-color 0.2s'
                                                            }}
                                                        >
                                                            {item.type === 'video' ? (
                                                                <video
                                                                    src={item.url}
                                                                    style={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'cover'
                                                                    }}
                                                                    muted
                                                                />
                                                            ) : (
                                                                <img
                                                                    src={item.url}
                                                                    alt={`${product.name} ${index + 1}`}
                                                                    onError={(e) => (e.currentTarget.src = imgFallback)}
                                                                    style={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'cover'
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Navigation buttons for thumbnails */}
                                                {imageUrls.length > 5 && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="btn btn-light position-absolute"
                                                            style={{
                                                                left: '0',
                                                                top: '50%',
                                                                transform: 'translateY(-50%)',
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '50%',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                zIndex: 10,
                                                                padding: 0,
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                            }}
                                                            onClick={() => {
                                                                const container = document.getElementById('thumbnail-scroll');
                                                                if (container) {
                                                                    container.scrollBy({ left: -100, behavior: 'smooth' });
                                                                }
                                                            }}
                                                        >
                                                            <i className="fa fa-chevron-left" style={{ fontSize: '12px' }}></i>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-light position-absolute"
                                                            style={{
                                                                right: '0',
                                                                top: '50%',
                                                                transform: 'translateY(-50%)',
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '50%',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                zIndex: 10,
                                                                padding: 0,
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                            }}
                                                            onClick={() => {
                                                                const container = document.getElementById('thumbnail-scroll');
                                                                if (container) {
                                                                    container.scrollBy({ left: 100, behavior: 'smooth' });
                                                                }
                                                            }}
                                                        >
                                                            <i className="fa fa-chevron-right" style={{ fontSize: '12px' }}></i>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        {/* Spacer to ensure equal height with right column */}
                                        <div style={{ flexGrow: 1 }}></div>
                                    </div>
                                </div>

                                {/* Product Info - Right Side */}
                                <div className="col-md-7" style={{ display: 'flex' }}>
                                    <div className="bg-white border rounded-3 p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)', width: '100%', display: 'flex', flexDirection: 'column' }}>
                                        {/* Product Name */}
                                        <h1 className="mb-3" style={{ fontSize: '1.75rem', fontWeight: 500, lineHeight: 1.4 }}>
                                            {product.name}
                                        </h1>

                                        <div className="mb-3 d-flex align-items-center gap-3">
                                            <div className="d-flex align-items-center gap-1">
                                                <span style={{ color: '#ffc107', fontSize: '1rem' }}>★</span>
                                                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                                    {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : "0.0"}
                                                </span>
                                            </div>
                                            <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                                                ({reviews.length} reviews)
                                            </span>
                                            {product.soldOf > 0 && (
                                                <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                                                    | Sold: <strong>{product.soldOf}</strong>
                                                </span>
                                            )}
                                        </div>
                                        {/* Price Option Selection */}
                                        {product.flashSaleRemaining !== undefined && product.flashSaleRemaining !== null && (
                                            <div className="d-flex gap-2 mb-3">
                                                <button
                                                    className={`btn ${isFlashSale ? 'btn-danger' : 'btn-outline-danger'}`}
                                                    onClick={() => setIsFlashSale(true)}
                                                    style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
                                                >
                                                    {product.flashSaleRemaining <= 0 && <div style={{ position: 'absolute', top: 0, right: 0, background: '#333', color: '#fff', fontSize: '10px', padding: '2px 6px' }}>Hết suất</div>}
                                                    <div className="fw-bold"><i className="fas fa-bolt me-1"></i>Flash Sale</div>
                                                    <div style={{ fontSize: '0.9em' }}>{product.price?.toLocaleString("vi-VN")}₫</div>
                                                    <div style={{ fontSize: '0.75em' }}>Còn: {product.flashSaleRemaining}</div>
                                                </button>
                                                <button
                                                    className={`btn ${!isFlashSale ? 'btn-primary' : 'btn-outline-primary'}`}
                                                    onClick={() => setIsFlashSale(false)}
                                                    style={{ flex: 1 }}
                                                >
                                                    <div className="fw-bold">Giá Thường</div>
                                                    <div style={{ fontSize: '0.9em' }}>{product.originalPrice?.toLocaleString("vi-VN")}₫</div>
                                                    <div style={{ fontSize: '0.75em' }}>Có sẵn</div>
                                                </button>
                                            </div>
                                        )}

                                        {/* Price Display */}
                                        <div className="mb-4" style={{ padding: '16px', background: '#fafafa', borderRadius: '8px' }}>
                                            {isFlashSale && product.flashSaleRemaining !== undefined ? (
                                                <div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="fs-4 fw-bold text-danger">
                                                            {product.price?.toLocaleString("vi-VN")} ₫
                                                        </span>
                                                        <span className="text-decoration-line-through text-muted ms-2">
                                                            {product.originalPrice?.toLocaleString("vi-VN")} ₫
                                                        </span>
                                                        <span className="badge bg-danger">Flash Sale</span>
                                                    </div>

                                                    <div className="mt-2 pt-2 border-top" style={{ borderColor: '#e0e0e0' }}>
                                                        <div className="d-flex align-items-center justify-content-between mt-1">
                                                            <span style={{ fontSize: '0.85rem', color: '#555' }}>
                                                                Số lượng khuyến mãi:
                                                            </span>
                                                            <span className="badge bg-danger rounded-pill px-3">
                                                                Còn {product.flashSaleRemaining}
                                                            </span>
                                                        </div>
                                                        <div className="progress mt-2" style={{ height: '6px' }}>
                                                            <div
                                                                className="progress-bar bg-danger progress-bar-striped progress-bar-animated"
                                                                role="progressbar"
                                                                style={{ width: '100%' }}
                                                            ></div>
                                                        </div>
                                                        <small className="text-muted d-block mt-1 fst-italic" style={{ fontSize: '0.75rem' }}>
                                                            (Giá sẽ trở về mức gốc khi hết số lượng khuyến mãi)
                                                        </small>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        {/* Check if there's a regular discount (not flash sale) */}
                                                        {product.discountPercent && product.discountPercent > 0 && product.originalPrice && product.originalPrice > product.price ? (
                                                            <>
                                                                <span className="fs-4 fw-bold text-danger">
                                                                    {(product.price || 0).toLocaleString("vi-VN")} ₫
                                                                </span>
                                                                <span className="text-decoration-line-through text-muted">
                                                                    {product.originalPrice.toLocaleString("vi-VN")} ₫
                                                                </span>
                                                                <span className="badge bg-danger">-{product.discountPercent}%</span>
                                                            </>
                                                        ) : (
                                                            <span className="fs-4 fw-bold">
                                                                {(product.price || 0).toLocaleString("vi-VN")} ₫
                                                            </span>
                                                        )}
                                                        {/* Show "Giá gốc" label when user explicitly chose regular price over flash sale */}
                                                        {isFlashSale === false && product.flashSaleRemaining !== undefined && (
                                                            <span className="text-muted" style={{ fontSize: '0.8rem' }}>(Giá gốc)</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Vouchers (Placeholder for future development) */}
                                        <div className="mb-4">
                                            <div className="d-flex align-items-center gap-2 mb-2">
                                                <i className="fa fa-tag text-danger"></i>
                                                <strong style={{ fontSize: '0.9rem' }}>Shop Voucher</strong>
                                            </div>
                                            <div className="d-flex flex-wrap gap-2">
                                                <span className="badge bg-danger" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                                                    2% OFF
                                                </span>
                                                <span className="badge bg-danger" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                                                    3% OFF
                                                </span>
                                                {/* Add more vouchers here */}
                                            </div>
                                        </div>

                                        {/* Size Selection */}
                                        {product.sizes && product.sizes.length > 0 && (
                                            <div className="mb-4">
                                                <label className="form-label fw-bold mb-2" style={{ fontSize: '1rem' }}>
                                                    Select Size:
                                                </label>
                                                <div className="d-flex flex-wrap gap-2">
                                                    {product.sizes.map((size) => {
                                                        const isSelected = selectedSizeId === size.id;
                                                        const isOutOfStock = (size.stock || 0) <= 0;
                                                        return (
                                                            <button
                                                                key={size.id}
                                                                type="button"
                                                                onClick={() => !isOutOfStock && setSelectedSizeId(size.id)}
                                                                disabled={isOutOfStock}
                                                                style={{
                                                                    minWidth: '64px',
                                                                    padding: '8px 10px',
                                                                    fontSize: '0.82rem',
                                                                    fontWeight: 600,
                                                                    border: isSelected ? '2px solid #ee4d2d' : '1px solid #ccc',
                                                                    color: isSelected ? '#fff' : '#222',
                                                                    background: isSelected ? '#ee4d2d' : '#fff',
                                                                    borderRadius: '8px',
                                                                    opacity: isOutOfStock ? 0.5 : 1,
                                                                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                                                                    boxShadow: isSelected ? '0 2px 6px rgba(238,77,45,0.25)' : 'none',
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    if (!isSelected) {
                                                                        e.currentTarget.style.borderColor = '#ee4d2d';
                                                                        e.currentTarget.style.color = '#ee4d2d';
                                                                    }
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    if (!isSelected) {
                                                                        e.currentTarget.style.borderColor = '#ccc';
                                                                        e.currentTarget.style.color = '#222';
                                                                    }
                                                                }}
                                                            >
                                                                <div>{size.name}</div>
                                                                <small style={{ fontSize: '0.7rem', display: 'block', marginTop: '2px', color: isSelected ? '#fff' : '#666' }}>
                                                                    {isOutOfStock ? 'Out of stock' : `Stock: ${size.stock}`}
                                                                </small>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                {selectedSizeId && (
                                                    <p className="text-success mt-2 mb-0" style={{ fontSize: '0.875rem' }}>
                                                        <i className="fa fa-check-circle me-1"></i> Size selected
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Weight Display (if size selected) */}
                                        {selectedSizeId && (() => {
                                            const selectedSize = product.sizes?.find(s => s.id === selectedSizeId);
                                            const totalWeight = selectedSize?.weight ? selectedSize.weight * qty : null;
                                            return totalWeight ? (
                                                <div className="mb-3" style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                                                            {t('product.weight', 'Weight')}: <strong>{totalWeight.toLocaleString('vi-VN')}g</strong>
                                                            {selectedSize.weight && qty > 1 && (
                                                                <span className="text-muted" style={{ fontSize: '0.85rem', marginLeft: '4px' }}>
                                                                    ({selectedSize.weight}g × {qty})
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : null;
                                        })()}

                                        {/* Spacer to push buttons to bottom */}
                                        <div style={{ flexGrow: 1 }}></div>

                                        {/* Quantity and Action Buttons */}
                                        <div className="mt-auto">
                                            <div className="d-flex align-items-center gap-3 mb-3">
                                                <label className="form-label fw-bold mb-0" style={{ fontSize: '1rem', minWidth: '80px' }}>
                                                    Quantity:
                                                </label>
                                                <div className="d-flex align-items-center gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary"
                                                        style={{ width: '36px', height: '36px', padding: 0 }}
                                                        onClick={() => setQty(Math.max(1, qty - 1))}
                                                        disabled={qty <= 1}
                                                    >
                                                        <i className="fa fa-minus"></i>
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={selectedSizeId
                                                            ? product.sizes?.find(s => s.id === selectedSizeId)?.stock || 1
                                                            : product.stock || 1}
                                                        value={qty}
                                                        onChange={(e) => {
                                                            const val = Number(e.target.value);
                                                            const maxQty = selectedSizeId
                                                                ? product.sizes?.find(s => s.id === selectedSizeId)?.stock || 1
                                                                : product.stock || 1;
                                                            setQty(Math.max(1, Math.min(val || 1, maxQty)));
                                                        }}
                                                        className="form-control text-center"
                                                        style={{ width: '80px', height: '36px' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary"
                                                        style={{ width: '36px', height: '36px', padding: 0 }}
                                                        onClick={() => {
                                                            const maxQty = selectedSizeId
                                                                ? product.sizes?.find(s => s.id === selectedSizeId)?.stock || 1
                                                                : product.stock || 1;
                                                            setQty(Math.min(qty + 1, maxQty));
                                                        }}
                                                        disabled={qty >= (selectedSizeId
                                                            ? product.sizes?.find(s => s.id === selectedSizeId)?.stock || 1
                                                            : product.stock || 1)}
                                                    >
                                                        <i className="fa fa-plus"></i>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="d-flex gap-2">
                                                <button
                                                    disabled={posting || (product.sizes?.length > 0 && !selectedSizeId)}
                                                    className="btn btn-outline-danger flex-fill py-2 fw-bold"
                                                    style={{ fontSize: '0.9rem' }}
                                                    onClick={onAddToCart}
                                                >
                                                    {posting ? (
                                                        <>
                                                            <i className="fa fa-spinner fa-spin me-2"></i>
                                                            Adding...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="fa fa-shopping-cart me-2"></i>
                                                            ADD TO CART
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    disabled={posting || (product.sizes?.length > 0 && !selectedSizeId)}
                                                    className="btn btn-danger flex-fill py-2 fw-bold"
                                                    style={{ fontSize: '0.9rem' }}
                                                    onClick={async () => {
                                                        if (!product) return;
                                                        if (product.sizes && product.sizes.length > 0 && !selectedSizeId) {
                                                            setError("Please select a size before buying.");
                                                            return;
                                                        }
                                                        try {
                                                            setPosting(true);
                                                            setError(null);
                                                            const requestData = {
                                                                productId: product.id,
                                                                quantity: Number(qty) || 1,
                                                                isFlashSale: isFlashSale
                                                            };
                                                            if (selectedSizeId) {
                                                                requestData.sizeId = selectedSizeId;
                                                            }
                                                            await fetchAddToCart(requestData);
                                                            const cart = await getCart();
                                                            setCart(cart);
                                                            window.dispatchEvent(new CustomEvent('cart-updated'));
                                                            // Navigate to cart with product selection info
                                                            navigate('/cart', {
                                                                state: {
                                                                    selectProduct: {
                                                                        productId: product.id,
                                                                        sizeId: selectedSizeId
                                                                    }
                                                                }
                                                            });
                                                        } catch (e) {
                                                            if (e?.response?.status === 403 || e?.response?.status === 401) {
                                                                toast.error(t("auth.loginRequired"));
                                                                navigate("/login");
                                                            } else {
                                                                let msg = e?.response?.data?.message || e.message || "Failed to add to cart";
                                                                if (msg.includes("INSUFFICIENT_STOCK")) {
                                                                    const available = msg.split(":")[1];
                                                                    msg = t('cart.insufficientStock', `Insufficient stock. Only ${available} items available.`);
                                                                }
                                                                setError(msg);
                                                            }
                                                        } finally {
                                                            setPosting(false);
                                                        }
                                                    }}
                                                >
                                                    {posting ? (
                                                        <>
                                                            <i className="fa fa-spinner fa-spin me-2"></i>
                                                            Processing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            BUY NOW
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Share Section */}
                                        <div className="mt-4 pt-3 border-top">
                                            <div className="d-flex align-items-center gap-3">
                                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Share:</span>
                                                <div className="d-flex gap-2">
                                                    {[
                                                        { icon: 'fab fa-facebook-f', bg: '#e8f1ff', color: '#1877f2', title: 'Share on Facebook' },
                                                        { icon: 'fab fa-twitter', bg: '#e6f7ff', color: '#1da1f2', title: 'Share on Twitter' },
                                                        { icon: 'fab fa-pinterest', bg: '#ffecec', color: '#e60023', title: 'Share on Pinterest' },
                                                        { icon: 'fa fa-link', bg: '#f2f2f2', color: '#555', title: 'Copy link' },
                                                    ].map((btn, idx) => (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            className="btn btn-sm"
                                                            style={{
                                                                width: '36px',
                                                                height: '36px',
                                                                padding: 0,
                                                                background: btn.bg,
                                                                color: btn.color,
                                                                border: '1px solid rgba(0,0,0,0.05)',
                                                                borderRadius: '8px',
                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                                                            }}
                                                            title={btn.title}
                                                        >
                                                            <i className={btn.icon}></i>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {product && shopOwner && (
                        <>
                            {/* Full-width Shop Info Bar below product section */}
                            <div className="row mt-3">
                                <div className="col-12">
                                    <ShopInfoBar
                                        shopOwner={shopOwner}
                                        onViewShop={() => navigate(`/shop/${product.userId}`)}
                                        onChat={() => {
                                            // Dispatch event để mở chat với shop owner về sản phẩm này
                                            window.dispatchEvent(new CustomEvent('open-chat-with-product', {
                                                detail: {
                                                    shopOwnerId: product.userId,
                                                    productId: product.id
                                                }
                                            }));
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Mock Description & Reviews (static sample) */}
                            <div className="row mt-4">
                                <div className="col-12">
                                    <div className="bg-white border rounded-3 p-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                                        <div className="d-flex gap-3 border-bottom mb-3">
                                            <button
                                                type="button"
                                                className={`btn ${detailTab === "spec" ? "btn-light border" : "btn-link text-decoration-none text-dark"}`}
                                                onClick={() => setDetailTab("spec")}
                                                style={{ borderBottom: detailTab === "spec" ? "2px solid #0d6efd" : "2px solid transparent", borderRadius: 0 }}
                                            >
                                                {t('product.specifications.tab', 'Specifications')}
                                            </button>
                                            <button
                                                type="button"
                                                className={`btn ${detailTab === "reviews" ? "btn-light border" : "btn-link text-decoration-none text-dark"}`}
                                                onClick={() => setDetailTab("reviews")}
                                                style={{ borderBottom: detailTab === "reviews" ? "2px solid #0d6efd" : "2px solid transparent", borderRadius: 0 }}
                                            >
                                                {t('product.reviews.tab', 'Reviews')}
                                            </button>
                                        </div>

                                        {detailTab === "spec" && (
                                            <div className="d-flex flex-column gap-3">
                                                <div>
                                                    <h5 className="fw-semibold">{t('product.specifications.title', 'Product Information')}</h5>
                                                    <table className="table table-sm">
                                                        <tbody>
                                                            {(() => {
                                                                // Filter out attributes with empty values
                                                                const validAttributes = product.attributes
                                                                    ? Object.entries(product.attributes).filter(([key, value]) =>
                                                                        key && value && value.toString().trim() !== ''
                                                                    )
                                                                    : [];

                                                                if (validAttributes.length === 0) {
                                                                    return (
                                                                        <tr>
                                                                            <td colSpan="2" className="text-muted fst-italic">
                                                                                {t('product.specifications.noInformation', 'No additional information.')}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                }

                                                                return validAttributes.map(([key, value]) => (
                                                                    <tr key={key}>
                                                                        <th scope="row" style={{ width: '30%' }}>
                                                                            {translateAttributeName(key, t)}
                                                                        </th>
                                                                        <td>{translateAttributeValue(key, value, t)}</td>
                                                                    </tr>
                                                                ));
                                                            })()}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div>
                                                    <h5 className="fw-semibold">{t('product.specifications.description', 'Product Description')}</h5>
                                                    <div className="product-description" dangerouslySetInnerHTML={{ __html: product.description || `<p>${t('product.specifications.noDescription', 'No specific description.')}</p>` }} />
                                                </div>
                                            </div>
                                        )}
                                        {detailTab === "reviews" && (
                                            <div className="d-flex flex-column gap-3">


                                                {/* Summary */}
                                                <div className="d-flex flex-wrap align-items-center gap-4">
                                                    <div>
                                                        <div className="display-6 fw-bold text-danger">
                                                            {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : "0.0"}
                                                        </div>
                                                        <div className="text-warning" style={{ letterSpacing: '1px' }}>★★★★★</div>
                                                        <div className="text-muted">({reviews.length} reviews)</div>
                                                    </div>
                                                    <div className="d-flex flex-wrap gap-2">
                                                        {["All", "5 Stars", "4 Stars", "3 Stars", "2 Stars", "1 Star"].map((label, idx) => {
                                                            const active = reviewFilter === label;
                                                            // Calculate count for this filter
                                                            let count = 0;
                                                            if (label === "All") count = reviews.length;
                                                            else {
                                                                const star = parseInt(label.charAt(0));
                                                                count = reviews.filter(r => r.rating === star).length;
                                                            }

                                                            return (
                                                                <button
                                                                    key={idx}
                                                                    type="button"
                                                                    onClick={() => setReviewFilter(label)}
                                                                    className="btn btn-sm"
                                                                    style={{
                                                                        border: active ? '1px solid #ee4d2d' : '1px solid #ddd',
                                                                        background: active ? '#ee4d2d' : '#fff',
                                                                        color: active ? '#fff' : '#222',
                                                                        fontWeight: active ? 600 : 500,
                                                                        boxShadow: active ? '0 2px 6px rgba(238,77,45,0.2)' : 'none'
                                                                    }}
                                                                >
                                                                    {label} ({count})
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Review list */}
                                                <div className="d-flex flex-column gap-3">
                                                    {(() => {
                                                        const filtered = reviews.filter(r => {
                                                            // Hide reviews with no content (no text AND no images)
                                                            const hasContent = (r.comment && r.comment.trim().length > 0) || (r.imageIds && r.imageIds.length > 0);
                                                            if (!hasContent) return false;

                                                            if (reviewFilter === "All") return true;
                                                            const star = parseInt(reviewFilter.charAt(0));
                                                            return r.rating === star;
                                                        });

                                                        if (filtered.length === 0) {
                                                            return <div className="text-center text-muted py-4">No reviews found for this filter.</div>;
                                                        }

                                                        return filtered.map((rv, idx) => (
                                                            <div key={rv.id || idx} className="border rounded-3 p-3">
                                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                                    {/* Avatar */}
                                                                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', overflow: 'hidden', background: '#f0f0f0' }}>
                                                                        <img
                                                                            src={rv.userAvatar || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}
                                                                            alt="avatar"
                                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                            onError={(e) => { e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png" }}
                                                                        />
                                                                    </div>
                                                                    <div className="fw-semibold">{rv.username || rv.userId || 'User'}</div>
                                                                    <div className="text-warning" style={{ letterSpacing: '1px' }}>
                                                                        {"★★★★★".slice(0, rv.rating)}
                                                                    </div>
                                                                </div>
                                                                <div className="text-muted ms-5" style={{ fontSize: '0.8rem', marginTop: '-4px' }}>
                                                                    {rv.createdAt ? new Date(rv.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                                                                </div>

                                                                <div className="mb-2 mt-2 ms-5">{rv.comment}</div>

                                                                {rv.imageIds && rv.imageIds.length > 0 && (
                                                                    <div className="ms-5 mt-2">
                                                                        <ReviewImages
                                                                            imageIds={rv.imageIds}
                                                                            onImageClick={(index, urls) => {
                                                                                setActiveLightboxImages(urls.map(u => ({ url: u, type: 'image' })));
                                                                                setLightboxIndex(index);
                                                                                setLightboxOpen(true);
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}

                                                                {rv.reply && (
                                                                    <div className="bg-light p-3 rounded mt-2 ms-5 border-start border-4 border-success">
                                                                        <strong>{t('product.reviews.shopResponse')}:</strong>
                                                                        <p className="mb-0 mt-1">{rv.reply}</p>
                                                                        {rv.repliedAt && (
                                                                            <small className="text-muted">
                                                                                {new Date(rv.repliedAt).toLocaleString()}
                                                                            </small>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main >


            {/* Lightbox Modal */}
            {/* Lightbox Modal */}
            {
                lightboxOpen && activeLightboxImages.length > 0 && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            zIndex: 9999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px'
                        }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                setLightboxOpen(false);
                            }
                        }}
                    >
                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={() => setLightboxOpen(false)}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                background: 'rgba(255, 255, 255, 0.2)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                color: 'white',
                                fontSize: '24px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 10000
                            }}
                        >
                            ×
                        </button>

                        {/* Main Image/Video in Lightbox */}
                        <div
                            style={{
                                position: 'relative',
                                maxWidth: '90vw',
                                maxHeight: '90vh',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {activeLightboxImages[lightboxIndex]?.type === 'video' ? (
                                <video
                                    src={activeLightboxImages[lightboxIndex].url}
                                    controls
                                    autoPlay
                                    style={{
                                        maxWidth: '90vw',
                                        maxHeight: '90vh',
                                        objectFit: 'contain'
                                    }}
                                />
                            ) : (
                                <img
                                    src={activeLightboxImages[lightboxIndex]?.url || imgFallback}
                                    onError={(e) => (e.currentTarget.src = imgFallback)}
                                    alt={product?.name}
                                    style={{
                                        maxWidth: '90vw',
                                        maxHeight: '90vh',
                                        objectFit: 'contain'
                                    }}
                                />
                            )}

                            {/* Navigation Arrows in Lightbox */}
                            {activeLightboxImages.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLightboxIndex((prev) => (prev > 0 ? prev - 1 : activeLightboxImages.length - 1));
                                        }}
                                        style={{
                                            position: 'absolute',
                                            left: '20px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'rgba(255, 255, 255, 0.2)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '50px',
                                            height: '50px',
                                            color: 'white',
                                            fontSize: '24px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                                    >
                                        <i className="fa fa-chevron-left"></i>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLightboxIndex((prev) => (prev < activeLightboxImages.length - 1 ? prev + 1 : 0));
                                        }}
                                        style={{
                                            position: 'absolute',
                                            right: '20px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'rgba(255, 255, 255, 0.2)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '50px',
                                            height: '50px',
                                            color: 'white',
                                            fontSize: '24px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                                    >
                                        <i className="fa fa-chevron-right"></i>
                                    </button>
                                </>
                            )}

                            {/* Image Counter */}
                            {activeLightboxImages.length > 1 && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        bottom: '20px',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        background: 'rgba(0, 0, 0, 0.6)',
                                        color: 'white',
                                        padding: '8px 16px',
                                        borderRadius: '20px',
                                        fontSize: '14px'
                                    }}
                                >
                                    {lightboxIndex + 1} / {activeLightboxImages.length}
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
}

// Helper component to load review images
function ReviewImages({ imageIds, onImageClick }) {
    const [urls, setUrls] = useState([]);

    useEffect(() => {
        let isActive = true;
        const loadImages = async () => {
            const loaded = [];
            for (const id of imageIds) {
                try {
                    const res = await fetchProductImageById(id);
                    const blob = new Blob([res.data], { type: res.headers["content-type"] || "image/jpeg" });
                    const url = URL.createObjectURL(blob);
                    loaded.push(url);
                } catch (e) {
                    console.error("Failed to load review image", id, e);
                }
            }
            if (isActive) setUrls(loaded);
        };
        if (imageIds && imageIds.length > 0) loadImages();
        return () => {
            isActive = false;
            urls.forEach(u => URL.revokeObjectURL(u));
        };
    }, [imageIds]);

    if (urls.length === 0) return null;

    return (
        <div className="d-flex gap-2 flex-wrap">
            {urls.map((url, i) => (
                <div
                    key={i}
                    style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        border: '1px solid #ddd',
                        cursor: 'pointer'
                    }}
                    onClick={() => onImageClick && onImageClick(i, urls)}
                >
                    <img src={url} alt="Review" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
            ))}
        </div>
    );
}