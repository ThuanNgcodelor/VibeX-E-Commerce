import React, { useState, useEffect } from 'react';
import '../../assets/admin/css/ShopOwnerManagementPage.css';
import ShopOwnerList from '../../components/admin/shopOwner/ShopOwnerList';
import ShopStatsDashboard from '../../components/admin/shopOwner/ShopStatsDashboard';
import OverviewDashboard from '../../components/admin/shopOwner/OverviewDashboard';
import shopOwnerAdminApi from '../../api/shopOwnerAdminApi';

export default function ShopOwnerManagementPage() {
    const [selectedShopId, setSelectedShopId] = useState(null);
    const [shops, setShops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchShops();
    }, []);

    const fetchShops = async () => {
        try {
            setLoading(true);
            const data = await shopOwnerAdminApi.getAllShopOwnersWithStats();
            // Map userId to id for frontend compatibility if needed, or just use userId
            const mappedData = data.map(item => ({
                ...item,
                id: item.userId, // Use userId as id
                createdAt: 'N/A' // backend doesn't return createdAt in stats DTO yet, or fix DTO
            }));
            setShops(mappedData);
            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch shops:", err);
            setError("Cannot fetch shop owner data.");
            setLoading(false);
        }
    };

    const handleSelectShop = (shopId) => {
        setSelectedShopId(shopId);
    };

    const handleToggleStatus = async (shopId) => {
        try {
            // Optimistic update
            setShops(prevShops => prevShops.map(shop => {
                if (shop.id === shopId) {
                    const newStatus = shop.status === 'LOCKED'
                        ? (shop.verified ? 'ACTIVE' : 'PENDING') // Fallback logic
                        : 'LOCKED';
                    return { ...shop, status: newStatus };
                }
                return shop;
            }));

            await shopOwnerAdminApi.toggleShopStatus(shopId);
            // Re-fetch to confirm or just rely on optimistic
            fetchShops();
        } catch (err) {
            console.error("Failed to toggle shop status:", err);
            // Revert on error
            fetchShops();
        }
    };

    const selectedShop = shops.find(shop => shop.id === selectedShopId);

    if (loading) return <div className="p-5 text-center">Loading shop data...</div>;
    if (error) return <div className="p-5 text-center text-danger">Error: {error}</div>;

    return (
        <div className="shop-owner-management">
            <div className="page-header">
                <h1 className="page-title">
                    <i className="fas fa-store me-2"></i>
                    Shop Owner Management
                </h1>
                <p className="page-subtitle">Manage shop owner information and statistics</p>
            </div>

            <div className="management-container">
                <div className="row g-3">
                    {/* Left Panel - Shop List */}
                    <div className="col-lg-5">
                        <ShopOwnerList
                            shops={shops}
                            selectedShopId={selectedShopId}
                            onSelectShop={handleSelectShop}
                            onToggleStatus={handleToggleStatus}
                        />
                    </div>

                    {/* Right Panel - Statistics Dashboard */}
                    <div className="col-lg-7">
                        {selectedShopId && selectedShop ? (
                            <ShopStatsDashboard
                                shop={selectedShop}
                                onToggleStatus={handleToggleStatus}
                            />
                        ) : (
                            <OverviewDashboard shops={shops} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}