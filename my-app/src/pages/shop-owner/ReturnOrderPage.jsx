import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getShopOwnerOrders, updateOrderStatusForShopOwner, returnOrder } from '../../api/order';
import { getUserById } from '../../api/user';
import '../../components/shop-owner/ShopOwnerLayout.css';

export default function ReturnOrderPage() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);
  const [usernames, setUsernames] = useState({});
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Load orders
  useEffect(() => {
    loadOrders();
  }, [currentPage, statusFilter]);

  // Auto-expand order if orderId is in URL
  useEffect(() => {
    const orderIdFromUrl = searchParams.get('orderId');
    if (orderIdFromUrl && orders.length > 0) {
      // Check if order exists in current orders list
      const orderExists = orders.some(order => order.id === orderIdFromUrl);
      if (orderExists) {
        setExpandedRows(prev => {
          if (!prev.has(orderIdFromUrl)) {
            return new Set([...prev, orderIdFromUrl]);
          }
          return prev;
        });
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
  }, [searchParams, orders]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      // Filter for CANCELLED and RETURNED orders if no specific filter is selected
      // If statusFilter is provided, use it. Otherwise default to CANCELLED and RETURNED.
      let filterValue = statusFilter && statusFilter.trim() !== '' ? statusFilter : ['CANCELLED', 'RETURNED'];

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

      // Fetch usernames for all orders
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
    if (!window.confirm(`Are you sure you want to update order status to "${getStatusLabel(newStatus)}"?`)) {
      return;
    }

    try {
      await updateOrderStatusForShopOwner(orderId, newStatus);
      alert('Order status updated successfully!');
      loadOrders(); // Reload orders
    } catch (err) {
      console.error('Error updating order status:', err);
      alert('Failed to update order status');
    }
  };

  const handleReturn = async (orderId) => {
    const reason = window.prompt("Enter return reason:");
    if (reason === null) return; // Cancelled

    try {
      await returnOrder(orderId, reason);
      alert('Order returned successfully!');
      loadOrders();
    } catch (err) {
      console.error('Error returning order:', err);
      alert('Failed to return order: ' + err.message);
    }
  };



  const toggleRowExpand = (orderId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedRows(newExpanded);
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

  const formatProducts = (orderItems) => {
    if (!orderItems || orderItems.length === 0) return 'No products';

    return orderItems
      .map(item => {
        const productName = item.productName || `Product ${item.productId}`;
        const sizeName = item.sizeName ? ` (${item.sizeName})` : '';
        return `${productName}${sizeName} x${item.quantity || 1}`;
      })
      .join(', ');
  };

  const formatPrice = (price) => {
    if (price == null) return '$0';
    return '$' + new Intl.NumberFormat('en-US').format(price);
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

  if (loading && orders.length === 0) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Returns & Refunds</h1>
        </div>
        <div className="text-center py-5">
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#ee4d2d' }}></i>
          <p className="mt-3">Loading orders list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Returns & Refunds</h1>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="orders-table">
        <div className="table-header">
          <div className="table-title">Orders List</div>
          <div className="table-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 'auto' }}
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="COMPLETED">Completed</option>
              <option value="RETURNED">Returned</option>
            </select>
            <button className="btn btn-secondary-shop" onClick={loadOrders}>
              <i className="fas fa-sync-alt"></i> Refresh
            </button>
            <button className="btn btn-secondary-shop">
              <i className="fas fa-download"></i> Export Excel
            </button>
          </div>
        </div>

        <div className="table-responsive" style={{ overflowX: 'auto' }}>
          <table className="table table-hover">
            <thead>
              <tr>
                <th>No.</th>
                <th>Customer</th>
                <th>Products</th>
                <th>Subtotal</th>
                <th>Shipping Fee</th>
                <th>Total</th>
                <th>Order Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-4">
                    <p className="text-muted">No orders found</p>
                  </td>
                </tr>
              ) : (
                orders.map((order, index) => {
                  const statusInfo = getStatusBadge(order.orderStatus);
                  const nextStatus = getNextStatus(order.orderStatus);
                  const isExpanded = expandedRows.has(order.id);
                  const orderNumber = (currentPage - 1) * pageSize + index + 1;

                  return (
                    <React.Fragment key={order.id}>
                      <tr data-order-id={order.id}>
                        <td><strong>{orderNumber}</strong></td>
                        <td>{usernames[order.userId] || order.userId || 'N/A'}</td>
                        <td style={{ maxWidth: '300px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span title={formatProducts(order.orderItems)}>
                              {formatProducts(order.orderItems)}
                            </span>
                            {order.orderItems && order.orderItems.length > 0 && (
                              <button
                                className="btn btn-sm btn-link p-0"
                                onClick={() => toggleRowExpand(order.id)}
                                title={isExpanded ? "Hide details" : "Show details"}
                              >
                                <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: '#555' }}>
                            {formatPrice(order.totalPrice)}
                          </strong>
                        </td>
                        <td>
                          <span style={{ color: '#666', fontSize: '0.9rem' }}>
                            {order.shippingFee ? formatPrice(order.shippingFee) : 'N/A'}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: '#ee4d2d' }}>
                            {formatPrice((order.totalPrice || 0) + (order.shippingFee || 0))}
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
                              onClick={() => {
                                toggleRowExpand(order.id);
                              }}
                              title="View details"
                            >
                              <i className="fas fa-eye"></i>
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
                            {order.orderStatus === 'DELIVERED' && (
                              <button
                                className="btn btn-sm btn-outline-warning"
                                onClick={() => handleReturn(order.id)}
                                title="Process Return"
                              >
                                <i className="fas fa-undo"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && order.orderItems && order.orderItems.length > 0 && (
                        <tr>
                          <td colSpan="9" style={{ backgroundColor: '#f8f9fa', padding: '20px' }}>
                            <div style={{ paddingLeft: '20px' }}>
                              <h6 style={{ marginBottom: '15px', fontWeight: 'bold' }}>Product Details:</h6>
                              <div className="table-responsive">
                                <table className="table table-sm table-bordered">
                                  <thead>
                                    <tr>
                                      <th>Product Name</th>
                                      <th>Size</th>
                                      <th>Quantity</th>
                                      <th>Unit Price</th>
                                      <th>Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.orderItems.map((item, itemIndex) => (
                                      <tr key={itemIndex}>
                                        <td>{item.productName || `Product ${item.productId}`}</td>
                                        <td>{item.sizeName || 'N/A'}</td>
                                        <td>{item.quantity || 1}</td>
                                        <td>{formatPrice(item.price || item.unitPrice || 0)}</td>
                                        <td>{formatPrice((item.price || item.unitPrice || 0) * (item.quantity || 1))}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="mt-3 d-flex justify-content-end">
                                <div style={{ minWidth: '300px' }}>
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
                                  <div className="d-flex justify-content-between pt-2 border-top">
                                    <strong>Total:</strong>
                                    <strong style={{ color: '#ee4d2d', fontSize: '1.1rem' }}>
                                      {formatPrice((order.totalPrice || 0) + (order.shippingFee || 0))}
                                    </strong>
                                  </div>

                                  {(order.cancelReason || order.returnReason) && (
                                    <div className="mt-3 p-3 bg-light rounded border border-warning">
                                      {order.cancelReason && (
                                        <div className="mb-2">
                                          <strong className="text-danger">Cancel Reason:</strong>
                                          <p className="mb-0 text-dark">{order.cancelReason}</p>
                                        </div>
                                      )}
                                      {order.returnReason && (
                                        <div>
                                          <strong className="text-danger">Return Reason:</strong>
                                          <p className="mb-0 text-dark">{order.returnReason}</p>
                                        </div>
                                      )}
                                    </div>
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
          <div className="d-flex justify-content-between align-items-center mt-3">
            <div>
              <small className="text-muted">
                Page {currentPage} / {totalPages}
              </small>
            </div>
            <div>
              <button
                className="btn btn-sm btn-outline-secondary me-2"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <i className="fas fa-chevron-left"></i> Previous
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
