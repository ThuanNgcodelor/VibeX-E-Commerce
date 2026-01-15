import React from 'react';
import { useNavigate } from 'react-router-dom';

const ShopLockedBlocker = ({ mode = 'banner' }) => {
    const navigate = useNavigate();

    const handleContactSupport = () => {
        window.location.href = 'mailto:support@example.com';
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    if (mode === 'fullscreen') {
        return (
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
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
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
        );
    }

    return (
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
    );
};

export default ShopLockedBlocker;
