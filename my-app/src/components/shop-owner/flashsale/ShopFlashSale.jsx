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
    const [quantityLimit, setQuantityLimit] = useState(''); // State for limit

    const [selectedProductData, setSelectedProductData] = useState(null);
    const [sizeConfig, setSizeConfig] = useState({}); // { [sizeId]: { quantity: 0, salePrice: 0 } }

    useEffect(() => {
        const token = Cookies.get('accessToken');
        if (!token) {
            alert("Bạn chưa đăng nhập. Vui lòng đăng nhập lại!");
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
            setSizeConfig({}); // Reset
        } else {
            setSelectedProductData(null);
            setSizeConfig({});
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

        // Prepare sizes payload
        // Filter sizes where quantity > 0 OR price is set (validation below will handle incomplete data)
        const sizesPayload = Object.entries(sizeConfig)
            .filter(([_, config]) => config.quantity > 0)
            .map(([sizeId, config]) => ({
                sizeId,
                quantity: config.quantity,
                salePrice: config.salePrice
            }));

        if (sizesPayload.length === 0) {
            alert(t('shopOwner.flashSale.errorSizeRequired'));
            return;
        }

        // Validate prices
        for (const item of sizesPayload) {
            if (!item.salePrice || item.salePrice <= 0) {
                alert("Vui lòng nhập giá Flash Sale hợp lệ cho tất cả các size đã chọn số lượng.");
                return;
            }
        }

        // Calculate min price for root salePrice (display purpose)
        const minPrice = Math.min(...sizesPayload.map(s => s.salePrice));

        try {
            setLoading(true);
            await flashSaleAPI.registerProduct({
                sessionId: selectedSessionId,
                productId: selectedProductId,
                salePrice: minPrice,
                sizes: sizesPayload,
                quantityLimit: quantityLimit ? parseInt(quantityLimit) : null
            });
            alert(t('shopOwner.flashSale.successMessage'));
            fetchMyRegistrations();
            // Reset form
            setSalePrice('');
            setQuantityLimit('');
            setSizeConfig({});
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

                                    {/* Size Quantities Input */}
                                    {selectedProductData && selectedProductData.sizes && (
                                        <div className="mb-3">
                                            <label className="form-label">{t('shopOwner.flashSale.sizeQuantityLabel') || 'Cấu hình chi tiết theo Size'}: <span style={{ color: 'red' }}>*</span></label>
                                            <div className="table-responsive border rounded p-2 bg-light">
                                                <table className="table table-sm table-borderless mb-0 align-middle">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '15%' }}>Size</th>
                                                            <th style={{ width: '15%' }}>Kho hiện tại</th>
                                                            <th style={{ width: '20%' }}>Giá gốc (+Mod)</th>
                                                            <th style={{ width: '20%' }}>Flash Sale Qty</th>
                                                            <th style={{ width: '30%' }}>Flash Sale Price</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedProductData.sizes.map(size => {
                                                            const originalPrice = (selectedProductData.price || 0) + (size.priceModifier || 0);
                                                            return (
                                                                <tr key={size.id}>
                                                                    <td className="fw-bold">{size.name}</td>
                                                                    <td>{size.stock}</td>
                                                                    <td className="text-muted small">{originalPrice.toLocaleString()}đ</td>
                                                                    <td>
                                                                        <input
                                                                            type="number"
                                                                            className="form-control form-control-sm"
                                                                            min="0"
                                                                            max={size.stock}
                                                                            placeholder="Qty"
                                                                            value={sizeConfig[size.id]?.quantity || ''}
                                                                            onChange={(e) => {
                                                                                const val = parseInt(e.target.value) || 0;
                                                                                if (val > size.stock) return;
                                                                                setSizeConfig(prev => ({
                                                                                    ...prev,
                                                                                    [size.id]: {
                                                                                        ...prev[size.id],
                                                                                        quantity: val
                                                                                    }
                                                                                }));
                                                                            }}
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <div className="input-group input-group-sm">
                                                                            <input
                                                                                type="number"
                                                                                className="form-control"
                                                                                min="1000"
                                                                                placeholder="Giá bán"
                                                                                value={sizeConfig[size.id]?.salePrice || ''}
                                                                                onChange={(e) => {
                                                                                    const val = parseFloat(e.target.value) || 0;
                                                                                    setSizeConfig(prev => ({
                                                                                        ...prev,
                                                                                        [size.id]: {
                                                                                            ...prev[size.id],
                                                                                            salePrice: val
                                                                                        }
                                                                                    }));
                                                                                }}
                                                                            />
                                                                            <span className="input-group-text">đ</span>
                                                                        </div>
                                                                        {sizeConfig[size.id]?.salePrice > 0 && (
                                                                            <div style={{ fontSize: '10px' }}>
                                                                                {sizeConfig[size.id]?.salePrice >= originalPrice ? (
                                                                                    <span className="text-danger">Cao hơn giá gốc!</span>
                                                                                ) : (
                                                                                    <span className="text-success">Giảm {Math.round((1 - sizeConfig[size.id].salePrice / originalPrice) * 100)}%</span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <small className="text-muted">Nhập số lượng và giá bán Flash Sale cho từng size.</small>
                                        </div>
                                    )}

                                    {/* Global Sale Price Input Removed - Handled per size */}
                                    {/* Limit Input */}
                                    <div className="row">
                                        <div className="col-md-12">
                                            <div className="mb-3">
                                                <label className="form-label">
                                                    Giới hạn mua mỗi người <small className="text-muted">(Để trống nếu không giới hạn)</small>
                                                </label>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    value={quantityLimit}
                                                    onChange={e => setQuantityLimit(e.target.value)}
                                                    min="1"
                                                    placeholder="Ví dụ: 1, 2, 5..."
                                                />
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
                                                    <td className="py-3 fw-bold text-danger">
                                                        {reg.sizes && reg.sizes.length > 0 ? (
                                                            <div style={{ fontSize: '0.85em' }}>
                                                                {reg.sizes.map(s => (
                                                                    <div key={s.sizeId}>
                                                                        <span className="text-dark opacity-75">{s.sizeName}:</span> {s.flashSalePrice?.toLocaleString()}đ
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <>{reg.salePrice?.toLocaleString()}đ</>
                                                        )}
                                                    </td>
                                                    <td className="py-3">
                                                        {reg.sizes && reg.sizes.length > 0 ? (
                                                            <div style={{ fontSize: '0.85em' }}>
                                                                {reg.sizes.map(s => (
                                                                    <div key={s.sizeId}>
                                                                        <span className="text-muted">{s.sizeName}:</span> {s.flashSaleStock}
                                                                        {s.soldCount > 0 && <span className="text-success ms-1">({s.soldCount})</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <>{reg.flashSaleStock}</>
                                                        )}
                                                    </td>
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
            )
            }
        </div >
    );
};

export default ShopFlashSale;
