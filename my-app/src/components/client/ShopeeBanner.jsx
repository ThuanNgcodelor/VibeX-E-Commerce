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
            : (import.meta.env.VITE_API_BASE_URL || 'http://localhost');
        // Remove leading slash if present to avoid double slashes
        const path = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
        return `${API_BASE_URL}/${path}`;
    };

    const fetchBanners = async () => {
        try {
            // Fetch both System Banners and Advertisements
            // We fetch 'BANNER' placement ads. Assumes this covers the homepage slots.
            const [bannerData, adData] = await Promise.all([
                getActiveBanners().catch(err => null),
                adAPI.getActiveAds('BANNER').catch(err => [])
            ]);

            // Transform Ads
            const adBanners = (adData || []).map(ad => ({
                id: `ad-${ad.id}`,
                title: ad.title,
                description: ad.description,
                imageUrl: ad.imageUrl, // For video ads, this might be the video URL
                linkUrl: ad.targetUrl,
                openInNewTab: true,
                bg: '#f0f0f0',
                textColor: 'black',
                isAd: true,
                adType: ad.adType // Preserving adType (BANNER or VIDEO)
            }));

            // Shuffle Ads
            const shuffledAds = adBanners.sort(() => 0.5 - Math.random());

            let finalData = bannerData || {};

            // If no database banners, use DEFAULTS as base
            if (!bannerData || !bannerData.LEFT_MAIN || bannerData.LEFT_MAIN.length === 0) {
                finalData = JSON.parse(JSON.stringify(defaultBanners)); // Deep copy defaults
            }

            // Distribute Ads Randomly to 3 Slots: LEFT_MAIN, RIGHT_TOP, RIGHT_BOTTOM (Round Robin to fill arrays)
            // Pool: shuffledAds
            let adIndex = 0;

            // Ensure arrays exist in finalData (mix with existing system/defaults if strictly needed, 
            // but for "random" request, we might want to prioritize ads. 
            // Let's ensure they are initialized as arrays of existing system banners, then we append Ads.)
            // Note: finalData comes from bannerData, which might contain arrays.

            if (!finalData.RIGHT_TOP) finalData.RIGHT_TOP = defaultBanners.RIGHT_TOP ? [...defaultBanners.RIGHT_TOP] : [];
            if (!finalData.RIGHT_BOTTOM) finalData.RIGHT_BOTTOM = defaultBanners.RIGHT_BOTTOM ? [...defaultBanners.RIGHT_BOTTOM] : [];
            if (!finalData.LEFT_MAIN) finalData.LEFT_MAIN = defaultBanners.LEFT_MAIN ? [...defaultBanners.LEFT_MAIN] : [];

            // Clearing defaults if we want purely random ads? 
            // User said "Ngẫu nhiên vào 3 ô". If we append, we get mix. 
            // Let's Append to mix Ads with System Banners. 
            // But to ensure Ads are seen, let's Unshift (prepend) or Random Insert?
            // Round Robin Distribution:
            while (adIndex < shuffledAds.length) {
                // 0 -> Top, 1 -> Bottom, 2 -> Main ... repeat
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

            console.log('Loaded banners with Random Ads:', finalData);
            setBanners(finalData);
            await loadBannerImages(finalData);

        } catch (error) {
            console.error('Failed to fetch banners/ads:', error);
        } finally {
            setLoading(false);
        }
    };

    // Use database banners if available, otherwise use defaults
    const displayBanners = banners || defaultBanners;
    const mainBanners = displayBanners.LEFT_MAIN || [];
    const rightTopBanners = displayBanners.RIGHT_TOP || [];
    const rightBottomBanners = displayBanners.RIGHT_BOTTOM || [];

    const [autoPlay, setAutoPlay] = useState(true);
    const [topIndex, setTopIndex] = useState(0);
    const [bottomIndex, setBottomIndex] = useState(0);

    const [topAutoPlay, setTopAutoPlay] = useState(true);
    const [bottomAutoPlay, setBottomAutoPlay] = useState(true);

    // Auto-rotate carousel for main banners (4s)
    useEffect(() => {
        if (mainBanners.length > 1 && autoPlay) {
            const interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % mainBanners.length);
            }, 4000);
            return () => clearInterval(interval);
        }
    }, [mainBanners.length, autoPlay]);

    // Auto-rotate Right Top Banner (2s)
    useEffect(() => {
        if (rightTopBanners.length > 1 && topAutoPlay) {
            const interval = setInterval(() => {
                setTopIndex((prev) => (prev + 1) % rightTopBanners.length);
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [rightTopBanners.length, topAutoPlay]);

    // Auto-rotate Right Bottom Banner (2s)
    useEffect(() => {
        if (rightBottomBanners.length > 1 && bottomAutoPlay) {
            const interval = setInterval(() => {
                setBottomIndex((prev) => (prev + 1) % rightBottomBanners.length);
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [rightBottomBanners.length, bottomAutoPlay]);

    // Helper to render carousel controls
    const renderCarouselControls = (items, index, setIndex, isHovering, setHovering) => {
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
                        width: '24px', // Smaller for side
                        height: '40px', // Smaller for side
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
        if (!banner.id?.startsWith('default-')) {
            trackBannerClick(banner.id).catch(err => console.error(err));
        }
        if (banner.linkUrl) {
            if (banner.openInNewTab) window.open(banner.linkUrl, '_blank', 'noopener,noreferrer');
            else window.location.href = banner.linkUrl;
        }
    };




    const renderBanner = (banner, isMain = false) => {
        if (!banner) return null;

        // Check if we have loaded image URL for this banner
        const loadedImageUrl = bannerImageUrls[banner.id];
        const hasImage = loadedImageUrl || (banner.imageUrl && !banner.imageUrl.includes('default'));
        const imageUrl = loadedImageUrl || (banner.imageUrl ? buildImageUrl(banner.imageUrl) : null);

        // If no image, use gradient
        const background = !hasImage
            ? (banner.bg || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
            : '#f0f0f0'; // Placeholder color while image loads or behind image

        const isVideo = banner.adType === 'VIDEO';

        return (
            <div
                key={banner.id} // Add key for React reconciliation during rotation
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
                {/* Render Media (Video or Image) */}
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
                                objectFit: 'cover', // Ensures image fills container
                                objectPosition: 'center',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                zIndex: 1
                            }}
                            onError={(e) => {
                                e.target.style.display = 'none'; // Fallback to background text if image fails
                            }}
                        />
                    )
                )}

                {/* Overlay for text readability (only if image/video exists) */}
                {hasImage && !isVideo && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 1, // Same level as content bottom layer, but text is Z=2
                        background: 'rgba(0,0,0,0.1)' // Slight dim for text pop
                    }} />
                )}

                {/* Content (Title/Desc) - Only show if NO Image/Video OR if the design explicitly overlays text on image. 
                    Usually Banner Ads have text IN the image. System banners might use text overlay.
                    Let's show text ONLY if it's a System Banner (usually defaults) OR if specific flag checking.
                    For now, if it's an Ad with an image, we probably don't want text overlay cluttering it.
                */}
                {/* Content (Title/Desc) - Show overlay text for Images, but hide for Video */}
                {!isVideo && (
                    <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '16px' }}>
                        {isMain ? (
                            <>
                                {banner.title && (
                                    <h1 style={{
                                        fontSize: 'clamp(24px, 5vw, 48px)',
                                        fontWeight: 700,
                                        marginBottom: '12px',
                                        textShadow: '2px 2px 4px rgba(0,0,0,0.5)' // Added shadow back for readability over images
                                    }}>
                                        {banner.title}
                                    </h1>
                                )}
                                {banner.description && (
                                    <p style={{
                                        fontSize: 'clamp(16px, 3vw, 24px)',
                                        marginBottom: 0,
                                        textShadow: '1px 1px 2px rgba(0,0,0,0.5)' // Added shadow back
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
                                    textShadow: '1px 1px 2px rgba(0,0,0,0.5)' // Added shadow back
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

                    {/* Side Banners (Rotating) */}
                    <div className="col-12 col-lg-4">
                        <div className="d-flex flex-column gap-3">
                            {/* Right Top Banner */}
                            <div style={{ position: 'relative' }}
                                onMouseEnter={() => setTopAutoPlay(false)}
                                onMouseLeave={() => setTopAutoPlay(true)}>
                                {rightTopBanners.length > 0 && renderBanner(rightTopBanners[topIndex])}
                                {renderCarouselControls(rightTopBanners, topIndex, setTopIndex)}
                            </div>

                            {/* Right Bottom Banner */}
                            <div style={{ position: 'relative' }}
                                onMouseEnter={() => setBottomAutoPlay(false)}
                                onMouseLeave={() => setBottomAutoPlay(true)}>
                                {rightBottomBanners.length > 0 && renderBanner(rightBottomBanners[bottomIndex])}
                                {renderCarouselControls(rightBottomBanners, bottomIndex, setBottomIndex)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}