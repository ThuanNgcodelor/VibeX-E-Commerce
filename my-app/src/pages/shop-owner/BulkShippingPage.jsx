import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getShopOwnerOrders, updateOrderStatusForShopOwner } from '../../api/order';
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
            CONFIRMED: 'Confirmed',
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
            PENDING: 'CONFIRMED',
            CONFIRMED: 'SHIPPED',
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
                        <button className="btn btn-primary-shop">
                            <i className="fas fa-download"></i> {t('shopOwner.manageOrder.exportExcel')}
                        </button>
                        <button className="btn btn-success">
                            <i className="fas fa-truck"></i> {t('shopOwner.manageOrder.createBulkLabels')}
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
                                    const total = subtotal + shippingFee;
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
                                                    <td colSpan="10" style={{ padding: '20px', background: '#f8f9fa' }}>
                                                        <div className="order-details">
                                                            <h5 className="mb-3">
                                                                <i className="fas fa-info-circle text-primary"></i> {t('shopOwner.manageOrder.orderDetails')} - {order.id}
                                                            </h5>

                                                            <div className="row mb-3">
                                                                <div className="col-md-6">
                                                                    <div className="info-box">
                                                                        <label><i className="fas fa-user"></i> {t('shopOwner.manageOrder.customer')}:</label>
                                                                        <div>{usernames[order.userId] || order.userId || 'N/A'}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="col-md-6">
                                                                    <div className="info-box">
                                                                        <label><i className="fas fa-phone"></i> {t('shopOwner.manageOrder.phone')}:</label>
                                                                        <div>{order.recipientPhone || 'N/A'}</div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="row mb-3">
                                                                <div className="col-md-12">
                                                                    <div className="info-box">
                                                                        <label><i className="fas fa-map-marker-alt"></i> {t('shopOwner.manageOrder.address')}:</label>
                                                                        <div>{order.fullAddress || order.shippingAddress || 'N/A'}</div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="item-details mt-3">
                                                                <h6 className="mb-3">
                                                                    <i className="fas fa-box-open"></i> {t('shopOwner.manageOrder.productsInOrder')}
                                                                </h6>
                                                                <div className="table-responsive">
                                                                    <table className="table table-sm table-bordered">
                                                                        <thead className="table-light">
                                                                            <tr>
                                                                                <th>#</th>
                                                                                <th>{t('shopOwner.analytics.product')}</th>
                                                                                <th>{t('shopOwner.product.form.quantity')}</th>
                                                                                <th>Size</th>
                                                                                <th>{t('shopOwner.product.form.price')}</th>
                                                                                <th>{t('shopOwner.manageOrder.subtotal')}</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {order.orderItems.map((item, itemIndex) => (
                                                                                <tr key={itemIndex}>
                                                                                    <td>{itemIndex + 1}</td>
                                                                                    <td>{item.productName || `Product ${item.productId}`}</td>
                                                                                    <td>{item.quantity || 1}</td>
                                                                                    <td>{item.sizeName || 'N/A'}</td>
                                                                                    <td>{formatPrice(item.price || item.unitPrice || 0)}</td>
                                                                                    <td><strong>{formatPrice((item.price || item.unitPrice || 0) * (item.quantity || 1))}</strong></td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>

                                                            <div className="row mt-3">
                                                                <div className="col-md-6 offset-md-6">
                                                                    <div className="price-summary">
                                                                        <div className="d-flex justify-content-between mb-2">
                                                                            <span>Subtotal:</span>
                                                                            <strong>{formatPrice(order.totalPrice)}</strong>
                                                                        </div>
                                                                        {order.shippingFee && order.shippingFee > 0 && (
                                                                            <div className="d-flex justify-content-between mb-2">
                                                                                <span>Shipping Fee (GHN):</span>
                                                                                <strong style={{ color: '#ee4d2d' }}>{formatPrice(order.shippingFee)}</strong>
                                                                            </div>
                                                                        )}
                                                                        <div className="d-flex justify-content-between pt-2 border-top total-amount">
                                                                            <strong>Total:</strong>
                                                                            <strong style={{ color: '#ee4d2d', fontSize: '18px' }}>
                                                                                {formatPrice((order.totalPrice || 0) + (order.shippingFee || 0))}
                                                                            </strong>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-3">
                                                                <button className="btn btn-primary">
                                                                    <i className="fas fa-print"></i> {t('shopOwner.manageOrder.printOrder')}
                                                                </button>
                                                                <button className="btn btn-success ms-2">
                                                                    <i className="fas fa-truck"></i> {t('shopOwner.manageOrder.createLabel')}
                                                                </button>
                                                                {nextStatus && (
                                                                    <button
                                                                        className="btn btn-outline-success ms-2"
                                                                        onClick={() => handleStatusUpdate(order.id, nextStatus)}
                                                                    >
                                                                        <i className="fas fa-check"></i> {t('shopOwner.manageOrder.updateStatus')}
                                                                    </button>
                                                                )}
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
                            Page {currentPage} / {totalPages}
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