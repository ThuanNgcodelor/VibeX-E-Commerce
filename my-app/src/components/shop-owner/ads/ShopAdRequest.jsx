import React, { useEffect, useState } from 'react';
import adAPI from '../../../api/ads/adAPI';
import { getUser, getShopOwnerInfo } from '../../../api/user';
import { uploadImage } from '../../../api/image';
import { API_BASE_URL } from '../../../config/config';
import '../ShopOwnerLayout.css'; // Import shared styles

import { useTranslation } from 'react-i18next';

export default function ShopAdRequest() {
    const { t } = useTranslation();
    const [ads, setAds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('LIST'); // 'LIST' or 'ADD'
    const [shopId, setShopId] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        adType: 'BANNER',
        imageUrl: '',
        targetUrl: '',
        durationDays: 7
    });

    useEffect(() => {
        fetchUserInfo();
    }, []);

    const fetchUserInfo = async () => {
        try {
            let sId = null;
            try {
                const shopOwner = await getShopOwnerInfo();
                if (shopOwner && shopOwner.id) sId = shopOwner.id;
            } catch (e) {
                console.warn("Failed to get shop owner info directly", e);
            }

            if (!sId) {
                const user = await getUser();
                sId = user.id || user.userId;
            }

            if (!sId) {
                alert(t('shopOwner.ads.noShopId'));
                return;
            }

            setShopId(sId);
            fetchAds(sId);
        } catch (error) {
            console.error("Failed to get user info", error);
        }
    };

    const fetchAds = async (sId) => {
        setLoading(true);
        try {
            const data = await adAPI.getShopAds(sId);
            setAds(data);
        } catch (error) {
            console.error("Failed to fetch my ads", error);
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const imageId = await uploadImage(file);
            const fullUrl = `${API_BASE_URL}/v1/file-storage/get/${imageId}`;
            setFormData(prev => ({ ...prev, imageUrl: fullUrl }));
        } catch (error) {
            alert(t('shopOwner.ads.uploadFailed') + (error.message || "Error"));
        } finally {
            setUploading(false);
        }
    };

    const handleAutoFillShopLink = async () => {
        let currentShopId = shopId;
        if (!currentShopId) {
            try {
                const user = await getUser();
                currentShopId = user.id || user.userId;
                if (currentShopId) setShopId(currentShopId);
            } catch (e) { }
        }

        if (currentShopId) {
            const origin = window.location.origin;
            const link = `${origin}/shop/${currentShopId}`;
            setFormData(prev => ({ ...prev, targetUrl: link }));
        } else {
            alert(t('shopOwner.ads.noShopId'));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!shopId) {
            alert(t('shopOwner.ads.noShopId'));
            return;
        }

        try {
            if (!formData.imageUrl) {
                alert(t('shopOwner.ads.form.uploadImage')); // Should use a validation message key really
                return;
            }
            if (!formData.title) {
                alert(t('shopOwner.ads.form.campaignName') + " required");
                return;
            }

            await adAPI.createRequest({ ...formData, shopId });
            alert(t('shopOwner.ads.createSuccess'));
            setViewMode('LIST');
            fetchAds(shopId);
            // Reset form
            setFormData({
                title: '',
                description: '',
                adType: 'BANNER',
                imageUrl: '',
                targetUrl: '',
                durationDays: 7
            });
        } catch (error) {
            const msg = error.response?.data?.message || t('shopOwner.ads.createFailed');
            alert(`Error: ${msg}`);
        }
    };

    const handleDelete = async (ad) => {
        if (ad.status === 'APPROVED') {
            alert(t('shopOwner.ads.cannotDeleteApproved'));
            return;
        }
        if (window.confirm(t('shopOwner.ads.deleteConfirm'))) {
            try {
                await adAPI.deleteAd(ad.id);
                fetchAds(shopId);
            } catch (error) {
                alert(t('shopOwner.ads.deleteFailed'));
            }
        }
    };

    // --- RENDER HELPERS ---

    const renderListView = () => (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>{t('shopOwner.ads.title')}</h1>
            </div>

            <div className="orders-table">
                <div className="table-header">
                    <div className="table-title">{t('shopOwner.ads.tableTitle')}</div>
                    <div className="table-actions">
                        <button className="btn btn-primary-shop" onClick={() => setViewMode('ADD')}>
                            <i className="fas fa-plus"></i> {t('shopOwner.ads.createButton')}
                        </button>
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="table table-hover">
                        <thead>
                            <tr>
                                <th>{t('shopOwner.ads.table.campaign')}</th>
                                <th>{t('shopOwner.ads.table.image')}</th>
                                <th>{t('shopOwner.ads.table.type')}</th>
                                <th>{t('shopOwner.ads.table.duration')}</th>
                                <th>{t('shopOwner.ads.table.status')}</th>
                                <th>{t('shopOwner.ads.table.placement')}</th>
                                <th>{t('shopOwner.ads.table.action')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="text-center p-4">
                                        <i className="fas fa-spinner fa-spin me-2"></i> {t('shopOwner.header.loading')}
                                    </td>
                                </tr>
                            ) : ads.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center p-5">
                                        <i className="fas fa-ad fa-3x text-muted mb-3"></i>
                                        <p className="text-muted">{t('shopOwner.ads.noAds')}</p>
                                    </td>
                                </tr>
                            ) : (
                                ads.map(ad => (
                                    <tr key={ad.id}>
                                        <td>
                                            <div className="fw-bold">{ad.title}</div>
                                            <small className="text-muted">{ad.description}</small>
                                        </td>
                                        <td>
                                            {ad.imageUrl && (
                                                <img
                                                    src={ad.imageUrl}
                                                    alt="Ad"
                                                    style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                                                />
                                            )}
                                        </td>
                                        <td>{ad.adType}</td>
                                        <td>{ad.durationDays} ngày</td>
                                        <td>
                                            <span className={`badge ${ad.status === 'APPROVED' ? 'bg-success' :
                                                ad.status === 'REJECTED' ? 'bg-danger' : 'bg-warning'
                                                }`}>
                                                {ad.status === 'APPROVED' ? t('shopOwner.flashSale.approved') :
                                                    ad.status === 'REJECTED' ? t('shopOwner.flashSale.rejected') :
                                                        t('shopOwner.flashSale.pending')}
                                            </span>
                                            {ad.status === 'REJECTED' && <div className="text-danger small mt-1">{ad.rejectionReason}</div>}
                                        </td>
                                        <td>{ad.placement || '-'}</td>
                                        <td>
                                            <button
                                                className="btn btn-sm btn-outline-danger"
                                                disabled={ad.status === 'APPROVED'}
                                                onClick={() => handleDelete(ad)}
                                                title="Xóa yêu cầu"
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderAddView = () => (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>{t('shopOwner.ads.addTitle')}</h1>
                        <p className="text-muted">{t('shopOwner.ads.addSubtitle')}</p>
                    </div>
                    <button className="btn btn-secondary-shop" onClick={() => setViewMode('LIST')}>
                        <i className="fas fa-arrow-left"></i> {t('shopOwner.ads.back')}
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="row">
                    {/* Left Column: Main Info */}
                    <div className="col-md-8">
                        <div className="card mb-4">
                            <div className="card-header">
                                <h5><i className="fas fa-info-circle"></i> {t('shopOwner.ads.form.basicInfo')}</h5>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <label className="form-label">{t('shopOwner.ads.form.campaignName')} <span className="text-danger">*</span></label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        required
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder={t('shopOwner.ads.form.campaignName')}
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">{t('shopOwner.ads.form.description')}</label>
                                    <textarea
                                        className="form-control"
                                        rows="4"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder={t('shopOwner.ads.form.description')}
                                    ></textarea>
                                </div>
                            </div>
                        </div>

                        <div className="card mb-4">
                            <div className="card-header">
                                <h5><i className="fas fa-image"></i> {t('shopOwner.ads.form.imageInfo')}</h5>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <label className="form-label">{t('shopOwner.ads.form.uploadImage')} <span className="text-danger">*</span></label>
                                    <input
                                        type="file"
                                        className="form-control"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={uploading}
                                    />
                                    <small className="text-muted">{t('shopOwner.ads.form.imageNote')}</small>
                                </div>

                                {uploading && <div className="text-info"><i className="fas fa-spinner fa-spin"></i> {t('shopOwner.ads.form.submitting')}</div>}

                                {formData.imageUrl && (
                                    <div className="mt-3 p-2 border rounded bg-light text-center">
                                        <img
                                            src={formData.imageUrl}
                                            alt="Preview"
                                            style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '4px' }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Settings */}
                    <div className="col-md-4">
                        <div className="card mb-4" style={{ position: 'sticky', top: '20px' }}>
                            <div className="card-header">
                                <h5><i className="fas fa-cog"></i> {t('shopOwner.ads.form.settings')}</h5>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <label className="form-label">{t('shopOwner.ads.form.adType')}</label>
                                    <select
                                        className="form-select"
                                        value={formData.adType}
                                        onChange={e => setFormData({ ...formData, adType: e.target.value })}
                                    >
                                        <option value="BANNER">Banner Hình ảnh</option>
                                    </select>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">{t('shopOwner.ads.form.duration')}</label>
                                    <div className="input-group">
                                        <input
                                            type="number"
                                            className="form-control"
                                            required
                                            min="1"
                                            value={formData.durationDays}
                                            onChange={e => setFormData({ ...formData, durationDays: parseInt(e.target.value) || 0 })}
                                        />
                                        <span className="input-group-text">Ngày</span>
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">{t('shopOwner.ads.form.targetUrl')}</label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="https://..."
                                            value={formData.targetUrl}
                                            onChange={e => setFormData({ ...formData, targetUrl: e.target.value })}
                                        />
                                        <button
                                            className="btn btn-outline-secondary"
                                            type="button"
                                            onClick={handleAutoFillShopLink}
                                            title={t('shopOwner.ads.autoFill')}
                                        >
                                            <i className="fas fa-magic"></i>
                                        </button>
                                    </div>
                                    <small className="text-muted">{t('shopOwner.ads.form.targetUrlNote')}</small>
                                </div>

                                <hr />

                                <div className="d-grid gap-2">
                                    <button
                                        type="submit"
                                        className="btn btn-primary-shop"
                                        disabled={uploading}
                                    >
                                        {uploading ? t('shopOwner.ads.form.submitting') : (
                                            <>
                                                <i className="fas fa-paper-plane"></i> {t('shopOwner.ads.form.submit')}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );

    return (
        <>
            {viewMode === 'LIST' ? renderListView() : renderAddView()}
        </>
    );
}
