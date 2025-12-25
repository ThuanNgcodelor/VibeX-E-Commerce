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
                names[id] = 'Hệ thống (Admin)';
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
                alert("Đã phê duyệt quảng cáo!");
            } else if (actionType === 'REJECT') {
                if (!rejectReason.trim()) {
                    alert("Vui lòng nhập lý do từ chối");
                    return;
                }
                await adAPI.rejectAd(selectedAd.id, rejectReason);
                alert("Đã từ chối quảng cáo!");
            }
            setSelectedAd(null);
            fetchAds();
        } catch (error) {
            console.error("Action failed", error);
            alert("Có lỗi xảy ra");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Bạn có chắc chắn muốn xóa quảng cáo này?")) {
            try {
                await adAPI.deleteAd(id);
                fetchAds();
            } catch (error) {
                alert("Xóa thất bại");
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
            alert('Upload ảnh thất bại: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleCreateSubmit = async () => {
        if (!newAd.title || !newAd.imageUrl) {
            alert("Vui lòng nhập tiêu đề và upload ảnh");
            return;
        }

        try {
            // Use raw targetUrl as requested (e.g. http://localhost:5173/shop)
            // No auto-formatting to Product ID anymore.

            // 1. Create Request
            const createdAd = await adAPI.createRequest(newAd);

            // 2. Auto Approve (Systems ads are auto-approved usually)
            if (createdAd && createdAd.id) {
                // For POPUP, we default to POPUP placement, otherwise HEADER
                const autoPlacement = newAd.adType === 'POPUP' ? 'POPUP' : 'HEADER';
                await adAPI.approveAd(createdAd.id, autoPlacement);
                alert("Đã tạo và kích hoạt quảng cáo hệ thống!");
            }

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
            alert("Tạo quảng cáo thất bại");
        }
    };

    return (
        <div className="container-fluid mt-4">
            <div className="d-flex justify-content-between align-items-center">
                <h3>Quản lý Quảng Cáo</h3>
                <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                    <i className="fas fa-plus"></i> Tạo Quảng Cáo Hệ Thống
                </button>
            </div>

            <div className="table-responsive">
                <table className="table table-bordered table-hover mt-3" style={{ background: 'white' }}>
                    <thead className="table-light">
                        <tr>
                            <th>Hình ảnh</th>
                            <th>Tiêu đề / Mô tả</th>
                            <th>Shop</th>
                            <th>Loại</th>
                            <th>Thời lượng</th>
                            <th>Trạng thái</th>
                            <th>Vị trí</th>
                            <th>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ads.length === 0 ? (
                            <tr><td colSpan="8" className="text-center text-muted p-4">Không có dữ liệu</td></tr>
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
                                            title="Click để xem ảnh lớn"
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
                                        <span className="badge bg-info">Hệ thống</span>
                                    ) : (
                                        <div style={{ fontWeight: 500 }}>
                                            {shopNames[ad.shopId] || <span className="text-secondary small">{ad.shopId}</span>}
                                        </div>
                                    )}
                                </td>
                                <td><span className="badge bg-secondary">{ad.adType}</span></td>
                                <td>{ad.durationDays} ngày</td>
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
                                                <button className="btn btn-sm btn-success" onClick={() => handleAction(ad, 'APPROVE')} title="Duyệt">
                                                    <i className="fas fa-check"></i>
                                                </button>
                                                <button className="btn btn-sm btn-warning" onClick={() => handleAction(ad, 'REJECT')} title="Từ chối">
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </>
                                        )}
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(ad.id)} title="Xóa">
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
                        <h5 className="mb-3">{actionType === 'APPROVE' ? 'Phê duyệt Quảng cáo' : 'Từ chối Quảng cáo'}</h5>
                        {/* ... Existing Approval Modal Content Can Stay or be Replaced, but let's keep it consistent within this tool call ... */}
                        <div className="mb-3 p-2 bg-light rounded text-center">
                            {selectedAd.imageUrl && (
                                <img src={selectedAd.imageUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'contain' }} />
                            )}
                            <div className="mt-2 fw-bold">{selectedAd.title}</div>
                        </div>

                        {actionType === 'APPROVE' ? (
                            <div className="mb-3">
                                <label className="form-label">Chọn vị trí hiển thị:</label>
                                <select className="form-select" value={placement} onChange={e => setPlacement(e.target.value)}>
                                    <option value="HEADER">Header (Banner chính)</option>
                                    <option value="SIDEBAR">Sidebar (Cột bên)</option>
                                    <option value="FOOTER">Footer (Chân trang)</option>
                                    <option value="POPUP">Popup (Hộp thoại)</option>
                                </select>
                            </div>
                        ) : (
                            <div className="mb-3">
                                <label className="form-label">Lý do từ chối:</label>
                                <textarea className="form-control" rows="3"
                                    value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                    placeholder="Nhập lý do..."
                                ></textarea>
                            </div>
                        )}

                        <div className="d-flex justify-content-end gap-2 mt-4">
                            <button className="btn btn-secondary" onClick={() => setSelectedAd(null)}>Hủy</button>
                            <button className={`btn ${actionType === 'APPROVE' ? 'btn-success' : 'btn-danger'}`} onClick={submitAction}>
                                {actionType === 'APPROVE' ? 'Xác nhận Duyệt' : 'Xác nhận Từ chối'}
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
                        <h5 className="mb-4">Tạo Quảng Cáo Hệ Thống (Admin)</h5>

                        <div className="mb-3">
                            <label className="form-label">Tiêu đề</label>
                            <input className="form-control" value={newAd.title} onChange={e => setNewAd({ ...newAd, title: e.target.value })} placeholder="Nhập tiêu đề..." />
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Loại quảng cáo</label>
                                <select className="form-select" value={newAd.adType} onChange={e => setNewAd({ ...newAd, adType: e.target.value })}>
                                    <option value="POPUP">Popup (Hộp thoại)</option> {/* Prioritized */}
                                    <option value="BANNER">Banner</option>
                                    <option value="VIDEO">Video</option>
                                </select>
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Thời gian (Ngày)</label>
                                <input type="number" className="form-control" value={newAd.durationDays} onChange={e => setNewAd({ ...newAd, durationDays: e.target.value })} />
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Hình ảnh</label>
                            <input type="file" className="form-control" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                            {uploading && <small className="text-info">Đang tải lên...</small>}
                            {newAd.imageUrl && (
                                <div className="mt-2 text-center border p-2">
                                    <img src={newAd.imageUrl} alt="New Ad" style={{ maxHeight: '150px', maxWidth: '100%' }} />
                                </div>
                            )}
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Link đích (URL)</label>
                            <input className="form-control" value={newAd.targetUrl} onChange={e => setNewAd({ ...newAd, targetUrl: e.target.value })} placeholder="VD: http://localhost:5173/shop" />
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Mô tả</label>
                            <textarea className="form-control" rows="2" value={newAd.description} onChange={e => setNewAd({ ...newAd, description: e.target.value })}></textarea>
                        </div>

                        <div className="alert alert-info small">
                            <i className="fas fa-info-circle"></i> Quảng cáo này sẽ được tự động duyệt và hiển thị ngay sau khi tạo.
                        </div>

                        <div className="d-flex justify-content-end gap-2 mt-4">
                            <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>Hủy</button>
                            <button className="btn btn-primary" onClick={handleCreateSubmit} disabled={uploading}>
                                {uploading ? 'Đang xử lý...' : 'Tạo & Duyệt Ngay'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
