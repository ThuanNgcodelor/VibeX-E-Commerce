import React, { useState, useEffect, useRef } from 'react';
import { getActiveBanners, trackBannerClick } from '../../api/banner';
import adAPI from '../../api/ads/adAPI';
import { fetchImageById } from '../../api/image';

export default function ShopeeBanner() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [banners, setBanners] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bannerImageUrls, setBannerImageUrls] = useState({}); // Store loaded image URLs by banner ID
    const createdUrlsRef = useRef([]); // Track created blob URLs for cleanup

    // Default fallback banners (hardcoded)
    const defaultBanners = {
        LEFT_MAIN: [
            {
                id: 'default-1',
                title: '12:12 5 DAYS LEFT',
                description: 'INTERNATIONAL WAREHOUSE FAST DELIVERY',
                imageUrl: null,
                bg: 'linear-gradient(135deg, #ff6b6b 0%, #ee4d2d 100%)',
                textColor: 'white'
            },
            {
                id: 'default-2',
                title: 'FREESHIP XTRA',
                description: 'Orders from 0₫ - Max 30k',
                imageUrl: null,
                bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                textColor: 'white'
            },
            {
                id: 'default-3',
                title: 'DISCOUNT CODE',
                description: 'Voucher 25% off',
                imageUrl: null,
                bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                textColor: 'white'
            }
        ],
        RIGHT_TOP: [
            {
                id: 'default-top',
                title: '12:12 1 TAP DOWNLOAD APP 1,000,000',
                imageUrl: null,
                bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                textColor: 'white'
            }
        ],
        RIGHT_BOTTOM: [
            {
                id: 'default-bottom',
                title: '12:12 UP TO 50% OFF ON APP',
                imageUrl: null,
                bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                textColor: 'white'
            }
        ]
    };

    // Fetch banners from API
    useEffect(() => {
        fetchBanners();

        // Cleanup blob URLs on unmount
        return () => {
            createdUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            createdUrlsRef.current = [];
        };
    }, []);

    // Helper to build full image URL from relative path or return full URL as-is
    const buildImageUrl = (imageUrl) => {
        if (!imageUrl) return null;
        // If already a full URL (starts with http:// or https://), return as-is
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return imageUrl;
        }
        // If relative path, build full URL using API base URL
        const API_BASE_URL = import.meta.env.MODE === 'production'
            ? '/api'
            : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080');
        // Remove leading slash if present to avoid double slashes
        const path = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
        return `${API_BASE_URL}/${path}`;
    };

    const fetchBanners = async () => {
        try {
            // Fetch both System Banners and Advertisements
            const [bannerData, adData] = await Promise.all([
                getActiveBanners().catch(err => null),
                adAPI.getActiveAds('HEADER').catch(err => [])
            ]);

            // Transform Ads to Banner format
            const adBanners = (adData || []).map(ad => ({
                id: `ad-${ad.id}`,
                title: ad.title,
                description: ad.description,
                imageUrl: ad.imageUrl, // Ad usually has full URL or file-storage path
                linkUrl: ad.targetUrl,
                openInNewTab: true,
                bg: '#f0f0f0',
                textColor: 'black',
                isAd: true
            }));

            let finalData = bannerData || {};

            // If no database banners, use DEFAULTS as base
            if (!bannerData || !bannerData.LEFT_MAIN || bannerData.LEFT_MAIN.length === 0) {
                finalData = JSON.parse(JSON.stringify(defaultBanners)); // Deep copy defaults
            }

            // Mix ads into LEFT_MAIN
            const existingMain = finalData.LEFT_MAIN || [];

            // Merge: Ads first, then existing banners
            finalData.LEFT_MAIN = [...adBanners, ...existingMain];

            // If we have data (either banners or ads), use it
            if (finalData.LEFT_MAIN.length > 0 || finalData.RIGHT_TOP?.length > 0 || finalData.RIGHT_BOTTOM?.length > 0) {
                console.log('Loaded mixed banners:', finalData);
                setBanners(finalData);
                await loadBannerImages(finalData);
            } else {
                console.log('No active banners/ads, using defaults');
            }
        } catch (error) {
            console.error('Failed to fetch banners/ads:', error);
        } finally {
            setLoading(false);
        }
    };

    // Use database banners if available, otherwise use defaults
    const displayBanners = banners || defaultBanners;
    const mainBanners = displayBanners.LEFT_MAIN || [];
    const rightTopBanner = displayBanners.RIGHT_TOP?.[0];
    const rightBottomBanner = displayBanners.RIGHT_BOTTOM?.[0];

    const [autoPlay, setAutoPlay] = useState(true);

    // Auto-rotate carousel for main banners
    useEffect(() => {
        if (mainBanners.length > 1 && autoPlay) {
            const interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % mainBanners.length);
            }, 4000);
            return () => clearInterval(interval);
        }
    }, [mainBanners.length, autoPlay]);

    const handleBannerClick = (banner) => {
        if (!banner) return;

        // Track click for analytics (fire and forget, don't await)
        if (!banner.id?.startsWith('default-')) {
            trackBannerClick(banner.id).catch(err =>
                console.error('Failed to track banner click:', err)
            );
        }

        // Navigate immediately if banner has a link
        if (banner.linkUrl) {
            console.log('Navigating to:', banner.linkUrl);
            if (banner.openInNewTab) {
                window.open(banner.linkUrl, '_blank', 'noopener,noreferrer');
            } else {
                window.location.href = banner.linkUrl;
            }
        }
    };

    const renderBanner = (banner, isMain = false) => {
        if (!banner) return null;

        // Check if we have loaded image URL for this banner
        const loadedImageUrl = bannerImageUrls[banner.id];
        const hasImage = loadedImageUrl || (banner.imageUrl && !banner.imageUrl.includes('default'));
        const imageUrl = loadedImageUrl || (banner.imageUrl ? buildImageUrl(banner.imageUrl) : null);
        const background = hasImage && imageUrl
            ? `url(${imageUrl})`
            : (banner.bg || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');

        return (
            <div
                onClick={() => handleBannerClick(banner)}
                style={{
                    height: isMain ? 'clamp(200px, 30vw, 300px)' : 'clamp(100px, 20vw, 143px)',
                    minHeight: isMain ? '200px' : '100px',
                    borderRadius: '4px',
                    background: hasImage ? '#f0f0f0' : background,
                    backgroundImage: hasImage ? background : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: banner.textColor || 'white',
                    cursor: banner.linkUrl ? 'pointer' : 'default',
                    transition: 'transform 0.2s',
                    padding: isMain ? '0' : '8px',
                    textAlign: 'center'
                }}
                onMouseEnter={(e) => banner.linkUrl && (e.currentTarget.style.transform = 'scale(1.02)')}
                onMouseLeave={(e) => banner.linkUrl && (e.currentTarget.style.transform = 'scale(1)')}
            >
                {/* Overlay for text readability on images */}
                {hasImage && (banner.title || banner.description) && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 1
                    }} />
                )}

                {/* Content */}
                <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '16px' }}>
                    {isMain ? (
                        <>
                            {banner.title && (
                                <h1 style={{
                                    fontSize: 'clamp(24px, 5vw, 48px)',
                                    fontWeight: 700,
                                    marginBottom: '12px',
                                    textShadow: hasImage ? '2px 2px 4px rgba(0,0,0,0.5)' : 'none'
                                }}>
                                    {banner.title}
                                </h1>
                            )}
                            {banner.description && (
                                <p style={{
                                    fontSize: 'clamp(16px, 3vw, 24px)',
                                    marginBottom: 0,
                                    textShadow: hasImage ? '1px 1px 2px rgba(0,0,0,0.5)' : 'none'
                                }}>
                                    {banner.description}
                                </p>
                            )}
                        </>
                    ) : (
                        banner.title && (
                            <div style={{
                                fontSize: 'clamp(14px, 2.5vw, 18px)',
                                fontWeight: 600,
                                textShadow: hasImage ? '1px 1px 2px rgba(0,0,0,0.5)' : 'none'
                            }}>
                                {banner.title}
                            </div>
                        )
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ background: '#F5F5F5', padding: '16px 0' }}>
                <div className="container" style={{ maxWidth: '1200px' }}>
                    <div className="row g-3">
                        <div className="col-12 col-lg-8">
                            <div style={{
                                height: 'clamp(200px, 30vw, 300px)',
                                borderRadius: '4px',
                                background: '#e0e0e0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-lg-4">
                            <div className="d-flex flex-column gap-3">
                                <div style={{ height: 'clamp(100px, 20vw, 143px)', borderRadius: '4px', background: '#e0e0e0' }} />
                                <div style={{ height: 'clamp(100px, 20vw, 143px)', borderRadius: '4px', background: '#e0e0e0' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: '#F5F5F5', padding: '16px 0' }}>
            <div className="container" style={{ maxWidth: '1200px' }}>
                <div className="row g-3">
                    {/* Main Banner Carousel */}
                    <div className="col-12 col-lg-8">
                        <div style={{ position: 'relative' }}
                            onMouseEnter={() => setAutoPlay(false)}
                            onMouseLeave={() => setAutoPlay(true)}>

                            {mainBanners.length > 0 && renderBanner(mainBanners[currentIndex], true)}

                            {/* Arrow Navigation */}
                            {mainBanners.length > 1 && (
                                <>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCurrentIndex(prev => (prev - 1 + mainBanners.length) % mainBanners.length);
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '0',
                                            transform: 'translateY(-50%)',
                                            background: 'rgba(0,0,0,0.18)',
                                            border: 'none',
                                            width: '32px',
                                            height: '60px',
                                            color: 'white',
                                            fontSize: '24px',
                                            cursor: 'pointer',
                                            zIndex: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'background 0.3s'
                                        }}
                                        className="banner-arrow"
                                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.32)'}
                                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.18)'}
                                    >
                                        &#10094;
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCurrentIndex(prev => (prev + 1) % mainBanners.length);
                                        }}
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            right: '0',
                                            transform: 'translateY(-50%)',
                                            background: 'rgba(0,0,0,0.18)',
                                            border: 'none',
                                            width: '32px',
                                            height: '60px',
                                            color: 'white',
                                            fontSize: '24px',
                                            cursor: 'pointer',
                                            zIndex: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'background 0.3s'
                                        }}
                                        className="banner-arrow"
                                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.32)'}
                                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.18)'}
                                    >
                                        &#10095;
                                    </button>
                                </>
                            )}
                            {/* Correct Right Arrow Content in JSX instead of CSS content hack which is messy for inline */}
                            {/* Actually simpler to just put the char in JSX above, waiting for correction in next step if needed, but I'll fix it inline below */}

                            {/* Navigation Dots */}
                            {mainBanners.length > 1 && (
                                <div
                                    className="d-flex gap-2 justify-content-center"
                                    style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 3 }}
                                >
                                    {mainBanners.map((_, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => setCurrentIndex(idx)}
                                            style={{
                                                width: currentIndex === idx ? '24px' : '8px',
                                                height: '8px',
                                                borderRadius: '4px',
                                                background: currentIndex === idx ? 'white' : 'rgba(255,255,255,0.5)',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Side Banners */}
                    <div className="col-12 col-lg-4">
                        <div className="d-flex flex-column gap-3">
                            {rightTopBanner && renderBanner(rightTopBanner)}
                            {rightBottomBanner && renderBanner(rightBottomBanner)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}