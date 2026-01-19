import { useState, useEffect, useMemo } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  approveRequest,
  rejectRequest,
  getPendingRequests,
  getRoleRequestById, // Implemented in api/role_request.js
} from "../../api/role_request";

// Items per page
const pageSize = 8;

// Normalize API record to UI format
const normalizeReq = (r) => {
  const requestedRole = r?.requestedRole ?? "";
  const statusRaw = r?.status ?? null;

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
  };
};

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null); // id đang Accept/Reject

  // New state for dropdown
  const [expandedRow, setExpandedRow] = useState(null); // ID of expanded row
  const [rowDetails, setRowDetails] = useState({}); // Cache for loaded details: { [id]: detailObject }
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Load data function
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rolesData = await getPendingRequests();

      // Normalize role requests
      const normalizedRoles = rolesData.map(r => normalizeReq(r));
      setRoles(normalizedRoles);
    } catch (err) {
      console.error("Error loading data:", err);
      setError(err.message || "Failed to load data");
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
    setUpdating(id);
    try {
      await approveRequest(id, 'Approved by admin');
      // Close expanded row if needed or keep it? 
      // Refresh data sau khi approve
      await load();
      setExpandedRow(null); // Close after action
    } catch (e) {
      console.error("Error approving request:", e);
      setError("Failed to approve request");
    } finally {
      setUpdating(null);
    }
  };

  // Reject role
  const handleReject = async (id) => {
    setUpdating(id);
    try {
      await rejectRequest(id, 'Rejected by admin');
      await load();
      setExpandedRow(null);
    } catch (e) {
      console.error("Error rejecting request:", e);
      setError("Failed to reject request");
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
    const { shopDetails, identification, taxInfo } = detail;

    return (
      <div className="p-3 bg-light border rounded">
        <div className="row">
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
                        style={{ maxHeight: '150px', objectFit: 'contain' }}
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
                        style={{ maxHeight: '150px', objectFit: 'contain' }}
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
    <div className="container py-4">
      <div className="card shadow-sm border-0">
        <div className="card-header bg-white d-flex align-items-center justify-content-between">
          <div>
            <h5 className="mb-0">Role Requests</h5>
          </div>
          <button
            className="btn btn-sm btn-outline-secondary"
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
              "↻ Reload"
            )}
          </button>
        </div>

        <div className="card-body">
          {/* Error */}
          {error && (
            <div className="alert alert-danger d-flex justify-content-between align-items-center">
              <div>{error}</div>
              <button className="btn btn-sm btn-light" onClick={load}>
                Retry
              </button>
            </div>
          )}

          {/* Tìm kiếm */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search by name / role / reason..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="form-control"
            />
          </div>

          {/* Bảng */}
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: '50px' }}></th>
                  <th>User</th>
                  <th>Role Request</th>
                  <th>Status</th>
                  <th style={{ width: 220 }} className="text-center">Actions</th>
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
                      <tr key={r.id} className={expandedRow === r.id ? "table-active" : ""}>
                        <td className="text-center">
                          <button
                            className={`btn btn-sm btn-link text-decoration-none ${expandedRow === r.id ? 'text-danger' : 'text-primary'}`}
                            onClick={() => toggleRow(r.id)}
                            title="View Details"
                          >
                            <i className={`fas fa-${expandedRow === r.id ? 'chevron-up' : 'eye'}`}></i>
                          </button>
                        </td>
                        <td className="text-start">
                          <div className="fw-semibold">{r.name}</div>
                          <small className="text-muted">{r.reason ? `Reason: ${r.reason.substring(0, 30)}${r.reason.length > 30 ? '...' : ''}` : ''}</small>
                        </td>
                        <td>
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                            {r.role_request}
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
                          <div
                            className="btn-group btn-group-sm"
                            role="group"
                            aria-label="Actions"
                          >
                            <button
                              className="btn btn-outline-success"
                              disabled={
                                updating === r.id || r.status === "Accepted"
                              }
                              onClick={() => handleAccept(r.id)}
                            >
                              {updating === r.id ? (
                                <span className="spinner-border spinner-border-sm" />
                              ) : (
                                "Accept"
                              )}
                            </button>
                            <button
                              className="btn btn-outline-danger"
                              disabled={
                                updating === r.id || r.status === "Rejected"
                              }
                              onClick={() => handleReject(r.id)}
                            >
                              {updating === r.id ? (
                                <span className="spinner-border spinner-border-sm" />
                              ) : (
                                "Reject"
                              )}
                            </button>
                          </div>
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
                    <td colSpan={5} className="text-muted py-4 text-center">
                      No roles found
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
        </div>
      </div>
    </div>
  );
}
