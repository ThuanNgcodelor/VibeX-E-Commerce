import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import RatingModal from "./RatingMockModal.jsx";
import Swal from "sweetalert2";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getOrdersByUser, cancelOrder } from "../../../api/order.js";
import { createReview } from "../../../api/review.js";
import { getUser } from "../../../api/user.js";
import { fetchImageById } from "../../../api/image.js";
import { fetchProductById } from "../../../api/product.js";
import Loading from "../Loading.jsx";

const PAGE_SIZE = 5;

const getStatusConfig = (t) => ({
    ALL: { label: t('orders.all'), color: "#555", bg: "#f8f8f8" },
    PENDING: { label: t('orders.pending'), color: "#ee4d2d", bg: "#fff5f0" },
    PROCESSING: { label: t('orders.processing'), color: "#2673dd", bg: "#e8f4ff" },
    SHIPPED: { label: t('orders.shipped'), color: "#2673dd", bg: "#e8f4ff" },
    DELIVERED: { label: t('orders.delivered'), color: "#26aa99", bg: "#e8f9f7" },
    CANCELLED: { label: t('orders.cancelled'), color: "#999", bg: "#f5f5f5" },
    RETURNED: { label: t('orders.returned'), color: "#ee4d2d", bg: "#fff5f0" }
});

const STATUS_NUMERIC_MAP = {
    0: "PENDING",
    1: "PROCESSING",
    2: "SHIPPED",
    3: "DELIVERED",
    4: "CANCELLED",
    5: "RETURNED",
};

// Styles for action buttons
const ratingButtonBase = {
    minWidth: '160px',
    padding: '10px 16px',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '13px',
    textTransform: 'uppercase',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
};

const ratingButtonOutline = {
    ...ratingButtonBase,
    background: '#fff',
    color: '#555',
    border: '1px solid #e5e5e5',
};

const ratingButtonPrimary = {
    ...ratingButtonBase,
    background: '#ee4d2d',
    color: '#fff',
    border: '1px solid #ee4d2d',
    boxShadow: '0 2px 6px rgba(238,77,45,0.2)',
};

const normalizeStatus = (status) => {
    if (status === null || status === undefined) return "";
    if (typeof status === "number") {
        return STATUS_NUMERIC_MAP[status] || String(status);
    }
    const str = String(status).toUpperCase();
    if (STATUS_NUMERIC_MAP[str]) return STATUS_NUMERIC_MAP[str];
    return str;
};

const formatVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";

const fmtDateTime = (iso) => {
    if (!iso) return "-";
    try {
        return new Date(iso).toLocaleDateString("vi-VN");
    } catch {
        return "-";
    }
};

function getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, 2, total, total - 1, current, current - 1, current + 1]);
    const arr = Array.from(pages).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const withEllipsis = [];
    for (let i = 0; i < arr.length; i++) {
        withEllipsis.push(arr[i]);
        if (i < arr.length - 1 && arr[i + 1] - arr[i] > 1) withEllipsis.push("…");
    }
    return withEllipsis;
}

export default function OrderList() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [orders, setOrders] = useState([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("ALL");
    const [imageUrls, setImageUrls] = useState({});
    const [confirmModal, setConfirmModal] = useState({ open: false, orderId: null });

    // Rating State
    const [ratingModalOpen, setRatingModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [ratingMode, setRatingMode] = useState('full'); // 'quick' or 'full'
    const [currentUser, setCurrentUser] = useState(null);
    
    const STATUS_CONFIG = getStatusConfig(t);

    useEffect(() => {
        // Fetch user for review submission
        getUser().then(setCurrentUser).catch(err => console.error("Failed to load user info", err));
    }, []);

    const openRatingModal = (product, mode = 'full') => {
        setSelectedProduct({
            id: product.productId,
            name: product.productName,
            image: imageUrls[product.imageId] || imageUrls[product.id] || imageUrls[`${product.productId}-${product.sizeId}`],
            shopName: "MERIER STORE"
        });
        setRatingMode(mode);
        setRatingModalOpen(true);
    };

    const handleSubmitReview = async (data) => {
        if (!selectedProduct) return;
        if (!currentUser) {
            Swal.fire(t('common.error'), t('orders.reviewError'), 'error');
            return;
        }

        await createReview({
            productId: selectedProduct.id,
            rating: data.rating,
            comment: data.comment,
            imageIds: data.imageIds,
            userId: currentUser.id,
            username: currentUser.username,
            userAvatar: currentUser.avatar
        });
        Swal.fire(t('common.success'), t('orders.reviewSuccess'), 'success');
    };

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setError("");
                const data = await getOrdersByUser();
                setOrders(Array.isArray(data) ? data : []);
            } catch (e) {
                setError("Cannot load orders. Please try again.");
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Load images for order items
    useEffect(() => {
        if (orders.length === 0) return;

        let isActive = true;
        const urls = {};
        const productCache = new Map();

        const loadImages = async () => {
            const imagePromises = [];

            orders.forEach((order) => {
                (order.orderItems || []).forEach((item) => {
                    const itemKey = item.id || `${item.productId}-${item.sizeId}`;
                    let imageId = item.imageId;

                    // If no imageId, try to fetch from product
                    if (!imageId && item.productId) {
                        imagePromises.push(
                            (async () => {
                                try {
                                    let product = productCache.get(item.productId);
                                    if (!product) {
                                        const prodRes = await fetchProductById(item.productId);
                                        product = prodRes?.data;
                                        if (product) productCache.set(item.productId, product);
                                    }
                                    imageId = product?.imageId || null;

                                    if (imageId && !urls[imageId]) {
                                        try {
                                            const res = await fetchImageById(imageId);
                                            const blob = new Blob([res.data], {
                                                type: res.headers["content-type"] || "image/jpeg",
                                            });
                                            const url = URL.createObjectURL(blob);
                                            urls[imageId] = url;
                                            urls[itemKey] = url; // Also store by item key
                                        } catch {
                                            urls[imageId] = null;
                                            urls[itemKey] = null;
                                        }
                                    } else {
                                        urls[itemKey] = urls[imageId] || null;
                                    }
                                } catch {
                                    urls[itemKey] = null;
                                }
                            })()
                        );
                    } else if (imageId && !urls[imageId]) {
                        imagePromises.push(
                            fetchImageById(imageId)
                                .then((res) => {
                                    const blob = new Blob([res.data], {
                                        type: res.headers["content-type"] || "image/jpeg",
                                    });
                                    const url = URL.createObjectURL(blob);
                                    urls[imageId] = url;
                                    urls[itemKey] = url; // Also store by item key
                                })
                                .catch(() => {
                                    urls[imageId] = null;
                                    urls[itemKey] = null;
                                })
                        );
                    } else if (imageId && urls[imageId]) {
                        urls[itemKey] = urls[imageId];
                    }
                });
            });

            await Promise.all(imagePromises);

            if (isActive) {
                setImageUrls(urls);
            }
        };

        loadImages();

        return () => {
            isActive = false;
            Object.values(imageUrls).forEach((url) => {
                if (url && url.startsWith("blob:")) {
                    URL.revokeObjectURL(url);
                }
            });
        };
    }, [orders]);

    // Auto expand order from URL
    useEffect(() => {
        const orderIdFromUrl = searchParams.get('orderId');
        if (orderIdFromUrl && orders.length > 0) {
            setTimeout(() => {
                const element = document.querySelector(`[data-order-id="${orderIdFromUrl}"]`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
        }
    }, [searchParams, orders]);

    // Filter orders by tab
    const filteredOrders = useMemo(() => {
        let result = orders;

        // Filter by status tab
        if (activeTab !== "ALL") {
            result = result.filter(order => normalizeStatus(order.orderStatus) === activeTab);
        }

        return result;
    }, [orders, activeTab]);

    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const pagedOrders = useMemo(
        () => filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [filteredOrders, page]
    );

    const pageNumbers = getPageNumbers(page, totalPages);

    const getStatusBadge = (status) => {
        const normalized = normalizeStatus(status);
        const config = STATUS_CONFIG[normalized] || STATUS_CONFIG.PENDING;
        return (
            <span
                style={{
                    color: config.color,
                    background: config.bg,
                    padding: '4px 12px',
                    borderRadius: '2px',
                    fontSize: '13px',
                    fontWeight: 500,
                    textTransform: 'uppercase'
                }}
            >
        {config.label}
      </span>
        );
    };

    const handleViewShop = (order) => {
        // Try to navigate to shop page, fallback to home if shopId not available
        if (order.shopId) {
            navigate(`/shop/${order.shopId}`);
        } else {
            navigate('/shop');
        }
    };

    const [successMessage, setSuccessMessage] = useState('');

    const handleCancelOrder = (orderId) => {
        setConfirmModal({ open: true, orderId, reason: "" });
    };

    const closeConfirm = () => setConfirmModal({ open: false, orderId: null, reason: "" });

    const confirmCancel = async () => {
        if (!confirmModal.orderId) return;
        try {
            setLoading(true);
            setError('');
            setSuccessMessage('');
            const reasonText = confirmModal.reason?.trim() || '';
            await cancelOrder(confirmModal.orderId, reasonText);
            setSuccessMessage(t('orders.cancelSuccess'));
            const data = await getOrdersByUser();
            setOrders(Array.isArray(data) ? data : []);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (e) {
            setError(e.message || t('orders.cancelError'));
            console.error(e);
        } finally {
            setLoading(false);
            closeConfirm();
        }
    };

    return (
        <div style={{ padding: '0', width: '100%', maxWidth: '100%', margin: 0 }}>
            {/* Rating Modal */}
            <RatingModal
                isOpen={ratingModalOpen}
                onClose={() => setRatingModalOpen(false)}
                onSubmit={handleSubmitReview}
                product={selectedProduct}
                mode={ratingMode}
                initialRating={ratingMode === 'quick' ? 5 : 0}
            />

            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', background: 'white', width: '100%' }}>
                <h4 style={{ fontSize: '20px', fontWeight: 500, color: '#222', margin: 0 }}>{t('orders.myOrders')}</h4>
            </div>

            <div style={{ background: 'white', minHeight: '400px', width: '100%', margin: 0 }}>
                {/* Status Tabs - Shopee Style */}
                <div style={{
                    background: 'white',
                    borderBottom: '1px solid #f0f0f0',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                }}>
                    <div className="d-flex" style={{ overflowX: 'auto', padding: '0 24px' }}>
                        {Object.keys(STATUS_CONFIG).map(status => (
                            <button
                                key={status}
                                onClick={() => {
                                    setActiveTab(status);
                                    setPage(1);
                                }}
                                style={{
                                    padding: '16px 20px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: activeTab === status ? '#ee4d2d' : '#555',
                                    borderBottom: activeTab === status ? '2px solid #ee4d2d' : '2px solid transparent',
                                    fontWeight: activeTab === status ? 500 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontSize: '14px',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {STATUS_CONFIG[status]?.label || status}
                            </button>
                        ))}
                    </div>
                </div>

                {loading && (
                    <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
                        <Loading />
                    </div>
                )}

                {error && (
                    <div style={{ padding: '16px 24px', background: 'white' }}>
                        <div className="alert alert-danger" style={{ margin: 0 }}>{error}</div>
                    </div>
                )}

                {successMessage && (
                    <div style={{ padding: '16px 24px', background: 'white' }}>
                        <div className="alert alert-success" style={{ margin: 0 }}>{successMessage}</div>
                    </div>
                )}

                {!loading && !error && filteredOrders.length === 0 && (
                    <div className="text-center py-5" style={{ background: 'white', padding: '60px 20px' }}>
                        <div style={{
                            width: '120px',
                            height: '120px',
                            margin: '0 auto 16px',
                            background: '#f5f5f5',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <i className="fa fa-clipboard-list" style={{ fontSize: '48px', color: '#ddd' }}></i>
                        </div>
                        <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>
                            {t('orders.noOrdersYet')}
                        </p>
                    </div>
                )}

                {!loading && !error && pagedOrders.length > 0 && (
                    <>
                        {/* Order Cards - Shopee Style */}
                        <div style={{ padding: '24px', background: 'white' }}>
                            {pagedOrders.map((order) => (
                                <div
                                    key={order.id}
                                    data-order-id={order.id}
                                    style={{
                                        background: 'white',
                                        border: '1px solid #f0f0f0',
                                        borderRadius: '4px',
                                        marginBottom: '16px',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* Order Header - Shopee Style */}
                                    <div
                                        className="d-flex justify-content-between align-items-center p-3"
                                        style={{
                                            borderBottom: '1px solid #f0f0f0',
                                            background: '#fafafa'
                                        }}
                                    >
                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span style={{ fontSize: '14px', fontWeight: 500, color: '#222' }}>
                        MERIER STORE
                      </span>
                                            <button
                                                className="btn btn-sm"
                                                onClick={() => handleViewShop(order)}
                                                style={{
                                                    background: 'transparent',
                                                    border: '1px solid #ee4d2d',
                                                    color: '#ee4d2d',
                                                    fontSize: '12px',
                                                    padding: '4px 12px',
                                                    borderRadius: '2px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = '#ee4d2d';
                                                    e.currentTarget.style.color = 'white';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'transparent';
                                                    e.currentTarget.style.color = '#ee4d2d';
                                                }}
                                            >
                                                <i className="fa fa-comment me-1"></i> Chat
                                            </button>
                                            <button
                                                className="btn btn-sm"
                                                onClick={() => handleViewShop(order)}
                                                style={{
                                                    background: 'transparent',
                                                    border: '1px solid #ddd',
                                                    color: '#555',
                                                    fontSize: '12px',
                                                    padding: '4px 12px',
                                                    borderRadius: '2px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = '#ee4d2d';
                                                    e.currentTarget.style.color = '#ee4d2d';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = '#ddd';
                                                    e.currentTarget.style.color = '#555';
                                                }}
                                            >
                                                View Shop
                                            </button>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            {(normalizeStatus(order.orderStatus) === 'COMPLETED' || normalizeStatus(order.orderStatus) === 'DELIVERED') && (
                                                <span style={{ fontSize: '12px', color: '#26aa99' }}>
                          <i className="fa fa-truck me-1"></i> Delivery successful
                        </span>
                                            )}
                                            {getStatusBadge(order.orderStatus)}
                                        </div>
                                    </div>

                                    {/* Order Items - Shopee Style */}
                                    <div className="p-3">
                                        {(order.orderItems || []).map((item, idx) => {
                                            const itemKey = item.id || `${item.productId}-${item.sizeId}`;
                                            const imgUrl = imageUrls[item.imageId] || imageUrls[itemKey] || null;
                                            return (
                                                <div
                                                    key={item.id || idx}
                                                    className="d-flex gap-3 mb-3 pb-3"
                                                    style={{
                                                        borderBottom: idx < order.orderItems.length - 1 ? '1px solid #f0f0f0' : 'none'
                                                    }}
                                                >
                                                    {/* Product Image */}
                                                    <div
                                                        style={{
                                                            width: '80px',
                                                            height: '80px',
                                                            border: '1px solid #f0f0f0',
                                                            borderRadius: '4px',
                                                            overflow: 'hidden',
                                                            flexShrink: 0,
                                                            background: '#f5f5f5',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        {imgUrl ? (
                                                            <img
                                                                src={imgUrl}
                                                                alt={item.productName}
                                                                style={{
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    objectFit: 'cover'
                                                                }}
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                    e.currentTarget.nextElementSibling.style.display = 'flex';
                                                                }}
                                                            />
                                                        ) : null}
                                                        <div style={{
                                                            display: imgUrl ? 'none' : 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '100%',
                                                            height: '100%'
                                                        }}>
                                                            <i className="fa fa-image" style={{ fontSize: '24px', color: '#ccc' }}></i>
                                                        </div>
                                                    </div>

                                                    {/* Product Info */}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '14px', color: '#222', marginBottom: '4px', wordBreak: 'break-word' }}>
                                                            {item.productName}
                                                        </div>
                                                        {item.sizeName && (
                                                            <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>
                                                                Variant: {item.sizeName}
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '12px', color: '#999' }}>
                                                            x{item.quantity}
                                                        </div>
                                                    </div>

                                {/* Price */}
                                <div className="text-end" style={{ minWidth: '130px', flexShrink: 0 }}>
                                                        {item.originalPrice && item.originalPrice > item.unitPrice && (
                                                            <div style={{ fontSize: '13px', color: '#999', textDecoration: 'line-through', marginBottom: '4px' }}>
                                                                {formatVND(item.originalPrice)}
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '14px', color: '#ee4d2d', fontWeight: 500, marginBottom: '8px' }}>
                                                            {formatVND(item.totalPrice)}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Order Footer - Shopee Style */}
                                    <div
                                        className="d-flex justify-content-between align-items-center p-3"
                                        style={{
                                            borderTop: '1px solid #f0f0f0',
                                            background: '#fffaf5'
                                        }}
                                    >
                                        <div style={{ fontSize: '13px', color: '#666' }}>
                                            <i className="fa fa-calendar me-1"></i> {fmtDateTime(order.updateTimestamp)}
                                        </div>
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="text-end" style={{ fontSize: '12px' }}>
                                                <div style={{ fontSize: '18px', color: '#ee4d2d', fontWeight: 500 }}>
                                                    {formatVND((order.totalPrice || 0) + (order.shippingFee || 0))}
                                                </div>
                                            </div>
                                            <div className="d-flex gap-2 align-items-center">
                                                {order.orderStatus === 'PENDING' && (
                                                    <>
                                                        <button
                                                            className="btn"
                                                            onClick={() => handleCancelOrder(order.id)}
                                                            style={{
                                                                background: 'white',
                                                                color: '#ee4d2d',
                                                                border: '1px solid #ee4d2d',
                                                                padding: '8px 20px',
                                                                fontSize: '13px',
                                                                borderRadius: '2px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = '#fff5f0';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = 'white';
                                                            }}
                                                        >
                                                            {t('orders.cancelOrder')}
                                                        </button>
                                                        <button
                                                            className="btn"
                                                            style={{
                                                                background: 'white',
                                                                color: '#555',
                                                                border: '1px solid #ddd',
                                                                padding: '8px 20px',
                                                                fontSize: '13px',
                                                                borderRadius: '2px',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.borderColor = '#ee4d2d';
                                                                e.currentTarget.style.color = '#ee4d2d';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.borderColor = '#ddd';
                                                                e.currentTarget.style.color = '#555';
                                                            }}
                                                        >
                                                            {t('header.contact')}
                                                        </button>
                                                    </>
                                                )}

                                                {(normalizeStatus(order.orderStatus) === 'DELIVERED' || normalizeStatus(order.orderStatus) === 'COMPLETED') && (
                                                    <>
                                                        <button
                                                            className="btn"
                                                            style={ratingButtonOutline}
                                                            onClick={() => openRatingModal(order.orderItems?.[0] || {}, 'quick')}
                                                        >
                                                            Quick Rate
                                                        </button>
                                                        <button
                                                            className="btn"
                                                            style={ratingButtonPrimary}
                                                            onClick={() => openRatingModal(order.orderItems?.[0] || {}, 'full')}
                                                        >
                                                            Write Review
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{ padding: '24px', background: 'white', borderTop: '1px solid #f0f0f0' }}>
                                <nav>
                                    <ul className="pagination justify-content-center mb-0" style={{ gap: '4px' }}>
                                        <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                                            <button
                                                className="page-link"
                                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                                disabled={page === 1}
                                                style={{
                                                    border: '1px solid #ddd',
                                                    color: page === 1 ? '#ccc' : '#555',
                                                    background: 'white',
                                                    padding: '8px 12px',
                                                    cursor: page === 1 ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                ‹
                                            </button>
                                        </li>

                                        {pageNumbers.map((p, i) =>
                                            p === "…" ? (
                                                <li key={`el-${i}`} className="page-item disabled">
                                                    <span className="page-link" style={{ border: '1px solid #ddd', color: '#999', padding: '8px 12px' }}>…</span>
                                                </li>
                                            ) : (
                                                <li key={p} className={`page-item ${p === page ? "active" : ""}`}>
                                                    <button
                                                        className="page-link"
                                                        onClick={() => setPage(p)}
                                                        style={{
                                                            border: '1px solid #ddd',
                                                            color: p === page ? 'white' : '#555',
                                                            background: p === page ? '#ee4d2d' : 'white',
                                                            padding: '8px 12px',
                                                            cursor: 'pointer',
                                                            minWidth: '40px'
                                                        }}
                                                    >
                                                        {p}
                                                    </button>
                                                </li>
                                            )
                                        )}

                                        <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                                            <button
                                                className="page-link"
                                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                                disabled={page === totalPages}
                                                style={{
                                                    border: '1px solid #ddd',
                                                    color: page === totalPages ? '#ccc' : '#555',
                                                    background: 'white',
                                                    padding: '8px 12px',
                                                    cursor: page === totalPages ? 'not-allowed' : 'pointer'
                                                }}
                                            >
                                                ›
                                            </button>
                                        </li>
                                    </ul>
                                </nav>
                            </div>
                        )}
                    </>
                )
                }
            </div >

            {/* Confirm cancel modal */}
            {
                confirmModal.open && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.45)',
                            zIndex: 2000,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '16px'
                        }}
                    >
                        <div
                            style={{
                                background: 'white',
                                borderRadius: 4,
                                width: '100%',
                                maxWidth: 420,
                                padding: '20px 24px',
                                boxShadow: '0 8px 20px rgba(0,0,0,0.12)'
                            }}
                        >
                            <p style={{ margin: '0 0 20px 0', fontSize: 16, color: '#333', textAlign: 'center' }}>
                                {t('orders.cancelConfirm')}
                            </p>
                            <textarea
                                placeholder={t('orders.reasonOptional')}
                                value={confirmModal.reason || ''}
                                onChange={(e) => setConfirmModal(prev => ({ ...prev, reason: e.target.value }))}
                                style={{
                                    width: '100%',
                                    minHeight: 80,
                                    marginBottom: 16,
                                    padding: '10px 12px',
                                    borderRadius: 4,
                                    border: '1px solid #ddd',
                                    fontSize: 13,
                                    resize: 'vertical'
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={closeConfirm}
                                    style={{
                                        minWidth: 100,
                                        padding: '10px 16px',
                                        border: '1px solid #ddd',
                                        background: 'white',
                                        color: '#555',
                                        borderRadius: 2,
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    CANCEL
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmCancel}
                                    style={{
                                        minWidth: 100,
                                        padding: '10px 16px',
                                        border: 'none',
                                        background: '#ee4d2d',
                                        color: 'white',
                                        borderRadius: 2,
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    CONFIRM
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}