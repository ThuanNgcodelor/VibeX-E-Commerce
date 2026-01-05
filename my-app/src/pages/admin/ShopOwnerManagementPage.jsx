import React, { useState } from 'react';
import '../../assets/admin/css/ShopOwnerManagementPage.css';
import ShopOwnerList from '../../components/admin/shopOwner/ShopOwnerList';
import ShopStatsDashboard from '../../components/admin/shopOwner/ShopStatsDashboard';
import OverviewDashboard from '../../components/admin/shopOwner/OverviewDashboard';

// Mock data - sẽ thay bằng API call sau
const mockShops = [
    {
        id: '1',
        userId: 'user-001',
        shopName: 'Tech Store VN',
        ownerName: 'Nguyễn Văn A',
        verified: true,
        imageUrl: null,
        totalProducts: 150,
        totalOrders: 320,
        totalRevenue: 125000000,
        createdAt: '2024-01-15'
    },
    {
        id: '2',
        userId: 'user-002',
        shopName: 'Fashion Paradise',
        ownerName: 'Trần Thị B',
        verified: true,
        imageUrl: null,
        totalProducts: 280,
        totalOrders: 512,
        totalRevenue: 200000000,
        createdAt: '2024-02-20'
    },
    {
        id: '3',
        userId: 'user-003',
        shopName: 'Home & Living',
        ownerName: 'Lê Văn C',
        verified: false,
        imageUrl: null,
        totalProducts: 95,
        totalOrders: 180,
        totalRevenue: 75000000,
        createdAt: '2024-03-10'
    },
    {
        id: '4',
        userId: 'user-004',
        shopName: 'Beauty Corner',
        ownerName: 'Phạm Thị D',
        verified: true,
        imageUrl: null,
        totalProducts: 120,
        totalOrders: 245,
        totalRevenue: 95000000,
        createdAt: '2024-04-05'
    },
    {
        id: '5',
        userId: 'user-005',
        shopName: 'Sports Gear',
        ownerName: 'Hoàng Văn E',
        verified: false,
        imageUrl: null,
        totalProducts: 65,
        totalOrders: 102,
        totalRevenue: 45000000,
        createdAt: '2024-05-12'
    }
];

export default function ShopOwnerManagementPage() {
    const [selectedShopId, setSelectedShopId] = useState(null);

    const handleSelectShop = (shopId) => {
        setSelectedShopId(shopId);
    };

    const selectedShop = mockShops.find(shop => shop.id === selectedShopId);

    return (
        <div className="shop-owner-management">
            <div className="page-header">
                <h1 className="page-title">
                    <i className="fas fa-store me-2"></i>
                    Shop Owner Management
                </h1>
                <p className="page-subtitle">Quản lý thông tin và thống kê của các shop owner</p>
            </div>

            <div className="management-container">
                <div className="row g-3">
                    {/* Left Panel - Shop List */}
                    <div className="col-lg-5">
                        <ShopOwnerList
                            shops={mockShops}
                            selectedShopId={selectedShopId}
                            onSelectShop={handleSelectShop}
                        />
                    </div>

                    {/* Right Panel - Statistics Dashboard */}
                    <div className="col-lg-7">
                        {selectedShopId && selectedShop ? (
                            <ShopStatsDashboard shop={selectedShop} />
                        ) : (
                            <OverviewDashboard shops={mockShops} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}