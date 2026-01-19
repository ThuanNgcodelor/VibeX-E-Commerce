import React, { useState, useEffect } from 'react';
import '../../assets/admin/css/VoucherManagementPage.css';
import '../../assets/admin/css/Validation.css';
import { adminVoucherApi } from '../../api/voucher';
import Swal from 'sweetalert2';

const VoucherManagementPage = () => {
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState(null);

    // API integration states
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        description: '',
        type: 'PLATFORM',
        discountType: 'PERCENTAGE',
        discountValue: '',
        maxDiscount: '',
        minOrder: '',
        totalQuantity: '',
        perUserLimit: 1,
        startDate: '',
        endDate: '',
        status: 'ACTIVE'
    });

    const validate = () => {
        const newErrors = {};

        if (!formData.code.trim()) newErrors.code = 'Code is required';
        if (!formData.name.trim()) newErrors.name = 'Name is required';

        if (!formData.discountValue || parseFloat(formData.discountValue) <= 0) {
            newErrors.discountValue = 'Valid discount value is required';
        }

        if (!formData.minOrder || parseFloat(formData.minOrder) < 0) {
            newErrors.minOrder = 'Valid min order is required';
        }

        if (!formData.totalQuantity || parseInt(formData.totalQuantity) <= 0) {
            newErrors.totalQuantity = 'Valid quantity is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    // Load vouchers from backend
    const loadVouchers = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await adminVoucherApi.getAll();
            // Map backend fields to frontend format
            const mapped = data.map(v => ({
                id: v.id,
                code: v.code,
                name: v.title,  // Backend: title → Frontend: name
                description: v.description,
                type: 'PLATFORM',  // All are platform vouchers
                discountType: v.discountType,
                discountValue: v.discountType === 'PERCENTAGE' ? v.discountValue : v.discountValue,
                maxDiscount: v.maxDiscountAmount,
                minOrder: v.minOrderValue,
                totalQuantity: v.totalQuantity,
                usedQuantity: v.usedQuantity,
                startDate: v.startAt?.split('T')[0],
                endDate: v.endAt?.split('T')[0],
                status: v.status,
                image: '🎟️'  // Default icon
            }));
            setVouchers(mapped);
        } catch (e) {
            const errorMsg = e?.response?.data?.message || 'Failed to load vouchers';
            setError(errorMsg);
            Swal.fire('Error!', errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Load on component mount
    useEffect(() => {
        loadVouchers();
    }, []);

    // Handle toggle voucher status
    const handleToggleStatus = (voucherId) => {
        setVouchers(prevVouchers =>
            prevVouchers.map(voucher =>
                voucher.id === voucherId
                    ? {
                        ...voucher,
                        status: voucher.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
                    }
                    : voucher
            )
        );
    };

    // Handle Create Voucher
    const handleCreate = () => {
        setEditingVoucher(null);
        setFormData({
            code: '',
            name: '',
            description: '',
            type: 'PLATFORM',
            discountType: 'PERCENTAGE',
            discountValue: '',
            maxDiscount: '',
            minOrder: '',
            totalQuantity: '',
            perUserLimit: 1,
            startDate: '',
            endDate: '',
            status: 'ACTIVE'
        });
        setErrors({});
        setShowModal(true);
    };

    // Handle Edit Voucher
    const handleEdit = (voucher) => {
        setEditingVoucher(voucher);
        setFormData({
            code: voucher.code,
            name: voucher.name,
            description: voucher.description,
            type: voucher.type,
            discountType: voucher.discountType,
            discountValue: voucher.discountValue,
            maxDiscount: voucher.maxDiscount || '',
            minOrder: voucher.minOrder,
            totalQuantity: voucher.totalQuantity,
            perUserLimit: 1,
            startDate: voucher.startDate,
            endDate: voucher.endDate,
            status: voucher.status
        });
        setErrors({});
        setShowModal(true);
    };

    // Handle Delete Voucher
    const handleDelete = async (voucherId) => {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await adminVoucherApi.remove(voucherId);
                await loadVouchers();
                Swal.fire('Deleted!', 'Voucher has been deleted', 'success');
            } catch (e) {
                const errorMsg = e?.response?.data?.message || 'Failed to delete voucher';
                Swal.fire('Error!', errorMsg, 'error');
            }
        }
    };

    // Generate random voucher code XXXX-XXXX
    const generateRandomCode = () => {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const generateSegment = () => {
            let segment = '';
            for (let i = 0; i < 4; i++) {
                segment += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            return segment;
        };
        const randomCode = `${generateSegment()}-${generateSegment()}`;
        setFormData({ ...formData, code: randomCode });
    };

    // Handle Submit Form
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) return;

        setSaving(true);
        setError('');

        try {
            // Build payload for backend
            const payload = {
                code: formData.code.toUpperCase(),
                title: formData.name,  // Frontend: name → Backend: title
                description: formData.description,
                discountType: formData.discountType === 'PERCENTAGE' ? 'PERCENT' : 'FIXED_AMOUNT',
                discountValue: parseFloat(formData.discountValue),
                maxDiscountAmount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
                minOrderValue: parseFloat(formData.minOrder),
                totalQuantity: parseInt(formData.totalQuantity),
                startAt: formData.startDate ? `${formData.startDate}T00:00:00` : null,
                endAt: formData.endDate ? `${formData.endDate}T23:59:59` : null
            };

            if (editingVoucher) {
                // Update
                payload.id = editingVoucher.id;
                if (formData.status) {
                    payload.status = formData.status;
                }
                await adminVoucherApi.update(payload);
                Swal.fire('Success!', 'Voucher updated successfully', 'success');
            } else {
                // Create
                await adminVoucherApi.create(payload);
                Swal.fire('Success!', 'Voucher created successfully', 'success');
            }

            await loadVouchers();
            setShowModal(false);
            setEditingVoucher(null);
        } catch (e) {
            const errorMsg = e?.response?.data?.message || 'Failed to save voucher';
            setError(errorMsg);
            Swal.fire('Error!', errorMsg, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Filter vouchers
    const filteredVouchers = vouchers.filter(voucher => {
        const matchesSearch = voucher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            voucher.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || voucher.type === filterType;
        const matchesStatus = filterStatus === 'all' || voucher.status === filterStatus;
        return matchesSearch && matchesType && matchesStatus;
    });

    // Calculate stats
    const stats = {
        total: vouchers.length,
        active: vouchers.filter(v => v.status === 'ACTIVE').length,
        expired: vouchers.filter(v => v.status === 'EXPIRED').length,
        scheduled: vouchers.filter(v => v.status === 'SCHEDULED').length,
        totalUsage: vouchers.reduce((sum, v) => sum + v.usedQuantity, 0)
    };

    const getStatusBadge = (status) => {
        const badges = {
            'ACTIVE': { label: 'Active', color: 'success' },
            'EXPIRED': { label: 'Expired', color: 'danger' },
            'SCHEDULED': { label: 'Scheduled', color: 'info' },
            'PAUSED': { label: 'Paused', color: 'warning' }
        };
        const badge = badges[status] || { label: status, color: 'secondary' };
        return <span className={`status-badge status-${badge.color}`}>{badge.label}</span>;
    };

    const getTypeBadge = (type) => {
        const badges = {
            'PLATFORM': { label: 'Platform', color: 'primary' },
            'SHOP': { label: 'Shop', color: 'success' },
            'CATEGORY': { label: 'Category', color: 'info' },
            'PRODUCT': { label: 'Product', color: 'warning' }
        };
        const badge = badges[type] || { label: type, color: 'secondary' };
        return <span className={`type-badge type-${badge.color}`}>{badge.label}</span>;
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('vi-VN');
    };

    return (
        <div className="voucher-management-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Voucher Management</h1>
                    <p className="page-subtitle">Manage discount codes and promotions</p>
                </div>
                <button className="btn-create" onClick={handleCreate}>
                    <i className="fas fa-plus"></i> Create Voucher
                </button>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon stat-icon-total">
                        <i className="fas fa-ticket-alt"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Total Vouchers</span>
                        <h2 className="stat-value">{stats.total}</h2>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon stat-icon-active">
                        <i className="fas fa-check-circle"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Active</span>
                        <h2 className="stat-value">{stats.active}</h2>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon stat-icon-scheduled">
                        <i className="fas fa-clock"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Scheduled</span>
                        <h2 className="stat-value">{stats.scheduled}</h2>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon stat-icon-usage">
                        <i className="fas fa-chart-line"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Usage Count</span>
                        <h2 className="stat-value">{stats.totalUsage}</h2>
                    </div>
                </div>
            </div>

            {/* Filters Card */}
            <div className="card filters-card">
                <div className="card-header">
                    <h3 className="card-title">Voucher List</h3>
                    <div className="header-actions">
                        <div className="search-box">
                            <i className="fas fa-search"></i>
                            <input
                                type="text"
                                placeholder="Search vouchers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>

                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Types</option>
                            <option value="PLATFORM">Platform</option>
                            <option value="SHOP">Shop</option>
                            <option value="CATEGORY">Category</option>
                            <option value="PRODUCT">Product</option>
                        </select>

                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Status</option>
                            <option value="ACTIVE">Active</option>
                            <option value="EXPIRED">Expired</option>
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="PAUSED">Paused</option>
                        </select>

                        {/* View Toggle */}
                        <div className="view-toggle">
                            <button
                                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                onClick={() => setViewMode('grid')}
                                title="Grid View"
                            >
                                <i className="fas fa-th"></i>
                            </button>
                            <button
                                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                                onClick={() => setViewMode('list')}
                                title="List View"
                            >
                                <i className="fas fa-list"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="card-body">
                    {loading ? (
                        <div className="loading-state">
                            <i className="fas fa-spinner fa-spin"></i>
                            <p>Loading vouchers...</p>
                        </div>
                    ) : filteredVouchers.length === 0 ? (
                        <div className="no-data">
                            <i className="fas fa-inbox"></i>
                            <p>No vouchers found</p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        /* Grid View */
                        <div className="vouchers-grid">
                            {filteredVouchers.map((voucher) => (
                                <div key={voucher.id} className="voucher-card">
                                    <div className="voucher-card-header">
                                        <div className="voucher-icon">{voucher.image}</div>
                                        <div className="voucher-badges">
                                            {getTypeBadge(voucher.type)}
                                            {getStatusBadge(voucher.status)}
                                        </div>
                                    </div>

                                    <div className="voucher-card-body">
                                        <div className="voucher-code">{voucher.code}</div>
                                        <h4 className="voucher-name">{voucher.name}</h4>
                                        <p className="voucher-description">{voucher.description}</p>

                                        <div className="voucher-discount">
                                            <div className="discount-badge">
                                                {voucher.discountType === 'PERCENTAGE'
                                                    ? `-${voucher.discountValue}%`
                                                    : formatCurrency(voucher.discountValue)}
                                            </div>
                                            {voucher.maxDiscount && (
                                                <span className="max-discount">
                                                    Max: {formatCurrency(voucher.maxDiscount)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="voucher-details">
                                            <div className="detail-row">
                                                <span className="detail-label">
                                                    <i className="fas fa-shopping-cart"></i> Min Order:
                                                </span>
                                                <span className="detail-value">{formatCurrency(voucher.minOrder)}</span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="detail-label">
                                                    <i className="fas fa-calendar"></i> Expires:
                                                </span>
                                                <span className="detail-value">{formatDate(voucher.endDate)}</span>
                                            </div>
                                        </div>

                                        <div className="voucher-usage">
                                            <div className="usage-header">
                                                <span>Used</span>
                                                <span>{voucher.usedQuantity} / {voucher.totalQuantity}</span>
                                            </div>
                                            <div className="usage-bar">
                                                <div
                                                    className="usage-fill"
                                                    style={{ width: `${(voucher.usedQuantity / voucher.totalQuantity) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Status Toggle */}
                                        <div className="voucher-toggle-section">
                                            <span className="toggle-label">
                                                {voucher.status === 'ACTIVE' ? 'Active' : 'Paused'}
                                            </span>
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={voucher.status === 'ACTIVE'}
                                                    onChange={() => handleToggleStatus(voucher.id)}
                                                    disabled={voucher.status === 'EXPIRED' || voucher.status === 'SCHEDULED'}
                                                />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="voucher-card-footer">
                                        <button className="btn-action btn-edit" title="Edit" onClick={() => handleEdit(voucher)}>
                                            <i className="fas fa-edit"></i>
                                        </button>
                                        <button className="btn-action btn-delete" title="Delete" onClick={() => handleDelete(voucher.id)}>
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* List View */
                        <div className="table-responsive">
                            <table className="vouchers-table">
                                <thead>
                                    <tr>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Discount</th>
                                        <th>Min Order</th>
                                        <th>Used</th>
                                        <th>Expires</th>
                                        <th>Status</th>
                                        <th>On/Off</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredVouchers.map((voucher) => (
                                        <tr key={voucher.id}>
                                            <td>
                                                <div className="voucher-icon-list">{voucher.image}</div>
                                                <span className="voucher-code-list">{voucher.code}</span>
                                            </td>
                                            <td>
                                                <div className="voucher-name-list">{voucher.name}</div>
                                            </td>
                                            <td>{getTypeBadge(voucher.type)}</td>
                                            <td>
                                                <div className="discount-cell">
                                                    <strong>
                                                        {voucher.discountType === 'PERCENTAGE'
                                                            ? `-${voucher.discountValue}%`
                                                            : formatCurrency(voucher.discountValue)}
                                                    </strong>
                                                    {voucher.maxDiscount && (
                                                        <small>Max: {formatCurrency(voucher.maxDiscount)}</small>
                                                    )}
                                                </div>
                                            </td>
                                            <td>{formatCurrency(voucher.minOrder)}</td>
                                            <td>
                                                <div className="usage-cell">
                                                    <span>{voucher.usedQuantity} / {voucher.totalQuantity}</span>
                                                    <div className="usage-bar-small">
                                                        <div
                                                            className="usage-fill-small"
                                                            style={{ width: `${(voucher.usedQuantity / voucher.totalQuantity) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{formatDate(voucher.endDate)}</td>
                                            <td>{getStatusBadge(voucher.status)}</td>
                                            <td>
                                                <label className="toggle-switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={voucher.status === 'ACTIVE'}
                                                        onChange={() => handleToggleStatus(voucher.id)}
                                                        disabled={voucher.status === 'EXPIRED' || voucher.status === 'SCHEDULED'}
                                                    />
                                                    <span className="toggle-slider"></span>
                                                </label>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="btn-action btn-edit" title="Edit" onClick={() => handleEdit(voucher)}>
                                                        <i className="fas fa-edit"></i>
                                                    </button>
                                                    <button className="btn-action btn-delete" title="Delete" onClick={() => handleDelete(voucher.id)}>
                                                        <i className="fas fa-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingVoucher ? 'Edit Voucher' : 'Create New Voucher'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Voucher Code *</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={formData.code}
                                                onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                                                placeholder="SALE20 or XXXX-XXXX"

                                                disabled={editingVoucher !== null}
                                                style={{
                                                    flex: 1,
                                                    cursor: editingVoucher ? 'not-allowed' : 'text',
                                                    opacity: editingVoucher ? 0.7 : 1
                                                }}
                                            />
                                            {!editingVoucher && (
                                                <button
                                                    type="button"
                                                    className="btn-random-code"
                                                    onClick={generateRandomCode}
                                                    title="Generate Random Code"
                                                    style={{
                                                        padding: '8px 16px',
                                                        backgroundColor: '#6c63ff',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        fontSize: '14px',
                                                        fontWeight: '500',
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                    onMouseEnter={(e) => e.target.style.backgroundColor = '#5848d6'}
                                                    onMouseLeave={(e) => e.target.style.backgroundColor = '#6c63ff'}
                                                >
                                                    <i className="fas fa-dice"></i>
                                                    Random
                                                </button>
                                            )}
                                        </div>
                                        {editingVoucher && (
                                            <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                                                Voucher code cannot be changed after creation
                                            </small>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label>Voucher Name *</label>
                                        <input
                                            type="text"
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                            placeholder="Flash Sale 20%"
                                            className={`form-input ${errors.name ? 'error' : ''}`}
                                        />
                                        {errors.name && <span className="error-message">{errors.name}</span>}
                                    </div>

                                    <div className="form-group full-width">
                                        <label>Description</label>
                                        <textarea
                                            className="form-input"
                                            rows="3"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="e.g., 20% off all products..."
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Discount Type *</label>
                                        <select
                                            className="form-input"
                                            value={formData.discountType}
                                            onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                                            required
                                        >
                                            <option value="PERCENTAGE">Percentage (%)</option>
                                            <option value="FIXED">Fixed Amount (VND)</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>{formData.discountType === 'PERCENTAGE' ? 'Discount (%) *' : 'Discount (VND) *'}</label>
                                        <input
                                            type="number"
                                            onChange={(e) => handleInputChange('discountValue', e.target.value)}
                                            placeholder={formData.discountType === 'PERCENTAGE' ? '20' : '50000'}
                                            min="0"
                                            step={formData.discountType === 'PERCENTAGE' ? '1' : '1000'}
                                            className={`form-input ${errors.discountValue ? 'error' : ''}`}
                                        />
                                        {errors.discountValue && <span className="error-message">{errors.discountValue}</span>}
                                    </div>

                                    {formData.discountType === 'PERCENTAGE' && (
                                        <div className="form-group">
                                            <label>Max Discount (VND)</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={formData.maxDiscount}
                                                onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                                                placeholder="100000"
                                                min="0"
                                                step="1000"
                                            />
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label>Min Order (VND) *</label>
                                        <input
                                            type="number"
                                            onChange={(e) => handleInputChange('minOrder', e.target.value)}
                                            placeholder="500000"
                                            min="0"
                                            step="1000"
                                            className={`form-input ${errors.minOrder ? 'error' : ''}`}
                                        />
                                        {errors.minOrder && <span className="error-message">{errors.minOrder}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Quantity *</label>
                                        <input
                                            type="number"
                                            onChange={(e) => handleInputChange('totalQuantity', e.target.value)}
                                            placeholder="100"
                                            min="1"
                                            className={`form-input ${errors.totalQuantity ? 'error' : ''}`}
                                        />
                                        {errors.totalQuantity && <span className="error-message">{errors.totalQuantity}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Start Date</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={formData.startDate}
                                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>End Date</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={formData.endDate}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Status *</label>
                                        <select
                                            className="form-input"
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            required
                                        >
                                            <option value="ACTIVE">Active</option>
                                            <option value="SCHEDULED">Scheduled</option>
                                            <option value="PAUSED">Paused</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-save" disabled={saving}>
                                    {saving ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin"></i>
                                            {editingVoucher ? 'Updating...' : 'Creating...'}
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-save"></i> {editingVoucher ? 'Update' : 'Create'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoucherManagementPage;
