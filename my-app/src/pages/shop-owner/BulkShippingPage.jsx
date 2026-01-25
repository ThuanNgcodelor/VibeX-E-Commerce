import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { useSearchParams } from 'react-router-dom';
import { getShopOwnerOrders, updateOrderStatusForShopOwner, getAllShopOwnerOrders, getShippingByOrderId, bulkUpdateOrderStatus, searchOrders, getAllOrderIds, getShopOwnerOrderById } from '../../api/order';
import { getUserById } from '../../api/user';
import { fetchImageById } from '../../api/image';
import { fetchProductById } from '../../api/product';
import { getImageUrl } from '../../api/image';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/config';
import '../../components/shop-owner/ShopOwnerLayout.css';

// GHN status to Vietnamese mapping
const GHN_STATUS_MAP = {
    'ready_to_pick': { titleKey: 'shopOwner.manageOrder.ghnStatus.ready_to_pick', color: '#ff9800' },
    'picking': { titleKey: 'shopOwner.manageOrder.ghnStatus.picking', color: '#ff9800' },
    'picked': { titleKey: 'shopOwner.manageOrder.ghnStatus.picked', color: '#2196f3' },
    'storing': { titleKey: 'shopOwner.manageOrder.ghnStatus.storing', color: '#2196f3' },
    'transporting': { titleKey: 'shopOwner.manageOrder.ghnStatus.transporting', color: '#2196f3' },
    'sorting': { titleKey: 'shopOwner.manageOrder.ghnStatus.sorting', color: '#2196f3' },
    'delivering': { titleKey: 'shopOwner.manageOrder.ghnStatus.delivering', color: '#4caf50' },
    'delivered': { titleKey: 'shopOwner.manageOrder.ghnStatus.delivered', color: '#4caf50' },
    'delivery_fail': { titleKey: 'shopOwner.manageOrder.ghnStatus.delivery_fail', color: '#f44336' },
    'waiting_to_return': { titleKey: 'shopOwner.manageOrder.ghnStatus.waiting_to_return', color: '#ff9800' },
    'return': { titleKey: 'shopOwner.manageOrder.ghnStatus.return', color: '#ff9800' },
    'returning': { titleKey: 'shopOwner.manageOrder.ghnStatus.returning', color: '#ff9800' },
    'returned': { titleKey: 'shopOwner.manageOrder.ghnStatus.returned', color: '#9e9e9e' },
    'cancel': { titleKey: 'shopOwner.manageOrder.ghnStatus.cancel', color: '#f44336' }
};

// Status Tab Groups for organized UI
const STATUS_TAB_GROUPS = {
    processing: {
        label: 'shopOwner.manageOrder.tabGroups.processing',
        icon: 'fas fa-clock',
        statuses: ['PENDING', 'CONFIRMED']
    },
    shipping: {
        label: 'shopOwner.manageOrder.tabGroups.shipping',
        icon: 'fas fa-truck',
        statuses: ['READY_TO_SHIP', 'SHIPPED']
    },
    completed: {
        label: 'shopOwner.manageOrder.tabGroups.completed',
        icon: 'fas fa-check-circle',
        statuses: ['DELIVERED', 'COMPLETED']
    },
    issues: {
        label: 'shopOwner.manageOrder.tabGroups.issues',
        icon: 'fas fa-exclamation-triangle',
        statuses: ['CANCELLED', 'RETURNED']
    }
};

// GHN sub-statuses for SHIPPED orders - helps filter problematic orders
const GHN_SHIPPED_SUB_STATUSES = {
    all: { label: 'shopOwner.manageOrder.ghnSubFilter.all', icon: 'fas fa-list' },
    in_transit: {
        label: 'shopOwner.manageOrder.ghnSubFilter.inTransit',
        icon: 'fas fa-shipping-fast',
        statuses: ['PICKED', 'STORING', 'TRANSPORTING', 'SORTING', 'DELIVERING', 'MONEY_COLLECT_DELIVERING']
    },
    attention: {
        label: 'shopOwner.manageOrder.ghnSubFilter.attention',
        icon: 'fas fa-exclamation-circle',
        statuses: ['DELIVERY_FAIL', 'WAITING_TO_RETURN'],
        badgeClass: 'bg-danger'
    }
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

const formatDate = (ts) => {
    if (!ts) return 'N/A';
    try {
        const date = new Date(ts);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return 'N/A';
    }
};

export default function BulkShippingPage() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRow, setExpandedRow] = useState(null);
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'PENDING');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [pageSize] = useState(10);
    const [usernames, setUsernames] = useState({});
    const [selectedOrders, setSelectedOrders] = useState(new Set());
    const [bulkStatus, setBulkStatus] = useState('');
    const [ghnSubFilter, setGhnSubFilter] = useState('all'); // For filtering SHIPPED orders by GHN sub-status

    const [imageUrls, setImageUrls] = useState({});
    const [productDetails, setProductDetails] = useState({}); // Store fetched product info (name, size)

    useEffect(() => {
        if (orders.length === 0) return;

        let isActive = true;
        const urls = {};
        const details = {};
        const productCache = new Map();

        const loadImagesAndDetails = async () => {
            const promises = [];

            orders.forEach((order) => {
                (order.orderItems || []).forEach((item) => {
                    const itemKey = item.id || `${item.productId}-${item.sizeId}`;
                    let imageId = item.imageId || item.productImage;

                    // If name looks like ID (number or UUID) or is missing, we should try to fetch it
                    // Simple check: if it's purely numeric or looks like UUID
                    const needsNameDetails = !item.productName || /^\d+$/.test(item.productName);

                    if ((!imageId && item.productId) || needsNameDetails) {
                        promises.push(
                            (async () => {
                                try {
                                    let product = productCache.get(item.productId);
                                    if (!product) {
                                        const prodRes = await fetchProductById(item.productId);
                                        product = prodRes?.data;
                                        if (product) productCache.set(item.productId, product);
                                    }

                                    // Handle Image
                                    if (!imageId) {
                                        imageId = product?.imageId || null;
                                        if (imageId && !urls[imageId]) {
                                            try {
                                                const res = await fetchImageById(imageId);
                                                const blob = new Blob([res.data], {
                                                    type: res.headers["content-type"] || "image/jpeg",
                                                });
                                                const url = URL.createObjectURL(blob);
                                                urls[imageId] = url;
                                                urls[itemKey] = url;
                                            } catch {
                                                urls[imageId] = null;
                                                urls[itemKey] = null;
                                            }
                                        } else {
                                            urls[itemKey] = urls[imageId] || null;
                                        }
                                    }

                                    // Handle Details
                                    if (product) {
                                        // Find size name if we have sizeId
                                        let sizeName = null;
                                        if (item.sizeId && product.sizes) {
                                            const sizeObj = product.sizes.find(s => s.id === item.sizeId);
                                            if (sizeObj) sizeName = sizeObj.name;
                                        }

                                        details[itemKey] = {
                                            productName: product.name,
                                            sizeName: sizeName
                                        };
                                        details[item.productId] = { productName: product.name }; // fallback
                                    }
                                } catch (e) {
                                    console.error("Failed to load details for item", item.productId, e);
                                    urls[itemKey] = null;
                                }
                            })()
                        );
                    } else if (imageId && !urls[imageId]) {
                        // Just fetch image
                        promises.push(
                            fetchImageById(imageId)
                                .then((res) => {
                                    const blob = new Blob([res.data], {
                                        type: res.headers["content-type"] || "image/jpeg",
                                    });
                                    const url = URL.createObjectURL(blob);
                                    urls[imageId] = url;
                                    urls[itemKey] = url;
                                })
                                .catch(() => {
                                    urls[imageId] = null;
                                    urls[itemKey] = null;
                                })
                        );
                    } else if (imageId && urls[imageId]) {
                        urls[itemKey] = urls[imageId];
                    }
                });
            });

            await Promise.all(promises);

            if (isActive) {
                setImageUrls(prev => ({ ...prev, ...urls }));
                setProductDetails(prev => ({ ...prev, ...details }));
            }
        };

        loadImagesAndDetails();

        return () => {
            isActive = false;
            // Note: we don't revoke here aggressively to avoid flickering if re-rendering, 
            // but in a real app we should track created URLs to revoke on unmount.
            // For now, relying on browser cleanup or existing logic.
        };
    }, [orders]);
    const [shippingData, setShippingData] = useState({}); // Shipping data per order
    const [loadingShipping, setLoadingShipping] = useState({});
    const [showTrackingModal, setShowTrackingModal] = useState(null); // orderId for modal
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null); // null = not searching, [] = no results
    const [totalOrderCount, setTotalOrderCount] = useState(0); // Total orders matching filter

    // Helper: Check if order can be edited/selected
    const canEditOrder = (orderStatus) => {
        const normalizedStatus = normalizeStatus(orderStatus);
        // Orders that CANNOT be edited: DELIVERED, COMPLETED, CANCELLED, RETURNED
        const nonEditableStatuses = ['DELIVERED', 'COMPLETED', 'CANCELLED', 'RETURNED'];
        return !nonEditableStatuses.includes(normalizedStatus);
    };

    // Helper: Check if order can transition to a specific status
    const canTransitionTo = (currentStatus, targetStatus) => {
        const current = normalizeStatus(currentStatus);
        const target = normalizeStatus(targetStatus);

        // Allowed transitions:
        // PENDING → CONFIRMED, CANCELLED
        // CONFIRMED → READY_TO_SHIP, CANCELLED
        // READY_TO_SHIP → (auto SHIPPED by GHN)
        const allowedTransitions = {
            'PENDING': ['CONFIRMED', 'CANCELLED'],
            'CONFIRMED': ['READY_TO_SHIP', 'CANCELLED'],
            'READY_TO_SHIP': [], // Cannot manually change, will be SHIPPED by GHN
            'SHIPPED': [], // GHN controls
            'DELIVERED': [],
            'COMPLETED': [],
            'CANCELLED': [],
            'RETURNED': []
        };

        return allowedTransitions[current]?.includes(target) || false;
    };

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

    // Auto-expand order if orderId is in URL AND handle deep linking
    useEffect(() => {
        const orderIdFromUrl = searchParams.get('orderId');

        const handleDeepLink = async () => {
            if (orderIdFromUrl) {
                // If order is NOT in current list, we might need to switch tabs
                const orderExists = orders.some(order => order.id === orderIdFromUrl);

                if (!orderExists) {
                    try {
                        // Fetch order details to know its status
                        setLoading(true);
                        const orderDetail = await getShopOwnerOrderById(orderIdFromUrl);

                        if (orderDetail) {
                            // If status is different from current filter, switch filter
                            // Normalize statuses for comparison
                            const orderStatus = orderDetail.orderStatus || 'PENDING';
                            if (orderStatus !== statusFilter) {
                                console.log(`Deep link: Switching from ${statusFilter} to ${orderStatus} for order ${orderIdFromUrl}`);
                                setStatusFilter(orderStatus);
                                // The statusFilter change will trigger loadOrders
                                // We'll handle expansion in the next render cycle or separate effect
                            }
                        }
                    } catch (err) {
                        console.error("Failed to fetch order for deep link:", err);
                    } finally {
                        setLoading(false);
                    }
                }
            }
        };

        handleDeepLink();

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
                }, 500); // Increased delay slightly
            }
        }
    }, [searchParams, orders]); // Removed expandedRow from dep to prevent loop, logic handles it

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
        const result = await Swal.fire({
            title: t('shopOwner.manageOrder.confirmUpdateTitle'),
            text: t('shopOwner.manageOrder.confirmUpdate', { status: getStatusLabel(newStatus) }),
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: t('common.yes', 'Đồng ý'),
            cancelButtonText: t('common.no', 'Hủy')
        });

        if (!result.isConfirmed) {
            return;
        }

        try {
            await updateOrderStatusForShopOwner(orderId, newStatus);
            Swal.fire({
                icon: 'success',
                title: t('shopOwner.manageOrder.successUpdate'),
                showConfirmButton: false,
                timer: 1500
            });
            loadOrders(); // Reload orders
        } catch (err) {
            console.error('Error updating order status:', err);
            Swal.fire({
                icon: 'error',
                title: t('shopOwner.manageOrder.failedUpdate'),
                text: err.message
            });
        }
    };

    const handleBulkStatusUpdate = async () => {
        if (selectedOrders.size === 0) {
            Swal.fire({
                icon: 'warning',
                title: t('shopOwner.manageOrder.selectOne'),
                timer: 2000
            });
            return;
        }

        if (!bulkStatus) {
            Swal.fire({
                icon: 'warning',
                title: t('shopOwner.manageOrder.selectStatusAlert'),
                timer: 2000
            });
            return;
        }

        // Validate transitions for all selected orders
        const invalidOrders = [];
        for (const orderId of selectedOrders) {
            const order = orders.find(o => o.id === orderId);
            if (order && !canTransitionTo(order.orderStatus, bulkStatus)) {
                invalidOrders.push({
                    id: orderId,
                    current: getStatusLabel(order.orderStatus),
                    target: getStatusLabel(bulkStatus)
                });
            }
        }

        if (invalidOrders.length > 0) {
            Swal.fire({
                icon: 'error',
                title: t('shopOwner.manageOrder.cannotUpdate'),
                html: `<p>${t('shopOwner.manageOrder.cannotUpdateDesc', { target: getStatusLabel(bulkStatus) })}</p>
                       <ul style="text-align: left; max-height: 200px; overflow-y: auto;">
                         ${invalidOrders.slice(0, 5).map(o =>
                    `<li>${t('shopOwner.manageOrder.order', { id: o.id.substring(0, 8), current: o.current })}</li>`
                ).join('')}
                         ${invalidOrders.length > 5 ? `<li>${t('shopOwner.manageOrder.andMore', { count: invalidOrders.length - 5 })}</li>` : ''}
                       </ul>
                       <p class="mt-2 small text-muted">${t('shopOwner.manageOrder.suggestion')}</p>`
            });
            return;
        }

        const result = await Swal.fire({
            title: t('shopOwner.manageOrder.confirmBulkUpdateTitle'),
            text: t('shopOwner.manageOrder.confirmBulkUpdate', { count: selectedOrders.size, status: getStatusLabel(bulkStatus) }),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: t('common.yes', 'Đồng ý'),
            cancelButtonText: t('common.no', 'Hủy')
        });

        if (!result.isConfirmed) {
            return;
        }

        try {
            // Use Kafka bulk API for async processing (high throughput)
            const response = await bulkUpdateOrderStatus(
                Array.from(selectedOrders),
                bulkStatus
            );

            // Show processing message (async - results come via notification)
            const message = response.message || `Processing ${response.accepted} orders...`;

            if (response.rejected > 0) {
                Swal.fire({
                    icon: 'warning',
                    title: t('shopOwner.manageOrder.partialSuccess'),
                    text: `${message}\n${response.rejected} The application was rejected.` // Note: Backend response might be strict string?
                });
            } else {
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: message,
                    timer: 2000
                });
            }

            setSelectedOrders(new Set());
            setBulkStatus('');

            // Reload after short delay (processing is async)
            setTimeout(() => loadOrders(), 2000);
        } catch (err) {
            console.error('Error updating bulk order status:', err);
            Swal.fire({
                icon: 'error',
                title: 'Failed to update orders',
                text: err.message
            });
            loadOrders();
        }
    };

    const toggleOrderSelection = (orderId) => {
        // Find order to check if it's editable
        const order = orders.find(o => o.id === orderId);
        if (!order || !canEditOrder(order.orderStatus)) {
            // Show warning for non-editable orders
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000
            });
            Toast.fire({
                icon: 'warning',
                title: t('shopOwner.manageOrder.orderNotEditable')
            });
            return;
        }

        const newSelected = new Set(selectedOrders);
        if (newSelected.has(orderId)) {
            newSelected.delete(orderId);
        } else {
            newSelected.add(orderId);
        }
        setSelectedOrders(newSelected);
    };

    const toggleSelectAll = () => {
        const currentList = searchResults || orders;
        // Filter only editable orders on current page/view
        const editableOrders = currentList.filter(o => canEditOrder(o.orderStatus));
        const editableOrderIds = editableOrders.map(o => o.id);

        // Check if all editable orders on THIS page are already selected
        const allOnPageSelected = editableOrderIds.length > 0 && editableOrderIds.every(id => selectedOrders.has(id));

        const newSelected = new Set(selectedOrders);

        if (allOnPageSelected) {
            // Deselect all ON THIS PAGE/VIEW only
            editableOrderIds.forEach(id => newSelected.delete(id));
        } else {
            // Select all ON THIS PAGE/VIEW
            editableOrderIds.forEach(id => newSelected.add(id));

            // Show info if some orders were skipped
            const skippedCount = currentList.length - editableOrders.length;
            if (skippedCount > 0) {
                const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
                Toast.fire({
                    icon: 'info',
                    title: t('shopOwner.manageOrder.selectEditableInfo', { count: editableOrders.length, skipped: skippedCount })
                });
            }
        }
        setSelectedOrders(newSelected);
    };

    // Select all EDITABLE orders across all pages
    const handleSelectAllAcrossPages = async () => {
        try {
            // Get filter but EXCLUDE non-editable statuses
            let filterStatuses = [];

            if (statusFilter && statusFilter.trim() !== '') {
                // If user has filtered by a specific status, use it
                filterStatuses = [statusFilter];
            } else {
                // Otherwise, get only EDITABLE statuses
                filterStatuses = ['PENDING', 'CONFIRMED', 'READY_TO_SHIP', 'SHIPPED'];
            }

            // Make sure we don't include non-editable statuses
            const editableStatuses = filterStatuses.filter(status => {
                const normalizedStatus = normalizeStatus(status);
                return !['DELIVERED', 'COMPLETED', 'CANCELLED', 'RETURNED'].includes(normalizedStatus);
            });

            if (editableStatuses.length === 0) {
                Swal.fire({
                    icon: 'info',
                    title: t('shopOwner.manageOrder.noEditableOrders'),
                    text: t('shopOwner.manageOrder.allOrdersFiltered')
                });
                return;
            }

            const allOrderIds = await getAllOrderIds(editableStatuses);
            setSelectedOrders(new Set(allOrderIds));
            setTotalOrderCount(allOrderIds.length);

            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
            Toast.fire({
                icon: 'success',
                title: t('shopOwner.manageOrder.selectedAllEditable', { count: allOrderIds.length })
            });
        } catch (err) {
            console.error('Error selecting all orders:', err);
            Swal.fire({
                icon: 'error',
                title: t('common.error'),
                text: t('shopOwner.manageOrder.selectAllError')
            });
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
        const labelKey = `common.status.${normalized.toLowerCase()}`;
        return t(`common.status.${normalized.toLowerCase()}`, normalized);
    };

    const getNextStatus = (currentStatus) => {
        const cur = normalizeStatus(currentStatus);
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
        ${order.voucherDiscount > 0 ? `<div class="row"><span>Shop Voucher:</span><span>-${formatPrice(order.voucherDiscount)}</span></div>` : ''}
        ${order.platformVoucherDiscount > 0 ? `<div class="row"><span>Platform Voucher:</span><span>-${formatPrice(order.platformVoucherDiscount)}</span></div>` : ''}
        ${order.coinDiscount > 0 ? `<div class="row"><span>Coins:</span><span>-${formatPrice(order.coinDiscount)}</span></div>` : ''}
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
            return date.toLocaleString('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
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
                Swal.fire({
                    icon: 'info',
                    title: t('shopOwner.manageOrder.noOrdersToExport', 'Không có đơn hàng để xuất')
                });
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

                // Use cached username if available, else just userId or placeholder.
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
            console.error('Export failed:', err);
            Swal.fire({
                icon: 'error',
                title: 'Xuất file thất bại',
                text: err.message
            });
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
                                placeholder="Find by order code..."
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
                    </div>
                </div>

                {/* ===== GROUPED TAB BAR UI ===== */}
                <div className="status-tabs-container" style={{
                    background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                    {/* Tab Groups Navigation */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {Object.entries(STATUS_TAB_GROUPS).map(([groupKey, group]) => (
                            <div key={groupKey} className="tab-group" style={{
                                display: 'flex',
                                gap: '4px',
                                padding: '4px',
                                background: '#fff',
                                borderRadius: '8px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                            }}>
                                {/* Group Label */}
                                <span style={{
                                    padding: '6px 10px',
                                    fontSize: '12px',
                                    color: '#6c757d',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <i className={group.icon} style={{ fontSize: '12px' }}></i>
                                    <span>{t(group.label, groupKey)}</span>
                                </span>
                                {/* Status Tabs in Group */}
                                {group.statuses.map(status => (
                                    <button
                                        key={status}
                                        onClick={() => {
                                            setStatusFilter(status);
                                            setCurrentPage(1);
                                            setSearchResults(null);
                                            setGhnSubFilter('all'); // Reset sub-filter when switching tabs
                                        }}
                                        className={`status-tab-btn ${statusFilter === status ? 'active' : ''}`}
                                        style={{
                                            padding: '6px 14px',
                                            fontSize: '13px',
                                            fontWeight: statusFilter === status ? '600' : '400',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            background: statusFilter === status
                                                ? (groupKey === 'issues' ? '#dc3545' : '#ee4d2d')
                                                : 'transparent',
                                            color: statusFilter === status ? '#fff' : '#495057',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        {t(`common.status.${status.toLowerCase()}`, status)}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* GHN Sub-filter for SHIPPED tab */}
                    {statusFilter === 'SHIPPED' && (
                        <div className="ghn-sub-filter" style={{
                            display: 'flex',
                            gap: '8px',
                            padding: '10px 12px',
                            background: '#fff8f5',
                            borderRadius: '8px',
                            border: '1px solid #ffe4dd',
                            alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '13px', color: '#666', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <i className="fas fa-truck" style={{ fontSize: '12px' }}></i>
                                {t('shopOwner.manageOrder.ghnSubFilter.label', 'GHN Status')}:
                            </span>
                            {Object.entries(GHN_SHIPPED_SUB_STATUSES).map(([key, config]) => (
                                <button
                                    key={key}
                                    onClick={() => setGhnSubFilter(key)}
                                    className={`ghn-sub-btn ${ghnSubFilter === key ? 'active' : ''}`}
                                    style={{
                                        padding: '4px 12px',
                                        fontSize: '12px',
                                        fontWeight: ghnSubFilter === key ? '600' : '400',
                                        border: ghnSubFilter === key ? 'none' : '1px solid #ddd',
                                        borderRadius: '20px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        background: ghnSubFilter === key
                                            ? (key === 'attention' ? '#dc3545' : '#ee4d2d')
                                            : '#fff',
                                        color: ghnSubFilter === key ? '#fff' : '#495057',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <i className={config.icon} style={{ fontSize: '11px' }}></i>
                                    <span>{t(config.label, key)}</span>
                                    {key === 'attention' && (
                                        <span className="badge bg-warning text-dark" style={{
                                            fontSize: '10px',
                                            marginLeft: '4px',
                                            display: ghnSubFilter === key ? 'none' : 'inline'
                                        }}>!</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Action Buttons Row */}
                <div className="table-header" style={{ borderTop: 'none', paddingTop: 0, marginBottom: '10px' }}>
                    <div className="table-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-end' }}>
                        {/* Select All Across Pages Button */}
                        <button
                            className={`btn btn-outline-primary d-flex align-items-center gap-2 ${selectedOrders.size === orders.length && orders.length > 0 ? 'active' : ''}`}
                            onClick={handleSelectAllAcrossPages}
                            title={t('shopOwner.manageOrder.selectAllTitle')}
                        >
                            <i className="fas fa-check-double"></i> {t('common.selectAll')}
                        </button>
                        {selectedOrders.size > 0 && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span className="badge bg-secondary">{t('shopOwner.manageOrder.selectedCount', { count: selectedOrders.size })}</span>
                                <select
                                    className="form-select"
                                    value={bulkStatus}
                                    onChange={(e) => setBulkStatus(e.target.value)}
                                    style={{ width: '170px' }}
                                >
                                    <option value="">{t('shopOwner.manageOrder.selectStatus')}</option>

                                    {/* Smart content based on current filter */}
                                    {statusFilter === 'PENDING' && (
                                        <>
                                            <option value="CONFIRMED">{t('common.status.confirmed')}</option>
                                            <option value="CANCELLED">{t('common.status.cancelled')}</option>
                                        </>
                                    )}

                                    {statusFilter === 'CONFIRMED' && (
                                        <option value="READY_TO_SHIP">{t('common.status.readyToShip', 'Sẵn sàng giao')}</option>
                                    )}

                                    {/* Fallback or other statuses if needed, but per requirement we restrict flow */}
                                    {/* If user selects other tabs, bulk update might be disabled or limited */}
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
                                        checked={(() => {
                                            const currentList = searchResults || orders;
                                            const editableOnPage = currentList.filter(o => canEditOrder(o.orderStatus));
                                            return editableOnPage.length > 0 && editableOnPage.every(o => selectedOrders.has(o.id));
                                        })()}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th style={{ width: '12%' }}>{t('shopOwner.manageOrder.ghnOrderCode', 'GHN Code')}</th>
                                <th style={{ width: '12%' }}>{t('shopOwner.manageOrder.recipient')}</th>
                                <th style={{ width: '10%' }} className="text-end">{t('shopOwner.manageOrder.subtotal')}</th>
                                <th style={{ width: '10%' }} className="text-end">{t('shopOwner.manageOrder.shipping')}</th>
                                <th style={{ width: '10%' }} className="text-end">{t('shopOwner.manageOrder.total')}</th>
                                <th style={{ width: '12%' }} className="text-center">{t('shopOwner.manageOrder.orderDate')}</th>
                                <th style={{ width: '12%' }} className="text-center">{t('shopOwner.manageOrder.status', 'Status')}</th>
                                <th style={{ width: '10%' }} className="text-center">{t('shopOwner.manageOrder.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Search Results Info */}
                            {searchResults !== null && (
                                <tr>
                                    <td colSpan="10" className="bg-info bg-opacity-10 py-2 px-3">
                                        <i className="fas fa-search me-2"></i>
                                        <span dangerouslySetInnerHTML={{ __html: t('shopOwner.manageOrder.searchResults', { count: searchResults.length, query: searchQuery }) }} />
                                        <button className="btn btn-link btn-sm" onClick={clearSearch}>{t('shopOwner.manageOrder.clearSearch')}</button>
                                    </td>
                                </tr>
                            )}
                            {(searchResults || orders).length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="text-center py-4">
                                        <p className="text-muted">{searchResults !== null ? t('shopOwner.manageOrder.noSearchResults') : t('shopOwner.manageOrder.noOrders')}</p>
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
                                            <tr
                                                data-order-id={order.id}
                                                className={`align-middle ${!canEditOrder(order.orderStatus) ? 'table-light text-muted' : ''}`}
                                                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                            >
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleOrderSelection(order.id)}
                                                        disabled={!canEditOrder(order.orderStatus)}
                                                        title={!canEditOrder(order.orderStatus) ? t('shopOwner.manageOrder.orderNotEditable') : ''}
                                                    />
                                                </td>
                                                <td>
                                                    <span className="text-primary fw-bold" style={{ fontSize: '0.85rem' }}>
                                                        {shippingData[order.id]?.ghnOrderCode || order.ghnOrderCode || '-'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="fw-medium text-dark" style={{ fontSize: '0.85rem' }}>
                                                        {order.recipientName || t('common.unknown')}
                                                    </span>
                                                </td>

                                                <td className="text-end">
                                                    <strong style={{ color: '#555' }}>
                                                        {formatPrice(subtotal)}
                                                    </strong>
                                                </td>
                                                <td className="text-end">
                                                    <span style={{ color: '#666', fontSize: '0.9rem' }}>
                                                        {formatPrice(shippingFee)}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <strong style={{ color: '#ee4d2d' }}>
                                                        {formatPrice(total)}
                                                    </strong>
                                                </td>
                                                <td className="text-center">{formatDate(order.createdAt || order.creationTimestamp)}</td>
                                                <td className="text-center">
                                                    <span className={`badge ${statusInfo.class}`}>
                                                        {statusInfo.label}
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
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
                                            {
                                                isExpanded && order.orderItems && order.orderItems.length > 0 && (
                                                    <tr>
                                                        <td colSpan="11" className="p-0 border-bottom">
                                                            <div className="bg-light p-4">
                                                                <div className="bg-white rounded shadow-sm p-4 border" style={{ borderLeft: '4px solid #ee4d2d' }}>
                                                                    <div className="d-flex justify-content-between align-items-start mb-4 border-bottom pb-3">
                                                                        <div>
                                                                            <h5 className="fw-bold text-dark mb-1">
                                                                                {t('shopOwner.manageOrder.orderDetails')}: {order.id}
                                                                            </h5>
                                                                            <span className="text-muted small">
                                                                                {t('common.status.title')}: <span className={`badge ${statusInfo.class}`}>{statusInfo.label}</span>
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-end">
                                                                            <div className="text-muted small mb-1">{t('shopOwner.manageOrder.orderDate')}</div>
                                                                            <div className="fw-bold text-dark">{formatDate(order.createdAt || order.creationTimestamp)}</div>
                                                                        </div>
                                                                    </div>

                                                                    <div className="row g-4 mb-4">
                                                                        <div className="col-md-4">
                                                                            <div className="p-3 bg-light rounded h-100">
                                                                                <h6 className="text-muted text-uppercase small fw-bold mb-3 border-bottom pb-2">
                                                                                    <i className="fas fa-user mb-1 me-2"></i>{t('shopOwner.manageOrder.customer')}
                                                                                </h6>
                                                                                <div className="fw-bold text-dark mb-1">{order.recipientName || t('common.unknown')}</div>
                                                                                {/* Customer ID removed */}
                                                                            </div>
                                                                        </div>
                                                                        <div className="col-md-4">
                                                                            <div className="p-3 bg-light rounded h-100">
                                                                                <h6 className="text-muted text-uppercase small fw-bold mb-3 border-bottom pb-2">
                                                                                    <i className="fas fa-truck mb-1 me-2"></i>{t('shopOwner.manageOrder.deliveryInfo')}
                                                                                </h6>
                                                                                <div className="mb-2">
                                                                                    <span className="text-muted small d-block">{t('shopOwner.manageOrder.recipient')}:</span>
                                                                                    <span className="fw-medium text-dark">{order.recipientName || t('common.unknown')}</span>
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
                                                                                {order.platformVoucherDiscount > 0 && (
                                                                                    <div className="d-flex justify-content-between mb-2">
                                                                                        <span className="text-muted small">Platform Voucher:</span>
                                                                                        <span className="fw-medium text-success">-{formatPrice(order.platformVoucherDiscount)}</span>
                                                                                    </div>
                                                                                )}
                                                                                {order.coinDiscount > 0 && (
                                                                                    <div className="d-flex justify-content-between mb-2">
                                                                                        <span className="text-muted small">Coins Used:</span>
                                                                                        <span className="fw-medium text-warning">-{formatPrice(order.coinDiscount)}</span>
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
                                                                                                    {(() => {
                                                                                                        const imgUrl = imageUrls[item.imageId] || imageUrls[item.productImage] || imageUrls[item.id] || imageUrls[`${item.productId}-${item.sizeId}`];
                                                                                                        const hasImage = !!imgUrl;
                                                                                                        return (
                                                                                                            <>
                                                                                                                {hasImage ? (
                                                                                                                    <img
                                                                                                                        src={imgUrl}
                                                                                                                        alt={item.productName}
                                                                                                                        className="rounded me-3"
                                                                                                                        style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                                                                                                                        onError={(e) => {
                                                                                                                            e.target.style.display = 'none';
                                                                                                                            // Show placeholder if image fails
                                                                                                                            e.target.nextSibling.style.display = 'flex';
                                                                                                                        }}
                                                                                                                    />
                                                                                                                ) : null}
                                                                                                            </>
                                                                                                        );
                                                                                                    })()}
                                                                                                    <div>
                                                                                                        <h6 className="mb-0 text-dark small">{
                                                                                                            productDetails[item.id || `${item.productId}-${item.sizeId}`]?.productName ||
                                                                                                            productDetails[item.productId]?.productName ||
                                                                                                            item.productName
                                                                                                        }</h6>
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
                                                                                            {t(GHN_STATUS_MAP[shippingData[order.id].status?.toLowerCase()]?.titleKey) || shippingData[order.id].status}
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
                                                )
                                            }
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
                                {(() => {
                                    const delta = 2;
                                    const left = currentPage - delta;
                                    const right = currentPage + delta + 1;
                                    let range = [];
                                    let rangeWithDots = [];
                                    let l;

                                    for (let i = 1; i <= totalPages; i++) {
                                        if (i === 1 || i === totalPages || (i >= left && i < right)) {
                                            range.push(i);
                                        }
                                    }

                                    for (let i of range) {
                                        if (l) {
                                            if (i - l === 2) {
                                                rangeWithDots.push(l + 1);
                                            } else if (i - l !== 1) {
                                                rangeWithDots.push('...');
                                            }
                                        }
                                        rangeWithDots.push(i);
                                        l = i;
                                    }

                                    return rangeWithDots.map((page, index) => {
                                        if (page === '...') {
                                            return (
                                                <li key={`ellipsis-${index}`} className="page-item disabled">
                                                    <span className="page-link">...</span>
                                                </li>
                                            );
                                        }
                                        return (
                                            <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                                                <button
                                                    className="page-link"
                                                    onClick={() => setCurrentPage(page)}
                                                >
                                                    {page}
                                                </button>
                                            </li>
                                        );
                                    });
                                })()}
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
        </div >
    );
}