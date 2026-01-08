import React, { useEffect, useState } from 'react';
import adAPI from '../../../api/ads/adAPI';
import './AdDisplay.css';

export default function AdDisplay({ placement }) {
    const [ads, setAds] = useState([]);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const fetchAds = async () => {
            try {
                const data = await adAPI.getActiveAds(placement);
                setAds(data);
            } catch (error) {
                console.error(`Failed to load ads for ${placement}`, error);
            }
        };
        fetchAds();
    }, [placement]);

    useEffect(() => {
        if (placement === 'POPUP') {
            const hasShown = sessionStorage.getItem('adPopupShown');
            if (hasShown) {
                setIsVisible(false);
            }
        }
    }, [placement]);

    if (!ads || ads.length === 0) return null;

    // Render based on placement type logic
    if (placement === 'POPUP') {
        if (!isVisible) return null;

        const ad = ads[0]; // Show only one popup

        const handleClose = () => {
            setIsVisible(false);
            sessionStorage.setItem('adPopupShown', 'true');
        };

        return (
            <div className="ad-popup-overlay">
                <div className="ad-popup-content">
                    <button className="ad-close-btn" onClick={handleClose}>&times;</button>
                    <a href={ad.targetUrl || '#'} target="_blank" rel="noopener noreferrer">
                        <img src={ad.imageUrl} alt={ad.title} className="ad-popup-img" />
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className={`ad-container ad-${placement.toLowerCase()}`}>
            {ads.map(ad => (
                <div key={ad.id} className="ad-item">
                    <a href={ad.targetUrl || '#'} target="_blank" rel="noopener noreferrer" title={ad.title}>
                        <img src={ad.imageUrl} alt={ad.title} className="ad-img" />
                    </a>
                </div>
            ))}
        </div>
    );
}
