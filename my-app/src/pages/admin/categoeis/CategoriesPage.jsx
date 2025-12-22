import { useEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../../assets/admin/css/CategoryManagement.css";
import categoryApi from "../../../api/categoryApi";
import CategoryForm from "./CategoryForm";
import Swal from 'sweetalert2';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [sortOrder, setSortOrder] = useState("asc");
  const [showModal, setShowModal] = useState(false);

  // Load categories
  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await categoryApi.getAll();
      setCategories(data ?? []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load categories");
      Swal.fire('Error!', 'Failed to load categories.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // CRUD operations
  const handleSubmit = async (form, id, imageFile) => {
    setSaving(true);
    setErr("");
    try {
      const formData = new FormData();
      const requestData = {
        name: form.name,
        description: form.description
      };

      if (id) {
        requestData.id = id;
      }

      formData.append('request', new Blob([JSON.stringify(requestData)], { type: 'application/json' }));

      if (imageFile) {
        formData.append('image', imageFile);
      }

      if (id) {
        await categoryApi.update(formData);
        Swal.fire('Success!', 'Category updated successfully.', 'success');
      } else {
        await categoryApi.create(formData);
        Swal.fire('Success!', 'Category created successfully.', 'success');
      }

      await load();
      setShowModal(false);
      setEditingCategory(null);
    } catch (e) {
      setErr(e?.response?.data?.message || "Save failed");
      Swal.fire('Error!', 'Failed to save category.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat) => {
    setEditingCategory(cat);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
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
      setErr("");
      try {
        await categoryApi.remove(id);
        await load();
        Swal.fire('Deleted!', 'Category has been deleted.', 'success');
      } catch (e) {
        setErr(e?.response?.data?.message || "Delete failed");
        Swal.fire('Error!', 'Failed to delete category.', 'error');
      }
    }
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setShowModal(true);
  };

  // Filter and sort
  const filtered = useMemo(() => {
    let result = categories;
    if (q.trim()) {
      const k = q.toLowerCase();
      result = result.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(k) ||
          (c.description || "").toLowerCase().includes(k)
      );
    }
    result = [...result].sort((a, b) => {
      const na = (a.name || "").toLowerCase();
      const nb = (b.name || "").toLowerCase();
      if (na < nb) return sortOrder === "asc" ? -1 : 1;
      if (na > nb) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [categories, q, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const goTo = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  const stats = {
    total: categories.length,
    filtered: filtered.length,
    currentPage: pageItems.length
  };

  return (
    <div className="category-management-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Category Management</h1>
          <p className="page-subtitle">Manage product categories and their details</p>
        </div>
        <button className="btn-create" onClick={handleCreate}>
          <i className="fas fa-plus"></i> Create Category
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-total">
            <i className="fas fa-grid-2"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Categories</span>
            <h2 className="stat-value">{stats.total}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-active">
            <i className="fas fa-check-circle"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Filtered Results</span>
            <h2 className="stat-value">{stats.filtered}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-filtered">
            <i className="fas fa-layer-group"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Current Page</span>
            <h2 className="stat-value">{stats.currentPage}</h2>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card categories-table-card">
        <div className="card-header">
          <h3 className="card-title">All Categories</h3>
          <div className="header-actions">
            {/* Search */}
            <div className="search-box">
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder="Search categories..."
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                className="search-input"
              />
            </div>

            {/* Filters */}
            <select
              className="filter-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="asc">A → Z</option>
              <option value="desc">Z → A</option>
            </select>

            <select
              className="filter-select"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n} items</option>)}
            </select>
          </div>
        </div>

        <div className="card-body">
          {loading ? (
            <div className="loading-state">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Loading categories...</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="categories-table">
                  <thead>
                    <tr>
                      <th>Preview</th>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div className="category-preview">
                            {c.imageUrl ? (
                              <img src={c.imageUrl} alt={c.name} />
                            ) : (
                              <div className="no-image">
                                <i className="fas fa-image"></i>
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="category-name-cell">{c.name}</div>
                        </td>
                        <td>
                          <span className="category-desc">{c.description || "—"}</span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button
                              onClick={() => handleEdit(c)}
                              className="btn-action btn-edit"
                              title="Edit Category"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="btn-action btn-delete"
                              title="Delete Category"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {pageItems.length === 0 && !loading && (
                      <tr>
                        <td colSpan="4" className="no-data">
                          <i className="fas fa-inbox"></i>
                          <p>No categories found</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <nav aria-label="Pagination">
                <ul className="pagination">
                  <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                    <button
                      className="page-link"
                      onClick={() => goTo(page - 1)}
                      disabled={page === 1}
                      title="Previous"
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>
                  </li>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <li key={p} className={`page-item ${p === page ? "active" : ""}`}>
                      <button
                        className="page-link"
                        onClick={() => goTo(p)}
                      >
                        {p}
                      </button>
                    </li>
                  ))}
                  <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                    <button
                      className="page-link"
                      onClick={() => goTo(page + 1)}
                      disabled={page === totalPages}
                      title="Next"
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </li>
                </ul>
              </nav>
            </>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <CategoryForm
              category={editingCategory}
              onSubmit={handleSubmit}
              onCancel={() => setShowModal(false)}
              submitting={saving}
            />
          </div>
        </div>
      )}
    </div>
  );
}
