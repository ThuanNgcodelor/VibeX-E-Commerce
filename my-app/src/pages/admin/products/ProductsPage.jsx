import { useEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import productAdminApi from "../../../api/productAdminApi";
import categoryApi from "../../../api/categoryApi";
import ProductForm from "./ProductForm";
import ProductSearch from "./ProductSearch";
import Swal from "sweetalert2";

export default function ProductsPage() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formInitial, setFormInitial] = useState({
    name: "",
    description: "",
    price: 0,
    originalPrice: 0,
    discountPercent: 0,
    stock: 0,
    status: "IN_STOCK",
    categoryId: "",
  });

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [sortOrder, setSortOrder] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [dark, setDark] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Toast helper
  const toast = (icon, title) =>
    Swal.fire({
      toast: true,
      position: "top-end",
      showConfirmButton: false,
      timer: 2200,
      timerProgressBar: true,
      icon,
      title,
    });

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [p, c] = await Promise.all([
        productAdminApi.list(),
        categoryApi.getAll(),
      ]);
      setItems(p ?? []);
      setCats(c ?? []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load products");
      Swal.fire({
        title: "Failed to load data",
        text: e?.response?.data?.message || "Please try again.",
        icon: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (form, id, file) => {
    setSaving(true);
    setErr("");
    try {
      if (id) await productAdminApi.update({ ...form, id }, file);
      else await productAdminApi.create(form, file);

      await load();
      setEditingId(null);
      setFormInitial({
        name: "",
        description: "",
        price: 0,
        originalPrice: 0,
        discountPercent: 0,
        stock: 0,
        status: "IN_STOCK",
        categoryId: "",
      });
      setShowForm(false);

      toast("success", id ? "Product updated" : "Product added");
    } catch (e) {
      const msg = e?.response?.data?.message || "Save failed";
      setErr(msg);
      Swal.fire({
        title: "Save failed",
        text: msg,
        icon: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (p) => {
    setEditingId(p.id);
    setFormInitial({
      name: p.name,
      description: p.description ?? "",
      price: p.price ?? 0,
      originalPrice: p.originalPrice ?? 0,
      discountPercent: p.discountPercent ?? 0,
      stock: p.stock ?? 0,
      status: p.status ?? "IN_STOCK",
      categoryId: p.categoryId || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    setErr("");
    try {
      // Lấy trước bản ghi để kiểm tra ràng buộc
      const product = await productAdminApi.getById(id);

      if (product?.categoryId) {
        await Swal.fire({
          title: "Cannot delete",
          html: `
            <div style="text-align:left">
              Product is linked to <b>Category</b>.<br/>
              Please remove category link first.
              ${product.categoryName
              ? `<div class="mt-2"><b>Category:</b> ${product.categoryName}</div>`
              : ""
            }
            </div>
          `,
          icon: "info",
          confirmButtonText: "Understood",
        });
        return;
      }

      // Confirm delete
      const result = await Swal.fire({
        title: "Delete product?",
        text: "This action cannot be undone.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Delete",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#d33",
        cancelButtonColor: "#6c757d",
      });

      if (!result.isConfirmed) return;

      // Loading while deleting
      Swal.fire({
        title: "Deleting...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      await productAdminApi.remove(id);
      await load();

      Swal.close();
      toast("success", "Product deleted");
    } catch (e) {
      const msg = e?.response?.data?.message || "Delete failed";
      setErr(msg);
      Swal.fire({
        title: "Delete failed",
        text: msg,
        icon: "error",
      });
    }
  };

  // Search + Sort + Pagination Logic
  const filtered = useMemo(() => {
    let list = items;
    if (q.trim()) {
      const k = q.toLowerCase();
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(k) ||
          (p.description || "").toLowerCase().includes(k) ||
          (p.categoryName || "").toLowerCase().includes(k)
      );
    }
    return [...list].sort((a, b) => {
      const na = (a.name || "").toLowerCase(),
        nb = (b.name || "").toLowerCase();
      if (na < nb) return sortOrder === "asc" ? -1 : 1;
      if (na > nb) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [items, q, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const goTo = (p) => setPage(Math.min(Math.max(1, p), totalPages));
  const money = (n) => (n != null ? `$${Number(n).toLocaleString()}` : "");

  return (
    <div className={dark ? "bg-dark text-light min-vh-100" : "min-vh-100"}>
      <div className="col-lg-12 mb-4">
        <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
          <h2 className={`m-0 ${dark ? "text-light" : "text-dark"}`}>
            Products
          </h2>

          <div className="d-flex align-items-center gap-3 flex-wrap">
            <ProductSearch
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              dark={dark}
            />
            <div className="d-flex align-items-center gap-2">
              <label
                className={`form-label m-0 ${dark ? "text-light" : "text-dark"
                  }`}
              >
                Sort
              </label>
              <select
                className={`form-select form-select-sm ${dark ? "bg-dark text-light border-secondary" : ""
                  }`}
                style={{ width: 120 }}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="asc">A → Z</option>
                <option value="desc">Z → A</option>
              </select>
            </div>
            <div className="form-check form-switch ms-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="themeSwitch"
                checked={dark}
                onChange={(e) => setDark(e.target.checked)}
              />
              <label className="form-check-label ms-1" htmlFor="themeSwitch">
                {dark ? "Dark" : "Light"}
              </label>
            </div>
          </div>
        </div>

        {err && (
          <div
            className={`alert alert-danger ${dark ? "bg-danger-subtle text-dark" : ""
              }`}
          >
            {err}
          </div>
        )}
        {loading && (
          <div
            className={`alert alert-info ${dark ? "bg-info-subtle text-dark" : ""
              }`}
          >
            Loading...
          </div>
        )}

        {/* Add Button */}
        <button
          className="btn btn-primary mb-3"
          onClick={() => setShowForm((prev) => !prev)}
        >
          {showForm ? "Close" : "Add Product"}
        </button>

        {/* Conditionally show the ProductForm */}
        {showForm && (
          <ProductForm
            initial={formInitial}
            categories={cats}
            editingId={editingId}
            onSubmit={handleSubmit}
            onCancel={() => {
              setEditingId(null);
              setFormInitial({
                name: "",
                description: "",
                price: 0,
                originalPrice: 0,
                discountPercent: 0,
                stock: 0,
                status: "IN_STOCK",
                categoryId: "",
              });
              setShowForm(false);
            }}
            submitting={saving}
            dark={dark}
          />
        )}

        {/* Product Table */}
        <div
          className={`card shadow-sm ${dark ? "bg-dark text-light border-secondary" : ""
            }`}
        >
          <div className="card-body p-2 p-md-3">
            <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
              <div className={dark ? "text-light" : "text-muted"}>
                Showing {pageItems.length} of {filtered.length} items
              </div>
              <div className="d-flex align-items-center gap-2">
                <label className="form-label m-0">Per page</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 90 }}
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(+e.target.value);
                    setPage(1);
                  }}
                >
                  {[5, 10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table
                className={`table table-bordered table-hover align-middle mb-2 ${dark ? "table-dark border-secondary" : ""
                  }`}
              >
                <thead className={`text-center ${dark ? "" : "table-light"}`}>
                  <tr>
                    <th style={{ minWidth: 200 }}>Name</th>
                    <th>Category</th>
                    <th>Original Price</th>
                    <th>Discount (%)</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th style={{ width: 220 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => (
                    <tr key={p.id} className="text-center">
                      <td className="text-start">{p.name}</td>
                      <td>{p.categoryName || ""}</td>
                      <td>{money(p.originalPrice)}</td>
                      <td>{p.discountPercent}%</td>
                      <td>{money(p.price)}</td>
                      <td>{p.stock}</td>
                      <td>{p.status}</td>
                      <td>
                        <div className="d-flex justify-content-center gap-2">
                          <button
                            className="btn btn-sm btn-warning text-white"
                            onClick={() => handleEdit(p)}
                          >
                            <i className="bi bi-pencil-square me-1"></i> Edit
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(p.id)}
                          >
                            <i className="bi bi-trash me-1"></i> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {pageItems.length === 0 && !loading && (
                    <tr>
                      <td colSpan="9" className="text-center p-4 text-muted">
                        No products
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <nav
              aria-label="Pagination"
              className="d-flex justify-content-center"
            >
              <ul className="pagination mb-0">
                <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                  <button
                    className={`page-link ${dark ? "bg-dark text-light border-secondary" : ""
                      }`}
                    onClick={() => goTo(page - 1)}
                    title="Previous"
                  >
                    <i className="bi bi-chevron-left"></i>
                  </button>
                </li>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <li
                      key={p}
                      className={`page-item ${p === page ? "active" : ""}`}
                    >
                      <button
                        className={`page-link ${dark
                            ? p === page
                              ? "bg-primary text-light border-primary"
                              : "bg-dark text-light border-secondary"
                            : ""
                          }`}
                        onClick={() => goTo(p)}
                      >
                        {p}
                      </button>
                    </li>
                  )
                )}
                <li
                  className={`page-item ${page === totalPages ? "disabled" : ""
                    }`}
                >
                  <button
                    className={`page-link ${dark ? "bg-dark text-light border-secondary" : ""
                      }`}
                    onClick={() => goTo(page + 1)}
                    title="Next"
                  >
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
