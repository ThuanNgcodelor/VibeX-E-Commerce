import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getReviewsByShopId, replyToReview } from '../../api/review.js';
import { getShopOwnerInfo } from '../../api/user.js';
import { fetchProductById } from '../../api/product.js'; // Import API fetch product
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import '../../components/shop-owner/ShopOwnerReview.css'; // Premium CSS

export default function ReviewManagementPage() {
    const { t } = useTranslation();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [shopId, setShopId] = useState(null);

    // UI States
    const [activeTab, setActiveTab] = useState('ALL'); // ALL, UNREPLIED, REPLIED
    const [ratingFilter, setRatingFilter] = useState('ALL'); // ALL, 5, 4, 3, 2, 1
    const [replyingId, setReplyingId] = useState(null);
    const [replyText, setReplyText] = useState('');

    // Data Cache
    const [productMap, setProductMap] = useState({}); // { productId: { name, image } }

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const shopInfo = await getShopOwnerInfo();
                if (shopInfo && (shopInfo.id || shopInfo.userId)) {
                    const id = shopInfo.id || shopInfo.userId;
                    setShopId(id);
                    await loadReviews(id);
                }
            } catch (error) {
                console.error("Error init:", error);
                toast.error(t('shopOwner.reviews.failedLoad'));
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const loadReviews = async (id) => {
        setLoading(true);
        try {
            const res = await getReviewsByShopId(id);
            const data = res.data || [];
            setReviews(data);

            // Extract unique Product IDs
            const productIds = [...new Set(data.map(r => r.productId))];

            // Fetch product details lazily
            fetchProductDetails(productIds);

        } catch (error) {
            console.error("Error fetching reviews:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProductDetails = async (ids) => {
        const newMap = { ...productMap };
        const missingIds = ids.filter(id => !newMap[id]);

        if (missingIds.length === 0) return;

        // Fetch in parallel (in real app, consider batch API if available to reduce calls)
        await Promise.all(missingIds.map(async (pid) => {
            try {
                const res = await fetchProductById(pid);
                if (res && res.data) {
                    newMap[pid] = {
                        name: res.data.productName,
                        image: res.data.image // Assuming main image field is 'image' or 'images[0]'
                    };
                }
            } catch (err) {
                console.warn(`Failed to fetch product ${pid}`, err);
                newMap[pid] = { name: t('shopOwner.reviews.unknownProduct'), image: null };
            }
        }));

        setProductMap(newMap);
    };

    const handleReply = async (reviewId) => {
        if (!replyText.trim()) return;
        try {
            await replyToReview(reviewId, replyText);
            toast.success(t('shopOwner.reviews.successReply'));
            setReplyingId(null);
            setReplyText('');
            // Reload reviews to show updated state
            loadReviews(shopId);
        } catch (error) {
            toast.error(t('shopOwner.reviews.failedReply'));
        }
    };

    // Calculate Statistics
    const stats = useMemo(() => {
        const total = reviews.length;
        if (total === 0) return { total: 0, avgRating: 0, responseRate: 0 };

        const sumRating = reviews.reduce((acc, r) => acc + r.rating, 0);
        const avgRating = (sumRating / total).toFixed(1);

        const repliedCount = reviews.filter(r => r.reply).length;
        const responseRate = Math.round((repliedCount / total) * 100);

        return { total, avgRating, responseRate };
    }, [reviews]);

    // Filter Logic
    const filteredReviews = useMemo(() => {
        return reviews.filter(review => {
            // Tab Filter
            if (activeTab === 'UNREPLIED' && review.reply) return false;
            if (activeTab === 'REPLIED' && !review.reply) return false;

            // Rating Filter
            if (ratingFilter !== 'ALL' && review.rating !== parseInt(ratingFilter)) return false;

            return true;
        });
    }, [reviews, activeTab, ratingFilter]);

    if (loading && reviews.length === 0) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">{t('common.loading')}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid p-4 review-management-container">
            <h2 className="mb-4 fw-bold text-dark">{t('shopOwner.reviews.title')}</h2>

            {/* Statistics Cards */}
            <div className="review-stats-grid">
                <div className="stat-card">
                    <div className="stat-icon blue">
                        <i className="fas fa-comments"></i>
                    </div>
                    <div className="stat-content">
                        <h3>{stats.total}</h3>
                        <p>{t('shopOwner.reviews.totalReviews')}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon orange">
                        <i className="fas fa-star"></i>
                    </div>
                    <div className="stat-content">
                        <h3>{stats.avgRating}</h3>
                        <p>{t('shopOwner.reviews.avgRating')}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green">
                        <i className="fas fa-reply"></i>
                    </div>
                    <div className="stat-content">
                        <h3>{stats.responseRate}%</h3>
                        <p>{t('shopOwner.reviews.responseRate')}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="review-filters-card">
                <div className="filter-tabs">
                    <button
                        className={`filter-tab ${activeTab === 'ALL' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ALL')}
                    >
                        {t('orders.all')}
                    </button>
                    <button
                        className={`filter-tab ${activeTab === 'UNREPLIED' ? 'active' : ''}`}
                        onClick={() => setActiveTab('UNREPLIED')}
                    >
                        {t('shopOwner.reviews.toReply')}
                    </button>
                    <button
                        className={`filter-tab ${activeTab === 'REPLIED' ? 'active' : ''}`}
                        onClick={() => setActiveTab('REPLIED')}
                    >
                        {t('shopOwner.reviews.replied')}
                    </button>
                </div>

                <div className="filter-dropdown">
                    <select
                        value={ratingFilter}
                        onChange={(e) => setRatingFilter(e.target.value)}
                        className="form-select border-0 bg-light"
                        style={{ width: 'auto' }}
                    >
                        <option value="ALL">{t('shopOwner.reviews.allRatings')}</option>
                        <option value="5">{t('shopOwner.reviews.stars', { count: 5 })}</option>
                        <option value="4">{t('shopOwner.reviews.stars', { count: 4 })}</option>
                        <option value="3">{t('shopOwner.reviews.stars', { count: 3 })}</option>
                        <option value="2">{t('shopOwner.reviews.stars', { count: 2 })}</option>
                        <option value="1">{t('shopOwner.reviews.stars', { count: 1 })}</option>
                    </select>
                </div>
            </div>

            {/* Review List */}
            <div className="review-list">
                {filteredReviews.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-search"></i>
                        <p>{t('shopOwner.reviews.noReviews')}</p>
                    </div>
                ) : (
                    filteredReviews.map(review => {
                        const product = productMap[review.productId];

                        return (
                            <div key={review.id} className="review-card">
                                <div className="review-header">
                                    <div className="user-info">
                                        <img
                                            src={review.userAvatar ? `/v1/file-storage/get/${review.userAvatar}` : "https://via.placeholder.com/45"}
                                            alt="User"
                                            className="user-avatar"
                                            onError={(e) => e.target.src = "https://via.placeholder.com/45"}
                                        />
                                        <div className="user-meta">
                                            <h5>{review.username || t('shopOwner.reviews.anonymous')}</h5>
                                            <small>{format(new Date(review.createdAt), 'dd/MM/yyyy HH:mm')}</small>
                                        </div>
                                    </div>

                                    {product && (
                                        <div className="product-badge" title={product.name}>
                                            {product.image && (
                                                <img
                                                    src={`/v1/file-storage/get/${product.image}`}
                                                    alt="Product"
                                                    className="product-thumb-small"
                                                />
                                            )}
                                            <a href={`/product/${review.productId}`} target="_blank" rel="noreferrer" className="product-name-link">
                                                {product.name}
                                            </a>
                                        </div>
                                    )}
                                </div>

                                <div className="review-body">
                                    <div className="rating-stars">
                                        {[...Array(5)].map((_, i) => (
                                            <i key={i} className={`fas fa-star ${i < review.rating ? '' : 'text-muted-light'}`} style={{ color: i < review.rating ? '#ffc107' : '#e0e0e0' }} />
                                        ))}
                                    </div>

                                    <p className="review-text">{review.comment}</p>

                                    {review.imageIds && review.imageIds.length > 0 && (
                                        <div className="review-images">
                                            {review.imageIds.map(img => (
                                                <div key={img} className="review-img-wrapper">
                                                    <img
                                                        src={`/v1/file-storage/get/${img}`}
                                                        alt="Review attachment"
                                                        className="review-img"
                                                        onClick={() => window.open(`/v1/file-storage/get/${img}`, '_blank')}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="review-footer">
                                    {review.reply ? (
                                        <div className="reply-container">
                                            <div className="reply-header">
                                                <span><i className="fas fa-store me-1"></i> {t('shopOwner.reviews.shopReplied')}</span>
                                                <span className="reply-date">
                                                    {review.repliedAt && format(new Date(review.repliedAt), 'dd/MM/yyyy HH:mm')}
                                                </span>
                                            </div>
                                            <p className="reply-text">{review.reply}</p>
                                        </div>
                                    ) : (
                                        <div className="reply-input-section">
                                            {replyingId === review.id ? (
                                                <div className="mt-2">
                                                    <div className="reply-input-wrapper">
                                                        <textarea
                                                            className="form-control"
                                                            rows="3"
                                                            value={replyText}
                                                            onChange={(e) => setReplyText(e.target.value)}
                                                            placeholder={t('shopOwner.reviews.writeReply')}
                                                            autoFocus
                                                        ></textarea>
                                                    </div>
                                                    <div className="reply-actions">
                                                        <button
                                                            className="btn btn-light btn-sm"
                                                            onClick={() => {
                                                                setReplyingId(null);
                                                                setReplyText('');
                                                            }}
                                                        >
                                                            {t('shopOwner.reviews.cancel')}
                                                        </button>
                                                        <button
                                                            className="btn-submit-reply"
                                                            onClick={() => handleReply(review.id)}
                                                        >
                                                            {t('shopOwner.reviews.submit')}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    className="btn btn-outline-primary btn-sm"
                                                    onClick={() => setReplyingId(review.id)}
                                                >
                                                    <i className="fas fa-reply me-1"></i> {t('shopOwner.reviews.reply')}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
