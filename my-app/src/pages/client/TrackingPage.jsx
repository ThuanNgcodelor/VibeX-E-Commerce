import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getShippingByOrderId, getOrderById, getAddressById } from '../../api/order.js';
import { fetchImageById } from '../../api/image.js';
import { fetchProductById } from '../../api/product.js';
import Loading from '../../components/client/Loading.jsx';
import Header from '../../components/client/Header.jsx';
import Footer from '../../components/client/Footer.jsx';
import { useTranslation } from 'react-i18next';

// Helper functions
const formatVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "đ";
const formatDateTime = (iso) => {
    if (!iso) return "-";
    try {
        const date = new Date(iso);
        return date.toLocaleString("vi-VN", {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return "-";
    }
};

// Status steps configuration - keys match order flow
// Step 1: PENDING = Order placed
// Step 2: CONFIRMED = Payment confirmed (COD) or Paid (VNPAY)  
// Step 3: SHIPPED = Handed to carrier
// Step 4: DELIVERED = Delivered to customer
// Step 5: COMPLETED = Order completed
const getOrderSteps = (paymentMethod, t) => [
    { key: 'PENDING', label: t('tracking.steps.orderPlaced'), icon: '📋' },
    {
        key: 'CONFIRMED',
        label: paymentMethod === 'VNPAY'
            ? t('tracking.steps.paymentConfirmedVNPAY')
            : t('tracking.steps.paymentConfirmedCOD'),
        icon: '💳'
    },
    { key: 'SHIPPED', label: t('tracking.steps.handedToShipper'), icon: '🚚' },
    { key: 'DELIVERED', label: t('tracking.steps.delivered'), icon: '📦' },
    { key: 'COMPLETED', label: t('tracking.steps.completed'), icon: '⭐' }
];

const STATUS_STEP_MAP = {
    'PENDING': 0,
    'CONFIRMED': 1,
    'PROCESSING': 1,      // Processing = same as confirmed
    'SHIPPED': 2,
    'DELIVERED': 3,
    'COMPLETED': 4,
    'CANCELLED': -1,
    'RETURNED': -2
};

// Mock tracking timeline data - in real app, this would come from API
const generateMockTimeline = (order) => {
    const timeline = [];
    const status = order?.orderStatus || 'PENDING';
    const stepIndex = STATUS_STEP_MAP[status] ?? 0;

    const baseDate = order?.createTimestamp ? new Date(order.createTimestamp) : new Date();

    // Generate timeline events based on current status
    if (stepIndex >= 4) {
        timeline.push({
            time: formatDateTime(new Date(baseDate.getTime() + 5 * 24 * 60 * 60 * 1000)),
            status: 'completed',
            title: 'Đã giao',
            description: 'Giao hàng thành công',
            highlight: true
        });
    }

    if (stepIndex >= 3) {
        timeline.push({
            time: formatDateTime(new Date(baseDate.getTime() + 4 * 24 * 60 * 60 * 1000)),
            status: 'shipped',
            title: 'Đang vận chuyển',
            description: 'Đơn hàng sẽ sớm được giao, vui lòng chú ý điện thoại'
        });
        timeline.push({
            time: formatDateTime(new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000)),
            status: 'shipped',
            title: 'Đơn hàng đã đến trạm giao hàng',
            description: 'Đơn hàng đã đến trạm giao hàng tại khu vực của bạn và sẽ được giao trong vòng 12 giờ tiếp theo'
        });
    }

    if (stepIndex >= 2) {
        timeline.push({
            time: formatDateTime(new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000)),
            status: 'processing',
            title: 'Đã giao cho đơn vị vận chuyển',
            description: 'Đơn hàng đã được bàn giao cho đơn vị vận chuyển'
        });
    }

    if (stepIndex >= 1) {
        timeline.push({
            time: formatDateTime(new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000)),
            status: 'confirmed',
            title: 'Đã xác nhận đơn hàng',
            description: 'Đơn hàng đã được xác nhận thanh toán'
        });
    }

    timeline.push({
        time: formatDateTime(baseDate),
        status: 'pending',
        title: 'Đặt hàng thành công',
        description: 'Đơn hàng đã được đặt thành công'
    });

    return timeline;
};

export default function TrackingPage() {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const [ghn, setGhn] = useState(null);
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState(null);
    const [address, setAddress] = useState(null);
    const [imageUrls, setImageUrls] = useState({});
    const [showAllTimeline, setShowAllTimeline] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                // Load shipping info
                const sh = await getShippingByOrderId(orderId);
                setGhn(sh ? sh.ghnOrderCode : null);

                // Load order details
                try {
                    const o = await getOrderById(orderId);
                    setOrder(o);

                    // Load shipping address
                    if (o?.addressId) {
                        try {
                            const addr = await getAddressById(o.addressId);
                            setAddress(addr);
                        } catch (e) {
                            console.warn('Failed to load address', e);
                        }
                    }

                    // Load product images
                    if (o?.orderItems?.length) {
                        const urls = {};
                        const productCache = new Map();

                        await Promise.all(o.orderItems.map(async (item) => {
                            const itemKey = item.id || `${item.productId}-${item.sizeId}`;
                            let imageId = item.imageId;

                            // If no imageId, fetch from product
                            if (!imageId && item.productId) {
                                try {
                                    let product = productCache.get(item.productId);
                                    if (!product) {
                                        const prodRes = await fetchProductById(item.productId);
                                        product = prodRes?.data;
                                        if (product) productCache.set(item.productId, product);
                                    }
                                    imageId = product?.imageId || null;
                                } catch (e) {
                                    console.warn('Failed to fetch product', e);
                                }
                            }

                            if (imageId && !urls[imageId]) {
                                try {
                                    const res = await fetchImageById(imageId);
                                    const blob = new Blob([res.data], {
                                        type: res.headers["content-type"] || "image/jpeg"
                                    });
                                    const url = URL.createObjectURL(blob);
                                    urls[imageId] = url;
                                    urls[itemKey] = url;
                                } catch (e) {
                                    console.warn('Failed to load image', e);
                                    urls[imageId] = null;
                                    urls[itemKey] = null;
                                }
                            } else if (imageId && urls[imageId]) {
                                urls[itemKey] = urls[imageId];
                            }
                        }));
                        setImageUrls(urls);
                    }
                } catch (e) {
                    console.warn('Failed to load order', e);
                }
            } catch (e) {
                console.warn('Failed to load shipping', e);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [orderId]);

    const currentStep = STATUS_STEP_MAP[order?.orderStatus] ?? 0;
    const isCancelled = order?.orderStatus === 'CANCELLED';
    const isReturned = order?.orderStatus === 'RETURNED';
    const ORDER_STEPS = getOrderSteps(order?.paymentMethod, t);
    const timeline = generateMockTimeline(order);
    const displayedTimeline = showAllTimeline ? timeline : timeline.slice(0, 4);

    if (loading) {
        return (
            <>
                <Header />
                <div style={{
                    background: '#F5F5F5',
                    minHeight: '100vh',
                    padding: '20px 0'
                }}>
                    <div className="container" style={{ maxWidth: '1200px' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                            <Loading />
                        </div>
                    </div>
                </div>
                <Footer />
            </>
        );
    }

    return (
        <>
            <Header />
            <div style={{
                background: '#F5F5F5',
                minHeight: '100vh',
                padding: '20px 0',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }}>
                <div className="container" style={{ maxWidth: '1200px' }}>
                    {/* Header Bar */}
                    <div style={{
                        background: 'white',
                        padding: '16px 24px',
                        borderRadius: '4px',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <button
                            onClick={() => navigate('/information/orders')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'none',
                                border: 'none',
                                color: '#555',
                                cursor: 'pointer',
                                fontSize: '14px',
                                padding: '0'
                            }}
                        >
                            <i className="fa fa-arrow-left" style={{ fontSize: '14px' }}></i>
                            TRỞ LẠI
                        </button>

                        <div style={{ textAlign: 'center' }}>
                            <span style={{ color: '#666', fontSize: '13px' }}>MÃ ĐƠN HÀNG. </span>
                            <span style={{ color: '#333', fontWeight: 500, fontSize: '13px' }}>{orderId?.slice(0, 16).toUpperCase()}</span>
                        </div>

                        <div style={{
                            color: isCancelled ? '#999' : isReturned ? '#ee4d2d' : '#26aa99',
                            fontWeight: 600,
                            fontSize: '13px',
                            textTransform: 'uppercase'
                        }}>
                            {isCancelled
                                ? t('tracking.statusMessages.cancelled').toUpperCase()
                                : isReturned
                                    ? t('tracking.statusMessages.returned').toUpperCase()
                                    : t('tracking.steps.completed').toUpperCase()}
                        </div>
                    </div>

                    {/* Progress Stepper */}
                    {!isCancelled && !isReturned && (
                        <div style={{
                            background: 'white',
                            padding: '24px 32px',
                            borderRadius: '4px',
                            marginBottom: '12px'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                position: 'relative'
                            }}>
                                {/* Progress Line */}
                                <div style={{
                                    position: 'absolute',
                                    top: '28px',
                                    left: '50px',
                                    right: '50px',
                                    height: '3px',
                                    background: '#e8e8e8',
                                    zIndex: 0
                                }}>
                                    <div style={{
                                        width: `${(currentStep / (ORDER_STEPS.length - 1)) * 100}%`,
                                        height: '100%',
                                        background: '#26aa99',
                                        transition: 'width 0.3s ease'
                                    }} />
                                </div>

                                {ORDER_STEPS.map((step, index) => {
                                    const isActive = index <= currentStep;
                                    const isCurrent = index === currentStep;
                                    return (
                                        <div
                                            key={step.key}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                flex: 1,
                                                position: 'relative',
                                                zIndex: 1
                                            }}
                                        >
                                            <div style={{
                                                width: '56px',
                                                height: '56px',
                                                borderRadius: '50%',
                                                background: isActive ? '#26aa99' : '#f5f5f5',
                                                border: isCurrent ? '3px solid #26aa99' : isActive ? 'none' : '2px solid #e8e8e8',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginBottom: '12px',
                                                boxShadow: isCurrent ? '0 4px 12px rgba(38, 170, 153, 0.3)' : 'none',
                                                transition: 'all 0.3s ease'
                                            }}>
                                                {isActive ? (
                                                    <i className="fa fa-check" style={{ color: 'white', fontSize: '20px' }}></i>
                                                ) : (
                                                    <span style={{ fontSize: '20px', opacity: 0.5 }}>{step.icon}</span>
                                                )}
                                            </div>
                                            <div style={{
                                                textAlign: 'center',
                                                fontSize: '11px',
                                                color: isActive ? '#26aa99' : '#999',
                                                fontWeight: isCurrent ? 600 : 400,
                                                maxWidth: '100px',
                                                lineHeight: 1.3
                                            }}>
                                                {step.label}
                                            </div>
                                            {isActive && order?.updateTimestamp && index === currentStep && (
                                                <div style={{
                                                    fontSize: '10px',
                                                    color: '#999',
                                                    marginTop: '4px'
                                                }}>
                                                    {formatDateTime(order.updateTimestamp)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Message Banner */}
                    <div style={{
                        background: 'white',
                        padding: '16px 24px',
                        borderRadius: '4px',
                        marginBottom: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <span style={{ color: '#666', fontSize: '13px' }}>
                            Cảm ơn bạn đã mua sắm tại Shopee!
                        </span>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => navigate('/')}
                                style={{
                                    background: '#ee4d2d',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 24px',
                                    borderRadius: '2px',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    fontSize: '13px',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#d73211'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#ee4d2d'}
                            >
                                {t('tracking.buttons.buyAgain')}
                            </button>
                            <button style={{
                                background: 'white',
                                color: '#555',
                                border: '1px solid #ddd',
                                padding: '10px 24px',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                fontSize: '13px',
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
                                Liên Hệ Người Bán
                            </button>
                        </div>
                    </div>

                    {/* Shipping Info & Timeline Row */}
                    <div className="row g-3" style={{ marginBottom: '12px' }}>
                        {/* Shipping Address */}
                        <div className="col-12 col-lg-6">
                            <div style={{
                                background: 'white',
                                padding: '20px 24px',
                                borderRadius: '4px',
                                height: '100%'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '16px'
                                }}>
                                    <h3 style={{
                                        margin: 0,
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: '#222'
                                    }}>
                                        {t('tracking.address.title')}
                                    </h3>
                                    <div style={{
                                        fontSize: '12px',
                                        color: '#666',
                                        textAlign: 'right'
                                    }}>
                                        <div style={{ color: '#26aa99', fontWeight: 500 }}>SPX Express</div>
                                        <div>{ghn || 'SPXVN...'}</div>
                                    </div>
                                </div>

                                <div style={{ fontSize: '14px' }}>
                                    <div style={{ fontWeight: 600, color: '#222', marginBottom: '4px' }}>
                                        {address?.recipientName || address?.fullName || 'Khách hàng'}
                                    </div>
                                    <div style={{ color: '#666', marginBottom: '4px' }}>
                                        {address?.recipientPhone || order?.recipientPhone || '(+84) xxx xxx xxx'}
                                    </div>
                                    <div style={{ color: '#666', lineHeight: 1.5 }}>
                                        {order?.fullAddress || address?.streetAddress || address?.fullAddress || t('tracking.address.updating')}
                                        {!order?.fullAddress && address?.wardName && `, ${address.wardName}`}
                                        {!order?.fullAddress && address?.districtName && `, ${address.districtName}`}
                                        {!order?.fullAddress && address?.provinceName && `, ${address.provinceName}`}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Delivery Timeline */}
                        <div className="col-12 col-lg-6">
                            <div style={{
                                background: 'white',
                                padding: '20px 24px',
                                borderRadius: '4px',
                                height: '100%'
                            }}>
                                <div style={{ position: 'relative' }}>
                                    {displayedTimeline.map((event, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                display: 'flex',
                                                marginBottom: index < displayedTimeline.length - 1 ? '16px' : 0,
                                                position: 'relative'
                                            }}
                                        >
                                            {/* Timeline dot and line */}
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                marginRight: '12px',
                                                width: '20px'
                                            }}>
                                                <div style={{
                                                    width: index === 0 ? '14px' : '10px',
                                                    height: index === 0 ? '14px' : '10px',
                                                    borderRadius: '50%',
                                                    background: index === 0 ? '#26aa99' : '#e8e8e8',
                                                    border: index === 0 ? '2px solid #26aa99' : 'none',
                                                    flexShrink: 0
                                                }} />
                                                {index < displayedTimeline.length - 1 && (
                                                    <div style={{
                                                        width: '1px',
                                                        flex: 1,
                                                        background: '#e8e8e8',
                                                        marginTop: '4px',
                                                        minHeight: '30px'
                                                    }} />
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{
                                                    fontSize: '12px',
                                                    color: '#999',
                                                    marginBottom: '4px'
                                                }}>
                                                    {event.time}
                                                </div>
                                                <div style={{
                                                    fontSize: '13px',
                                                    color: index === 0 ? '#26aa99' : '#333',
                                                    fontWeight: index === 0 ? 600 : 400,
                                                    marginBottom: '2px'
                                                }}>
                                                    {event.title}
                                                </div>
                                                <div style={{
                                                    fontSize: '12px',
                                                    color: '#666',
                                                    lineHeight: 1.4
                                                }}>
                                                    {event.description}
                                                </div>
                                                {index === 0 && event.highlight && (
                                                    <a
                                                        href="#"
                                                        style={{
                                                            color: '#26aa99',
                                                            fontSize: '12px',
                                                            textDecoration: 'none',
                                                            marginTop: '4px',
                                                            display: 'inline-block'
                                                        }}
                                                    >
                                                        Xem hình ảnh giao hàng
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {timeline.length > 4 && (
                                        <button
                                            onClick={() => setShowAllTimeline(!showAllTimeline)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#26aa99',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                marginTop: '8px',
                                                padding: 0
                                            }}
                                        >
                                            {showAllTimeline ? 'Thu gọn' : 'Xem thêm'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Shop Info & Products */}
                    <div style={{
                        background: 'white',
                        borderRadius: '4px',
                        marginBottom: '12px'
                    }}>
                        {/* Shop Header */}
                        <div style={{
                            padding: '12px 24px',
                            borderBottom: '1px solid #f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            flexWrap: 'wrap'
                        }}>
                            <span style={{
                                background: '#ee4d2d',
                                color: 'white',
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '2px'
                            }}>
                                Yêu thích+
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '14px', color: '#333' }}>
                                MERIER STORE
                            </span>
                            <button style={{
                                background: '#ee4d2d',
                                color: 'white',
                                border: 'none',
                                padding: '4px 12px',
                                borderRadius: '2px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <i className="fa fa-comment"></i> Chat
                            </button>
                            <button style={{
                                background: 'white',
                                color: '#555',
                                border: '1px solid #ddd',
                                padding: '4px 12px',
                                borderRadius: '2px',
                                fontSize: '12px',
                                cursor: 'pointer'
                            }}>
                                Xem Shop
                            </button>
                        </div>

                        {/* Product Items */}
                        {order?.orderItems?.map((item, index) => (
                            <div
                                key={item.id || index}
                                style={{
                                    padding: '16px 24px',
                                    borderBottom: index < order.orderItems.length - 1 ? '1px solid #f0f0f0' : 'none',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '16px'
                                }}
                            >
                                {/* Product Image */}
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    background: '#f5f5f5',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                    border: '1px solid #e8e8e8'
                                }}>
                                    {(() => {
                                        const itemKey = item.id || `${item.productId}-${item.sizeId}`;
                                        const imgUrl = imageUrls[itemKey] || imageUrls[item.imageId];
                                        return imgUrl ? (
                                            <img
                                                src={imgUrl}
                                                alt={item.productName}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '100%',
                                                height: '100%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <i className="fa fa-image" style={{ fontSize: '24px', color: '#ccc' }}></i>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Product Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '14px',
                                        color: '#222',
                                        marginBottom: '8px',
                                        lineHeight: 1.4
                                    }}>
                                        {item.productName}
                                    </div>
                                    {item.sizeName && (
                                        <div style={{
                                            fontSize: '12px',
                                            color: '#999',
                                            marginBottom: '4px'
                                        }}>
                                            Phân loại hàng: {item.sizeName}
                                        </div>
                                    )}
                                    <div style={{ fontSize: '13px', color: '#666' }}>
                                        x{item.quantity}
                                    </div>
                                </div>

                                {/* Price */}
                                <div style={{ textAlign: 'right', minWidth: '120px' }}>
                                    {item.originalPrice && item.originalPrice > item.unitPrice && (
                                        <div style={{
                                            fontSize: '12px',
                                            color: '#999',
                                            textDecoration: 'line-through',
                                            marginBottom: '4px'
                                        }}>
                                            {formatVND(item.originalPrice)}
                                        </div>
                                    )}
                                    <div style={{
                                        fontSize: '14px',
                                        color: '#ee4d2d',
                                        fontWeight: 500
                                    }}>
                                        {formatVND(item.unitPrice || item.totalPrice / item.quantity)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Price Breakdown */}
                    <div style={{
                        background: '#fffaf5',
                        borderRadius: '4px',
                        padding: '20px 24px'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '60px'
                        }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
                                    {t('tracking.priceBreakdown.subtotal')}
                                </div>
                                <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
                                    {t('tracking.priceBreakdown.shippingFee')}
                                </div>
                                {(order?.shippingDiscount > 0) && (
                                    <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
                                        {t('tracking.priceBreakdown.shippingDiscount')} <i className="fa fa-info-circle" style={{ fontSize: '11px', color: '#999' }}></i>
                                    </div>
                                )}
                                {(order?.voucherDiscount > 0) && (
                                    <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
                                        {t('tracking.priceBreakdown.voucherDiscount')}
                                    </div>
                                )}
                                <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
                                    {t('tracking.priceBreakdown.total')}
                                </div>
                                <div style={{ fontSize: '13px', color: '#666' }}>
                                    {t('tracking.priceBreakdown.paymentMethod')}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', minWidth: '120px' }}>
                                <div style={{ marginBottom: '12px', fontSize: '13px', color: '#333' }}>
                                    {formatVND(
                                        order?.orderItems?.reduce((sum, item) => sum + (item.totalPrice || 0), 0) || 0
                                    )}
                                </div>
                                <div style={{ marginBottom: '12px', fontSize: '13px', color: '#333' }}>
                                    {formatVND(order?.shippingFee || 0)}
                                </div>
                                {(order?.shippingDiscount > 0) && (
                                    <div style={{ marginBottom: '12px', fontSize: '13px', color: '#26aa99' }}>
                                        -{formatVND(order.shippingDiscount)}
                                    </div>
                                )}
                                {(order?.voucherDiscount > 0) && (
                                    <div style={{ marginBottom: '12px', fontSize: '13px', color: '#26aa99' }}>
                                        -{formatVND(order.voucherDiscount)}
                                    </div>
                                )}
                                <div style={{
                                    marginBottom: '12px',
                                    fontSize: '24px',
                                    color: '#ee4d2d',
                                    fontWeight: 500
                                }}>
                                    {formatVND(order?.totalPrice || 0)}
                                </div>
                                <div style={{ fontSize: '13px', color: '#333' }}>
                                    {order?.paymentMethod === 'VNPAY' ? t('tracking.paymentMethods.vnpay') :
                                        order?.paymentMethod === 'COD' ? t('tracking.paymentMethods.cod') :
                                            order?.paymentMethod === 'CARD' ? t('tracking.paymentMethods.card') :
                                                order?.paymentMethod || t('tracking.paymentMethods.cod')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
}
