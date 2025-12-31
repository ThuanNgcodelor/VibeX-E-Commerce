import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import Header from '../../components/client/Header.jsx';
import { getShopOwnerByUserId, getFollowerCount, checkIsFollowing, followShop, unfollowShop, getShopDecoration } from '../../api/user';
import { getShopProducts, getShopStats, fetchProductImageById } from '../../api/product';
import imgFallback from "../../assets/images/shop/6.png";
import DecorationRenderer from '../../components/shop-owner/decoration/DecorationRenderer';

export default function ShopDetailPage() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [shopInfo, setShopInfo] = useState(null);
    const [stats, setStats] = useState({ productCount: 0, avgRating: 0 });
    const [followerCount, setFollowerCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('products'); // Default to updated later
    const [imageUrls, setImageUrls] = useState({});
    const [decorationConfig, setDecorationConfig] = useState(null);
    const { t } = useTranslation();

    useEffect(() => {
        const loadShopData = async () => {
            try {
                setLoading(true);
                // 1. Get Shop Owner Info
                const shopData = await getShopOwnerByUserId(userId);
                setShopInfo(shopData);

                // Fetch Decoration
                try {
                    const decoRes = await getShopDecoration(shopData.userId || userId);
                    if (decoRes && decoRes.content) {
                        setDecorationConfig(JSON.parse(decoRes.content));
                        setActiveTab('home');
                    }
                } catch (e) {
                    console.error("Decoration fetch error", e);
                }

                // 2. Get Shop Stats (Product Count, Avg Rating)
                getShopStats(userId).then(data => {
                    setStats({
                        productCount: data.productCount || 0,
                        avgRating: data.avgRating || 0
                    });
                }).catch(err => console.error("Stats error", err));

                // 3. Get Follower Count
                getFollowerCount(userId).then(count => setFollowerCount(count || 0))
                    .catch(err => console.error("Follower count error", err));

                // 4. Check Following Status
                checkIsFollowing(userId).then(status => setIsFollowing(status))
                    .catch(err => console.error("Follow status error", err));

                // 5. Get Shop Products
                loadProducts();

            } catch (error) {
                console.error('Error loading shop:', error);
                alert('Failed to load shop information: ' + (error.message || 'Unknown error'));
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            loadShopData();
        }
    }, [userId]);

    const loadProducts = async () => {
        try {
            const res = await getShopProducts(userId, 1, 24); // Fetch first page
            if (res && res.content) {
                setProducts(res.content);
                // Load images for products
                loadProductImages(res.content);
            }
        } catch (error) {
            console.error("Failed to load products", error);
        }
    };

    const loadProductImages = async (productList) => {
        const newUrls = {};
        await Promise.all(productList.map(async (p) => {
            try {
                if (p.imageId) {
                    const res = await fetchProductImageById(p.imageId);
                    const blob = new Blob([res.data], { type: res.headers?.["content-type"] || "image/png" });
                    newUrls[p.id] = URL.createObjectURL(blob);
                } else {
                    newUrls[p.id] = imgFallback;
                }
            } catch {
                newUrls[p.id] = imgFallback;
            }
        }));
        setImageUrls(prev => ({ ...prev, ...newUrls }));
    };

    const handleFollow = async () => {
        try {
            if (isFollowing) {
                await unfollowShop(userId);
                setFollowerCount(prev => Math.max(0, prev - 1));
                setIsFollowing(false);
            } else {
                await followShop(userId);
                setFollowerCount(prev => prev + 1);
                setIsFollowing(true);
            }
        } catch (error) {
            if (error?.response?.status === 403 || error?.response?.status === 401) {
                toast.error(t("auth.loginRequired"));
                navigate("/login");
            } else {
                alert("Failed to update follow status. Please try again.");
            }
        }
    };

    if (loading) {
        return (
            <div className="wrapper">
                <Header />
                <div className="container py-5 text-center">
                    <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#ee4d2d' }}></i>
                    <p className="mt-3">Loading shop information...</p>
                </div>
            </div>
        );
    }

    if (!shopInfo) {
        return (
            <div className="wrapper">
                <Header />
                <div className="container py-5 text-center">
                    <h3>{t('shop.notFound')}</h3>
                    <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>
                        {t('shop.goHome')}
                    </button>
                </div>
            </div>
        );
    }

    const formatJoinedDate = (dateString) => {
        if (!dateString) return 'Recently joined';
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffYears >= 1) return t('shop.yearsAgo', { count: diffYears });
        if (diffMonths >= 1) return t('shop.monthsAgo', { count: diffMonths });
        if (diffDays >= 1) return t('shop.daysAgo', { count: diffDays });
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        if (diffHours >= 1) return t('shop.hoursAgo', { count: diffHours });
        return t('shop.justNow');
    };

    const formatCount = (count) => {
        if (!count) return '0';
        if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
        return count.toString();
    };

    const formatVND = (n) => (Number(n) || 0).toLocaleString("vi-VN") + "₫";

    return (
        <div className="wrapper">
            <Header />
            <main className="main-content bg-light">
                <div className="container py-4">
                    {/* Shop Header */}
                    <div className="card mb-3 border-0 shadow-sm">
                        <div className="card-body" style={{ background: 'linear-gradient(45deg, #222, #444)', color: 'white' }}>
                            <div className="row align-items-center">
                                <div className="col-md-4">
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="position-relative">
                                            {shopInfo.imageUrl ? (
                                                <img
                                                    src={`/v1/file-storage/get/${shopInfo.imageUrl}`}
                                                    alt={shopInfo.shopName}
                                                    style={{
                                                        width: 80,
                                                        height: 80,
                                                        objectFit: 'cover',
                                                        borderRadius: '50%',
                                                        border: '3px solid rgba(255,255,255,0.2)'
                                                    }}
                                                    onError={(e) => { e.currentTarget.src = '/vite.svg'; }}
                                                />
                                            ) : (
                                                <div
                                                    style={{
                                                        width: 80,
                                                        height: 80,
                                                        borderRadius: '50%',
                                                        background: '#ee4d2d',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        fontSize: '2rem',
                                                        fontWeight: 'bold',
                                                        border: '3px solid rgba(255,255,255,0.2)'
                                                    }}
                                                >
                                                    {shopInfo.shopName?.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            {shopInfo.verified && (
                                                <div className="position-absolute bottom-0 end-0 bg-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: 20, height: 20 }}>
                                                    <i className="fas fa-check-circle text-primary" style={{ fontSize: 14 }}></i>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <h4 className="mb-1 fw-bold text-white">
                                                {shopInfo.shopName}
                                            </h4>
                                            <div className="text-white-50 small">
                                                <i className="fas fa-circle text-success me-1" style={{ fontSize: 8 }}></i> {t('shop.online')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-3 d-flex gap-2">
                                        <button
                                            className={`btn btn-sm ${isFollowing ? 'btn-secondary' : 'btn-outline-light'}`}
                                            onClick={handleFollow}
                                        >
                                            {isFollowing ? <><i className="fas fa-check me-1"></i> {t('shop.followingStatus')}</> : <><i className="fas fa-plus me-1"></i> {t('shop.follow')}</>}
                                        </button>
                                        <button className="btn btn-sm btn-outline-light">
                                            <i className="fas fa-comment me-1"></i> {t('shop.chat')}
                                        </button>
                                    </div>
                                </div>

                                <div className="col-md-8 mt-3 mt-md-0">
                                    <div className="row text-white">
                                        <div className="col-4 mb-3">
                                            <div className="small text-white-50"><i className="fas fa-box me-1"></i> {t('shop.products')}</div>
                                            <div className="fw-bold fs-5">{formatCount(stats.productCount)}</div>
                                        </div>
                                        <div className="col-4 mb-3">
                                            <div className="small text-white-50"><i className="fas fa-star me-1"></i> {t('shop.rating')}</div>
                                            <div className="fw-bold fs-5">{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : t('shop.noRatings')}</div>
                                        </div>
                                        <div className="col-4 mb-3">
                                            <div className="small text-white-50"><i className="fas fa-comment-dots me-1"></i> {t('shop.chatResponse')}</div>
                                            <div className="fw-bold fs-5">{t('shop.na')}</div>
                                        </div>
                                        <div className="col-4">
                                            <div className="small text-white-50"><i className="fas fa-users me-1"></i> {t('shop.followers')}</div>
                                            <div className="fw-bold fs-5">{formatCount(followerCount)}</div>
                                        </div>
                                        <div className="col-4">
                                            <div className="small text-white-50"><i className="fas fa-calendar-alt me-1"></i> {t('shop.joined')}</div>
                                            <div className="fw-bold fs-5">{formatJoinedDate(shopInfo.createdAt)}</div>
                                        </div>
                                        <div className="col-4">
                                            <div className="small text-white-50"><i className="fas fa-user-plus me-1"></i> {t('shop.following')}</div>
                                            <div className="fw-bold fs-5">{shopInfo.followingCount || 0}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="card shadow-sm border-0">
                        <div className="card-header bg-white border-bottom">
                            <ul className="nav nav-tabs card-header-tabs border-0">
                                {decorationConfig && decorationConfig.length > 0 && (
                                    <li className="nav-item">
                                        <button
                                            className={`nav-link border-0 ${activeTab === 'home' ? 'active text-danger border-bottom border-danger border-3' : 'text-dark'}`}
                                            onClick={() => setActiveTab('home')}
                                            style={{ fontWeight: activeTab === 'home' ? 'bold' : 'normal' }}
                                        >
                                            {t('shop.home')}
                                        </button>
                                    </li>
                                )}
                                <li className="nav-item">
                                    <button
                                        className={`nav-link border-0 ${activeTab === 'products' ? 'active text-danger border-bottom border-danger border-3' : 'text-dark'}`}
                                        onClick={() => setActiveTab('products')}
                                        style={{ fontWeight: activeTab === 'products' ? 'bold' : 'normal' }}
                                    >
                                        {t('shop.products')}
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button
                                        className={`nav-link border-0 ${activeTab === 'intro' ? 'active text-danger border-bottom border-danger border-3' : 'text-dark'}`}
                                        onClick={() => setActiveTab('intro')}
                                        style={{ fontWeight: activeTab === 'intro' ? 'bold' : 'normal' }}
                                    >
                                        {t('shop.intro')}
                                    </button>
                                </li>
                            </ul>
                        </div>
                        <div className="card-body p-4">
                            {activeTab === 'home' && decorationConfig && (
                                <DecorationRenderer config={decorationConfig} />
                            )}
                            {activeTab === 'intro' && (
                                <div>
                                    <h5 className="text-danger mb-3 fw-bold">{t('shop.aboutShop')}</h5>
                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <strong>{t('shop.shopName')}:</strong> {shopInfo.shopName}
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <strong>{t('shop.owner')}:</strong> {shopInfo.ownerName || t('shop.na')}
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <strong>{t('shop.email')}:</strong> {shopInfo.email || t('shop.na')}
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <strong>{t('shop.address')}:</strong> {shopInfo.address || t('shop.na')}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {activeTab === 'products' && (
                                <div>
                                    {products.length === 0 ? (
                                        <div className="text-center py-5 text-muted">
                                            <i className="fas fa-box-open fa-3x mb-3"></i>
                                            <p>{t('shop.noProducts')}</p>
                                        </div>
                                    ) : (
                                        <div className="row g-3">
                                            {products.map((product) => (
                                                <div className="col-6 col-md-4 col-lg-2" key={product.id}>
                                                    <Link
                                                        to={`/product/${product.id}`}
                                                        className="text-decoration-none text-dark"
                                                    >
                                                        <div className="card h-100 border-0 shadow-sm product-card hover-shadow transition">
                                                            <div className="position-relative" style={{ paddingBottom: '100%', overflow: 'hidden' }}>
                                                                <img
                                                                    src={imageUrls[product.id] || imgFallback}
                                                                    alt={product.name}
                                                                    className="position-absolute w-100 h-100"
                                                                    style={{ objectFit: 'cover', top: 0, left: 0 }}
                                                                    onError={(e) => { e.currentTarget.src = imgFallback; }}
                                                                />
                                                                {product.discountPercent > 0 && (
                                                                    <div className="position-absolute top-0 end-0 bg-warning text-dark px-2 py-1 small fw-bold m-1 rounded">
                                                                        -{product.discountPercent}%
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="card-body p-2 d-flex flex-column">
                                                                <div className="mb-1 text-truncate-2 small" style={{ minHeight: '38px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                                    {product.name}
                                                                </div>
                                                                <div className="mt-auto">
                                                                    <div className="d-flex align-items-center justify-content-between">
                                                                        <span className="text-danger fw-bold">{formatVND(product.price)}</span>
                                                                        {product.totalStock <= 0 && <span className="badge bg-secondary">{t('shop.soldOut')}</span>}
                                                                    </div>
                                                                    {product.originalPrice > product.price && (
                                                                        <div className="text-decoration-line-through text-muted small" style={{ fontSize: '0.8rem' }}>
                                                                            {formatVND(product.originalPrice)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
            <style>{`
        .text-truncate-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .hover-shadow:hover {
            box-shadow: 0 .5rem 1rem rgba(0,0,0,.15)!important;
            transform: translateY(-2px);
        }
        .transition {
            transition: all 0.2s ease-in-out;
        }
      `}</style>
        </div>
    );
}