import React, { useState, useEffect } from 'react';
import '../../assets/admin/css/VoucherManagementPage.css';
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
                    <h1 className="page-title">Quản Lý Voucher</h1>
                    <p className="page-subtitle">Quản lý mã giảm giá và khuyến mãi</p>
                </div>
                <button className="btn-create" onClick={handleCreate}>
                    <i className="fas fa-plus"></i> Tạo Voucher
                </button>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon stat-icon-total">
                        <i className="fas fa-ticket-alt"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Tổng Voucher</span>
                        <h2 className="stat-value">{stats.total}</h2>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon stat-icon-active">
                        <i className="fas fa-check-circle"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Đang Hoạt Động</span>
                        <h2 className="stat-value">{stats.active}</h2>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon stat-icon-scheduled">
                        <i className="fas fa-clock"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Đã Lên Lịch</span>
                        <h2 className="stat-value">{stats.scheduled}</h2>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon stat-icon-usage">
                        <i className="fas fa-chart-line"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Lượt Sử Dụng</span>
                        <h2 className="stat-value">{stats.totalUsage}</h2>
                    </div>
                </div>
            </div>

            {/* Filters Card */}
            <div className="card filters-card">
                <div className="card-header">
                    <h3 className="card-title">Danh Sách Voucher</h3>
                    <div className="header-actions">
                        <div className="search-box">
                            <i className="fas fa-search"></i>
                            <input
                                type="text"
                                placeholder="Tìm kiếm voucher..."
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
                            <option value="all">Tất Cả Loại</option>
                            <option value="PLATFORM">Platform</option>
                            <option value="SHOP">Shop</option>
                            <option value="CATEGORY">Danh Mục</option>
                            <option value="PRODUCT">Sản Phẩm</option>
                        </select>

                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">Tất Cả Trạng Thái</option>
                            <option value="ACTIVE">Hoạt Động</option>
                            <option value="EXPIRED">Hết Hạn</option>
                            <option value="SCHEDULED">Đã Lên Lịch</option>
                            <option value="PAUSED">Tạm Dừng</option>
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
                            <p>Không tìm thấy voucher</p>
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
                                                    Tối đa: {formatCurrency(voucher.maxDiscount)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="voucher-details">
                                            <div className="detail-row">
                                                <span className="detail-label">
                                                    <i className="fas fa-shopping-cart"></i> Đơn tối thiểu:
                                                </span>
                                                <span className="detail-value">{formatCurrency(voucher.minOrder)}</span>
                                            </div>
                                            <div className="detail-row">
                                                <span className="detail-label">
                                                    <i className="fas fa-calendar"></i> Hết hạn:
                                                </span>
                                                <span className="detail-value">{formatDate(voucher.endDate)}</span>
                                            </div>
                                        </div>

                                        <div className="voucher-usage">
                                            <div className="usage-header">
                                                <span>Đã dùng</span>
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
                                                {voucher.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}
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
                                        <button className="btn-action btn-edit" title="Sửa" onClick={() => handleEdit(voucher)}>
                                            <i className="fas fa-edit"></i>
                                        </button>
                                        <button className="btn-action btn-delete" title="Xóa" onClick={() => handleDelete(voucher.id)}>
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
                                        <th>Mã</th>
                                        <th>Tên</th>
                                        <th>Loại</th>
                                        <th>Giảm Giá</th>
                                        <th>Đơn Tối Thiểu</th>
                                        <th>Đã Dùng</th>
                                        <th>Hết Hạn</th>
                                        <th>Trạng Thái</th>
                                        <th>Bật/Tắt</th>
                                        <th>Thao Tác</th>
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
                                                        <small>Tối đa: {formatCurrency(voucher.maxDiscount)}</small>
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
                                                    <button className="btn-action btn-edit" title="Sửa" onClick={() => handleEdit(voucher)}>
                                                        <i className="fas fa-edit"></i>
                                                    </button>
                                                    <button className="btn-action btn-delete" title="Xóa" onClick={() => handleDelete(voucher.id)}>
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
                                {editingVoucher ? 'Sửa Voucher' : 'Tạo Voucher Mới'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Mã Voucher *</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={formData.code}
                                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                                placeholder="SALE20 hoặc XXXX-XXXX"
                                                required
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
                                                    title="Tạo mã ngẫu nhiên"
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
                                                Mã voucher không thể thay đổi sau khi tạo
                                            </small>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label>Tên Voucher *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Flash Sale 20%"
                                            required
                                        />
                                    </div>

                                    <div className="form-group full-width">
                                        <label>Mô Tả</label>
                                        <textarea
                                            className="form-input"
                                            rows="3"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Giảm ngay 20% cho tất cả sản phẩm..."
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Loại Giảm Giá *</label>
                                        <select
                                            className="form-input"
                                            value={formData.discountType}
                                            onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                                            required
                                        >
                                            <option value="PERCENTAGE">Phần Trăm (%)</option>
                                            <option value="FIXED">Giá Cố Định (VND)</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>{formData.discountType === 'PERCENTAGE' ? 'Giảm Giá (%) *' : 'Giảm Giá (VND) *'}</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={formData.discountValue}
                                            onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                                            placeholder={formData.discountType === 'PERCENTAGE' ? '20' : '50000'}
                                            min="0"
                                            step={formData.discountType === 'PERCENTAGE' ? '1' : '1000'}
                                            required
                                        />
                                    </div>

                                    {formData.discountType === 'PERCENTAGE' && (
                                        <div className="form-group">
                                            <label>Giảm Tối Đa (VND)</label>
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
                                        <label>Đơn Tối Thiểu (VND) *</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={formData.minOrder}
                                            onChange={(e) => setFormData({ ...formData, minOrder: e.target.value })}
                                            placeholder="500000"
                                            min="0"
                                            step="1000"
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Số Lượng *</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={formData.totalQuantity}
                                            onChange={(e) => setFormData({ ...formData, totalQuantity: e.target.value })}
                                            placeholder="100"
                                            min="1"
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Ngày Bắt Đầu</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={formData.startDate}
                                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Ngày Kết Thúc</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={formData.endDate}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Trạng Thái *</label>
                                        <select
                                            className="form-input"
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                            required
                                        >
                                            <option value="ACTIVE">Hoạt Động</option>
                                            <option value="SCHEDULED">Đã Lên Lịch</option>
                                            <option value="PAUSED">Tạm Dừng</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                                    Hủy
                                </button>
                                <button type="submit" className="btn-save" disabled={saving}>
                                    {saving ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin"></i>
                                            {editingVoucher ? 'Updating...' : 'Creating...'}
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-save"></i> {editingVoucher ? 'Cập Nhật' : 'Tạo Mới'}
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
