import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getShopOwnerOrders, updateOrderStatusForShopOwner, getAllShopOwnerOrders, getShippingByOrderId, bulkUpdateOrderStatus, searchOrders, getAllOrderIds } from '../../api/order';
import { getUserById } from '../../api/user';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/config';
import '../../components/shop-owner/ShopOwnerLayout.css';

// GHN status to Vietnamese mapping
const GHN_STATUS_MAP = {
    'ready_to_pick': { title: 'Chờ lấy hàng', color: '#ff9800' },
    'picking': { title: 'Đang lấy hàng', color: '#ff9800' },
    'picked': { title: 'Đã lấy hàng', color: '#2196f3' },
    'storing': { title: 'Đã nhập kho', color: '#2196f3' },
    'transporting': { title: 'Đang vận chuyển', color: '#2196f3' },
    'sorting': { title: 'Đang phân loại', color: '#2196f3' },
    'delivering': { title: 'Đang giao hàng', color: '#4caf50' },
    'delivered': { title: 'Đã giao hàng', color: '#26aa99' },
    'delivery_fail': { title: 'Giao thất bại', color: '#f44336' },
    'waiting_to_return': { title: 'Chờ trả hàng', color: '#f44336' },
    'return': { title: 'Đang trả hàng', color: '#e91e63' },
    'returning': { title: 'Đang trả hàng', color: '#e91e63' },
    'returned': { title: 'Đã trả hàng', color: '#9c27b0' },
    'cancel': { title: 'Đã hủy', color: '#9e9e9e' }
};

// Format datetime helper
const formatTrackingTime = (ts) => {
    if (!ts) return '-';
    try {
        const date = new Date(ts);
        return date.toLocaleString('vi-VN', {
            hour: '2-digit', minute: '2-digit',
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    } catch {
        return '-';
    }
};

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
    const [shippingData, setShippingData] = useState({}); // Shipping data per order
    const [loadingShipping, setLoadingShipping] = useState({});
    const [showTrackingModal, setShowTrackingModal] = useState(null); // orderId for modal
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null); // null = not searching, [] = no results
    const [totalOrderCount, setTotalOrderCount] = useState(0); // Total orders matching filter

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
            // Use Kafka bulk API for async processing (high throughput)
            const response = await bulkUpdateOrderStatus(
                Array.from(selectedOrders),
                bulkStatus
            );

            // Show processing message (async - results come via notification)
            const message = response.message || `Đang xử lý ${response.accepted} đơn hàng...`;
            if (response.rejected > 0) {
                alert(`${message}\n${response.rejected} đơn bị từ chối.`);
            } else {
                alert(message);
            }

            setSelectedOrders(new Set());
            setBulkStatus('');

            // Reload after short delay (processing is async)
            setTimeout(() => loadOrders(), 2000);
        } catch (err) {
            console.error('Error updating bulk order status:', err);
            alert(err.message || 'Failed to update orders');
            loadOrders();
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

    // Select all orders across all pages
    const handleSelectAllAcrossPages = async () => {
        try {
            const filterValue = statusFilter && statusFilter.trim() !== '' ? [statusFilter] : null;
            const allOrderIds = await getAllOrderIds(filterValue);
            setSelectedOrders(new Set(allOrderIds));
            setTotalOrderCount(allOrderIds.length);
            alert(`Đã chọn ${allOrderIds.length} đơn hàng`);
        } catch (err) {
            console.error('Error selecting all orders:', err);
            alert('Không thể chọn tất cả đơn hàng');
        }
    };

    // Search orders
    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }
        try {
            const results = await searchOrders(searchQuery.trim());
            setSearchResults(results);
        } catch (err) {
            console.error('Search error:', err);
            setSearchResults([]);
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults(null);
    };

    const STATUS_NUMERIC_MAP = {
        0: 'PENDING',
        1: 'CONFIRMED',
        2: 'READY_TO_SHIP',
        3: 'SHIPPED',
        4: 'DELIVERED',
        5: 'COMPLETED',
        6: 'CANCELLED',
        7: 'RETURNED'
    };

    const normalizeStatus = (status) => {
        if (status === null || status === undefined) return '';
        if (typeof status === 'number') return STATUS_NUMERIC_MAP[status] || String(status);
        return String(status).toUpperCase();
    };

    const getStatusBadge = (status) => {
        const normalizedStatus = normalizeStatus(status);
        const statusMap = {
            PENDING: { label: t('common.status.pending'), class: 'bg-warning' },
            CONFIRMED: { label: t('common.status.confirmed'), class: 'bg-info' },
            READY_TO_SHIP: { label: t('common.status.readyToShip') || 'Sẵn sàng giao', class: 'bg-primary' },
            SHIPPED: { label: t('common.status.shipped'), class: 'bg-success' },
            DELIVERED: { label: t('common.status.delivered'), class: 'bg-success' },
            COMPLETED: { label: t('common.status.completed'), class: 'bg-success' },
            CANCELLED: { label: t('common.status.cancelled'), class: 'bg-danger' },
            RETURNED: { label: t('common.status.returned'), class: 'bg-secondary' }
        };

        return statusMap[normalizedStatus] || { label: status || 'N/A', class: 'bg-secondary' };
    };

    const getStatusLabel = (status) => {
        const normalized = normalizeStatus(status);
        const statusMap = {
            PENDING: 'Chờ xác nhận',
            CONFIRMED: 'Đã xác nhận',
            READY_TO_SHIP: 'Sẵn sàng giao',
            SHIPPED: 'Đang giao',
            DELIVERED: 'Đã giao',
            COMPLETED: 'Hoàn thành',
            CANCELLED: 'Đã hủy',
            RETURNED: 'Đã hoàn'
        };
        return statusMap[normalized] || normalized || 'N/A';
    };

    const getNextStatus = (currentStatus) => {
        const cur = normalizeStatus(currentStatus);
        // New flow: PENDING → CONFIRMED → READY_TO_SHIP (shipper picks up → SHIPPED auto)
        const statusFlow = {
            PENDING: 'CONFIRMED',
            CONFIRMED: 'READY_TO_SHIP'
        };
        return statusFlow[cur];
    };

    // Print order function  
    const handlePrintOrder = (order) => {
        const shipping = shippingData[order.id];
        const subtotal = order.orderItems?.reduce((sum, item) => sum + (item.unitPrice || item.price || 0) * (item.quantity || 1), 0) || order.totalPrice;
        const shippingFee = order.shippingFee || 0;
        const total = order.totalPrice || (subtotal + shippingFee);

        const printContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${t('shopOwner.manageOrder.printOrder')} - ${order.id}</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 18px; }
        .section { margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; }
        .section-title { font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .items-table th { background-color: #f5f5f5; }
        .total-row { font-weight: bold; font-size: 14px; }
        .barcode { font-family: monospace; font-size: 16px; letter-spacing: 2px; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>${t('shopOwner.manageOrder.printOrder')}</h1>
        <p>${t('shopOwner.manageOrder.orderDate')}: ${new Date(order.creationTimestamp).toLocaleString()}</p>
    </div>
    
    <div class="section">
        <div class="section-title">${t('shopOwner.manageOrder.deliveryInfo')}</div>
        <div class="row"><span>${t('shopOwner.manageOrder.recipient')}:</span><strong>${order.recipientName || 'N/A'}</strong></div>
        <div class="row"><span>${t('shopOwner.manageOrder.phone')}:</span><strong>${order.recipientPhone || 'N/A'}</strong></div>
        <div class="row"><span>${t('shopOwner.manageOrder.address')}:</span><span>${order.fullAddress || 'N/A'}</span></div>
        ${shipping?.ghnOrderCode ? `<div class="row"><span>${t('shopOwner.manageOrder.ghnOrderCode')}:</span><span class="barcode">${shipping.ghnOrderCode}</span></div>` : ''}
    </div>

    <div class="section">
        <div class="section-title">${t('shopOwner.manageOrder.productsInOrder')}</div>
        <table class="items-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>${t('shopOwner.analytics.product')}</th>
                    <th>${t('shopOwner.product.form.sizeName')}</th>
                    <th>${t('shopOwner.product.form.quantity')}</th>
                    <th>${t('shopOwner.product.form.price')}</th>
                </tr>
            </thead>
            <tbody>
                ${order.orderItems?.map((item, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${item.productName || item.productId}</td>
                        <td>${item.sizeName || 'N/A'}</td>
                        <td>${item.quantity}</td>
                        <td>${formatPrice((item.price || item.unitPrice) * item.quantity)}</td>
                    </tr>
                `).join('') || ''}
            </tbody>
        </table>
    </div>

    <div class="section">
        <div class="section-title">${t('shopOwner.manageOrder.paymentInfo')}</div>
        <div class="row"><span>${t('shopOwner.manageOrder.subtotal')}:</span><span>${formatPrice(subtotal)}</span></div>
        <div class="row"><span>${t('shopOwner.manageOrder.shippingFee')}:</span><span>${formatPrice(shippingFee)}</span></div>
        <div class="row total-row"><span>${t('shopOwner.manageOrder.total')}:</span><span style="color: #ee4d2d;">${formatPrice(total)}</span></div>
    </div>

    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
        }
    };

    // Load shipping data for an order
    const loadShippingData = async (orderId) => {
        if (shippingData[orderId] || loadingShipping[orderId]) return;

        setLoadingShipping(prev => ({ ...prev, [orderId]: true }));
        try {
            const shipping = await getShippingByOrderId(orderId);
            setShippingData(prev => ({ ...prev, [orderId]: shipping }));
        } catch (err) {
            console.error('Failed to load shipping data:', err);
        } finally {
            setLoadingShipping(prev => ({ ...prev, [orderId]: false }));
        }
    };

    const toggleRowExpansion = (orderId) => {
        if (expandedRow === orderId) {
            setExpandedRow(null);
        } else {
            setExpandedRow(orderId);
            loadShippingData(orderId); // Auto-load shipping when expanding
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
                        {/* Search Box */}
                        <div style={{ display: 'flex', gap: '5px' }}>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Tìm theo mã đơn..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                style={{ width: '180px' }}
                            />
                            <button className="btn btn-outline-secondary" onClick={handleSearch}>
                                <i className="fas fa-search"></i>
                            </button>
                            {searchResults !== null && (
                                <button className="btn btn-outline-secondary" onClick={clearSearch}>
                                    <i className="fas fa-times"></i>
                                </button>
                            )}
                        </div>
                        <div className="search-filter">
                            <select
                                className="form-select"
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setCurrentPage(1);
                                    setSearchResults(null);
                                }}
                                style={{ width: '180px' }}
                            >
                                <option value="">{t('shopOwner.manageOrder.allStatus')}</option>
                                <option value="PENDING">{t('common.status.pending')}</option>
                                <option value="CONFIRMED">{t('common.status.confirmed')}</option>
                                <option value="READY_TO_SHIP">Sẵn sàng giao</option>
                                <option value="SHIPPED">{t('common.status.shipped')}</option>
                                <option value="DELIVERED">{t('common.status.delivered')}</option>
                                <option value="COMPLETED">{t('common.status.completed')}</option>
                                <option value="CANCELLED">{t('common.status.cancelled')}</option>
                                <option value="RETURNED">{t('common.status.returned')}</option>
                            </select>
                        </div>
                        {/* Select All Across Pages Button */}
                        <button
                            className="btn btn-outline-primary"
                            onClick={handleSelectAllAcrossPages}
                            title="Chọn tất cả đơn hàng"
                        >
                            <i className="fas fa-check-double"></i> Chọn tất cả
                        </button>
                        {selectedOrders.size > 0 && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span className="badge bg-secondary">{selectedOrders.size} đã chọn</span>
                                <select
                                    className="form-select"
                                    value={bulkStatus}
                                    onChange={(e) => setBulkStatus(e.target.value)}
                                    style={{ width: '170px' }}
                                >
                                    <option value="">{t('shopOwner.manageOrder.selectStatus')}</option>
                                    <option value="CONFIRMED">{t('common.status.confirmed')}</option>
                                    <option value="READY_TO_SHIP">Sẵn sàng giao</option>
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
                            {/* Search Results Info */}
                            {searchResults !== null && (
                                <tr>
                                    <td colSpan="10" className="bg-info bg-opacity-10 py-2 px-3">
                                        <i className="fas fa-search me-2"></i>
                                        Tìm thấy <strong>{searchResults.length}</strong> đơn hàng với từ khóa "{searchQuery}"
                                        <button className="btn btn-link btn-sm" onClick={clearSearch}>Xóa tìm kiếm</button>
                                    </td>
                                </tr>
                            )}
                            {(searchResults || orders).length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="text-center py-4">
                                        <p className="text-muted">{searchResults !== null ? 'Không tìm thấy đơn hàng' : t('shopOwner.manageOrder.noOrders')}</p>
                                    </td>
                                </tr>
                            ) : (
                                (searchResults || orders).map((order, index) => {
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

                                                                {/* Tracking Section */}
                                                                <div className="mb-4">
                                                                    <h6 className="text-muted text-uppercase small fw-bold mb-3">
                                                                        <i className="fas fa-shipping-fast me-2"></i>{t('shopOwner.manageOrder.trackingShipping')}
                                                                    </h6>
                                                                    {loadingShipping[order.id] ? (
                                                                        <div className="text-center py-3">
                                                                            <i className="fas fa-spinner fa-spin me-2"></i>{t('common.loading')}
                                                                        </div>
                                                                    ) : shippingData[order.id] ? (
                                                                        <div className="border rounded p-3 bg-light">
                                                                            {/* GHN Order Code */}
                                                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                                                <span className="text-muted small">{t('shopOwner.manageOrder.ghnOrderCode')}:</span>
                                                                                <span className="fw-bold text-primary">{shippingData[order.id].ghnOrderCode || 'N/A'}</span>
                                                                            </div>

                                                                            {/* Current Status */}
                                                                            {shippingData[order.id].status && (
                                                                                <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                                                                                    <span className="text-muted small">{t('shopOwner.manageOrder.currentStatus')}:</span>
                                                                                    <span
                                                                                        className="badge"
                                                                                        style={{
                                                                                            backgroundColor: GHN_STATUS_MAP[shippingData[order.id].status?.toLowerCase()]?.color || '#555',
                                                                                            color: 'white'
                                                                                        }}
                                                                                    >
                                                                                        {GHN_STATUS_MAP[shippingData[order.id].status?.toLowerCase()]?.title || shippingData[order.id].status}
                                                                                    </span>
                                                                                </div>
                                                                            )}

                                                                            {/* Tracking Timeline */}
                                                                            {shippingData[order.id].trackingHistory ? (() => {
                                                                                try {
                                                                                    const history = typeof shippingData[order.id].trackingHistory === 'string'
                                                                                        ? JSON.parse(shippingData[order.id].trackingHistory)
                                                                                        : shippingData[order.id].trackingHistory;

                                                                                    if (Array.isArray(history) && history.length > 0) {
                                                                                        const isVietnamese = i18n.language === 'vi';
                                                                                        return (
                                                                                            <div className="mt-3">
                                                                                                <div className="small fw-bold text-muted mb-2">{t('shopOwner.manageOrder.shippingHistory')}:</div>
                                                                                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                                                                                    {history.slice().reverse().map((entry, idx) => (
                                                                                                        <div key={idx} className="d-flex align-items-start mb-2" style={{ paddingLeft: '16px', borderLeft: idx === 0 ? '3px solid #26aa99' : '3px solid #e0e0e0' }}>
                                                                                                            <div>
                                                                                                                <div className={`small ${idx === 0 ? 'fw-bold text-success' : 'text-muted'}`}>
                                                                                                                    {formatTrackingTime(entry.ts)}
                                                                                                                </div>
                                                                                                                <div className={`${idx === 0 ? 'fw-bold' : ''}`}>
                                                                                                                    {isVietnamese ? (entry.titleVi || entry.title) : (entry.titleEn || entry.title)}
                                                                                                                </div>
                                                                                                                {(isVietnamese ? entry.descVi : entry.descEn) || entry.description ? (
                                                                                                                    <div className="small text-muted">
                                                                                                                        {isVietnamese ? (entry.descVi || entry.description) : (entry.descEn || entry.description)}
                                                                                                                    </div>
                                                                                                                ) : null}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    }
                                                                                    return <div className="text-muted small">{t('shopOwner.manageOrder.noShippingHistory')}</div>;
                                                                                } catch (e) {
                                                                                    return <div className="text-muted small">{t('shopOwner.manageOrder.cannotDisplayHistory')}</div>;
                                                                                }
                                                                            })() : (
                                                                                <div className="text-muted small">{t('shopOwner.manageOrder.noShippingHistory')}</div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-muted small">{t('shopOwner.manageOrder.noShippingInfo')}</div>
                                                                    )}
                                                                </div>

                                                                <div className="d-flex justify-content-end gap-2 pt-3 border-top">
                                                                    <button
                                                                        className="btn btn-light border text-muted"
                                                                        onClick={() => handlePrintOrder(order)}
                                                                    >
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