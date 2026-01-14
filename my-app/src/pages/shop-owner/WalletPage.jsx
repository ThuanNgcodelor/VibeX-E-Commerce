import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../components/shop-owner/ShopOwnerLayout.css';
import { getShopOwnerInfo } from '../../api/user';
import { getBalance, getEntries, requestPayout, getPayoutHistory } from '../../api/ledger';

export default function WalletPage() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('unpaid'); // 'unpaid' or 'paid'
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [shopOwnerId, setShopOwnerId] = useState(null);

    const [walletData, setWalletData] = useState({
        unpaidTotal: 0,
        paidThisWeek: 0,
        paidThisMonth: 0,
        paidTotal: 0,
        balanceAvailable: 0
    });

    const [entries, setEntries] = useState([]);

    // Payout Form State
    const [showPayoutModal, setShowPayoutModal] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutDescription, setPayoutDescription] = useState('');
    const [bankInfo, setBankInfo] = useState({
        bankAccountNumber: '',
        bankName: '',
        accountHolderName: ''
    });

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const fetchWalletData = async () => {
        try {
            setLoading(true);
            const shopInfo = await getShopOwnerInfo();
            const id = shopInfo.userId; // Assuming userId is what we need
            setShopOwnerId(id);

            const balance = await getBalance(id);
            setWalletData({
                unpaidTotal: (balance.balanceAvailable || 0) + (balance.balancePending || 0),
                paidThisWeek: 0, // Not implemented in backend yet
                paidThisMonth: 0, // Not implemented in backend yet
                paidTotal: balance.totalPayouts || 0,
                balanceAvailable: balance.balanceAvailable || 0
            });

            const entriesData = await getEntries(id, 0, 50);
            const payoutHistory = await getPayoutHistory(id);

            // Combine history for better view or just use entries.
            // For now, let's just stick to entries but ensure we can map payout entries effectively if we need better details.
            // Actually, let's map entries just like before.

            // Map entries to UI format
            const mappedEntries = (entriesData.content || []).map(e => ({
                id: e.id,
                orderId: e.orderId || e.refTxn,
                buyerName: 'Shopper', // Placeholder
                productImage: '/placeholder-product.jpg',
                productName: e.description || 'Order Item',
                estimatedPaymentDate: new Date(e.createdAt).toLocaleString('vi-VN'),
                status: e.entryType,
                paymentMethod: 'Wallet',
                unpaidAmount: e.amountNet, // Amount this entry affected the wallet
                completedAt: e.createdAt,
                type: e.entryType,
                // If it's a payout, we might want the payout ID.
                // However, the Payout Entry usually has refTxn = "PAYOUT_{ID}".
                payoutId: e.entryType === 'PAYOUT' && e.refTxn && e.refTxn.startsWith('PAYOUT_')
                    ? e.refTxn.replace('PAYOUT_', '')
                    : null
            }));
            setEntries(mappedEntries);

        } catch (error) {
            console.error("Failed to fetch wallet data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWalletData();
    }, []);

    // Notification State
    const [notification, setNotification] = useState({
        show: false,
        type: 'info', // success, error, warning, info
        title: '',
        message: ''
    });

    const showNotification = (type, title, message) => {
        setNotification({
            show: true,
            type,
            title,
            message
        });
    };

    const closeNotification = () => {
        setNotification(prev => ({ ...prev, show: false }));
    };

    const handlePayout = async (e) => {
        e.preventDefault();
        try {
            const realAmount = Number(payoutAmount.replace(/\./g, ''));
            if (!realAmount || realAmount <= 0) return;
            if (realAmount > walletData.balanceAvailable) {
                showNotification('warning', t('shopOwner.wallet.notifications.insufficientBalance.title'), t('shopOwner.wallet.notifications.insufficientBalance.message'));
                return;
            }

            await requestPayout(shopOwnerId, {
                amount: realAmount,
                bankAccountNumber: bankInfo.bankAccountNumber,
                bankName: bankInfo.bankName,
                accountHolderName: bankInfo.accountHolderName,
                description: payoutDescription
            });

            showNotification('success', t('shopOwner.wallet.notifications.payoutSuccess.title'), t('shopOwner.wallet.notifications.payoutSuccess.message'));
            setShowPayoutModal(false);
            setPayoutAmount('');
            setPayoutDescription('');
            fetchWalletData(); // Refresh data
        } catch (error) {
            showNotification('error', t('shopOwner.wallet.notifications.payoutError.title'), t('shopOwner.wallet.notifications.payoutError.message') + error.message);
        }
    };

    const handleExportInvoice = async (payoutId) => {
        try {
            // We need to import exportInvoice at top
            const { exportInvoice } = await import('../../api/ledger');
            const blob = await exportInvoice(payoutId);

            // Create download link
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `invoice_${payoutId}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            console.error(error);
            showNotification('error', t('shopOwner.wallet.notifications.exportInvoiceError.title'), t('shopOwner.wallet.notifications.exportInvoiceError.message'));
        }
    };

    const handleExportHistory = async () => {
        try {
            const { exportPayoutHistory } = await import('../../api/ledger');
            const blob = await exportPayoutHistory(shopOwnerId);

            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payout_history_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            console.error(error);
            showNotification('error', t('shopOwner.wallet.notifications.exportHistoryError.title'), t('shopOwner.wallet.notifications.exportHistoryError.message') + error.message);
        }
    };

    const filteredEntries = entries.filter(entry => {
        // Filter by tab
        if (activeTab === 'paid' && entry.type !== 'PAYOUT') return false;
        if (activeTab === 'unpaid' && entry.type === 'PAYOUT') return false;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                (entry.orderId || '').toLowerCase().includes(query) ||
                (entry.productName || '').toLowerCase().includes(query) ||
                (entry.status || '').toLowerCase().includes(query)
            );
        }
        return true;
    });

    return (
        <div className="dashboard-container">
            <div className="dashboard-header mb-4">
                <div className="d-flex justify-content-between align-items-center gap-4">
                    <div>
                        <h1 className="fw-bold text-dark mb-1">{t('shopOwner.wallet.title')}</h1>
                        <p className="text-muted mb-0">{t('shopOwner.wallet.subtitle')}</p>
                    </div>
                    <button
                        className="btn btn-primary btn-lg shadow-sm"
                        onClick={() => setShowPayoutModal(true)}
                        disabled={loading}
                        style={{ borderRadius: '10px' }}
                    >
                        <i className="fas fa-money-bill-wave me-2"></i>
                        {t('shopOwner.wallet.payoutModal.title', 'Rút tiền')}
                    </button>
                </div>
            </div>

            {/* Overview Section */}
            <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                <div className="card-header bg-white border-bottom-0 pt-4 pb-0">
                    <h5 className="mb-0 fw-bold text-dark">{t('shopOwner.wallet.overview.title')}</h5>
                </div>
                <div className="card-body">
                    <div className="alert alert-light border-start border-4 border-info mb-4" role="alert" style={{ fontSize: '0.9rem', backgroundColor: '#e3f2fd' }}>
                        <i className="fas fa-info-circle me-2 text-info"></i>
                        {t('shopOwner.wallet.overview.note')}
                    </div>

                    <div className="row g-4">
                        {/* Unpaid Section */}
                        <div className="col-md-6">
                            <div className="p-4 rounded-3 h-100 position-relative overflow-hidden"
                                style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', border: '1px solid #e9ecef', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                                <div className="position-absolute top-0 end-0 p-3 opacity-25">
                                    <i className="fas fa-wallet fa-4x" style={{ color: '#EE4D2D' }}></i>
                                </div>
                                <h6 className="text-muted text-uppercase fw-bold mb-3" style={{ fontSize: '0.8rem', letterSpacing: '0.5px' }}>
                                    {t('shopOwner.wallet.overview.unpaid')}
                                </h6>
                                <div className="mb-3">
                                    <span className="d-block text-secondary small mb-1">{t('shopOwner.wallet.overview.total')}</span>
                                    <span className="fw-bold text-dark" style={{ fontSize: '1.8rem', fontFamily: 'monospace' }}>
                                        {formatCurrency(walletData.unpaidTotal)}
                                    </span>
                                </div>
                                <div className="d-flex align-items-center pt-3 border-top">
                                    <div className="bg-opacity-10 rounded-circle p-2 me-3" style={{ backgroundColor: 'rgba(238, 77, 45, 0.1)' }}>
                                        <i className="fas fa-check" style={{ color: '#EE4D2D' }}></i>
                                    </div>
                                    <div>
                                        <span className="small text-muted d-block">{t('shopOwner.wallet.overview.withdrawable', 'Có thể rút')}:</span>
                                        <span className="fw-bold fs-5" style={{ color: '#EE4D2D' }}>
                                            {formatCurrency(walletData.balanceAvailable)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Paid Section */}
                        <div className="col-md-6">
                            <div className="p-4 rounded-3 h-100 position-relative overflow-hidden"
                                style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', border: '1px solid #e9ecef', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                                <div className="position-absolute top-0 end-0 p-3 opacity-25">
                                    <i className="fas fa-history fa-4x" style={{ color: '#EE4D2D' }}></i>
                                </div>
                                <h6 className="text-muted text-uppercase fw-bold mb-3" style={{ fontSize: '0.8rem', letterSpacing: '0.5px' }}>
                                    {t('shopOwner.wallet.overview.paid')}
                                </h6>
                                <div className="mb-3">
                                    <span className="d-block text-secondary small mb-1">{t('shopOwner.wallet.overview.total')}</span>
                                    <span className="fw-bold text-success" style={{ fontSize: '1.8rem', fontFamily: 'monospace' }}>
                                        {formatCurrency(walletData.paidTotal)}
                                    </span>
                                </div>
                                <div className="pt-3 border-top">
                                    <span className="badge bg-secondary bg-opacity-10 text-secondary rounded-pill px-3 py-2">
                                        <i className="fas fa-chart-line me-1"></i>
                                        {t('shopOwner.wallet.details.updatedJustNow', 'Cập nhật thời gian thực')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Entries Table */}
            <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
                <div className="card-header bg-white border-bottom py-3">
                    <div className="d-flex justify-content-between align-items-center">
                        <ul className="nav nav-pills" id="pills-tab" role="tablist">
                            <li className="nav-item me-2" role="presentation">
                                <button
                                    className={`nav-link rounded-pill px-4 ${activeTab === 'unpaid' ? 'active shadow-sm' : 'text-muted'}`}
                                    onClick={() => setActiveTab('unpaid')}
                                    style={activeTab === 'unpaid' ? { backgroundColor: '#EE4D2D', color: 'white' } : {}}
                                >
                                    {t('shopOwner.wallet.details.tabs.earnings', 'Thu nhập')}
                                </button>
                            </li>
                            <li className="nav-item" role="presentation">
                                <button
                                    className={`nav-link rounded-pill px-4 ${activeTab === 'paid' ? 'active shadow-sm' : 'text-muted'}`}
                                    onClick={() => setActiveTab('paid')}
                                    style={activeTab === 'paid' ? { backgroundColor: '#EE4D2D', color: 'white' } : {}}
                                >
                                    {t('shopOwner.wallet.details.tabs.payouts', 'Lịch sử rút tiền')}
                                </button>
                            </li>
                        </ul>

                        <div className="d-flex align-items-center">
                            {activeTab === 'paid' && (
                                <button
                                    className="btn btn-outline-success me-3 shadow-sm rounded-pill px-3"
                                    onClick={handleExportHistory}
                                    style={{ whiteSpace: 'nowrap' }}
                                >
                                    <i className="fas fa-file-excel me-2"></i>
                                    {t('shopOwner.wallet.details.exportHistory', 'Export History')}
                                </button>
                            )}
                            <div className="input-group shadow-sm" style={{ width: '300px' }}>
                                <span className="input-group-text bg-white border-end-0">
                                    <i className="fas fa-search text-muted"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 ps-0"
                                    placeholder={t('shopOwner.wallet.details.searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="bg-light text-muted text-uppercase small">
                                <tr>
                                    <th scope="col" className="ps-4 py-3 border-0">{t('shopOwner.wallet.details.description', 'Mô tả')} / {t('shopOwner.wallet.details.order')}</th>
                                    <th scope="col" className="py-3 border-0">{t('shopOwner.wallet.details.estimatedPaymentDate')}</th>
                                    <th scope="col" className="py-3 border-0 text-center">{t('shopOwner.wallet.details.status')}</th>
                                    <th scope="col" className="pe-4 py-3 border-0 text-end">{t('shopOwner.wallet.details.amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEntries.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="text-center py-5 text-muted">
                                            <div className="d-flex flex-column align-items-center">
                                                <i className="fas fa-box-open fa-3x mb-3 text-secondary opacity-50"></i>
                                                <p className="mb-0">{t('shopOwner.wallet.details.noEntries')}</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEntries.map((entry) => {
                                        // Determine status badge style
                                        let badgeClass = 'bg-secondary text-white';
                                        let statusLabel = entry.status;

                                        if (entry.status === 'COMPLETED') {
                                            badgeClass = 'bg-success-subtle text-success border border-success-subtle';
                                        } else if (entry.status === 'PENDING') {
                                            badgeClass = 'bg-warning-subtle text-warning border border-warning-subtle';
                                        } else if (entry.status === 'EARNING') {
                                            badgeClass = 'bg-teal-subtle text-teal border border-teal-subtle'; // Custom or use success
                                            // Fallback if teal not in bootstrap standard without custom css
                                            badgeClass = 'bg-success-subtle text-success border border-success-subtle';
                                        } else if (entry.status === 'PAYOUT') {
                                            badgeClass = 'bg-danger-subtle text-danger border border-danger-subtle';
                                        }

                                        // Override for specific types if status alone isn't enough, or just styling based on type
                                        if (entry.type === 'EARNING') {
                                            // Make Earning distinct if needed, but status usually covers it. 
                                            // If status is just 'EARNING' (from DTO), it falls into above.
                                        }

                                        return (
                                            <tr key={entry.id}>
                                                <td className="ps-4 py-3">
                                                    <div className="d-flex flex-column">
                                                        <span className="fw-bold text-dark mb-1" title={entry.productName}>
                                                            {entry.productName}
                                                        </span>
                                                        {entry.type === 'PAYOUT' && entry.payoutId && (
                                                            <button
                                                                className="btn btn-sm btn-link text-decoration-none p-0 mt-1 d-inline-flex align-items-center"
                                                                onClick={(e) => { e.stopPropagation(); handleExportInvoice(entry.payoutId); }}
                                                                title={t('shopOwner.wallet.details.exportInvoice', 'Invoice')}
                                                                style={{ fontSize: '0.85rem' }}
                                                            >
                                                                <i className="fas fa-file-invoice text-primary me-1"></i>
                                                                <span className="text-muted small">{t('shopOwner.wallet.details.invoiceFile')}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-muted small">
                                                    <div className="d-flex align-items-center">
                                                        <i className="far fa-calendar-alt me-2 text-primary opacity-50"></i>
                                                        {entry.estimatedPaymentDate}
                                                    </div>
                                                </td>
                                                <td className="text-center">
                                                    <span className={`badge rounded-pill px-3 py-2 fw-normal ${badgeClass}`}>
                                                        {statusLabel}
                                                    </span>
                                                </td>
                                                <td className="pe-4 text-end">
                                                    <span className={`fw-bold font-monospace fs-6 ${entry.unpaidAmount > 0 ? 'text-success' : 'text-danger'}`}>
                                                        {entry.unpaidAmount > 0 ? '+' : ''}{formatCurrency(entry.unpaidAmount)}
                                                    </span>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Payout Modal */}
            {showPayoutModal && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal-dialog">
                        <div className="custom-modal-content">
                            <div className="custom-modal-header bg-primary text-white">
                                <h5 className="custom-modal-title text-white">
                                    <i className="fas fa-university me-2"></i>
                                    {t('shopOwner.wallet.payoutModal.title', 'Yêu cầu rút tiền')}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPayoutModal(false)}></button>
                            </div>
                            <div className="custom-modal-body">
                                <form onSubmit={handlePayout}>
                                    {/* Balance Info */}
                                    <div className="bg-light rounded-3 p-3 mb-4 d-flex justify-content-between align-items-center border">
                                        <div>
                                            <small className="text-muted d-block">{t('shopOwner.wallet.payoutModal.balance', 'Số dư khả dụng')}</small>
                                            <span className="fw-bold text-success fs-5">{formatCurrency(walletData.balanceAvailable)}</span>
                                        </div>
                                        <i className="fas fa-wallet fa-2x text-muted opacity-25"></i>
                                    </div>

                                    {/* Amount Input */}
                                    <div className="mb-4">
                                        <label className="form-label fw-bold text-dark">{t('shopOwner.wallet.payoutModal.amount', 'Số tiền muốn rút')}</label>
                                        <div className="input-group input-group-lg">
                                            <span className="input-group-text bg-white text-success fw-bold">₫</span>
                                            <input
                                                type="text"
                                                className="form-control fw-bold"
                                                value={payoutAmount}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\./g, '').replace(/\D/g, '');
                                                    if (val === '') {
                                                        setPayoutAmount('');
                                                    } else {
                                                        setPayoutAmount(Number(val).toLocaleString('vi-VN'));
                                                    }
                                                }}
                                                placeholder="0"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Bank Details */}
                                    <h6 className="text-muted text-uppercase small fw-bold mb-3 border-bottom pb-2">
                                        {t('shopOwner.wallet.payoutModal.bank', 'Thông tin ngân hàng')}
                                    </h6>

                                    <div className="row g-3 mb-3">
                                        <div className="col-md-6">
                                            <label className="form-label small text-muted">{t('shopOwner.wallet.payoutModal.bank', 'Ngân hàng')}</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={bankInfo.bankName}
                                                onChange={e => setBankInfo({ ...bankInfo, bankName: e.target.value })}
                                                placeholder={t('shopOwner.wallet.payoutModal.bankPlaceholder', 'VD: Vietcombank')}
                                                required
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small text-muted">{t('shopOwner.wallet.payoutModal.accountNumber', 'Số tài khoản')}</label>
                                            <input
                                                type="text"
                                                className="form-control font-monospace"
                                                value={bankInfo.bankAccountNumber}
                                                onChange={e => setBankInfo({ ...bankInfo, bankAccountNumber: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label small text-muted">{t('shopOwner.wallet.payoutModal.accountHolder', 'Tên chủ tài khoản')}</label>
                                            <input
                                                type="text"
                                                className="form-control text-uppercase"
                                                value={bankInfo.accountHolderName}
                                                onChange={e => setBankInfo({ ...bankInfo, accountHolderName: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <div className="mb-4">
                                        <label className="form-label fw-bold small text-dark">
                                            {t('shopOwner.wallet.payoutModal.description', 'Nội dung')} <span className="text-muted fw-normal">(Tùy chọn)</span>
                                        </label>
                                        <textarea
                                            className="form-control"
                                            value={payoutDescription}
                                            onChange={e => setPayoutDescription(e.target.value)}
                                            placeholder={t('shopOwner.wallet.payoutModal.descriptionPlaceholder', 'Nhập nội dung...')}
                                            rows="2"
                                            style={{ resize: 'none' }}
                                        />
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="custom-modal-footer">
                                        <button
                                            type="button"
                                            className="btn btn-link text-decoration-none text-muted p-0 small me-auto"
                                            onClick={() => setBankInfo({
                                                bankAccountNumber: '999988887777',
                                                bankName: 'Ngan Hang Test (Demo)',
                                                accountHolderName: 'NGUYEN VAN TEST'
                                            })}
                                        >
                                            <i className="fas fa-magic me-1"></i> {t('shopOwner.wallet.payoutModal.fillTemplate', 'Điền mẫu')}
                                        </button>
                                        <div className="d-flex gap-2">
                                            <button type="button" className="btn btn-light px-4" onClick={() => setShowPayoutModal(false)}>
                                                {t('shopOwner.wallet.payoutModal.cancel', 'Hủy')}
                                            </button>
                                            <button type="submit" className="btn btn-primary px-4 shadow-sm">
                                                {t('shopOwner.wallet.payoutModal.confirm', 'Xác nhận')}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notification Modal */}
            {notification.show && (
                <div className="custom-modal-overlay" style={{ zIndex: 1060 }}>
                    <div className="custom-modal-dialog" style={{ maxWidth: '400px' }}>
                        <div className="custom-modal-content border-0">
                            <div className={`custom-modal-header text-white ${notification.type === 'success' ? 'bg-success' :
                                notification.type === 'error' ? 'bg-danger' :
                                    'bg-warning'
                                }`}>
                                <h5 className="custom-modal-title text-white">
                                    <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' :
                                        notification.type === 'error' ? 'fa-exclamation-circle' :
                                            'fa-exclamation-triangle'
                                        } me-2`}></i>
                                    {notification.title}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={closeNotification}></button>
                            </div>
                            <div className="custom-modal-body p-4 text-center">
                                <div className={`mb-3 ${notification.type === 'success' ? 'text-success' :
                                    notification.type === 'error' ? 'text-danger' :
                                        'text-warning'
                                    }`}>
                                    <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' :
                                        notification.type === 'error' ? 'fa-times-circle' :
                                            'fa-exclamation-triangle'
                                        } fa-4x`}></i>
                                </div>
                                <h5 className="mb-2 fw-bold">{notification.title}</h5>
                                <p className="text-muted mb-0">{notification.message}</p>
                            </div>
                            <div className="custom-modal-footer justify-content-center bg-light">
                                <button type="button" className={`btn ${notification.type === 'success' ? 'btn-success' :
                                    notification.type === 'error' ? 'btn-danger' :
                                        'btn-warning text-white'
                                    } px-4`} onClick={closeNotification}>
                                    {t('common.close', 'Đóng')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}