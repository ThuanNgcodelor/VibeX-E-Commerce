import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllShopVouchers, createShopVoucher, updateShopVoucher, deleteShopVoucher } from '../../api/voucher.js';
import { getShopOwnerInfo } from '../../api/user.js';
import { getMySubscription } from '../../api/subscription.js';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

export default function VoucherManagementPage() {
    const { t } = useTranslation();
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [shopId, setShopId] = useState(null);
    const [isSubscribed, setIsSubscribed] = useState(null); // Initialize as null to distinguish from false

    const [formData, setFormData] = useState({
        code: '',
        title: '',
        description: '',
        discountType: 'PERCENT',
        discountValue: 0,
        maxDiscountAmount: 0,
        minOrderValue: 0,
        startAt: '',
        endAt: '',
        quantityTotal: 100,
        applicableScope: 'ALL_PRODUCTS',
        shopOwnerId: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const shopInfo = await getShopOwnerInfo();
            if (shopInfo && (shopInfo.id || shopInfo.userId)) {
                const id = shopInfo.id || shopInfo.userId;
                setShopId(id);
                setFormData(prev => ({ ...prev, shopOwnerId: id }));
                const res = await getAllShopVouchers(id);
                setVouchers(res.data || []);

                try {
                    const sub = await getMySubscription(id);
                    setIsSubscribed(sub && sub.isActive);
                } catch (err) {
                    console.error("Failed to fetch subscription", err);
                    setIsSubscribed(false);
                }
            } else {
                toast.error(t('shopOwner.vouchers.shopNotFound'));
            }
        } catch (error) {
            console.error(error);
            // Don't toast generalized error if it's a redirect handled by Header
            if (!error.response || (error.response.status !== 401 && error.response.status !== 400)) {
                toast.error(t('shopOwner.vouchers.failedLoad'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Basic validation
        if (formData.discountValue <= 0) {
            toast.error(t('shopOwner.vouchers.invalidDiscount'));
            return;
        }

        // Format Payload
        const payload = {
            ...formData,
            shopOwnerId: shopId, // Ensure shopOwnerId is current
            startAt: formData.startAt.length === 16 ? formData.startAt + ':00' : formData.startAt,
            endAt: formData.endAt.length === 16 ? formData.endAt + ':00' : formData.endAt,
        };

        try {
            if (isEdit) {
                await updateShopVoucher(formData.id, payload);
                toast.success(t('shopOwner.vouchers.updated'));
            } else {
                await createShopVoucher(payload);
                toast.success(t('shopOwner.vouchers.created'));
            }
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error('Submit error:', error);
            // Show detailed error if available
            const msg = error.response?.data?.message || error.message || t('shopOwner.vouchers.operationFailed');
            toast.error(msg);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('shopOwner.vouchers.deleteConfirm'))) return;
        try {
            await deleteShopVoucher(id);
            toast.success(t('shopOwner.vouchers.deleted'));
            fetchData();
        } catch (error) {
            toast.error(t('shopOwner.vouchers.deleteFailed'));
        }
    };

    const openEdit = (voucher) => {
        setFormData({ ...voucher });
        setIsEdit(true);
        setShowModal(true);
    };

    const openCreate = () => {
        if (!isSubscribed) {
            toast.error(t('shopOwner.vouchers.subscriptionRequired') || "You must have an active subscription to create vouchers.");
            return;
        }
        setFormData({
            code: '',
            title: '',
            description: '',
            discountType: 'PERCENT',
            discountValue: 0,
            maxDiscountAmount: 0,
            minOrderValue: 0,
            startAt: '',
            endAt: '',
            quantityTotal: 100,
            applicableScope: 'ALL_PRODUCTS',
            shopOwnerId: shopId
        });
        setIsEdit(false);
        setShowModal(true);
    };

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between mb-4">
                <h2>{t('shopOwner.vouchers.title')}</h2>
                {/* Only show Create button if subscribed */}
                {isSubscribed && (
                    <button className="btn btn-primary" onClick={openCreate}>
                        <i className="fas fa-plus me-2"></i> {t('shopOwner.vouchers.create')}
                    </button>
                )}
            </div>

            {loading ? <div className="spinner-border" /> : (
                <>
                    {!isSubscribed ? (
                        <div className="alert alert-warning text-center p-5 shadow-sm" style={{ fontSize: '1.2rem' }}>
                            <i className="fas fa-lock fa-2x mb-3 text-warning"></i>
                            <p className="mb-3 fw-bold">{t('shopOwner.vouchers.subscriptionNeededMessage')}</p>
                            <a href="/shop-owner/subscription" className="btn btn-outline-warning">
                                {t('shopOwner.sidebar.subscription') || "View Subscriptions"}
                            </a>
                        </div>
                    ) : (
                        <div className="card shadow-sm">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th>{t('shopOwner.vouchers.table.code')}</th>
                                            <th>{t('shopOwner.vouchers.table.title')}</th>
                                            <th>{t('shopOwner.vouchers.table.discount')}</th>
                                            <th>{t('shopOwner.vouchers.table.usage')}</th>
                                            <th>{t('shopOwner.vouchers.table.duration')}</th>
                                            <th>{t('shopOwner.vouchers.table.status')}</th>
                                            <th>{t('shopOwner.vouchers.table.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {vouchers.map(v => (
                                            <tr key={v.id}>
                                                <td><strong>{v.code}</strong></td>
                                                <td>{v.title}</td>
                                                <td>
                                                    {v.discountType === 'PERCENT' ? `${v.discountValue}%` : `$${v.discountValue}`}
                                                </td>
                                                <td>{v.quantityUsed} / {v.quantityTotal}</td>
                                                <td>
                                                    <small>{format(new Date(v.startAt), 'dd/MM/yy')} - {format(new Date(v.endAt), 'dd/MM/yy')}</small>
                                                </td>
                                                <td>
                                                    <span className={`badge bg-${v.status === 'ACTIVE' ? 'success' : 'secondary'}`}>
                                                        {v.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button className="btn btn-sm btn-outline-primary me-2" onClick={() => openEdit(v)}>
                                                        <i className="fas fa-edit"></i>
                                                    </button>
                                                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(v.id)}>
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {vouchers.length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="text-center py-4 text-muted">
                                                    {t('shopOwner.vouchers.noVouchers', 'No vouchers found')}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Simple Modal Implementation */}
            {showModal && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">{isEdit ? t('shopOwner.vouchers.edit') : t('shopOwner.vouchers.create')}</h5>
                                <button className="btn-close" onClick={() => setShowModal(false)}></button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body">
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label">{t('shopOwner.vouchers.form.code')}</label>
                                            <input type="text" className="form-control" value={formData.code}
                                                onChange={e => setFormData({ ...formData, code: e.target.value })} required disabled={isEdit} />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">{t('shopOwner.vouchers.form.title')}</label>
                                            <input type="text" className="form-control" value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label">{t('shopOwner.vouchers.form.type')}</label>
                                            <select className="form-select" value={formData.discountType}
                                                onChange={e => setFormData({ ...formData, discountType: e.target.value })}>
                                                <option value="PERCENT">{t('shopOwner.vouchers.form.percentage')}</option>
                                                <option value="FIXED">{t('shopOwner.vouchers.form.fixedAmount')}</option>
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label">{t('shopOwner.vouchers.form.value')}</label>
                                            <input type="number" className="form-control" value={formData.discountValue}
                                                onChange={e => setFormData({ ...formData, discountValue: Number(e.target.value) })} required />
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label">{t('shopOwner.vouchers.form.maxDiscount')}</label>
                                            <input type="number" className="form-control" value={formData.maxDiscountAmount}
                                                onChange={e => setFormData({ ...formData, maxDiscountAmount: Number(e.target.value) })} />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">{t('shopOwner.vouchers.form.startDate')}</label>
                                            <input type="datetime-local" className="form-control" value={formData.startAt}
                                                onChange={e => setFormData({ ...formData, startAt: e.target.value })} required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">{t('shopOwner.vouchers.form.endDate')}</label>
                                            <input type="datetime-local" className="form-control" value={formData.endAt}
                                                onChange={e => setFormData({ ...formData, endAt: e.target.value })} required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">{t('shopOwner.vouchers.form.quantity')}</label>
                                            <input type="number" className="form-control" value={formData.quantityTotal}
                                                onChange={e => setFormData({ ...formData, quantityTotal: Number(e.target.value) })} required />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label">{t('shopOwner.vouchers.form.minOrder')}</label>
                                            <input type="number" className="form-control" value={formData.minOrderValue}
                                                onChange={e => setFormData({ ...formData, minOrderValue: Number(e.target.value) })} required />
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label">{t('shopOwner.vouchers.form.description')}</label>
                                            <textarea className="form-control" rows="2" value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}></textarea>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('shopOwner.vouchers.form.close')}</button>
                                    <button type="submit" className="btn btn-primary">{t('shopOwner.vouchers.form.save')}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
