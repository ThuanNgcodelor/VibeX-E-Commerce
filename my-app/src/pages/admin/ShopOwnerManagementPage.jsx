import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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

    // Pagination & Search State
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [pageSize] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [sortDir, setSortDir] = useState('asc'); // 'asc' or 'desc'
    const [filterVerified, setFilterVerified] = useState('all');
    const [searchParams] = useSearchParams();

    // Date Range State (Default: Last 30 days)
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    useEffect(() => {
        const querySearch = searchParams.get('search');
        if (querySearch) {
            setSearchTerm(querySearch);
            // Trigger fetch immediately with the new term
            fetchShops(0, querySearch, startDate, endDate);
        } else {
            fetchShops(currentPage, searchTerm, startDate, endDate);
        }
    }, [currentPage, startDate, endDate, sortBy, sortDir, searchParams]); // Fetch when params change

    // Triggered by search submit in child
    const handleSearch = (term) => {
        setSearchTerm(term);
        setCurrentPage(0); // Reset to page 0
        fetchShops(0, term, startDate, endDate);
    };

    const fetchShops = async (page, search, start, end) => {
        try {
            setLoading(true);
            const params = {
                page: page,
                size: pageSize,
                search: search,
                startDate: start,
                endDate: end,
                sortBy: sortBy,
                sortDir: sortDir
            };

            const data = await shopOwnerAdminApi.getAllShopOwnersWithStats(params);

            // Backend returns Page object: { content: [], totalPages: ... }
            const shopList = data.content || [];
            const mappedData = shopList.map(item => ({
                ...item,
                id: item.userId,
                createdAt: item.createdAt || 'N/A'
            }));

            // No client-side sort needed anymore as backend handles it

            setShops(mappedData);
            setTotalPages(data.totalPages);
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
            fetchShops(currentPage, searchTerm);
        } catch (err) {
            console.error("Failed to toggle shop status:", err);
            // Revert on error
            fetchShops(currentPage, searchTerm);
        }
    };

    const handleVerifyShop = async (shopId) => {
        try {
            // Optimistic update
            setShops(prevShops => prevShops.map(shop => {
                if (shop.id === shopId) {
                    return { ...shop, verified: true };
                }
                return shop;
            }));

            await shopOwnerAdminApi.verifyShop(shopId);
            fetchShops(currentPage, searchTerm);
        } catch (err) {
            console.error("Failed to verify shop:", err);
            fetchShops(currentPage, searchTerm);
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
                            sortBy={sortBy}
                            setSortBy={(val) => {
                                setSortBy(val);
                                // Default directions for better UX
                                if (val === 'name') setSortDir('asc');
                                else if (val === 'revenue') setSortDir('desc');
                                else if (val === 'trending') setSortDir('desc');
                            }}
                            sortDir={sortDir}
                            setSortDir={setSortDir}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            filterVerified={filterVerified}
                            setFilterVerified={setFilterVerified}
                            totalPages={totalPages}
                            currentPage={currentPage}
                            onPageChange={(page) => setCurrentPage(page)}
                            onSearch={handleSearch}
                            startDate={startDate}
                            setStartDate={setStartDate}
                            endDate={endDate}
                            setEndDate={setEndDate}
                        />
                    </div>

                    {/* Right Panel - Statistics Dashboard */}
                    <div className="col-lg-7">
                        {selectedShopId && selectedShop ? (
                            <ShopStatsDashboard
                                shop={selectedShop}
                                onToggleStatus={handleToggleStatus}
                                onVerifyShop={handleVerifyShop}
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