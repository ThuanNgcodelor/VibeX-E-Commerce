import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUnlockRequest } from '../../api/role_request';
import { getUserRoleRequests } from '../../api/user';
import { format } from 'date-fns';

const SupportModal = ({
    show,
    onClose,
    onSubmit,
    reason,
    setReason,
    isSubmitting,
    submitSuccess,
    error
}) => {
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    React.useEffect(() => {
        if (show) {
            fetchHistory();
        }
    }, [show]);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const data = await getUserRoleRequests();
            // Filter only unlock requests if needed, assuming the API returns all types. 
            // For now, let's display all to be safe, or check status. 
            // Usually unlock requests might be specific, but let's just show what we get.
            setHistory(data);
        } catch (err) {
            console.error("Failed to fetch history", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    if (!show) return null;

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING': return <span className="badge bg-warning text-dark">Pending</span>;
            case 'APPROVED': return <span className="badge bg-success">Approved</span>;
            case 'REJECTED': return <span className="badge bg-danger">Rejected</span>;
            default: return <span className="badge bg-secondary">{status}</span>;
        }
    };

    const pendingRequest = history.find(req => req.status === 'PENDING');

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (pendingRequest) {
            // User shouldn't be able to submit due to disabled button, but as a safeguard:
            return;
        }
        onSubmit(e);
    };

    return (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10050 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-lg"> {/* Widened modal for history */}
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">Request to Unlock Shop</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body text-start" style={{ color: '#333' }}>
                        <div className="row">
                            <div className="col-md-6 border-end">
                                <h6 className="fw-bold mb-3">New Request</h6>
                                {submitSuccess ? (
                                    <div className="alert alert-success">
                                        <i className="fas fa-check-circle me-2"></i>
                                        Request sent successfully! Admin will review it shortly.
                                    </div>
                                ) : (
                                    <>
                                        {pendingRequest && (
                                            <div className="alert alert-warning mb-3">
                                                <i className="fas fa-exclamation-circle me-2"></i>
                                                You have a pending request sent on <strong>
                                                    {(() => {
                                                        try {
                                                            return pendingRequest.createdAt ? format(new Date(pendingRequest.createdAt), 'dd/MM/yyyy') : 'N/A';
                                                        } catch {
                                                            return 'N/A';
                                                        }
                                                    })()}
                                                </strong>. You cannot send a new request until it is processed.
                                            </div>
                                        )}
                                        <form onSubmit={handleFormSubmit}>
                                            <div className="mb-3">
                                                <label className="form-label fw-bold">Reason / Explanation</label>
                                                <textarea
                                                    className="form-control"
                                                    rows="5"
                                                    value={reason}
                                                    onChange={(e) => setReason(e.target.value)}
                                                    placeholder="Please explain why your shop should be unlocked..."
                                                    disabled={isSubmitting || !!pendingRequest}
                                                ></textarea>
                                            </div>
                                            {error && <div className="alert alert-danger py-2">{error}</div>}
                                            <div className="d-flex justify-content-end gap-2">
                                                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
                                                <button type="submit" className="btn btn-primary" disabled={isSubmitting || !!pendingRequest}>
                                                    {isSubmitting ? (
                                                        <>
                                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                            Sending...
                                                        </>
                                                    ) : 'Send Request'}
                                                </button>
                                            </div>
                                        </form>
                                    </>
                                )}
                            </div>
                            <div className="col-md-6">
                                <h6 className="fw-bold mb-3">Request History</h6>
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {loadingHistory ? (
                                        <div className="text-center py-4">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Loading...</span>
                                            </div>
                                        </div>
                                    ) : history.length > 0 ? (
                                        <div className="list-group">
                                            {history.map((req) => (
                                                <div key={req.id} className="list-group-item list-group-item-action">
                                                    <div className="d-flex w-100 justify-content-between mb-1">
                                                        <small className="text-muted">
                                                            {(() => {
                                                                try {
                                                                    return req.createdAt ? format(new Date(req.createdAt), 'dd/MM/yyyy HH:mm') : 'N/A';
                                                                } catch {
                                                                    return 'N/A';
                                                                }
                                                            })()}
                                                        </small>
                                                        {getStatusBadge(req.status)}
                                                    </div>
                                                    <p className="mb-1 text-truncate" title={req.reason || req.description}>{req.reason || req.description || "No reason provided"}</p>
                                                    {req.adminNote && (
                                                        <small className="text-danger d-block mt-1">
                                                            <strong>Admin Note:</strong> {req.adminNote}
                                                        </small>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-muted py-4">
                                            <i className="fas fa-history mb-2" style={{ fontSize: '24px' }}></i>
                                            <p>No request history found.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ShopLockedBlocker = ({ mode = 'banner' }) => {
    const navigate = useNavigate();
    const [showModal, setShowModal] = useState(false);
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleContactSupport = () => {
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setReason('');
        setError('');
        setSubmitSuccess(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason.trim()) {
            setError('Please enter a reason');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            await createUnlockRequest(reason);
            setSubmitSuccess(true);
            setTimeout(() => {
                handleCloseModal();
            }, 2000);
        } catch (err) {
            setError(err.message || 'Failed to submit request');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    if (mode === 'fullscreen') {
        return (
            <>
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    zIndex: 9999,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    color: 'white',
                    flexDirection: 'column'
                }}>
                    <div style={{
                        backgroundColor: '#fff',
                        color: '#333',
                        padding: '40px',
                        borderRadius: '8px',
                        textAlign: 'center',
                        maxWidth: '500px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        pointerEvents: 'auto'
                    }}>
                        <i className="fas fa-lock" style={{ fontSize: '48px', color: '#dc3545', marginBottom: '20px' }}></i>
                        <h2 style={{ marginBottom: '15px' }}>Shop Locked</h2>
                        <p style={{ marginBottom: '20px', color: '#666' }}>
                            Your shop has been temporarily locked by the administrator.
                            You cannot access this page.
                        </p>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                            <button
                                onClick={() => navigate('/shop-owner/orders')}
                                className="btn btn-outline-primary"
                            >
                                Go to Orders
                            </button>
                            <button
                                onClick={handleContactSupport}
                                className="btn btn-danger"
                            >
                                Contact Support
                            </button>
                        </div>
                    </div>
                </div>
                {showModal && (
                    <SupportModal
                        show={showModal}
                        onClose={handleCloseModal}
                        onSubmit={handleSubmit}
                        reason={reason}
                        setReason={setReason}
                        isSubmitting={isSubmitting}
                        submitSuccess={submitSuccess}
                        error={error}
                    />
                )}
            </>
        );
    }

    return (
        <>
            <div className="alert alert-danger d-flex align-items-center justify-content-between mb-0" role="alert" style={{ borderRadius: 0 }}>
                <div className="d-flex align-items-center">
                    <i className="fas fa-lock me-3" style={{ fontSize: '24px' }}></i>
                    <div>
                        <h5 className="alert-heading mb-1">Shop Locked</h5>
                        <p className="mb-0">
                            Your shop is currently locked. You cannot add new products or receive new orders.
                            However, you can still process existing orders.
                        </p>
                    </div>
                </div>
                <div className="d-flex gap-2">
                    <button
                        onClick={handleContactSupport}
                        className="btn btn-danger btn-sm"
                    >
                        Contact Support
                    </button>
                </div>
            </div>
            {showModal && (
                <SupportModal
                    show={showModal}
                    onClose={handleCloseModal}
                    onSubmit={handleSubmit}
                    reason={reason}
                    setReason={setReason}
                    isSubmitting={isSubmitting}
                    submitSuccess={submitSuccess}
                    error={error}
                />
            )}
        </>
    );
};

export default ShopLockedBlocker;
