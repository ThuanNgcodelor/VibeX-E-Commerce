import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUnlockRequest } from '../../api/role_request';

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

    const SupportModal = () => (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10050 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">Request to Unlock Shop</h5>
                        <button type="button" className="btn-close" onClick={handleCloseModal}></button>
                    </div>
                    <div className="modal-body text-start" style={{ color: '#333' }}>
                        {submitSuccess ? (
                            <div className="alert alert-success">
                                <i className="fas fa-check-circle me-2"></i>
                                Request sent successfully! Admin will review it shortly.
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label fw-bold">Reason / Explanation</label>
                                    <textarea
                                        className="form-control"
                                        rows="4"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="Please explain why your shop should be unlocked or provide necessary documentation..."
                                        disabled={isSubmitting}
                                    ></textarea>
                                </div>
                                {error && <div className="alert alert-danger py-2">{error}</div>}
                                <div className="d-flex justify-content-end gap-2">
                                    <button type="button" className="btn btn-secondary" onClick={handleCloseModal} disabled={isSubmitting}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Sending...
                                            </>
                                        ) : 'Send Request'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

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
                {showModal && <SupportModal />}
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
            {showModal && <SupportModal />}
        </>
    );
};

export default ShopLockedBlocker;
