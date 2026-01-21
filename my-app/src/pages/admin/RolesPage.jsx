import { useState, useEffect, useMemo } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  approveRequest,
  rejectRequest,
  getPendingRequests,
  getRoleRequestById, // Implemented in api/role_request.js
} from "../../api/role_request";
import Swal from 'sweetalert2';

// Items per page
const pageSize = 8;

// Normalize API record to UI format
const normalizeReq = (r) => {
  const requestedRole = r?.requestedRole ?? "";
  const statusRaw = r?.status ?? null;
  // Use 'type' returned by backend, default to 'REGISTRATION' if missing
  const requestType = r?.type || "REGISTRATION";

  return {
    id: r?.id ?? `unknown-${requestedRole}`,
    userId: r?.userId ?? "",
    name: r?.username ?? r?.userId ?? "Unknown",
    role_request: String(requestedRole || "").toUpperCase(),
    status: statusRaw
      ? String(statusRaw).charAt(0).toUpperCase() + String(statusRaw).slice(1)
      : "Pending",
    reason: r?.reason ?? "",
    createdAt: r?.creationTimestamp ?? null,
    requestType: requestType,
  };
};

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null); // id currently being processed

  // Detail View State
  const [expandedRow, setExpandedRow] = useState(null); // ID of expanded row
  const [rowDetails, setRowDetails] = useState({}); // Cache for loaded details: { [id]: detailObject }
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Modal State for Reject
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  // Load data function
  const load = async () => {
    setLoading(true);
    try {
      const rolesData = await getPendingRequests();

      // Normalize role requests
      const normalizedRoles = rolesData.map(r => normalizeReq(r));
      setRoles(normalizedRoles);
    } catch (err) {
      console.error("Error loading data:", err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || "Failed to load data"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Handle Expand Row
  const toggleRow = async (id) => {
    if (expandedRow === id) {
      setExpandedRow(null);
      return;
    }

    setExpandedRow(id);

    // If not cached, fetch details
    if (!rowDetails[id]) {
      setLoadingDetails(true);
      try {
        const detail = await getRoleRequestById(id);
        setRowDetails(prev => ({ ...prev, [id]: detail }));
      } catch (err) {
        console.error("Failed to load request details", err);
        // Optional: show error toast
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  // Accept role
  const handleAccept = async (id) => {
    const result = await Swal.fire({
      title: 'Approve Request?',
      text: "Are you sure you want to approve this role request?",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, Approve'
    });

    if (result.isConfirmed) {
      setUpdating(id);
      try {
        await approveRequest(id, 'Approved by admin');

        Swal.fire({
          icon: 'success',
          title: 'Approved!',
          text: 'Request has been approved successfully.',
          timer: 1500,
          showConfirmButton: false
        });

        await load();
        setExpandedRow(null);
      } catch (e) {
        console.error("Error approving request:", e);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to approve request'
        });
      } finally {
        setUpdating(null);
      }
    }
  };

  // Reject role - Open Modal
  const handleReject = (id) => {
    setSelectedRequestId(id);
    setRejectReason("");
    setShowRejectModal(true);
  };

  // Confirm Reject
  const confirmReject = async () => {
    if (!selectedRequestId) return;
    if (!rejectReason.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Info',
        text: 'Please provide a reason for rejection.'
      });
      return;
    }

    setUpdating(selectedRequestId);
    try {
      await rejectRequest(selectedRequestId, rejectReason);
      setShowRejectModal(false);

      Swal.fire({
        icon: 'success',
        title: 'Rejected!',
        text: 'Request has been rejected.',
        timer: 1500,
        showConfirmButton: false
      });

      await load();
      setExpandedRow(null);
    } catch (e) {
      console.error("Error rejecting request:", e);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to reject request'
      });
    } finally {
      setUpdating(null);
    }
  };

  // Filter by search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.role_request.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
    );
  }, [roles, search]);

  // Client-side pagination
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const current = filtered.slice(start, start + pageSize);

  const renderDetailRow = (detail) => {
    if (!detail) return null;
    const { shopDetails, identification, taxInfo, reason, adminNote } = detail;

    return (
      <div className="p-3 bg-light border rounded">
        <div className="row">
          <div className="col-12 mb-3">
            <h6 className="text-primary border-bottom pb-2">Request Information</h6>
            <p><strong>Reason for Request:</strong> {reason || <span className="text-muted fst-italic">No reason provided</span>}</p>
            {adminNote && <p><strong>Admin Note:</strong> {adminNote}</p>}
          </div>
          <div className="col-md-6">
            <h6 className="text-primary border-bottom pb-2">Shop Information</h6>
            <p><strong>Shop Name:</strong> {shopDetails?.shopName}</p>
            <p><strong>Owner Name:</strong> {shopDetails?.ownerName}</p>
            <p><strong>Phone:</strong> {shopDetails?.phone}</p>
            <p><strong>Address:</strong> {shopDetails?.address}</p>
            <p><strong>Email:</strong> {taxInfo?.email || 'N/A'}</p>
            <p><strong>Tax Code:</strong> {taxInfo?.taxCode || 'N/A'}</p>
          </div>
          <div className="col-md-6">
            <h6 className="text-primary border-bottom pb-2">Identification Documents</h6>
            {identification ? (
              <div className="d-flex flex-column gap-3">
                <div>
                  <small className="text-muted d-block mb-1">ID Number: {identification.identificationNumber}</small>
                  <small className="text-muted d-block mb-1">Type: {identification.identificationType}</small>
                </div>
                <div className="row">
                  <div className="col-6 text-center">
                    <span className="badge bg-secondary mb-2">Front Side</span>
                    {identification.imageFrontUrl ? (
                      <img
                        src={identification.imageFrontUrl}
                        alt="ID Front"
                        className="img-fluid rounded border shadow-sm"
                        style={{ maxHeight: '150px', objectFit: 'contain', cursor: 'pointer' }}
                        onClick={() => window.open(identification.imageFrontUrl, '_blank')}
                      />
                    ) : <p className="text-muted small">No image</p>}
                  </div>
                  <div className="col-6 text-center">
                    <span className="badge bg-secondary mb-2">Back Side</span>
                    {identification.imageBackUrl ? (
                      <img
                        src={identification.imageBackUrl}
                        alt="ID Back"
                        className="img-fluid rounded border shadow-sm"
                        style={{ maxHeight: '150px', objectFit: 'contain', cursor: 'pointer' }}
                        onClick={() => window.open(identification.imageBackUrl, '_blank')}
                      />
                    ) : <p className="text-muted small">No image</p>}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted fst-italic">No identification info provided.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid mt-4">
      <div className="d-flex justify-content-between align-items-center">
        <h3>Role Requests</h3>
        <button
          className="btn btn-primary"
          onClick={load}
          disabled={loading}
          title="Reload"
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Loading...
            </>
          ) : (
            <>
              <i className="fas fa-sync-alt me-2"></i> Reload
            </>
          )}
        </button>
      </div>

      <div className="table-responsive">
        {/* Search Bar */}
        <div className="mb-3 mt-3">
          <input
            type="text"
            placeholder="Search by name / role / reason..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="form-control"
            style={{ maxWidth: '400px' }}
          />
        </div>

        <table className="table table-bordered table-hover mt-3" style={{ background: 'white' }}>
          <thead className="table-light">
            <tr>
              <th style={{ width: '50px' }}></th>
              <th>User</th>
              <th>Role Request</th>
              <th>Status</th>
              <th style={{ width: 150 }} className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-5 text-center">
                  <div className="d-flex justify-content-center align-items-center">
                    <span className="spinner-border me-2" />
                    Loading data...
                  </div>
                </td>
              </tr>
            ) : current.length > 0 ? (
              current.map((r) => (
                <>
                  <tr key={r.id} className={expandedRow === r.id ? "table-active" : ""} style={{ verticalAlign: 'middle' }}>
                    <td className="text-center">
                      <button
                        className="btn border-0 bg-transparent p-0 shadow-none"
                        onClick={() => toggleRow(r.id)}
                        title="View Details"
                        style={{ color: expandedRow === r.id ? '#dc3545' : '#0d6efd' }}
                      >
                        <i className={`fas fa-${expandedRow === r.id ? 'chevron-up' : 'eye'}`}></i>
                      </button>
                    </td>
                    <td className="text-start">
                      <div className="fw-bold">{r.name}</div>
                      <small className="text-muted" style={{ display: 'block', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.reason ? `Reason: ${r.reason}` : ''}
                      </small>
                    </td>
                    <td>
                      <span className={`badge ${r.requestType === 'UNLOCK' ? 'bg-warning text-dark' : 'bg-primary'}`}>
                        {r.requestType === 'UNLOCK' ? 'UNLOCK SHOP' : r.role_request}
                      </span>
                    </td>
                    <td>
                      {r.status ? (
                        <span
                          className={
                            r.status === "Accepted"
                              ? "badge bg-success"
                              : r.status === "Rejected"
                                ? "badge bg-danger"
                                : "badge bg-secondary"
                          }
                        >
                          {r.status}
                        </span>
                      ) : (
                        <span className="badge bg-secondary">Pending</span>
                      )}
                    </td>
                    <td className="text-center">
                      {r.status !== 'Accepted' && r.status !== 'Rejected' && (
                        <div className="d-flex gap-2 justify-content-center">
                          <button
                            className="btn btn-sm btn-success"
                            disabled={updating === r.id}
                            onClick={() => handleAccept(r.id)}
                            title="Approve"
                          >
                            <i className="fas fa-check"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            disabled={updating === r.id}
                            onClick={() => handleReject(r.id)}
                            title="Reject"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedRow === r.id && (
                    <tr>
                      <td colSpan="5" className="p-0 border-0">
                        <div className="p-3 bg-white border-bottom">
                          {loadingDetails && !rowDetails[r.id] ? (
                            <div className="text-center py-3">
                              <span className="spinner-border spinner-border-sm text-primary me-2"></span>
                              Loading details...
                            </div>
                          ) : (
                            renderDetailRow(rowDetails[r.id])
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-center text-muted p-4">
                  No role requests found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <nav>
          <ul className="pagination justify-content-center mb-0 mt-3">
            <li className={`page-item ${safePage === 1 ? "disabled" : ""}`}>
              <button
                className="page-link"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
            </li>
            <li className="page-item disabled">
              <span className="page-link">
                Page {safePage} of {totalPages}
              </span>
            </li>
            <li
              className={`page-item ${safePage === totalPages ? "disabled" : ""
                }`}
            >
              <button
                className="page-link"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </li>
          </ul>
        </nav>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1055,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '500px', maxWidth: '90%' }}>
            <h5 className="mb-3">Reject Request</h5>
            <div className="mb-3">
              <label className="form-label">Reason for Rejection <span className="text-danger">*</span></label>
              <textarea
                className="form-control"
                rows="3"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                autoFocus
              ></textarea>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={confirmReject}
                disabled={!rejectReason.trim() || updating === selectedRequestId}
              >
                {updating === selectedRequestId ? 'Processing...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
