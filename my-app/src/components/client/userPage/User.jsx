import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getUserRole, isAuthenticated } from "../../../api/auth.js";
import { getUser } from "../../../api/user.js";
import Address from "./Address.jsx";
import AccountInfo from "./AccountInfo.jsx";
import RoleRequestForm from "./RoleRequestForm.jsx";
import OrderList from "./OrderList.jsx";
import NotificationPage from "./NotificationPage.jsx";
import CoinPage from "./CoinPage.jsx";
import Loading from "../Loading.jsx";
import { fetchImageById } from "../../../api/image.js";
import UserWalletPage from "./UserWalletPage.jsx";

export default function User() {
    const { t } = useTranslation();
    const [, setUserInfo] = useState(null);
    const location = useLocation();
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [avatarUrl, setAvatarUrl] = useState("");
    const avatarRef = useRef("");
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("dashboard");

    useEffect(() => {
        if (!isAuthenticated()) {
            navigate("/login");
        } else {
            const role = getUserRole();
            setUserInfo(role);
        }
    }, [navigate]);

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                setLoading(true);
                const response = await getUser();
                setUserData(response);
                // load avatar if available
                const imageId = response?.userDetails?.imageUrl || response?.imageUrl;
                if (imageId) {
                    try {
                        const resp = await fetchImageById(imageId);
                        const type = resp.headers?.["content-type"] || "image/jpeg";
                        const blob = new Blob([resp.data], { type });
                        const url = URL.createObjectURL(blob);
                        if (avatarRef.current) URL.revokeObjectURL(avatarRef.current);
                        avatarRef.current = url;
                        setAvatarUrl(url);
                    } catch (e) {
                        console.error("Failed to load avatar", e);
                        setAvatarUrl("");
                    }
                } else {
                    setAvatarUrl("");
                }
            } catch (error) {
                console.error("Error fetching user info:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserInfo();

        return () => {
            if (avatarRef.current) {
                URL.revokeObjectURL(avatarRef.current);
                avatarRef.current = "";
            }
        };
    }, []);

    // Listen for avatar updates from AccountInfo
    useEffect(() => {
        const handleAvatarUpdated = async (event) => {
            const detail = event?.detail || {};
            const imageId = detail.imageId;
            const urlFromDetail = detail.avatarUrl;

            // If we get an imageId, refetch to ensure fresh blob
            if (imageId) {
                try {
                    const resp = await fetchImageById(imageId);
                    const type = resp.headers?.["content-type"] || "image/jpeg";
                    const blob = new Blob([resp.data], { type });
                    const url = URL.createObjectURL(blob);
                    if (avatarRef.current) URL.revokeObjectURL(avatarRef.current);
                    avatarRef.current = url;
                    setAvatarUrl(url);
                    return;
                } catch (e) {
                    console.error("Failed to refresh avatar from imageId", e);
                }
            }

            // Fallback: use provided URL (object URL from AccountInfo)
            if (urlFromDetail) {
                if (avatarRef.current) URL.revokeObjectURL(avatarRef.current);
                avatarRef.current = urlFromDetail;
                setAvatarUrl(urlFromDetail);
            }
        };

        window.addEventListener("userAvatarUpdated", handleAvatarUpdated);
        return () => window.removeEventListener("userAvatarUpdated", handleAvatarUpdated);
    }, []);

    useEffect(() => {
        const path = location.pathname.split("/")[2];
        if (path) {
            setActiveTab(path);
        } else {
            setActiveTab("dashboard");
        }
    }, [location.pathname]);

    const handleTabClick = (tab) => {
        setActiveTab(tab);
        navigate(`/information/${tab}`);
    };

    if (loading) {
        return <Loading fullScreen />;
    }

    return (
        <div style={{ background: '#F5F5F5', minHeight: '100vh', padding: '20px 0', width: '100%' }}>

            <div className="container" style={{ maxWidth: '1200px' }}>

                <div className="row g-3">
                    {/* Left Sidebar - Shopee Style */}
                    <div className="col-12 col-lg-3">
                        <div style={{ background: 'white', borderRadius: '4px', overflow: 'hidden' }}>
                            {/* User Profile */}
                            <div style={{ padding: '20px', borderBottom: '1px solid #f0f0f0' }}>
                                <div className="d-flex align-items-center gap-3">
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt="avatar"
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                flexShrink: 0,
                                                border: '1px solid #e5e5e5'
                                            }}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: '50px',
                                                height: '50px',
                                                borderRadius: '50%',
                                                background: '#E8ECEF',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                            }}
                                        >
                                            <i className="fa fa-user" style={{ fontSize: '20px', color: '#666' }}></i>
                                        </div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#222', marginBottom: '4px' }}>
                                            {userData?.username || 'User'}
                                        </div>
                                        <Link
                                            to="/information/account-info"
                                            onClick={() => handleTabClick('account-info')}
                                            style={{
                                                fontSize: '12px',
                                                color: '#ee4d2d',
                                                textDecoration: 'none'
                                            }}
                                        >
                                            {t('user.editProfile')}
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <button
                                    onClick={() => handleTabClick("notifications")}
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px',
                                        border: 'none',
                                        background: activeTab === "notifications" ? '#fff5f0' : 'transparent',
                                        color: activeTab === "notifications" ? '#ee4d2d' : '#222',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <i className="fa fa-bell" style={{ width: '20px', textAlign: 'center' }}></i>
                                    {t('user.notifications')}
                                </button>

                                <button
                                    onClick={() => handleTabClick("dashboard")}
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px',
                                        border: 'none',
                                        background: activeTab === "dashboard" ? '#fff5f0' : 'transparent',
                                        color: activeTab === "dashboard" ? '#ee4d2d' : '#222',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <i className="fa fa-user" style={{ width: '20px', textAlign: 'center' }}></i>
                                    {t('user.myAccount')}
                                </button>

                                {/* Sub-menu for Account */}
                                {activeTab === "dashboard" && (
                                    <div style={{ paddingLeft: '48px', background: '#fafafa' }}>
                                        <button
                                            onClick={() => handleTabClick("account-info")}
                                            style={{
                                                width: '100%',
                                                padding: '10px 0',
                                                border: 'none',
                                                background: 'transparent',
                                                color: activeTab === "account-info" ? '#ee4d2d' : '#666',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                transition: 'color 0.2s'
                                            }}
                                        >
                                            {t('user.profile')}
                                        </button>
                                        <button
                                            onClick={() => handleTabClick("address")}
                                            style={{
                                                width: '100%',
                                                padding: '10px 0',
                                                border: 'none',
                                                background: 'transparent',
                                                color: activeTab === "address" ? '#ee4d2d' : '#666',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                transition: 'color 0.2s'
                                            }}
                                        >
                                            {t('user.address')}
                                        </button>
                                    </div>
                                )}

                                <button
                                    onClick={() => handleTabClick("orders")}
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px',
                                        border: 'none',
                                        background: activeTab === "orders" ? '#fff5f0' : 'transparent',
                                        color: activeTab === "orders" ? '#ee4d2d' : '#222',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <i className="fa fa-file-text" style={{ width: '20px', textAlign: 'center' }}></i>
                                    {t('user.myOrders')}
                                </button>


                                <button
                                    onClick={() => handleTabClick("coins")}
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px',
                                        border: 'none',
                                        background: activeTab === "coins" ? '#fff5f0' : 'transparent',
                                        color: activeTab === "coins" ? '#ee4d2d' : '#222',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <i className="fa fa-coins" style={{ width: '20px', textAlign: 'center', color: '#ffc107' }}></i>
                                    Vibe Coins
                                </button>

                                <button
                                    onClick={() => handleTabClick("wallet")}
                                    style={{
                                        width: '100%',
                                        padding: '14px 16px',
                                        border: 'none',
                                        background: activeTab === "wallet" ? '#fff5f0' : 'transparent',
                                        color: activeTab === "wallet" ? '#ee4d2d' : '#222',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <i className="fa fa-ticket" style={{ width: '20px', textAlign: 'center' }}></i>
                                    {t('Wallet')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="col-12 col-lg-9">
                        {activeTab === "orders" ? (
                            <OrderList />
                        ) : (
                            <div style={{ background: 'white', borderRadius: '4px', minHeight: '400px' }}>
                                {/* Dashboard Tab */}
                                {activeTab === "dashboard" && (
                                    <div className="p-4">
                                        <h5 style={{ color: '#222', marginBottom: '16px', fontSize: '18px' }}>{t('user.myAccount')}</h5>
                                        <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
                                            {t('user.hello', { username: userData?.username || 'User' })}
                                        </p>
                                        <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.6' }}>
                                            {t('user.accountDescription')}
                                        </p>
                                    </div>
                                )}

                                {/* Address Tab */}
                                {activeTab === "address" && (
                                    <div className="p-4">
                                        <Address />
                                    </div>
                                )}

                                {/* Account Info Tab */}
                                {activeTab === "account-info" && (
                                    <div className="p-4">
                                        <AccountInfo />
                                    </div>
                                )}

                                {/* Role Request Tab */}
                                {activeTab === "role-request" && (
                                    <div className="p-4">
                                        <RoleRequestForm />
                                    </div>
                                )}

                                {/* Notifications Tab */}
                                {activeTab === "notifications" && (
                                    <div className="p-4">
                                        <NotificationPage />
                                    </div>
                                )}


                                {/* Coins Tab */}
                                {activeTab === "coins" && (
                                    <CoinPage />
                                )}

                                {/* Wallet Tab */}
                                {activeTab === "wallet" && (
                                    <UserWalletPage />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}
