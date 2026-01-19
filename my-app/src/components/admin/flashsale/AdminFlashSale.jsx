import React, { useState, useEffect } from 'react';
import flashSaleAPI from '../../../api/flashSale/flashSaleAPI';
import { API_BASE_URL } from '../../../config/config';
import './AdminFlashSale.css';

const AdminFlashSale = () => {
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [products, setProducts] = useState([]);
    const [showModal, setShowModal] = useState(false);

    // Default start time: 9am tomorrow
    // Default end time: 11am tomorrow
    const [newSession, setNewSession] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        const end = new Date(tomorrow);
        end.setHours(11, 0, 0, 0);

        const format = (date) => date.toISOString().slice(0, 16);
        return {
            name: '',
            startTime: format(tomorrow),
            endTime: format(end),
            description: ''
        };
    });

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        if (selectedSession) {
            fetchProducts(selectedSession.id);
        } else if (sessions.length > 0) {
            // Auto select first session? Or leave null
        }
    }, [selectedSession, sessions]);

    const fetchSessions = async () => {
        try {
            const data = await flashSaleAPI.getAllSessions();
            setSessions(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to load sessions", error);
        }
    };

    const fetchProducts = async (sessionId) => {
        try {
            const data = await flashSaleAPI.getSessionProducts(sessionId);
            setProducts(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to load products", error);
        }
    };

    const handleCreateSession = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...newSession,
                startTime: newSession.startTime.length === 16 ? newSession.startTime + ':00' : newSession.startTime,
                endTime: newSession.endTime.length === 16 ? newSession.endTime + ':00' : newSession.endTime,
            };

            await flashSaleAPI.createSession(payload);
            setShowModal(false);
            // Reset logic
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            const end = new Date(tomorrow);
            end.setHours(11, 0, 0, 0);
            const format = (date) => date.toISOString().slice(0, 16);

            setNewSession({ name: '', startTime: format(tomorrow), endTime: format(end), description: '' });
            fetchSessions();
            alert('Session created successfully!');
        } catch (error) {
            alert('Error creating session: ' + (error.response?.data?.message || 'Unknown'));
        }
    };

    const handleOpenSession = async (sessionId, e) => {
        e.stopPropagation();
        if (!window.confirm("Do you want to open registration and notify shops?")) return;
        try {
            await flashSaleAPI.openSession(sessionId);
            alert('Registration opened!');
            fetchSessions();
        } catch (error) {
            alert('Error opening session');
        }
    };

    const handleApprove = async (regId) => {
        try {
            await flashSaleAPI.approveProduct(regId);
            fetchProducts(selectedSession.id);
        } catch (error) {
            alert('Error approving product');
        }
    };

    const handleReject = async (regId) => {
        const reason = prompt("Rejection reason:");
        if (reason) {
            try {
                await flashSaleAPI.rejectProduct(regId, reason);
                fetchProducts(selectedSession.id);
            } catch (error) {
                alert('Error rejecting');
            }
        }
    };

    const handleDeleteSession = async (sessionId, e) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure you want to delete this session?")) return;
        try {
            await flashSaleAPI.deleteSession(sessionId);
            alert("Session deleted successfully!");
            fetchSessions();
            if (selectedSession && selectedSession.id === sessionId) setSelectedSession(null);
        } catch (error) {
            alert("Cannot delete: " + (error.response?.data?.message || "Unknown error"));
        }
    };

    const handleToggleStatus = async (sessionId, currentStatus, e) => {
        e.stopPropagation();
        const action = currentStatus === 'ACTIVE' ? 'Deactivate' : 'Activate';
        if (!window.confirm(`Do you want to ${action.toLowerCase()} this session?`)) return;

        try {
            await flashSaleAPI.toggleSessionStatus(sessionId);
            fetchSessions();
        } catch (error) {
            alert("Error changing status");
        }
    };

    // Calculate stats
    const stats = {
        total: sessions.length,
        active: sessions.filter(s => s.status === 'ACTIVE').length,
        upcoming: sessions.filter(s => new Date(s.startTime) > new Date()).length,
        products: products.length
    };

    return (
        <div className="admin-flash-sale-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Flash Sale Management</h1>
                    <p className="page-subtitle">Manage flash sale sessions and product approvals</p>
                </div>
                <button className="btn-create" onClick={() => setShowModal(true)}>
                    <i className="fas fa-plus"></i> Create Session
                </button>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon stat-icon-total"><i className="fas fa-layer-group"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Total Sessions</span>
                        <h2 className="stat-value">{stats.total}</h2>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon stat-icon-active"><i className="fas fa-bolt"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Active Sessions</span>
                        <h2 className="stat-value">{stats.active}</h2>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon stat-icon-upcoming"><i className="fas fa-clock"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Upcoming</span>
                        <h2 className="stat-value">{stats.upcoming}</h2>
                    </div>
                </div>
                {selectedSession && (
                    <div className="stat-card">
                        <div className="stat-icon stat-icon-pending"><i className="fas fa-box"></i></div>
                        <div className="stat-info">
                            <span className="stat-label">Products (Current)</span>
                            <h2 className="stat-value">{stats.products}</h2>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Grid: Sessions List (Left equivalent) & Products (Right equivalent) could be good, 
                but to match reference let's do Tabs or a Master-Detail view. 
                Reference image is single table. I'll make a Sessions Table first. 
            */}

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Flash Sale Sessions</h3>
                </div>
                <table className="banners-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Time Slot</th>
                            <th>Products</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map(session => (
                            <tr key={session.id} className={selectedSession?.id === session.id ? 'bg-orange-50' : ''} onClick={() => setSelectedSession(session)} style={{ cursor: 'pointer' }}>
                                <td>
                                    <strong>{session.name}</strong><br />
                                    <span className="text-gray-500 text-xs">{session.description}</span>
                                </td>
                                <td>
                                    <div className="text-sm">
                                        <i className="fas fa-calendar-alt mr-1"></i> {new Date(session.startTime).toLocaleString()} <br />
                                        <i className="fas fa-arrow-right mr-1"></i> {new Date(session.endTime).toLocaleString()}
                                    </div>
                                </td>
                                <td>-</td>
                                <td>
                                    <span className={`status-badge ${session.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                                        {session.status}
                                    </span>
                                </td>
                                <td>
                                    <div className="flex gap-2">
                                        <button className="btn-icon btn-view" title="View Details" onClick={() => setSelectedSession(session)}>
                                            <i className="fas fa-eye text-blue-500"></i>
                                        </button>

                                        {/* Status Toggle */}
                                        <button
                                            className="btn-icon"
                                            title={session.status === 'ACTIVE' ? "Stop Session" : "Start Session"}
                                            onClick={(e) => handleToggleStatus(session.id, session.status, e)}
                                        >
                                            <i className={`fas ${session.status === 'ACTIVE' ? 'fa-toggle-on text-green-500' : 'fa-toggle-off text-gray-400'} fa-lg`}></i>
                                        </button>

                                        {/* Notify Button (only if not active/started?) - Keeping original logic or merging? 
                                            Original was Open & Notify. Now Toggle handles status. 
                                            Maybe keep a separate Notify button? 
                                            Let's keep Notify button separate if needed, but "Open Session" basically did setStatus(ACTIVE) + Notify.
                                            Now Toggle sets status.
                                            Let's re-add Notify explicitly if needed, but user just asked for "Change Status".
                                            I'll stick to Toggle + Delete for now.
                                        */}

                                        {session.status !== 'ACTIVE' && (
                                            <button className="btn-icon btn-delete" title="Delete Session" onClick={(e) => handleDeleteSession(session.id, e)}>
                                                <i className="fas fa-trash text-red-500"></i>
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Selected Session Details (Product List) */}
            {selectedSession && (
                <div className="card mt-6">
                    <div className="card-header">
                        <h3 className="card-title">Participating Products: {selectedSession.name}</h3>
                    </div>
                    {products.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <i className="fas fa-box-open text-4xl mb-3"></i>
                            <p>No products registered for this session yet.</p>
                        </div>
                    ) : (
                        <table className="banners-table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Pricing</th>
                                    <th>Stock</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #eee' }}>
                                                    {p.productImageId ? (
                                                        <img
                                                            src={`${API_BASE_URL}/v1/file-storage/get/${p.productImageId}`}
                                                            alt={p.productName}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            onError={(e) => e.target.src = 'https://via.placeholder.com/64?text=No+Img'}
                                                        />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', color: '#adb5bd' }}>
                                                            <i className="fas fa-box"></i>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', color: '#333' }}>{p.productName || 'Unknown Product'}</div>
                                                    <div className="text-muted text-xs">Shop: {p.shopName || p.shopId}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex flex-col">
                                                <span className="line-through text-gray-400 text-xs">{p.originalPrice?.toLocaleString()}</span>
                                                <span className="font-bold text-red-600">{p.salePrice?.toLocaleString()}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="text-center">
                                                <span className="font-medium">{p.flashSaleStock}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${p.status === 'APPROVED' ? 'active' : p.status === 'REJECTED' ? 'inactive' : 'pending'}`}>
                                                {p.status}
                                            </span>
                                            {p.rejectionReason && (
                                                <div className="text-xs text-red-500 mt-1" style={{ maxWidth: '150px' }} title={p.rejectionReason}>
                                                    {p.rejectionReason}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {p.status === 'PENDING' && (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleApprove(p.id)}
                                                        className="btn-icon btn-approve"
                                                        title="Approve"
                                                    >
                                                        <i className="fas fa-check"></i>
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(p.id)}
                                                        className="btn-icon btn-reject"
                                                        title="Reject"
                                                    >
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                </div>
                                            )}
                                            {p.status === 'APPROVED' && (
                                                <button
                                                    onClick={() => handleReject(p.id)}
                                                    className="btn-icon btn-delete"
                                                    title="Remove from Flash Sale"
                                                >
                                                    <i className="fas fa-trash text-red-500"></i>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-container" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Create New Flash Sale Session</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><i className="fas fa-times"></i></button>
                        </div>
                        <form onSubmit={handleCreateSession}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Session Name</label>
                                    <input type="text" className="form-input" placeholder="e.g. 9.9 Super Sale" value={newSession.name} onChange={e => setNewSession({ ...newSession, name: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label>Description (Optional)</label>
                                    <input type="text" className="form-input" value={newSession.description} onChange={e => setNewSession({ ...newSession, description: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="form-group">
                                        <label>Start Time</label>
                                        <input type="datetime-local" className="form-input" value={newSession.startTime} onChange={e => setNewSession({ ...newSession, startTime: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label>End Time</label>
                                        <input type="datetime-local" className="form-input" value={newSession.endTime} onChange={e => setNewSession({ ...newSession, endTime: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-700 mb-4">
                                    <i className="fas fa-info-circle mr-2"></i>
                                    Recommendation: Create sessions at least 24h in advance to allow enough time for shop registration.
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-save">Create Session</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminFlashSale;
