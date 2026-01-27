import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import flashSaleAPI from '../../../api/flashSale/flashSaleAPI';
import productAdminApi from '../../../api/productAdminApi';
import '../ShopOwnerLayout.css';
import Cookies from 'js-cookie';

const ShopFlashSale = () => {
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

    const [selectedProductData, setSelectedProductData] = useState(null);
    const [sizeConfig, setSizeConfig] = useState({});

    useEffect(() => {
        const token = Cookies.get('accessToken');
        if (!token) {
            Swal.fire({
                icon: 'warning',
                title: 'Login Required',
                text: 'You need to login first!'
            });
            return;
        }
        fetchSessions();
        fetchMyRegistrations();
        fetchMyProducts();
    }, []);

    // ... (fetch functions remain same)

    useEffect(() => {
        if (selectedProductId) {
            const product = products.find(p => p.id === selectedProductId);
            setSelectedProductData(product || null);
            setSizeConfig({});
        } else {
            setSelectedProductData(null);
            setSizeConfig({});
        }
    }, [selectedProductId, products]);

    const fetchSessions = async () => {
        try {
            const data = await flashSaleAPI.getAllSessions();
            if (Array.isArray(data)) {
                setSessions(data);
            } else {
                console.error("Sessions data is not an array:", data);
                setSessions([]);
            }
        } catch (error) {
            console.error("Failed to fetch sessions", error);
            setSessions([]);
        }
    };

    const fetchMyRegistrations = async () => {
        try {
            const data = await flashSaleAPI.getMyRegistrations();
            if (Array.isArray(data)) {
                setMyRegistrations(data);
            } else {
                console.error("Registrations data is not an array:", data);
                setMyRegistrations([]);
            }
        } catch (error) {
            console.error("Failed to fetch registrations", error);
            setMyRegistrations([]);
        }
    };

    const fetchMyProducts = async () => {
        try {
            const response = await productAdminApi.getProducts();
            const content = response?.content;
            setProducts(Array.isArray(content) ? content : []);
        } catch (error) {
            console.error("Failed to fetch products", error);
            setProducts([]);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        const sizesPayload = Object.entries(sizeConfig)
            .filter(([_, config]) => config.quantity > 0)
            .map(([sizeId, config]) => ({
                sizeId,
                quantity: config.quantity,
                salePrice: config.salePrice
            }));

        if (sizesPayload.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Incomplete Information',
                text: 'Please select at least one size with quantity'
            });
            return;
        }

        for (const item of sizesPayload) {
            if (!item.salePrice || item.salePrice <= 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Price',
                    text: 'Please enter a valid flash sale price for all selected sizes.'
                });
                return;
            }
        }

        const minPrice = Math.min(...sizesPayload.map(s => s.salePrice));

        try {
            setLoading(true);
            await flashSaleAPI.registerProduct({
                sessionId: selectedSessionId,
                productId: selectedProductId,
                salePrice: minPrice,
                sizes: sizesPayload
            });

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Product registered successfully!',
                showConfirmButton: false,
                timer: 1500
            });

            fetchMyRegistrations();
            setSalePrice('');
            setSizeConfig({});
            setSelectedProductId('');
            setIsRegistering(false);
        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: 'error',
                title: 'Registration Failed',
                text: 'Error: ' + (error.response?.data?.message || 'Unknown error occurred')
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (registrationId, productName, sessionName) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Delete Registration?',
            html: `Are you sure you want to delete the registration for <b>${productName}</b> in <b>${sessionName}</b>?<br/><br/><span style="color: red;">This action cannot be undone.</span>`,
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                await flashSaleAPI.deleteRegistration(registrationId);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Registration has been deleted successfully.',
                    showConfirmButton: false,
                    timer: 1500
                });
                fetchMyRegistrations();
            } catch (error) {
                console.error("Delete error:", error);
                const errorMsg = error.response?.data?.message || error.message || 'Unknown error occurred';
                Swal.fire({
                    icon: 'error',
                    title: 'Delete Failed',
                    text: 'Error: ' + errorMsg
                });
            }
        }
    };

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>{isRegistering ? 'Register for Flash Sale' : 'Flash Sale Management'}</h1>
                        <p className="text-muted">
                            {isRegistering
                                ? 'Fill in the form below to register your product for a flash sale session'
                                : 'Manage your flash sale registrations and view history'}
                        </p>
                    </div>
                    {isRegistering ? (
                        <button
                            className="btn btn-secondary-shop"
                            onClick={() => setIsRegistering(false)}
                        >
                            <i className="fas fa-arrow-left"></i> Back
                        </button>
                    ) : (
                        <button
                            className="btn btn-primary-shop"
                            onClick={() => setIsRegistering(true)}
                        >
                            <i className="fas fa-plus"></i> Register Product
                        </button>
                    )}
                </div>
            </div>

            {isRegistering ? (
                <form onSubmit={handleRegister}>
                    <div className="row">
                        <div className="col-md-8">
                            <div className="card" style={{ marginBottom: '20px' }}>
                                <div className="card-header">
                                    <h5><i className="fas fa-info-circle"></i> Registration Information</h5>
                                </div>
                                <div className="card-body">
                                    <div className="mb-3">
                                        <label className="form-label">Select Session <span style={{ color: 'red' }}>*</span></label>
                                        <select
                                            className="form-select"
                                            value={selectedSessionId}
                                            onChange={e => setSelectedSessionId(e.target.value)}
                                            required
                                        >
                                            <option value="">-- Select a session --</option>
                                            {sessions.map(s => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({new Date(s.startTime).toLocaleString('en-US')} - {new Date(s.endTime).toLocaleString('en-US')})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label">Select Product <span style={{ color: 'red' }}>*</span></label>
                                        <select
                                            className="form-select"
                                            value={selectedProductId}
                                            onChange={e => setSelectedProductId(e.target.value)}
                                            required
                                        >
                                            <option value="">-- Select a product --</option>
                                            {products.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} - Original: {p.price?.toLocaleString()}đ (Stock: {p.totalStock})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {selectedProductData && (
                                        <div className="alert alert-info border-0 bg-blue-50 text-blue-700">
                                            <div className="d-flex align-items-center gap-3">
                                                <div className="bg-white rounded d-flex align-items-center justify-content-center border"
                                                    style={{ width: '60px', height: '60px', overflow: 'hidden' }}>
                                                    {selectedProductData.imageId ? (
                                                        <img
                                                            src={`/v1/file-storage/get/${selectedProductData.imageId}`}
                                                            alt={selectedProductData.name}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <i className="fas fa-box text-2xl text-blue-300"></i>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="fw-bold fs-5">{selectedProductData.name}</div>
                                                    <div className="text-sm">Category: {selectedProductData.categoryName}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {selectedProductData && selectedProductData.sizes && (
                                        <div className="mb-3">
                                            <label className="form-label">Size Configuration: <span style={{ color: 'red' }}>*</span></label>
                                            <div className="table-responsive border rounded p-2 bg-light">
                                                <table className="table table-sm table-borderless mb-0 align-middle">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '15%' }}>Size</th>
                                                            <th style={{ width: '15%' }}>Current Stock</th>
                                                            <th style={{ width: '20%' }}>Original Price (+Mod)</th>
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
                                                                                placeholder="Sale Price"
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
                                                                                    <span className="text-danger">Higher than original price!</span>
                                                                                ) : (
                                                                                    <span className="text-success">Discount {Math.round((1 - sizeConfig[size.id].salePrice / originalPrice) * 100)}%</span>
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
                                            <small className="text-muted">Enter flash sale quantity and price for each size.</small>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="col-md-4">
                            <div className="card" style={{ position: 'sticky', top: '20px' }}>
                                <div className="card-header">
                                    <h5><i className="fas fa-check-circle"></i> Confirm Registration</h5>
                                </div>
                                <div className="card-body">
                                    <p className="text-muted small mb-3">
                                        Please review all information before submitting your registration.
                                    </p>
                                    <div className="d-grid gap-2">
                                        <button
                                            type="submit"
                                            className="btn btn-primary-shop"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <><i className="fas fa-spinner fa-spin"></i> Processing...</>
                                            ) : (
                                                <><i className="fas fa-paper-plane"></i> Submit Registration</>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary-shop"
                                            onClick={() => setIsRegistering(false)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            ) : (
                <div className="card pb-5">
                    <div className="table-header">
                        <h5 className="table-title mb-0">Registration History</h5>
                    </div>
                    <div className="card-body p-0">
                        {myRegistrations.length === 0 ? (
                            <div className="text-center py-5">
                                <div className="text-gray-300 text-5xl mb-3"><i className="fas fa-inbox"></i></div>
                                <p className="text-gray-500">No registrations found</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover mb-0">
                                    <thead className="bg-light text-muted">
                                        <tr>
                                            <th className="ps-4 py-3">Product</th>
                                            <th className="py-3">Program</th>
                                            <th className="py-3">Original Price</th>
                                            <th className="py-3">Sale Price</th>
                                            <th className="py-3">Stock</th>
                                            <th className="py-3">Sold</th>
                                            <th className="py-3">Revenue</th>
                                            <th className="py-3 text-center">Status</th>
                                            <th className="py-3 text-center">Actions</th>
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
                                                                <div className="fw-bold text-dark">{product?.name || 'Product ' + reg.productId}</div>
                                                                <small className="text-muted">ID: {reg.productId.substring(0, 8)}</small>
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
                                                    <td className="py-3 fw-bold text-success">
                                                        {reg.soldCount}
                                                    </td>
                                                    <td className="py-3 fw-bold text-primary">
                                                        {reg.totalRevenue?.toLocaleString()}đ
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        <span className={`badge rounded-pill ${reg.status === 'APPROVED' ? 'bg-success' :
                                                            reg.status === 'REJECTED' ? 'bg-danger' : 'bg-warning text-dark'
                                                            }`}>
                                                            {reg.status === 'APPROVED' ? 'Approved' :
                                                                reg.status === 'REJECTED' ? 'Rejected' :
                                                                    'Pending'}
                                                        </span>
                                                        {reg.rejectionReason && (
                                                            <div className="text-danger small mt-1" style={{ fontSize: '11px', maxWidth: '150px', margin: '0 auto' }}>
                                                                {reg.rejectionReason}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 text-center">
                                                        {session && session.status === 'INACTIVE' && (
                                                            <button
                                                                className="btn btn-danger btn-sm"
                                                                onClick={() => handleDelete(reg.id, product?.name || 'Product', session?.name || 'Session')}
                                                                title="Delete registration (only available when session is INACTIVE)"
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </button>
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
