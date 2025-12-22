import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getShopOwnerOrders, updateOrderStatusForShopOwner, getAllShopOwnerOrders } from '../../api/order';
import { getUserById } from '../../api/user';
import { useTranslation } from 'react-i18next';
import '../../components/shop-owner/ShopOwnerLayout.css';

export default function BulkShippingPage() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize] = useState(10);
    const [usernames, setUsernames] = useState({});
    const [selectedOrders, setSelectedOrders] = useState(new Set());
    const [bulkStatus, setBulkStatus] = useState('');

    // Load orders
    useEffect(() => {
        loadOrders();
    }, [currentPage, statusFilter]);

    // Sync URL params with statusFilter on mount
    useEffect(() => {
        const statusFromUrl = searchParams.get('status');
        if (statusFromUrl) {
            setStatusFilter(statusFromUrl);
        }
    }, [searchParams]);

    // Auto-expand order if orderId is in URL
    useEffect(() => {
        const orderIdFromUrl = searchParams.get('orderId');
        if (orderIdFromUrl && orders.length > 0) {
            // Check if order exists in current orders list
            const orderExists = orders.some(order => order.id === orderIdFromUrl);
            if (orderExists && expandedRow !== orderIdFromUrl) {
                setExpandedRow(orderIdFromUrl);
                // Scroll to the order after a short delay to ensure it's rendered
                setTimeout(() => {
                    const element = document.querySelector(`[data-order-id="${orderIdFromUrl}"]`);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element.style.backgroundColor = '#fff3cd';
                        setTimeout(() => {
                            element.style.backgroundColor = '';
                        }, 2000);
                    }
                }, 300);
            }
        }
    }, [searchParams, orders, expandedRow]);

    const loadOrders = async () => {
        try {
            setLoading(true);
            setError(null);

            // Pass empty string instead of null if no filter
            const filterValue = statusFilter && statusFilter.trim() !== '' ? statusFilter : null;
            const response = await getShopOwnerOrders(filterValue, currentPage, pageSize);

            // Handle both paginated response and simple array
            let ordersList = [];
            if (response && response.content && Array.isArray(response.content)) {
                // Paginated response
                ordersList = response.content;
                setTotalPages(response.totalPages || 1);
            } else if (Array.isArray(response)) {
                // Simple array response
                ordersList = response;
                setTotalPages(1);
            } else if (response && response.data && Array.isArray(response.data)) {
                // Response wrapped in data property
                ordersList = response.data;
                setTotalPages(response.totalPages || 1);
            } else {
                ordersList = [];
                setTotalPages(1);
            }

            setOrders(ordersList);

            // Fetch user info (username) for all orders
            const userIds = [...new Set(ordersList.map(order => order.userId).filter(Boolean))];
            const usernameMap = {};

            await Promise.all(
                userIds.map(async (userId) => {
                    try {
                        const userData = await getUserById(userId);
                        usernameMap[userId] = userData.username || userData.email || `User ${userId}`;
                    } catch (err) {
                        console.error(`Error fetching user ${userId}:`, err);
                        usernameMap[userId] = `User ${userId}`;
                    }
                })
            );

            setUsernames(usernameMap);
        } catch (err) {
            console.error('Error loading orders:', err);
            setError('Failed to load orders list');
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (orderId, newStatus) => {
        if (!window.confirm(t('shopOwner.manageOrder.confirmUpdate', { status: getStatusLabel(newStatus) }))) {
            return;
        }

        try {
            await updateOrderStatusForShopOwner(orderId, newStatus);
            alert(t('shopOwner.manageOrder.successUpdate'));
            loadOrders(); // Reload orders
        } catch (err) {
            console.error('Error updating order status:', err);
            alert('Failed to update order status');
        }
    };

    const handleBulkStatusUpdate = async () => {
        if (selectedOrders.size === 0) {
            alert(t('shopOwner.manageOrder.selectOne'));
            return;
        }

        if (!bulkStatus) {
            alert(t('shopOwner.manageOrder.selectStatusAlert'));
            return;
        }

        if (!window.confirm(t('shopOwner.manageOrder.confirmBulkUpdate', { count: selectedOrders.size, status: getStatusLabel(bulkStatus) }))) {
            return;
        }

        try {
            const updatePromises = Array.from(selectedOrders).map(orderId =>
                updateOrderStatusForShopOwner(orderId, bulkStatus)
            );

            await Promise.all(updatePromises);
            alert(t('shopOwner.manageOrder.successBulkUpdate', { count: selectedOrders.size }));
            setSelectedOrders(new Set());
            setBulkStatus('');
            loadOrders(); // Reload orders
        } catch (err) {
            console.error('Error updating bulk order status:', err);
            alert('Failed to update some orders');
            loadOrders(); // Reload to refresh status
        }
    };

    const toggleOrderSelection = (orderId) => {
        const newSelected = new Set(selectedOrders);
        if (newSelected.has(orderId)) {
            newSelected.delete(orderId);
        } else {
            newSelected.add(orderId);
        }
        setSelectedOrders(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedOrders.size === orders.length) {
            setSelectedOrders(new Set());
        } else {
            setSelectedOrders(new Set(orders.map(o => o.id)));
        }
    };

    const STATUS_NUMERIC_MAP = {
        0: 'PENDING',
        1: 'PROCESSING',
        2: 'SHIPPED',
        3: 'DELIVERED',
        4: 'CANCELLED',
        5: 'COMPLETED',
        6: 'RETURNED'
    };

    const normalizeStatus = (status) => {
        if (status === null || status === undefined) return '';
        if (typeof status === 'number') return STATUS_NUMERIC_MAP[status] || String(status);
        return String(status).toUpperCase();
    };

    const getStatusBadge = (status) => {
        const normalizedStatus = normalizeStatus(status);
        const statusMap = {
            PENDING: { label: 'Pending', class: 'bg-warning' },
            PROCESSING: { label: 'Processing', class: 'bg-info' },
            SHIPPED: { label: 'Shipped', class: 'bg-success' },
            DELIVERED: { label: 'Delivered', class: 'bg-success' },
            CANCELLED: { label: 'Cancelled', class: 'bg-danger' },
            COMPLETED: { label: 'Completed', class: 'bg-success' }
        };

        return statusMap[normalizedStatus] || { label: status || 'N/A', class: 'bg-secondary' };
    };

    const getStatusLabel = (status) => {
        const normalized = normalizeStatus(status);
        const statusMap = {
            PENDING: 'Pending',
            PROCESSING: 'Processing',
            SHIPPED: 'Shipped',
            DELIVERED: 'Delivered',
            CANCELLED: 'Cancelled',
            COMPLETED: 'Completed'
        };
        return statusMap[normalized] || normalized || 'N/A';
    };

    const getNextStatus = (currentStatus) => {
        const cur = normalizeStatus(currentStatus);
        const statusFlow = {
            PENDING: 'PROCESSING',
            PROCESSING: 'SHIPPED',
            SHIPPED: 'DELIVERED'
        };
        return statusFlow[cur];
    };

    const toggleRowExpansion = (orderId) => {
        if (expandedRow === orderId) {
            setExpandedRow(null);
        } else {
            setExpandedRow(orderId);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch {
            return dateString;
        }
    };

    const formatPrice = (price) => {
        if (price == null) return '0 đ';
        return new Intl.NumberFormat('vi-VN').format(price) + ' đ';
    };

    // Reset to first page when filter changes
    useEffect(() => {
        setCurrentPage(1);
        setExpandedRow(null); // Close any expanded rows when filter changes
    }, [statusFilter]);

    const handleExportExcel = async () => {
        try {
            setLoading(true);
            // Fetch all orders matching current filter
            // Note: statusFilter might be empty string, which is falsy.
            const filter = statusFilter && statusFilter.trim() !== '' ? statusFilter : null;
            const allOrders = await getAllShopOwnerOrders(filter);

            if (!allOrders || allOrders.length === 0) {
                alert(t('shopOwner.manageOrder.noOrdersToExport', 'Không có đơn hàng để xuất'));
                setLoading(false);
                return;
            }

            // We need usernames for these orders, but fetching them all might be slow.
            // We will prioritize recipientName, then userId.

            // Define headers
            const headers = [
                "Order ID",
                "Customer Name",
                "Recipient Name",
                "Recipient Phone",
                "Address",
                "Subtotal",
                "Shipping Fee",
                "Voucher",
                "Total",
                "Date",
                "Status"
            ];

            // Helper to escape CSV fields
            const escapeCsv = (str) => {
                if (str === null || str === undefined) return '';
                return `"${String(str).replace(/"/g, '""')}"`;
            };

            const csvRows = [headers.join(',')];

            for (const order of allOrders) {
                const subtotal = order.orderItems ? order.orderItems.reduce((sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 1), 0) : order.totalPrice;
                const shipping = order.shippingFee || 0;
                const voucher = order.voucherDiscount || 0;
                const total = order.totalPrice || (subtotal + shipping - voucher);
                const date = new Date(order.creationTimestamp).toLocaleDateString('vi-VN');

                // Use cached username if available, else just userId or fetch?
                // For speed, let's use what we have or placeholder.
                const customerName = usernames[order.userId] || `User: ${order.userId}`;

                const row = [
                    escapeCsv(order.id),
                    escapeCsv(customerName),
                    escapeCsv(order.recipientName),
                    escapeCsv(order.recipientPhone),
                    escapeCsv(order.fullAddress || order.shippingAddress),
                    subtotal,
                    shipping,
                    voucher,
                    total,
                    escapeCsv(date),
                    escapeCsv(order.orderStatus)
                ];
                csvRows.push(row.join(','));
            }

            // BOM for Excel to read UTF-8 correctly
            const bom = '\uFEFF';
            const csvString = bom + csvRows.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (err) {
            console.error('Export failed:', err);
            alert(t('shopOwner.manageOrder.exportError', 'Xuất file thất bại: ') + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && orders.length === 0) {
        return (
            <div className="dashboard-container">
                <div className="dashboard-header">
                    <h1>{t('shopOwner.manageOrder.title')}</h1>
                </div>
                <div className="text-center py-5">
                    <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#ee4d2d' }}></i>
                    <p className="mt-3">{t('shopOwner.manageOrder.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1>{t('shopOwner.manageOrder.title')}</h1>
                <p className="text-muted">{t('shopOwner.manageOrder.subtitle')}</p>
            </div>

            {error && (
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            )}

            <div className="orders-table">
                <div className="table-header">
                    <div className="table-title">{t('shopOwner.manageOrder.tableTitle')}</div>
                    <div className="table-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="search-filter">
                            <select
                                className="form-select"
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                style={{ width: '200px' }}
                            >
                                <option value="">{t('shopOwner.manageOrder.allStatus')}</option>
                                <option value="PENDING">{t('common.status.pending')}</option>
                                <option value="PROCESSING">{t('common.status.processing')}</option>
                                <option value="SHIPPED">{t('common.status.shipped')}</option>
                                <option value="DELIVERED">{t('common.status.delivered')}</option>
                                <option value="CANCELLED">{t('common.status.cancelled')}</option>
                                <option value="COMPLETED">{t('common.status.completed')}</option>
                                <option value="RETURNED">{t('common.status.returned')}</option>
                            </select>
                        </div>
                        {selectedOrders.size > 0 && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <select
                                    className="form-select"
                                    value={bulkStatus}
                                    onChange={(e) => setBulkStatus(e.target.value)}
                                    style={{ width: '150px' }}
                                >
                                    <option value="">{t('shopOwner.manageOrder.selectStatus')}</option>
                                    <option value="PROCESSING">{t('common.status.processing')}</option>
                                    <option value="SHIPPED">{t('common.status.shipped')}</option>
                                    <option value="DELIVERED">{t('common.status.delivered')}</option>
                                    <option value="CANCELLED">{t('common.status.cancelled')}</option>
                                    <option value="RETURNED">{t('common.status.returned')}</option>
                                </select>
                                <button
                                    className="btn btn-primary-shop"
                                    onClick={handleBulkStatusUpdate}
                                    disabled={!bulkStatus}
                                >
                                    <i className="fas fa-check"></i> {t('shopOwner.manageOrder.updateSelected', { count: selectedOrders.size })}
                                </button>
                            </div>
                        )}
                        <button className="btn btn-secondary-shop" onClick={loadOrders}>
                            <i className="fas fa-sync-alt"></i> {t('shopOwner.manageOrder.refresh')}
                        </button>
                        <button className="btn btn-primary-shop" onClick={handleExportExcel}>
                            <i className="fas fa-download"></i> {t('shopOwner.manageOrder.exportExcel')}
                        </button>
                    </div>
                </div>

                <div className="table-responsive" style={{ overflowX: 'auto' }}>
                    <table className="table table-hover">
                        <thead>
                            <tr>
                                <th style={{ width: '4%' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedOrders.size === orders.length && orders.length > 0}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th style={{ width: '12%' }}>{t('shopOwner.manageOrder.customer')}</th>
                                <th style={{ width: '10%' }}>{t('shopOwner.manageOrder.phone')}</th>
                                <th style={{ width: '18%' }}>{t('shopOwner.manageOrder.address')}</th>
                                <th style={{ width: '9%' }}>{t('shopOwner.manageOrder.subtotal')}</th>
                                <th style={{ width: '9%' }}>{t('shopOwner.manageOrder.shipping')}</th>
                                <th style={{ width: '9%' }}>{t('shopOwner.manageOrder.total')}</th>
                                <th style={{ width: '9%' }}>{t('shopOwner.manageOrder.orderDate')}</th>
                                <th style={{ width: '9%' }}>{t('common.status.title')}</th>
                                <th style={{ width: '11%' }}>{t('shopOwner.manageOrder.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="text-center py-4">
                                        <td colSpan="10" className="text-center py-4">
                                            <p className="text-muted">{t('shopOwner.manageOrder.noOrders')}</p>
                                        </td>
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order, index) => {
                                    const statusInfo = getStatusBadge(order.orderStatus);
                                    const nextStatus = getNextStatus(order.orderStatus);
                                    const isExpanded = expandedRow === order.id;
                                    const isSelected = selectedOrders.has(order.id);
                                    const orderNumber = (currentPage - 1) * pageSize + index + 1;

                                    // Calculate subtotal from items
                                    const calculateSubtotal = (order) => {
                                        if (order.orderItems && order.orderItems.length > 0) {
                                            return order.orderItems.reduce((sum, item) => sum + (item.unitPrice || item.price || 0) * (item.quantity || 1), 0);
                                        }
                                        return order.totalPrice; // Fallback if no items
                                    };
                                    const subtotal = calculateSubtotal(order);
                                    const shippingFee = order.shippingFee || 0;
                                    const voucherDiscount = order.voucherDiscount || 0;
                                    const total = order.totalPrice || (subtotal + shippingFee - voucherDiscount);
                                    return (
                                        <React.Fragment key={order.id}>
                                            <tr data-order-id={order.id}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleOrderSelection(order.id)}
                                                    />
                                                </td>
                                                <td>{usernames[order.userId] || order.userId || 'N/A'}</td>
                                                <td>{order.recipientPhone || 'N/A'}</td>
                                                <td className="text-truncate" style={{ maxWidth: '200px' }} title={order.fullAddress || order.shippingAddress || 'N/A'}>
                                                    {order.fullAddress || order.shippingAddress || 'N/A'}
                                                </td>
                                                <td>
                                                    <strong style={{ color: '#555' }}>
                                                        {formatPrice(subtotal)}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <span style={{ color: '#666', fontSize: '0.9rem' }}>
                                                        {formatPrice(shippingFee)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <strong style={{ color: '#ee4d2d' }}>
                                                        {formatPrice(total)}
                                                    </strong>
                                                </td>
                                                <td>{formatDate(order.creationTimestamp)}</td>
                                                <td>
                                                    <span className={`badge ${statusInfo.class}`}>
                                                        {statusInfo.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        <button
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() => toggleRowExpansion(order.id)}
                                                            title="View details"
                                                        >
                                                            <i className={`fas ${isExpanded ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                        </button>
                                                        {nextStatus && (
                                                            <button
                                                                className="btn btn-sm btn-outline-success"
                                                                onClick={() => handleStatusUpdate(order.id, nextStatus)}
                                                                title={`Update to ${getStatusLabel(nextStatus)}`}
                                                            >
                                                                <i className="fas fa-check"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && order.orderItems && order.orderItems.length > 0 && (
                                                <tr>
                                                    <td colSpan="10" className="p-0 border-bottom">
                                                        <div className="bg-light p-4">
                                                            <div className="bg-white rounded shadow-sm p-4 border" style={{ borderLeft: '4px solid #ee4d2d' }}>
                                                                <div className="d-flex justify-content-between align-items-start mb-4 border-bottom pb-3">
                                                                    <div>
                                                                        <h5 className="fw-bold text-dark mb-1">
                                                                            {t('shopOwner.manageOrder.orderDetails')} #{order.id.substring(0, 8)}...
                                                                        </h5>
                                                                        <span className="text-muted small">
                                                                            {t('common.status.title')}: <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-end">
                                                                        <div className="text-muted small mb-1">{t('shopOwner.manageOrder.orderDate')}</div>
                                                                        <div className="fw-bold text-dark">{formatDate(order.creationTimestamp)}</div>
                                                                    </div>
                                                                </div>

                                                                <div className="row g-4 mb-4">
                                                                    <div className="col-md-4">
                                                                        <div className="p-3 bg-light rounded h-100">
                                                                            <h6 className="text-muted text-uppercase small fw-bold mb-3 border-bottom pb-2">
                                                                                <i className="fas fa-user mb-1 me-2"></i>{t('shopOwner.manageOrder.customer')}
                                                                            </h6>
                                                                            <div className="fw-bold text-dark mb-1">{usernames[order.userId] || 'N/A'}</div>
                                                                            <div className="text-muted small">{t('shopOwner.manageOrder.customer')} ID: {order.userId}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-md-4">
                                                                        <div className="p-3 bg-light rounded h-100">
                                                                            <h6 className="text-muted text-uppercase small fw-bold mb-3 border-bottom pb-2">
                                                                                <i className="fas fa-truck mb-1 me-2"></i>{t('shopOwner.manageOrder.deliveryInfo')}
                                                                            </h6>
                                                                            <div className="mb-2">
                                                                                <span className="text-muted small d-block">{t('shopOwner.manageOrder.recipient')}:</span>
                                                                                <span className="fw-medium text-dark">{order.recipientName || usernames[order.userId] || 'N/A'}</span>
                                                                            </div>
                                                                            <div className="mb-2">
                                                                                <span className="text-muted small d-block">{t('shopOwner.manageOrder.phone')}:</span>
                                                                                <span className="fw-medium text-dark">{order.recipientPhone || 'N/A'}</span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-muted small d-block">{t('shopOwner.manageOrder.address')}:</span>
                                                                                <span className="fw-medium text-dark" style={{ lineHeight: '1.4' }}>
                                                                                    {order.fullAddress || order.shippingAddress || 'N/A'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="col-md-4">
                                                                        <div className="p-3 bg-light rounded h-100">
                                                                            <h6 className="text-muted text-uppercase small fw-bold mb-3 border-bottom pb-2">
                                                                                <i className="fas fa-receipt mb-1 me-2"></i>{t('shopOwner.manageOrder.paymentInfo')}
                                                                            </h6>
                                                                            <div className="d-flex justify-content-between mb-2">
                                                                                <span className="text-muted small">{t('shopOwner.manageOrder.subtotal')}:</span>
                                                                                <span className="fw-medium">{formatPrice(subtotal)}</span>
                                                                            </div>
                                                                            <div className="d-flex justify-content-between mb-2">
                                                                                <span className="text-muted small">{t('shopOwner.manageOrder.shippingFee')}:</span>
                                                                                <span className="fw-medium">{formatPrice(shippingFee)}</span>
                                                                            </div>
                                                                            {voucherDiscount > 0 && (
                                                                                <div className="d-flex justify-content-between mb-2">
                                                                                    <span className="text-muted small">{t('shopOwner.manageOrder.voucher')}:</span>
                                                                                    <span className="fw-medium text-success">-{formatPrice(voucherDiscount)}</span>
                                                                                </div>
                                                                            )}
                                                                            <div className="d-flex justify-content-between pt-2 border-top mt-2">
                                                                                <span className="fw-bold text-dark">{t('shopOwner.manageOrder.total')}:</span>
                                                                                <span className="fw-bold fs-5" style={{ color: '#ee4d2d' }}>
                                                                                    {formatPrice(total)}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="mb-4">
                                                                    <h6 className="text-muted text-uppercase small fw-bold mb-3">
                                                                        <i className="fas fa-box-open me-2"></i>{t('shopOwner.manageOrder.productsInOrder')}
                                                                    </h6>
                                                                    <div className="table-responsive border rounded">
                                                                        <table className="table table-hover mb-0 align-middle">
                                                                            <thead className="bg-light">
                                                                                <tr>
                                                                                    <th className="ps-3 py-3 border-0" style={{ width: '50px' }}>#</th>
                                                                                    <th className="py-3 border-0">{t('shopOwner.analytics.product')}</th>
                                                                                    <th className="py-3 border-0 text-center">{t('shopOwner.product.form.quantity')}</th>
                                                                                    <th className="py-3 border-0 text-center">{t('shopOwner.product.form.sizeName')}</th>
                                                                                    <th className="py-3 border-0 text-end">{t('shopOwner.product.form.price')}</th>
                                                                                    <th className="pe-3 py-3 border-0 text-end">{t('shopOwner.manageOrder.subtotal')}</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {order.orderItems.map((item, itemIndex) => (
                                                                                    <tr key={itemIndex}>
                                                                                        <td className="ps-3 text-muted small">{itemIndex + 1}</td>
                                                                                        <td>
                                                                                            <div className="d-flex align-items-center">
                                                                                                <div className="bg-light rounded d-flex align-items-center justify-content-center me-3" style={{ width: '40px', height: '40px' }}>
                                                                                                    <i className="fas fa-image text-secondary opacity-50"></i>
                                                                                                </div>
                                                                                                <div>
                                                                                                    <div className="fw-medium text-dark">{item.productName || `Product ${item.productId}`}</div>
                                                                                                    <small className="text-muted">{t('shopOwner.manageOrder.id')}: {item.productId}</small>
                                                                                                </div>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="text-center">{item.quantity}</td>
                                                                                        <td className="text-center"><span className="badge bg-light text-dark border">{item.sizeName || 'N/A'}</span></td>
                                                                                        <td className="text-end text-muted">{formatPrice(item.price || item.unitPrice || 0)}</td>
                                                                                        <td className="pe-3 text-end fw-medium">{formatPrice((item.price || item.unitPrice || 0) * (item.quantity))}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>

                                                                <div className="d-flex justify-content-end gap-2 pt-3 border-top">
                                                                    <button className="btn btn-light border text-muted">
                                                                        <i className="fas fa-print me-2"></i>{t('shopOwner.manageOrder.printOrder')}
                                                                    </button>
                                                                    {nextStatus && (
                                                                        <button
                                                                            className="btn btn-primary-shop text-white"
                                                                            onClick={() => handleStatusUpdate(order.id, nextStatus)}
                                                                        >
                                                                            {t('shopOwner.manageOrder.updateStatus')} <i className="fas fa-arrow-right ms-2"></i>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination-container">
                        <div className="pagination-info">
                            {t('shopOwner.returnOrder.pageInfo', { current: currentPage, total: totalPages })}
                        </div>
                        <nav aria-label="Page navigation">
                            <ul className="pagination">
                                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                    <button
                                        className="page-link"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <i className="fas fa-chevron-left"></i>
                                    </button>
                                </li>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                                        <button
                                            className="page-link"
                                            onClick={() => setCurrentPage(page)}
                                        >
                                            {page}
                                        </button>
                                    </li>
                                ))}
                                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                    <button
                                        className="page-link"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                    >
                                        <i className="fas fa-chevron-right"></i>
                                    </button>
                                </li>
                            </ul>
                        </nav>
                    </div>
                )}
            </div>
        </div>
    );
}