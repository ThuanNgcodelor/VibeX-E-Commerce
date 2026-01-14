import React, { useEffect, useState } from 'react';
import adAPI from '../../../api/ads/adAPI';
import { uploadImage } from '../../../api/image'; // Import uploadImage
import { API_BASE_URL } from '../../../config/config'; // Import API_BASE_URL
import { getShopOwnerByUserId } from '../../../api/user'; // Import User API

export default function AdManagement() {
    const [ads, setAds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [shopNames, setShopNames] = useState({}); // Map shopId -> shopName

    // Approval Modal State
    const [selectedAd, setSelectedAd] = useState(null);
    const [actionType, setActionType] = useState(null); // 'APPROVE' or 'REJECT'
    const [placement, setPlacement] = useState('HEADER');
    const [rejectReason, setRejectReason] = useState('');

    // Create Ad State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newAd, setNewAd] = useState({
        title: '',
        description: '',
        adType: 'POPUP', // Default to POPUP as requested explanation implies this is key
        imageUrl: '',
        targetUrl: '',
        durationDays: 7,
        shopId: 'ADMIN', // specific ID for system ads
    });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchAds();
    }, []);

    const fetchAds = async () => {
        setLoading(true);
        try {
            const data = await adAPI.getAllAds();
            setAds(data);
            fetchShopNames(data);
        } catch (error) {
            console.error("Failed to fetch ads", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchShopNames = async (adsData) => {
        const uniqueShopIds = [...new Set(adsData.map(ad => ad.shopId))];
        const names = {};

        // Parallel fetch for simplified logic (optimize to bulk if API exists)
        await Promise.all(uniqueShopIds.map(async (id) => {
            if (id === 'ADMIN' || id === 'SYSTEM') {
                names[id] = 'System (Admin)';
                return;
            }
            try {
                // Try fetching shop info
                const shopInfo = await getShopOwnerByUserId(id);
                if (shopInfo && shopInfo.shopName) {
                    names[id] = shopInfo.shopName;
                } else {
                    names[id] = id; // Fallback
                }
            } catch (err) {
                // If 404 or error, keep ID
                names[id] = id;
            }
        }));

        setShopNames(prev => ({ ...prev, ...names }));
    };

    const handleAction = (ad, type) => {
        setSelectedAd(ad);
        setActionType(type);
        setPlacement('HEADER');
        setRejectReason('');
    };

    const submitAction = async () => {
        if (!selectedAd) return;
        try {
            if (actionType === 'APPROVE') {
                await adAPI.approveAd(selectedAd.id, placement);
                alert("Ad approved!");
            } else if (actionType === 'REJECT') {
                if (!rejectReason.trim()) {
                    alert("Please enter rejection reason");
                    return;
                }
                await adAPI.rejectAd(selectedAd.id, rejectReason);
                alert("Ad rejected!");
            }
            setSelectedAd(null);
            fetchAds();
        } catch (error) {
            console.error("Action failed", error);
            alert("An error occurred");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this ad?")) {
            try {
                await adAPI.deleteAd(id);
                fetchAds();
            } catch (error) {
                alert("Delete failed");
            }
        }
    };

    // Create Ad Handlers
    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            // Fix: Pass file directly, api/image.js handles FormData
            // And construct full URL from returned ID
            const imageId = await uploadImage(file);
            const fullUrl = `${API_BASE_URL}/v1/file-storage/get/${imageId}`;
            setNewAd({ ...newAd, imageUrl: fullUrl });
        } catch (error) {
            console.error('Upload failed', error);
            alert('Image upload failed: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleCreateSubmit = async () => {
        if (!newAd.title || !newAd.imageUrl) {
            alert("Please enter title and upload image");
            return;
        }

        try {
            // Use raw targetUrl as requested (e.g. http://localhost:5173/shop)
            // No auto-formatting to Product ID anymore.

            // 1. Create & Auto Approve
            await adAPI.createSystemAd(newAd);
            alert("System ad created and activated!");

            setIsCreateModalOpen(false);
            setNewAd({
                title: '',
                description: '',
                adType: 'POPUP',
                imageUrl: '',
                targetUrl: '',
                durationDays: 7,
                shopId: 'ADMIN'
            });
            fetchAds();
        } catch (error) {
            console.error("Create failed", error);
            alert("Failed to create ad");
        }
    };

    return (
        <div className="container-fluid mt-4">
            <div className="d-flex justify-content-between align-items-center">
                <h3>Advertisement Management</h3>
                <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                    <i className="fas fa-plus"></i> Create System Ad
                </button>
            </div>

            <div className="table-responsive">
                <table className="table table-bordered table-hover mt-3" style={{ background: 'white' }}>
                    <thead className="table-light">
                        <tr>
                            <th>Image</th>
                            <th>Title / Description</th>
                            <th>Shop</th>
                            <th>Type</th>
                            <th>Duration</th>
                            <th>Status</th>
                            <th>Position</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ads.length === 0 ? (
                            <tr><td colSpan="8" className="text-center text-muted p-4">No data</td></tr>
                        ) : ads.map(ad => (
                            <tr key={ad.id} style={{ verticalAlign: 'middle' }}>
                                <td style={{ width: '120px', textAlign: 'center' }}>
                                    {ad.imageUrl ? (
                                        <img
                                            src={ad.imageUrl}
                                            alt="Ad"
                                            style={{
                                                width: '100px',
                                                height: '60px',
                                                objectFit: 'cover',
                                                borderRadius: '4px',
                                                border: '1px solid #dee2e6',
                                                cursor: 'pointer'
                                            }}
                                            onClick={() => window.open(ad.imageUrl, '_blank')}
                                            title="Click to view full image"
                                        />
                                    ) : <span className="text-muted small">No Image</span>}
                                </td>
                                <td>
                                    <div className="fw-bold">{ad.title}</div>
                                    <small className="text-muted" style={{ display: 'block', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {ad.description}
                                    </small>
                                </td>
                                <td>
                                    {ad.shopId === 'ADMIN' ? (
                                        <span className="badge bg-info">System</span>
                                    ) : (
                                        <div style={{ fontWeight: 500 }}>
                                            {shopNames[ad.shopId] || <span className="text-secondary small">{ad.shopId}</span>}
                                        </div>
                                    )}
                                </td>
                                <td><span className="badge bg-secondary">{ad.adType}</span></td>
                                <td>{ad.durationDays} days</td>
                                <td>
                                    <span className={`badge ${ad.status === 'APPROVED' ? 'bg-success' :
                                        ad.status === 'REJECTED' ? 'bg-danger' : 'bg-warning'
                                        }`}>
                                        {ad.status}
                                    </span>
                                </td>
                                <td>{ad.placement || '-'}</td>
                                <td>
                                    <div className="d-flex gap-2">
                                        {ad.status === 'PENDING' && (
                                            <>
                                                <button className="btn btn-sm btn-success" onClick={() => handleAction(ad, 'APPROVE')} title="Approve">
                                                    <i className="fas fa-check"></i>
                                                </button>
                                                <button className="btn btn-sm btn-warning" onClick={() => handleAction(ad, 'REJECT')} title="Reject">
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </>
                                        )}
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(ad.id)} title="Delete">
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Approval Modal */}
            {selectedAd && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '500px', maxWidth: '90%' }}>
                        <h5 className="mb-3">{actionType === 'APPROVE' ? 'Approve Advertisement' : 'Reject Advertisement'}</h5>
                        <div className="mb-3 p-2 bg-light rounded text-center">
                            {selectedAd.imageUrl && (
                                <img src={selectedAd.imageUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'contain' }} />
                            )}
                            <div className="mt-2 fw-bold">{selectedAd.title}</div>
                        </div>

                        {actionType === 'APPROVE' ? (
                            <div className="mb-3">
                                <label className="form-label">Select display position:</label>
                                <select className="form-select" value={placement} onChange={e => setPlacement(e.target.value)}>
                                    <option value="HEADER">Header (Main Banner)</option>
                                    <option value="SIDEBAR">Sidebar</option>
                                    <option value="FOOTER">Footer</option>
                                    <option value="POPUP">Popup</option>
                                </select>
                            </div>
                        ) : (
                            <div className="mb-3">
                                <label className="form-label">Rejection reason:</label>
                                <textarea className="form-control" rows="3"
                                    value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                    placeholder="Enter reason..."
                                ></textarea>
                            </div>
                        )}

                        <div className="d-flex justify-content-end gap-2 mt-4">
                            <button className="btn btn-secondary" onClick={() => setSelectedAd(null)}>Cancel</button>
                            <button className={`btn ${actionType === 'APPROVE' ? 'btn-success' : 'btn-danger'}`} onClick={submitAction}>
                                {actionType === 'APPROVE' ? 'Confirm Approve' : 'Confirm Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Ad Modal */}
            {isCreateModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '600px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h5 className="mb-4">Create System Ad (Admin)</h5>

                        <div className="mb-3">
                            <label className="form-label">Title</label>
                            <input className="form-control" value={newAd.title} onChange={e => setNewAd({ ...newAd, title: e.target.value })} placeholder="Enter title..." />
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Ad Type</label>
                                <select className="form-select" value={newAd.adType} onChange={e => setNewAd({ ...newAd, adType: e.target.value })}>
                                    <option value="POPUP">Popup</option> {/* Prioritized */}
                                    <option value="BANNER">Banner</option>
                                </select>
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Duration (Days)</label>
                                <input type="number" className="form-control" value={newAd.durationDays} onChange={e => setNewAd({ ...newAd, durationDays: e.target.value })} />
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Image</label>
                            <input type="file" className="form-control" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                            {uploading && <small className="text-info">Uploading...</small>}
                            {newAd.imageUrl && (
                                <div className="mt-2 text-center border p-2">
                                    <img src={newAd.imageUrl} alt="New Ad" style={{ maxHeight: '150px', maxWidth: '100%' }} />
                                </div>
                            )}
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Target Link (URL)</label>
                            <input className="form-control" value={newAd.targetUrl} onChange={e => setNewAd({ ...newAd, targetUrl: e.target.value })} placeholder="e.g. http://localhost:5173/shop" />
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Description</label>
                            <textarea className="form-control" rows="2" value={newAd.description} onChange={e => setNewAd({ ...newAd, description: e.target.value })}></textarea>
                        </div>

                        <div className="alert alert-info small">
                            <i className="fas fa-info-circle"></i> This ad will be automatically approved and displayed immediately after creation.
                        </div>

                        <div className="d-flex justify-content-end gap-2 mt-4">
                            <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreateSubmit} disabled={uploading}>
                                {uploading ? 'Processing...' : 'Create & Approve'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
