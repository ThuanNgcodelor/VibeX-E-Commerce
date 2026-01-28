import React, { useState, useEffect } from 'react';
import { getActiveBanners, trackBannerClick } from '../../api/banner';
import adAPI from '../../api/ads/adAPI';

export default function ShopeeBanner() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [banners, setBanners] = useState(null);
    const [loading, setLoading] = useState(true);

    // Fetch banners from API
    useEffect(() => {
        fetchBanners();
    }, []);

    // Helper to build full image URL from relative path or return full URL as-is
    const buildImageUrl = (imageUrl) => {
        if (!imageUrl) return null;

        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return imageUrl;
        }

        const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
        return path;
    };

    const fetchBanners = async () => {
        try {
            let bannerData = null;
            let adData = [];

            try {
                bannerData = await getActiveBanners();
            } catch (bannerErr) {
                console.warn('Failed to fetch banners:', bannerErr.message);
            }

            try {
                adData = await adAPI.getActiveAds('BANNER');
            } catch (adErr) {
                console.warn('Failed to fetch ads:', adErr.message);
            }

            // Transform Ads - ensure adData is array
            const adsArray = Array.isArray(adData) ? adData : [];
            const adBanners = adsArray.map(ad => ({
                id: `ad-${ad.id}`,
                title: ad.title,
                description: ad.description,
                imageUrl: ad.imageUrl,
                linkUrl: ad.targetUrl,
                openInNewTab: true,
                bg: '#f0f0f0',
                textColor: 'black',
                isAd: true,
                adType: ad.adType
            }));

            // Shuffle Ads
            const shuffledAds = adBanners.sort(() => 0.5 - Math.random());

            // Initialize empty structure - NO DEFAULTS
            let finalData = {
                LEFT_MAIN: [],
                RIGHT_TOP: [],
                RIGHT_BOTTOM: []
            };

            // Check if bannerData is valid
            if (bannerData && typeof bannerData === 'object') {
                if (bannerData.LEFT_MAIN && Array.isArray(bannerData.LEFT_MAIN)) {
                    finalData.LEFT_MAIN = [...bannerData.LEFT_MAIN];
                }
                if (bannerData.RIGHT_TOP && Array.isArray(bannerData.RIGHT_TOP)) {
                    finalData.RIGHT_TOP = [...bannerData.RIGHT_TOP];
                }
                if (bannerData.RIGHT_BOTTOM && Array.isArray(bannerData.RIGHT_BOTTOM)) {
                    finalData.RIGHT_BOTTOM = [...bannerData.RIGHT_BOTTOM];
                }
            }

            // Distribute Ads Round Robin to 3 Slots
            let adIndex = 0;
            while (adIndex < shuffledAds.length) {
                const remainder = adIndex % 3;
                if (remainder === 0) {
                    finalData.RIGHT_TOP.unshift(shuffledAds[adIndex]);
                } else if (remainder === 1) {
                    finalData.RIGHT_BOTTOM.unshift(shuffledAds[adIndex]);
                } else {
                    finalData.LEFT_MAIN.unshift(shuffledAds[adIndex]);
                }
                adIndex++;
            }

            console.log('Loaded banners with Ads:', finalData);
            setBanners(finalData);

        } catch (error) {
            console.error('Failed to fetch banners/ads:', error);
            setBanners(null);
        } finally {
            setLoading(false);
        }
    };

    // Use database banners only - no defaults
    const displayBanners = banners || { LEFT_MAIN: [], RIGHT_TOP: [], RIGHT_BOTTOM: [] };

    // Increment Views for Ads once loaded
    useEffect(() => {
        if (banners) {
            const allBanners = [
                ...(banners.LEFT_MAIN || []),
                ...(banners.RIGHT_TOP || []),
                ...(banners.RIGHT_BOTTOM || [])
            ];
            allBanners.forEach(banner => {
                if (banner.isAd) {
                    const adId = banner.id.replace('ad-', '');
                    adAPI.incrementView(adId).catch(err => console.error('Failed to inc view', err));
                }
            });
        }
    }, [banners]);

    const mainBanners = displayBanners.LEFT_MAIN || [];
    const rightTopBanners = displayBanners.RIGHT_TOP || [];
    const rightBottomBanners = displayBanners.RIGHT_BOTTOM || [];

    // Check if we have any banners at all
    const hasAnyBanners = mainBanners.length > 0 || rightTopBanners.length > 0 || rightBottomBanners.length > 0;

    const [autoPlay, setAutoPlay] = useState(true);
    const [topIndex, setTopIndex] = useState(0);
    const [bottomIndex, setBottomIndex] = useState(0);

    const [topAutoPlay, setTopAutoPlay] = useState(true);
    const [bottomAutoPlay, setBottomAutoPlay] = useState(true);

    // Auto-rotate carousel for main banners (4s) - ONLY if more than 1 banner
    useEffect(() => {
        if (mainBanners.length > 1 && autoPlay) {
            const interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % mainBanners.length);
            }, 4000);
            return () => clearInterval(interval);
        }
    }, [mainBanners.length, autoPlay]);

    // Auto-rotate Right Top Banner (2s) - ONLY if more than 1 banner
    useEffect(() => {
        if (rightTopBanners.length > 1 && topAutoPlay) {
            const interval = setInterval(() => {
                setTopIndex((prev) => (prev + 1) % rightTopBanners.length);
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [rightTopBanners.length, topAutoPlay]);

    // Auto-rotate Right Bottom Banner (2s) - ONLY if more than 1 banner
    useEffect(() => {
        if (rightBottomBanners.length > 1 && bottomAutoPlay) {
            const interval = setInterval(() => {
                setBottomIndex((prev) => (prev + 1) % rightBottomBanners.length);
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [rightBottomBanners.length, bottomAutoPlay]);

    // Helper to render carousel controls - ONLY show if more than 1 item
    const renderCarouselControls = (items, index, setIndex) => {
        if (items.length <= 1) return null;
        return (
            <>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIndex(prev => (prev - 1 + items.length) % items.length);
                    }}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '0',
                        transform: 'translateY(-50%)',
                        background: 'rgba(0,0,0,0.18)',
                        border: 'none',
                        width: '24px',
                        height: '40px',
                        color: 'white',
                        fontSize: '18px',
                        cursor: 'pointer',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.3s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.32)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.18)'}
                >
                    &#10094;
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIndex(prev => (prev + 1) % items.length);
                    }}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        right: '0',
                        transform: 'translateY(-50%)',
                        background: 'rgba(0,0,0,0.18)',
                        border: 'none',
                        width: '24px',
                        height: '40px',
                        color: 'white',
                        fontSize: '18px',
                        cursor: 'pointer',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.3s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.32)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.18)'}
                >
                    &#10095;
                </button>
            </>
        );
    };

    const handleBannerClick = (banner) => {
        if (!banner) return;

        if (banner.isAd) {
            // Extract ID from "ad-{id}"
            const adId = banner.id.replace('ad-', '');
            adAPI.incrementClick(adId).catch(err => console.error(err));
        } else {
            trackBannerClick(banner.id).catch(err => console.error(err));
        }

        if (banner.linkUrl) {
            if (banner.openInNewTab) window.open(banner.linkUrl, '_blank', 'noopener,noreferrer');
            else window.location.href = banner.linkUrl;
        }
    };

    const renderBanner = (banner, isMain = false) => {
        if (!banner) return null;

        const hasImage = banner.imageUrl && !banner.imageUrl.includes('default');
        const imageUrl = banner.imageUrl ? buildImageUrl(banner.imageUrl) : null;

        const background = !hasImage
            ? (banner.bg || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
            : '#f0f0f0';

        const isVideo = banner.adType === 'VIDEO';

        return (
            <div
                key={banner.id}
                onClick={() => !isVideo && handleBannerClick(banner)}
                style={{
                    height: isMain ? 'clamp(200px, 30vw, 300px)' : 'clamp(100px, 20vw, 143px)',
                    minHeight: isMain ? '200px' : '100px',
                    borderRadius: '4px',
                    background: background,
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
                {isVideo ? (
                    <video
                        src={imageUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            zIndex: 1
                        }}
                        onClick={(e) => {
                            if (banner.linkUrl) {
                                e.stopPropagation();
                                handleBannerClick(banner);
                            }
                        }}
                    />
                ) : (
                    hasImage && (
                        <img
                            src={imageUrl}
                            alt={banner.title || 'Banner'}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                zIndex: 1
                            }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                    )
                )}

                {hasImage && !isVideo && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 1,
                        background: 'rgba(0,0,0,0.1)'
                    }} />
                )}

                {!isVideo && (
                    <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '16px' }}>
                        {isMain ? (
                            <>
                                {banner.title && (
                                    <h1 style={{
                                        fontSize: 'clamp(24px, 5vw, 48px)',
                                        fontWeight: 700,
                                        marginBottom: '12px',
                                        textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                                    }}>
                                        {banner.title}
                                    </h1>
                                )}
                                {banner.description && (
                                    <p style={{
                                        fontSize: 'clamp(16px, 3vw, 24px)',
                                        marginBottom: 0,
                                        textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
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
                                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
                                }}>
                                    {banner.title}
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Loading state
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

    // If no banners at all, don't render the component
    if (!hasAnyBanners) {
        return null;
    }

    return (
        <div style={{ background: '#F5F5F5', padding: '16px 0' }}>
            <div className="container" style={{ maxWidth: '1200px' }}>
                <div className="row g-3">
                    {/* Main Banner Carousel - only show if has banners */}
                    {mainBanners.length > 0 && (
                        <div className={rightTopBanners.length > 0 || rightBottomBanners.length > 0 ? "col-12 col-lg-8" : "col-12"}>
                            <div style={{ position: 'relative' }}
                                onMouseEnter={() => setAutoPlay(false)}
                                onMouseLeave={() => setAutoPlay(true)}>

                                {renderBanner(mainBanners[currentIndex], true)}

                                {/* Arrow Navigation - only show if more than 1 banner */}
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

                                {/* Navigation Dots - only show if more than 1 banner */}
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
                    )}

                    {/* Side Banners - only show if has banners */}
                    {(rightTopBanners.length > 0 || rightBottomBanners.length > 0) && (
                        <div className={mainBanners.length > 0 ? "col-12 col-lg-4" : "col-12"}>
                            <div className="d-flex flex-column gap-3">
                                {/* Right Top Banner */}
                                {rightTopBanners.length > 0 && (
                                    <div style={{ position: 'relative' }}
                                        onMouseEnter={() => setTopAutoPlay(false)}
                                        onMouseLeave={() => setTopAutoPlay(true)}>
                                        {renderBanner(rightTopBanners[topIndex])}
                                        {renderCarouselControls(rightTopBanners, topIndex, setTopIndex)}
                                    </div>
                                )}

                                {/* Right Bottom Banner */}
                                {rightBottomBanners.length > 0 && (
                                    <div style={{ position: 'relative' }}
                                        onMouseEnter={() => setBottomAutoPlay(false)}
                                        onMouseLeave={() => setBottomAutoPlay(true)}>
                                        {renderBanner(rightBottomBanners[bottomIndex])}
                                        {renderCarouselControls(rightBottomBanners, bottomIndex, setBottomIndex)}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}