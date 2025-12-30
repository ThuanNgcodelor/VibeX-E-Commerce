import React, { useState, useEffect } from 'react';
import flashSaleAPI from '../../../api/flashSale/flashSaleAPI';
import axios from 'axios';
import { API_BASE_URL } from '../../../config/config';
import '../ShopOwnerLayout.css'; // Import shared styles
import Cookies from 'js-cookie';
import { useTranslation } from 'react-i18next';

const ShopFlashSale = () => {
    const { t } = useTranslation();
    const [sessions, setSessions] = useState([]);
    const [myRegistrations, setMyRegistrations] = useState([]);
    const [products, setProducts] = useState([]);

    // UI State
    const [isRegistering, setIsRegistering] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [selectedSessionId, setSelectedSessionId] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [salePrice, setSalePrice] = useState('');
    const [stock, setStock] = useState('');
    const [selectedProductData, setSelectedProductData] = useState(null);

    useEffect(() => {
        const token = Cookies.get('accessToken');
        if (!token) {
            alert("Bạn chưa đăng nhập. Vui lòng đăng nhập lại!"); // Consider translating this too if generic
            return;
        }
        fetchSessions();
        fetchMyRegistrations();
        fetchMyProducts();
    }, []);

    // Update selected product data when ID changes
    useEffect(() => {
        if (selectedProductId) {
            const product = products.find(p => p.id === selectedProductId);
            setSelectedProductData(product || null);
        } else {
            setSelectedProductData(null);
        }
    }, [selectedProductId, products]);

    const fetchSessions = async () => {
        try {
            const data = await flashSaleAPI.getAllSessions();
            setSessions(data.filter(s => s.status === 'ACTIVE' || new Date(s.endTime) > new Date()));
        } catch (error) {
            console.error("Failed to fetch sessions");
        }
    };

    const fetchMyRegistrations = async () => {
        try {
            const data = await flashSaleAPI.getMyRegistrations();
            setMyRegistrations(data);
        } catch (error) {
            console.error("Failed to fetch registrations");
        }
    };

    const fetchMyProducts = async () => {
        try {
            const token = Cookies.get('accessToken');
            if (!token) return;

            const response = await axios.get(`${API_BASE_URL}/v1/stock/product/listPageShopOwner?pageSize=1000&pageNo=1`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProducts(response.data.content || []);
        } catch (error) {
            console.error("Failed to fetch products", error);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            await flashSaleAPI.registerProduct({
                sessionId: selectedSessionId,
                productId: selectedProductId,
                salePrice: parseFloat(salePrice),
                flashSaleStock: parseInt(stock)
            });
            alert(t('shopOwner.flashSale.successMessage'));
            fetchMyRegistrations();
            // Reset form and go back to list
            setSalePrice('');
            setStock('');
            setSelectedProductId('');
            setIsRegistering(false);
        } catch (error) {
            console.error(error);
            alert(t('shopOwner.flashSale.errorMessage', { message: error.response?.data?.message || 'Error' }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>{isRegistering ? t('shopOwner.flashSale.registerTitle') : t('shopOwner.flashSale.title')}</h1>
                        <p className="text-muted">
                            {isRegistering
                                ? t('shopOwner.flashSale.registerDescription')
                                : t('shopOwner.flashSale.description')}
                        </p>
                    </div>
                    {isRegistering ? (
                        <button
                            className="btn btn-secondary-shop"
                            onClick={() => setIsRegistering(false)}
                        >
                            <i className="fas fa-arrow-left"></i> {t('shopOwner.flashSale.backButton')}
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary-shop"
                            onClick={() => setIsRegistering(true)}
                        >
                            <i className="fas fa-plus"></i> {t('shopOwner.flashSale.registerButton')}
                        </button>
                    )}
                </div>
            </div>

            {isRegistering ? (
                /* Registration Form View */
                <form onSubmit={handleRegister}>
                    <div className="row">
                        <div className="col-md-8">
                            <div className="card" style={{ marginBottom: '20px' }}>
                                <div className="card-header">
                                    <h5><i className="fas fa-info-circle"></i> {t('shopOwner.flashSale.registrationInfo')}</h5>
                                </div>
                                <div className="card-body">
                                    {/* Session Selection */}
                                    <div className="mb-3">
                                        <label className="form-label">{t('shopOwner.flashSale.selectSessionRequired')} <span style={{ color: 'red' }}>*</span></label>
                                        <select
                                            className="form-select"
                                            value={selectedSessionId}
                                            onChange={e => setSelectedSessionId(e.target.value)}
                                            required
                                        >
                                            <option value="">{t('shopOwner.flashSale.selectSessionPlaceholder')}</option>
                                            {sessions.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({new Date(s.startTime).toLocaleString('vi-VN')} - {new Date(s.endTime).toLocaleString('vi-VN')})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Product Selection */}
                                    <div className="mb-3">
                                        <label className="form-label">{t('shopOwner.flashSale.selectProductRequired')} <span style={{ color: 'red' }}>*</span></label>
                                        <select
                                            className="form-select"
                                            value={selectedProductId}
                                            onChange={e => setSelectedProductId(e.target.value)}
                                            required
                                        >
                                            <option value="">{t('shopOwner.flashSale.selectProductPlaceholder')}</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} - {t('shopOwner.flashSale.originalPrice')}: {p.price?.toLocaleString()}đ ({t('shopOwner.flashSale.stockAvailable')}: {p.totalStock})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Product Details Display (Read-only) */}
                                    {selectedProductData && (
                                        <div className="alert alert-info border-0 bg-blue-50 text-blue-700">
                                            <div className="d-flex align-items-center gap-3">
                                                <div className="bg-white rounded d-flex align-items-center justify-content-center border"
                                                    style={{ width: '60px', height: '60px', overflow: 'hidden' }}>
                                                    {selectedProductData.imageId ? (
                                                        <img
                                                            src={`${API_BASE_URL}/v1/file-storage/get/${selectedProductData.imageId}`}
                                                            alt={selectedProductData.name}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <i className="fas fa-box text-2xl text-blue-300"></i>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="fw-bold fs-5">{selectedProductData.name}</div>
                                                    <div className="text-sm">Danh mục: {selectedProductData.categoryName}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="row">
                                        <div className="col-md-6">
                                            <div className="mb-3">
                                                <label className="form-label">{t('shopOwner.flashSale.salePrice')} <span style={{ color: 'red' }}>*</span></label>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    value={salePrice}
                                                    onChange={e => setSalePrice(e.target.value)}
                                                    required
                                                    min="1000"
                                                    placeholder="Nhập giá khuyến mãi"
                                                />
                                                {selectedProductData && salePrice && (
                                                    <small className={`d-block mt-1 ${parseFloat(salePrice) >= selectedProductData.price ? 'text-danger' : 'text-success'}`}>
                                                        {parseFloat(salePrice) >= selectedProductData.price
                                                            ? t('shopOwner.flashSale.priceWarning') // 'Lưu ý: Giá sale phải thấp hơn giá gốc!'
                                                            : `Giảm: ${Math.round((1 - parseFloat(salePrice) / selectedProductData.price) * 100)}%`}
                                                    </small>
                                                )}
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <div className="mb-3">
                                                <label className="form-label">{t('shopOwner.flashSale.stock')} <span style={{ color: 'red' }}>*</span></label>
                                                <input
                                                    type="number"
                                                    className={`form-control ${selectedProductData && parseInt(stock) > selectedProductData.totalStock ? 'is-invalid' : ''}`}
                                                    value={stock}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setStock(val);
                                                    }}
                                                    required
                                                    min="1"
                                                    max={selectedProductData?.totalStock}
                                                    placeholder="Số lượng bán trong khung giờ"
                                                />
                                                {selectedProductData && (
                                                    <>
                                                        <small className="text-muted d-block mt-1">
                                                            {t('shopOwner.flashSale.stockAvailable')}: {selectedProductData.totalStock}
                                                        </small>
                                                        {parseInt(stock) > selectedProductData.totalStock && (
                                                            <div className="invalid-feedback d-block">
                                                                {t('shopOwner.flashSale.invalidStock')}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar Info */}
                        <div className="col-md-4">
                            <div className="card" style={{ position: 'sticky', top: '20px' }}>
                                <div className="card-header">
                                    <h5><i className="fas fa-check-circle"></i> {t('shopOwner.flashSale.confirmHeader')}</h5>
                                </div>
                                <div className="card-body">
                                    <p className="text-muted small mb-3">
                                        {t('shopOwner.flashSale.confirmText')}
                                    </p>
                                    <div className="d-grid gap-2">
                                        <button
                                            type="submit"
                                            className="btn btn-primary-shop"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <><i className="fas fa-spinner fa-spin"></i> {t('shopOwner.flashSale.loading')}</>
                                            ) : (
                                                <><i className="fas fa-paper-plane"></i> {t('shopOwner.flashSale.submitRegister')}</>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary-shop"
                                            onClick={() => setIsRegistering(false)}
                                        >
                                            {t('shopOwner.flashSale.cancel')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            ) : (
                /* List View */
                <div className="card pb-5">
                    <div className="table-header">
                        <h5 className="table-title mb-0">{t('shopOwner.flashSale.historyTitle')}</h5>
                    </div>
                    <div className="card-body p-0">
                        {myRegistrations.length === 0 ? (
                            <div className="text-center py-5">
                                <div className="text-gray-300 text-5xl mb-3"><i className="fas fa-inbox"></i></div>
                                <p className="text-gray-500">{t('shopOwner.flashSale.noRegistrations')}</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover mb-0">
                                    <thead className="bg-light text-muted">
                                        <tr>
                                            <th className="ps-4 py-3">{t('shopOwner.flashSale.product')}</th>
                                            <th className="py-3">{t('shopOwner.flashSale.program')}</th>
                                            <th className="py-3">{t('shopOwner.flashSale.originalPrice')}</th>
                                            <th className="py-3">{t('shopOwner.flashSale.salePrice')}</th>
                                            <th className="py-3">{t('shopOwner.flashSale.stock')}</th>
                                            <th className="py-3 text-center">{t('shopOwner.flashSale.status')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {myRegistrations.map(reg => {
                                            const session = sessions.find(s => s.id === reg.sessionId);
                                            const product = products.find(p => p.id === reg.productId);
                                            return (
                                                <tr key={reg.id}>
                                                    <td className="ps-4 py-3">
                                                        <div className="d-flex align-items-center">
                                                            <div className="bg-light rounded d-flex align-items-center justify-content-center me-3" style={{ width: '40px', height: '40px' }}>
                                                                <i className="fas fa-box text-secondary"></i>
                                                            </div>
                                                            <div>
                                                                <div className="fw-bold text-dark">{product?.name || 'Sản phẩm ' + reg.productId}</div>
                                                                <small className="text-muted">Mã: {reg.productId.substring(0, 8)}</small>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 text-primary small">
                                                        {session ? session.name : reg.sessionId}
                                                    </td>
                                                    <td className="py-3">{product?.price?.toLocaleString()}đ</td>
                                                    <td className="py-3 fw-bold text-danger">{reg.salePrice?.toLocaleString()}đ</td>
                                                    <td className="py-3">{reg.flashSaleStock}</td>
                                                    <td className="py-3 text-center">
                                                        <span className={`badge rounded-pill ${reg.status === 'APPROVED' ? 'bg-success' :
                                                            reg.status === 'REJECTED' ? 'bg-danger' : 'bg-warning text-dark'
                                                            }`}>
                                                            {reg.status === 'APPROVED' ? t('shopOwner.flashSale.approved') :
                                                                reg.status === 'REJECTED' ? t('shopOwner.flashSale.rejected') :
                                                                    t('shopOwner.flashSale.pending')}
                                                        </span>
                                                        {reg.rejectionReason && (
                                                            <div className="text-danger small mt-1" style={{ fontSize: '11px', maxWidth: '150px', margin: '0 auto' }}>
                                                                {reg.rejectionReason}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShopFlashSale;
