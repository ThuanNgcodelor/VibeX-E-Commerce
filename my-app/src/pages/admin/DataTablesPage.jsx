import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toggleUserActive, getAllUser, updateUser } from "../../api/user";
import { getUserOrderStats } from "../../api/order";

import "../../assets/admin/css/Validation.css"; // Import shared validation styles
import Swal from "sweetalert2";
import '../../assets/admin/css/UserManagement.css';

const DataTablesPage = () => {
  // Stats state
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    lockedUsers: 0,
    shopOwners: 0,
    adminUsers: 0
  });

  // Table Data State
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize] = useState(10);

  // Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Edit / Form State
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    id: "",
    email: "",
    lastName: "",
    firstName: "",
    username: "",
    phoneNumber: "",
    gender: "",
    birthDate: "",
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});

  // Stats Expansion State
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [userStatsCache, setUserStatsCache] = useState({});
  const [statsLoading, setStatsLoading] = useState(false);

  const toggleRow = async (userId) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }

    setExpandedUserId(userId);

    // If not in cache, fetch it
    if (!userStatsCache[userId]) {
      setStatsLoading(true);
      try {
        const stats = await getUserOrderStats(userId);
        setUserStatsCache((prev) => ({ ...prev, [userId]: stats }));
      } catch (error) {
        console.error("Failed to fetch user stats", error);
      } finally {
        setStatsLoading(false);
      }
    }
  };

  // Handle form input changes and clear error
  const handleInputChange = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  // Debounce search term
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm((prev) => {
        if (prev !== searchTerm) {
          setCurrentPage(0);
          return searchTerm;
        }
        return prev;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch users when dependencies change
  // Triggers immediately for pagination/filters, and after delay for search
  useEffect(() => {
    fetchUsers();
  }, [debouncedSearchTerm, filterRole, filterStatus, currentPage]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        size: pageSize,
        search: debouncedSearchTerm,
        role: filterRole !== 'all' ? filterRole : undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined
      };

      const data = await getAllUser(params);

      // Handle both Page<User> structure and potential List<User> (fallback)
      if (data.content) {
        setUsers(data.content);
        setTotalPages(data.totalPages);
        setTotalElements(data.totalElements);
      } else if (Array.isArray(data)) {
        // Fallback if backend returns list
        setUsers(data);
        setTotalPages(1);
        setTotalElements(data.length);
      }

      // Update stats (You might want a separate API for accurate total stats if pagination is used)
      // For now, we can only count what's on page or keys from backend if provided.
      // Ideally, create a separate endpoint for dashboard stats.
      // Here I will mockup calls or use existing list if small, but with pagination 
      // simple counts on frontend are inaccurate.
      // Lets assume we kept the stats logic simple or fetched separately.
      // For this task, I will mock stats based on current page or fetch stats separately if needed.
    } catch (e) {
      console.log(e);
      Swal.fire("Error!", "Failed to fetch users.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 0 && newPage < totalPages) {
      setCurrentPage(newPage);
    }
  };

  const confirmToggleActive = async (user) => {
    const isActive = user.active === "ACTIVE";
    const action = isActive ? "lock" : "unlock";

    const result = await Swal.fire({
      title: `${isActive ? "Lock" : "Unlock"} account?`,
      text: `Are you sure you want to ${action} the account "${user.email}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: isActive ? '#dc3545' : '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: `Yes, ${action} it`,
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      await handleToggleActive(user.id, isActive);
    }
  };

  const handleEdit = (user) => {
    setEditing(user.id);
    setForm({
      id: user.id,
      email: user.email,
      lastName: user.lastName || "",
      firstName: user.firstName || "",
      username: user.username || "",
      phoneNumber: user.phoneNumber || "",
      gender: user.gender || "",
      birthDate: user.birthDate || "",
    });
  };

  const handleToggleActive = async (id, wasActive) => {
    try {
      const updatedUser = await toggleUserActive(id);
      // Update local list
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? updatedUser : u))
      );
      const actionPast = wasActive ? "locked" : "unlocked";
      Swal.fire('Success!', `Account has been ${actionPast}.`, 'success');
    } catch (err) {
      console.error("Toggle active failed:", err);
      Swal.fire("Error!", `Failed to ${wasActive ? "lock" : "unlock"} account.`, "error");
    }
  };

  const validate = () => {
    let tempErrors = {};
    let isValid = true;

    if (!form.firstName) {
      tempErrors.firstName = "First name is required.";
      isValid = false;
    }
    if (!form.lastName) {
      tempErrors.lastName = "Last name is required.";
      isValid = false;
    }
    if (!form.username) {
      tempErrors.username = "Username is required.";
      isValid = false;
    }
    if (!form.email) {
      tempErrors.email = "Email is required.";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      tempErrors.email = "Email is not valid.";
      isValid = false;
    }
    if (form.phoneNumber && !/^\d{10,15}$/.test(form.phoneNumber)) {
      tempErrors.phoneNumber = "Phone number is not valid.";
      isValid = false;
    }
    // Add more validation rules as needed

    setErrors(tempErrors);
    return isValid;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      const payload = {
        id: form.id,
        lastName: form.lastName,
        firstName: form.firstName,
        username: form.username,
        phoneNumber: form.phoneNumber,
        email: form.email,
        gender: form.gender,
        birthDate: form.birthDate,
      };

      const updated = await updateUser(payload, file);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditing(null);
      setFile(null);

      Swal.fire({
        title: "Success!",
        text: "User information has been updated.",
        icon: "success",
        confirmButtonText: "OK",
      });
    } catch (err) {
      console.error("Update error:", err);
      Swal.fire("Error!", "Update failed.", "error");
    }
  };

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "ADMIN": return "badge-danger";
      case "SHOP_OWNER": return "badge-warning";
      case "USER": return "badge-info";
      default: return "badge-secondary";
    }
  };

  return (
    <div className="user-management-page">
      {/* Search & Filter Section */}
      <div className="card users-table-card">
        <div className="card-header">
          <h3 className="card-title">User Management</h3>
          <div className="header-actions">
            {/* Search */}
            <div className="search-box">
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder="Search by email, name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                }}
                className="search-input"
              />
            </div>

            {/* Filters */}
            <select
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value);
                setCurrentPage(0);
              }}
              className="filter-select"
            >
              <option value="all">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="SHOP_OWNER">Shop Owner</option>
              <option value="USER">User</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(0);
              }}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div className="card-body">
          <div className="table-responsive">
            <table className="users-table">
              <thead>
                <tr>
                  <th style={{ width: "50px" }}></th>
                  <th>User</th>
                  <th>Email</th>
                  <th>Phone</th>

                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="text-center">Loading...</td></tr>
                ) : users.length > 0 ? (
                  users.map((user) => (
                    <React.Fragment key={user.id}>
                      <tr className={expandedUserId === user.id ? "table-active" : ""}>
                        <td className="text-center">
                          <button
                            className="btn border-0 bg-transparent shadow-none"
                            onClick={() => toggleRow(user.id)}
                            style={{ color: '#0d6efd' }}
                          >
                            <i className={`fas fa-${expandedUserId === user.id ? 'chevron-up' : 'chevron-down'}`}></i>
                          </button>
                        </td>
                        <td>
                          <div className="user-info-cell">
                            <div className="user-avatar">
                              {user.imageUrl ? (
                                <img src={user.imageUrl} alt={user.username} />
                              ) : (
                                <span>{(user.firstName?.[0] || user.username?.[0] || 'U').toUpperCase()}</span>
                              )}
                            </div>
                            <div className="user-details">
                              <span className="user-name">
                                {user.firstName} {user.lastName}
                              </span>
                              <span className="user-username">@{user.username}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="user-email">{user.email}</span>
                        </td>
                        <td>{user.phoneNumber || '-'}</td>

                        <td>
                          <span className={`status-badge ${user.active === "ACTIVE" ? 'status-active' : 'status-inactive'}`}>
                            {user.active === "ACTIVE" ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              onClick={() => handleEdit(user)}
                              className="btn-action btn-edit"
                              title="Edit User"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              onClick={() => confirmToggleActive(user)}
                              className={`btn-action ${user.active === "ACTIVE" ? "btn-lock" : "btn-unlock"}`}
                              title={user.active === "ACTIVE" ? "Lock Account" : "Unlock Account"}
                            >
                              {user.active === "ACTIVE" ? (
                                <i className="fas fa-lock"></i>
                              ) : (
                                <i className="fas fa-lock-open"></i>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedUserId === user.id && (
                        <tr>
                          <td colSpan="6" className="p-0 border-0">
                            <div className="p-3 bg-light border-bottom">
                              {statsLoading && !userStatsCache[user.id] ? (
                                <div className="text-center py-3">
                                  <span className="spinner-border spinner-border-sm text-primary me-2"></span>
                                  Loading stats...
                                </div>
                              ) : userStatsCache[user.id] ? (
                                <div className="row g-3">
                                  <div className="col-md-3">
                                    <div className="card border-0 shadow-sm h-100">
                                      <div className="card-body text-center">
                                        <h6 className="text-muted mb-2">Total Orders</h6>
                                        <h4 className="mb-0 text-primary">{userStatsCache[user.id].totalOrders}</h4>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="col-md-3">
                                    <div className="card border-0 shadow-sm h-100">
                                      <div className="card-body text-center">
                                        <h6 className="text-muted mb-2">Successful</h6>
                                        <h4 className="mb-0 text-success">{userStatsCache[user.id].successfulOrders}</h4>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="col-md-3">
                                    <div className="card border-0 shadow-sm h-100">
                                      <div className="card-body text-center">
                                        <h6 className="text-muted mb-2">Delivering</h6>
                                        <h4 className="mb-0 text-info">{userStatsCache[user.id].deliveringOrders}</h4>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="col-md-3">
                                    <div className="card border-0 shadow-sm h-100">
                                      <div className="card-body text-center">
                                        <h6 className="text-muted mb-2">Cancelled</h6>
                                        <h4 className="mb-0 text-danger">{userStatsCache[user.id].cancelledOrders}</h4>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-muted">No data available</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="no-data">
                      <i className="fas fa-inbox"></i>
                      <p>No users found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="table-footer" style={{ marginTop: '20px', justifyContent: 'center' }}>
              <div className="position-relative d-flex align-items-center justify-content-center">
                {/* <span className="results-info position-absolute start-0">
                  Showing {(currentPage * pageSize) + 1} to {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} users
                </span> */}

                <nav aria-label="Pagination">
                  <ul className="pagination mb-0">
                    <li className={`page-item ${currentPage === 0 ? "disabled" : ""}`}>
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 0}
                        title="Previous"
                      >
                        <i className="fas fa-chevron-left"></i>
                      </button>
                    </li>

                    {Array.from({ length: totalPages }, (_, i) => i).map((p) => (
                      <li key={p} className={`page-item ${p === currentPage ? "active" : ""}`}>
                        <button
                          className="page-link"
                          onClick={() => handlePageChange(p)}
                        >
                          {p + 1}
                        </button>
                      </li>
                    ))}

                    <li className={`page-item ${currentPage === totalPages - 1 ? "disabled" : ""}`}>
                      <button
                        className="page-link"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages - 1}
                        title="Next"
                      >
                        <i className="fas fa-chevron-right"></i>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit User Details</h3>
              <button className="modal-close" onClick={() => setEditing(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={form.email}
                    readOnly
                    disabled
                  />
                </div>
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    className={`form-input ${errors.username ? 'error' : ''}`}
                    value={form.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                  />
                  {errors.username && <span className="error-message">{errors.username}</span>}
                </div>
                <div className="row">
                  <div className="col-6">
                    <div className="form-group">
                      <label>First Name *</label>
                      <input
                        type="text"
                        className={`form-input ${errors.firstName ? 'error' : ''}`}
                        value={form.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                      />
                      {errors.firstName && <span className="error-message">{errors.firstName}</span>}
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="form-group">
                      <label>Last Name *</label>
                      <input
                        type="text"
                        className={`form-input ${errors.lastName ? 'error' : ''}`}
                        value={form.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                      />
                      {errors.lastName && <span className="error-message">{errors.lastName}</span>}
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    className={`form-input ${errors.phoneNumber ? 'error' : ''}`}
                    value={form.phoneNumber}
                    onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  />
                  {errors.phoneNumber && <span className="error-message">{errors.phoneNumber}</span>}
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select
                    className="form-input"
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  >
                    <option value="">Select Gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Birth Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={form.birthDate}
                    onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Avatar</label>
                  <input
                    type="file"
                    className="form-input"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn-save" onClick={handleSave}>
                <i className="fas fa-save"></i> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTablesPage;
