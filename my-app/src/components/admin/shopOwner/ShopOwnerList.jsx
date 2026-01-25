import React, { useState } from 'react';
import '../../../assets/admin/css/ShopOwnerList.css';
import Swal from 'sweetalert2';

export default function ShopOwnerList({
    shops,
    selectedShopId,
    onSelectShop,
    onToggleStatus,
    sortBy,
    setSortBy,
    searchTerm,
    setSearchTerm,
    filterVerified,
    setFilterVerified,
    totalPages,
    currentPage,
    onPageChange,
    onSearch, // Callback to trigger search in parent
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    sortDir,
    setSortDir
}) {

    const handleLockClick = (e, shop) => {
        e.stopPropagation(); // Stop row selection

        const isLocked = shop.status === 'LOCKED';
        const action = isLocked ? 'Unlock' : 'Lock';

        Swal.fire({
            title: `Are you sure you want to ${action.toLowerCase()} this shop?`,
            text: isLocked ? "The shop will be active again." : "The shop will be disabled and cannot sell products.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: isLocked ? '#28a745' : '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: `Yes, ${action} it!`
        }).then((result) => {
            if (result.isConfirmed) {
                onToggleStatus(shop.id);
                Swal.fire({
                    title: `${action}ed!`,
                    text: `The shop has been ${action.toLowerCase()}ed.`,
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        onSearch(searchTerm); // Trigger fetch in parent
    };

    const formatDate = (dateString, showTime = false) => {
        if (!dateString || dateString === 'N/A') return 'N/A';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
    };

    return (
        <div className="shop-owner-list-container">
            <div className="list-header mb-3">
                <h3 className="list-title mb-0">
                    <i className="fas fa-list me-2"></i>
                    Shop List ({shops.length} displayed)
                </h3>
            </div>

            {/* Search and Filters */}
            <div className="list-controls mb-3">
                {/* Date Range Picker */}
                <div className="d-flex gap-2 mb-2">
                    <input
                        type="date"
                        className="form-control form-control-sm"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        title="Start Date"
                    />
                    <span className="align-self-center">-</span>
                    <input
                        type="date"
                        className="form-control form-control-sm"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        title="End Date"
                    />
                </div>

                <form onSubmit={handleSearchSubmit} className="search-box mb-2 w-100">
                    <i className="fas fa-search"></i>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search shop or owner..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </form>

                <div className="filter-row d-flex gap-2">
                    <select
                        className="form-select form-select-sm"
                        value={filterVerified}
                        onChange={(e) => setFilterVerified(e.target.value)} // Note: You might want to handle this in parent too if server-side filter needed
                        disabled // Disabled for now as backend simplified plan focused on Search
                    >
                        <option value="all">All Statuses</option>
                        {/* <option value="verified">✓ Verified</option>
                        <option value="unverified">⏳ Unverified</option> */}
                    </select>

                    <select
                        className="form-select form-select-sm"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                    >
                        <option value="name">Sort: Name</option>
                        <option value="revenue">Sort: Revenue</option>
                        <option value="trending">Sort: 🔥 Trending</option>
                    </select>

                    <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                        title={sortDir === 'asc' ? 'Ascending (A-Z)' : 'Descending (Z-A)'}
                        type="button"
                    >
                        <i className={`fas fa-sort-${sortDir === 'asc' ? 'amount-down-alt' : 'amount-down'}`}></i>
                    </button>
                </div>
            </div>

            {/* Shop Table */}
            <div className="table-responsive">
                <table className="table table-hover align-middle mb-0 bg-white">
                    <thead className="table-light sticky-top">
                        <tr>
                            <th scope="col" style={{ width: '40%' }}>Shop</th>
                            <th scope="col" style={{ width: '25%' }}>Owner</th>
                            <th scope="col" style={{ width: '20%' }}>Status</th>
                            <th scope="col" style={{ width: '15%', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shops.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center p-4 text-muted">
                                    <i className="fas fa-store-slash me-2"></i>
                                    No shops found
                                </td>
                            </tr>
                        ) : (
                            shops.map(shop => {
                                // Trending Logic: Revenue > 10M OR Orders > 10 (Adjust as needed)
                                const isTrending = (shop.totalRevenue > 10000000) || (shop.totalOrders >= 10);

                                return (
                                    <tr
                                        key={shop.id}
                                        className={`${selectedShopId === shop.id ? 'table-active' : ''} ${isTrending ? 'table-warning' : ''}`}
                                        style={{ cursor: 'pointer', backgroundColor: isTrending && selectedShopId !== shop.id ? '#fff3cd' : undefined }}
                                        onClick={() => onSelectShop(shop.id)}
                                    >
                                        <td>
                                            <div className="d-flex align-items-center">
                                                {/* Trending Badge */}
                                                {isTrending && (
                                                    <div className="me-2 text-warning" title="Trending Shop!">
                                                        <i className="fas fa-fire"></i>
                                                    </div>
                                                )}

                                                {shop.imageUrl ? (
                                                    <img
                                                        src={shop.imageUrl}
                                                        alt=""
                                                        style={{ width: '32px', height: '32px' }}
                                                        className="rounded-circle me-2"
                                                    />
                                                ) : (
                                                    <div
                                                        className="rounded-circle me-2 bg-secondary text-white d-flex align-items-center justify-content-center"
                                                        style={{ width: '32px', height: '32px', fontSize: '12px' }}
                                                    >
                                                        {shop.shopName.charAt(0)}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="fw-bold text-truncate" style={{ maxWidth: '120px' }}>{shop.shopName}</div>
                                                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                        Joined: {formatDate(shop.createdAt)}
                                                    </small>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className='d-flex align-items-center text-truncate' style={{ maxWidth: '100px' }}>
                                                <i className="fas fa-user-circle me-1 text-secondary"></i>
                                                {shop.ownerName}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="d-flex justify-content-between align-items-center">
                                                {shop.status === 'LOCKED' ? (
                                                    <span className="badge bg-danger rounded-pill">Locked</span>
                                                ) : (
                                                    <span className={`badge ${shop.verified ? 'bg-primary' : 'bg-warning text-dark'} rounded-pill d-flex align-items-center gap-1`}>
                                                        {shop.verified && <i className="fas fa-check-circle text-white" style={{ fontSize: '10px' }}></i>}
                                                        {shop.verified ? 'Verified' : 'Unverified'}
                                                    </span>
                                                )}

                                            </div>
                                        </td>
                                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                            <a
                                                href={`/shop/${shop.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-sm btn-outline-primary"
                                                title="View Shop Public Page"
                                            >
                                                <i className="fas fa-external-link-alt"></i> View
                                            </a>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {
                totalPages > 0 && (
                    <div className="pagination-controls d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            disabled={currentPage === 0}
                            onClick={() => onPageChange(currentPage - 1)}
                        >
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <span className="small text-muted">
                            Page {currentPage + 1} of {totalPages}
                        </span>
                        <button
                            className="btn btn-sm btn-outline-secondary"
                            disabled={currentPage === totalPages - 1}
                            onClick={() => onPageChange(currentPage + 1)}
                        >
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>
                )
            }
        </div >
    );
}
