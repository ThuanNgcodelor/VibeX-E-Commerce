import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ShopOwnerSidebar from "./layout/ShopOwnerSidebar";
import ShopOwnerHeader from "./layout/ShopOwnerHeader";
import ShopLockedBlocker from "./ShopLockedBlocker";
import './ShopOwnerLayout.css';

import { getShopOwnerInfo } from "../../api/user";

export default function ShopOwnerLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const location = useLocation();

    useEffect(() => {
        const checkShopStatus = async () => {
            try {
                const shopInfo = await getShopOwnerInfo();
                if (shopInfo && shopInfo.active === 'INACTIVE') {
                    setIsLocked(true);
                }
            } catch (error) {
                console.error("Failed to check shop status:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkShopStatus();

        // Load Bootstrap và các assets cần thiết
        const loadAssets = () => {
            // Check if Bootstrap CSS is already loaded
            if (!document.getElementById('bootstrap-shop-owner-css')) {
                const bootstrapCSS = document.createElement('link');
                bootstrapCSS.rel = 'stylesheet';
                bootstrapCSS.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css';
                bootstrapCSS.id = 'bootstrap-shop-owner-css';
                document.head.appendChild(bootstrapCSS);
            }

            // Load FontAwesome
            if (!document.getElementById('fontawesome-css')) {
                const fontAwesomeCSS = document.createElement('link');
                fontAwesomeCSS.rel = 'stylesheet';
                fontAwesomeCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
                fontAwesomeCSS.id = 'fontawesome-css';
                document.head.appendChild(fontAwesomeCSS);
            }
        };

        loadAssets();

        return () => {
            // Cleanup if needed
        };
    }, []);

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    // Define paths allowed when shop is locked
    const ALLOWED_LOCKED_PATHS = [
        '/shop-owner/orders',
        '/shop-owner/wallet',
        '/shop-owner/chat',
        '/shop-owner/notifications',
        '/shop-owner/settings',
        '/shop-owner/reviews'
    ];

    const isAllowedPath = ALLOWED_LOCKED_PATHS.some(path => location.pathname.startsWith(path));

    if (isLocked && !isAllowedPath) {
        return (
            <div className="shop-owner-layout">
                <ShopOwnerHeader onMenuClick={toggleSidebar} />
                <ShopLockedBlocker mode="fullscreen" />
                <div className="container-fluid" style={{ pointerEvents: 'none', filter: 'blur(5px)' }}>
                    {/* Render layout in background but blurred and disabled */}
                    <div className="row">
                        <ShopOwnerSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                        <main className="col-md-9 main-content">
                            {/* Don't render outlet content to be safe and save performance */}
                        </main>
                    </div>
                </div>
                {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
            </div>
        );
    }

    return (
        <div className="shop-owner-layout">
            <ShopOwnerHeader onMenuClick={toggleSidebar} />
            {isLocked && <ShopLockedBlocker mode="banner" />}
            <div className="shop-layout-wrapper">
                <ShopOwnerSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
        </div>
    );
}

