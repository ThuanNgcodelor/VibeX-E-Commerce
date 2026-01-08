import React, { useEffect, useState } from 'react';
import '../../assets/admin/css/AdminWallet.css';
import { getAdminWalletBalance, getAdminWalletEntries } from '../../api/adminWalletApi';


const AdminWalletPage = () => {
    const [balanceData, setBalanceData] = useState({
        balanceAvailable: 0,
        totalCommission: 0,
        totalSubscriptionRevenue: 0
    });
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const fetchWalletData = async () => {
        setLoading(true);
        try {
            const balance = await getAdminWalletBalance();
            setBalanceData(balance);

            const entriesData = await getAdminWalletEntries(page, 20);
            setEntries(entriesData.content);
            setTotalPages(entriesData.totalPages);
        } catch (error) {
            console.error("Failed to load wallet data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWalletData();
    }, [page]);

    const handlePrevPage = () => {
        if (page > 0) setPage(page - 1);
    };

    const handleNextPage = () => {
        if (page < totalPages - 1) setPage(page + 1);
    };

    return (
        <div className="admin-wallet-page">
            <div className="wallet-header">
                <h1 className="wallet-title">Admin Wallet</h1>
            </div>

            {/* Stats Cards */}
            <div className="wallet-stats-grid">
                <div className="stat-card">
                    <div className="stat-icon-wrapper balance">
                        <i className="fas fa-wallet"></i>
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Available Balance</span>
                        <div className="stat-value">{loading ? '...' : formatCurrency(balanceData.balance)}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon-wrapper commission">
                        <i className="fas fa-percentage"></i>
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Total Commission</span>
                        <div className="stat-value">{loading ? '...' : formatCurrency(balanceData.totalCommission)}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon-wrapper subscription">
                        <i className="fas fa-crown"></i>
                    </div>
                    <div className="stat-content">
                        <span className="stat-label">Subscription Revenue</span>
                        <div className="stat-value">{loading ? '...' : formatCurrency(balanceData.totalSubscriptionRevenue)}</div>
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="transactions-card">
                <div className="card-header">
                    <h2 className="card-title">Transaction History</h2>
                    <button className="btn-page" onClick={fetchWalletData}>
                        <i className="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="wallet-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Balance After</th>
                                    <th>Description</th>
                                    <th>Ref ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="text-center p-4">Loading...</td>
                                    </tr>
                                ) : entries.length > 0 ? (
                                    entries.map((entry) => (
                                        <tr key={entry.id}>
                                            <td>{new Date(entry.creationTimestamp).toLocaleString('vi-VN')}</td>
                                            <td>
                                                <span className={`badge-type badge-${entry.type}`}>
                                                    {entry.type ? entry.type.replace('_', ' ') : ''}
                                                </span>
                                            </td>
                                            <td className="amount-positive">
                                                +{formatCurrency(entry.amount)}
                                            </td>
                                            <td>{formatCurrency(entry.balanceAfter)}</td>
                                            <td>{entry.description}</td>
                                            <td>
                                                <small className="text-muted">{entry.sourceId}</small>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-center p-4">No transactions found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="pagination-controls">
                        <span className="page-info">
                            Page {page + 1} of {totalPages || 1}
                        </span>
                        <button
                            className="btn-page"
                            onClick={handlePrevPage}
                            disabled={page === 0 || loading}
                        >
                            Previous
                        </button>
                        <button
                            className="btn-page"
                            onClick={handleNextPage}
                            disabled={page >= totalPages - 1 || loading}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminWalletPage;
