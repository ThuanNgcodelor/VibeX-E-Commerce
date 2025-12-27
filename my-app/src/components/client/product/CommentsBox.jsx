import React, { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import {
  listProductComments,
  addProductComment,
  replyProductComment,
  deleteProductComment,
} from "../../../api/productComments";
import { getUser } from "../../../api/user";

/* ---- UI helpers ---- */
const Star = ({ filled, size = 18, onClick, onMouseEnter, onMouseLeave, readOnly }) => (
  <span
    onClick={readOnly ? undefined : onClick}
    onMouseEnter={readOnly ? undefined : onMouseEnter}
    onMouseLeave={readOnly ? undefined : onMouseLeave}
    style={{
      fontSize: size,
      lineHeight: 1,
      cursor: readOnly ? "default" : "pointer",
      color: filled ? "#f5a623" : "#d9d9d9",
      userSelect: "none",
    }}
  >
    ★
  </span>
);

const StarReadOnly = ({ value = 0, size = 16 }) => {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  const full = Math.floor(v);
  const half = v - full >= 0.5 ? 1 : 0;
  return (
    <span aria-label={`${v} stars`}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f-${i}`} filled size={size} readOnly />
      ))}
      {half === 1 ? <span style={{ color: "#f5a623", fontSize: size }}>★</span> : null}
      {Array.from({ length: 5 - full - half }).map((_, i) => (
        <Star key={`e-${i}`} filled={false} size={size} readOnly />
      ))}
    </span>
  );
};

const StarInput = ({ value, onChange }) => {
  const [hover, setHover] = useState(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="d-inline-flex align-items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const n = i + 1;
        return (
          <Star
            key={n}
            filled={n <= shown}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
          />
        );
      })}
      <small className="ms-2 text-muted">{shown || 0}/5</small>
    </div>
  );
};

const initialsOf = (t) =>
  (!t ? "U" : (t.includes("@") ? t.split("@")[0] : t).slice(0, 2).toUpperCase());
const Avatar = ({ seed }) => (
  <div
    className="d-inline-flex justify-content-center align-items-center rounded-circle"
    style={{
      width: 40,
      height: 40,
      background: "#F1FAEE",
      border: "1px solid #e6e6e6",
      fontWeight: 600,
      color: "#555",
    }}
  >
    {initialsOf(seed)}
  </div>
);

/** Small, robust editor that keeps its own local state */
function ReplyEditor({ initial = "", disabled, onSend, onCancel }) {
  const [val, setVal] = useState(initial);
  // If initial changes (e.g., reopening), sync it once.
  useEffect(() => { setVal(initial); }, [initial]);

  const submit = (e) => {
    e.preventDefault();
    const v = (val || "").trim();
    if (!v) return;
    onSend(v);
  };

  return (
    <form className="mt-2" onSubmit={submit}>
      <textarea
        className="form-control mb-2"
        rows={2}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Write a reply…"
      />
      <div className="d-flex gap-2">
        <button type="submit" disabled={disabled} className="btn btn-sm btn-primary">
          Send
        </button>
        <button type="button" className="btn btn-sm btn-light" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** product: used for "Specification" tab; currentUser is optional (auto-fetch if missing) */
export default function CommentsBox({ productId, currentUser, product }) {
  const { t } = useTranslation();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(0);
  const [error, setError] = useState(null);
  const [posting, setPosting] = useState(false);

  // Keep which comment is being replied to
  const [replyingId, setReplyingId] = useState(null);
  // Persist drafts by commentId (even if closing/reopening)
  const [replyDrafts, setReplyDrafts] = useState({}); // { [commentId]: "draft" }

  const [activeTab, setActiveTab] = useState("review"); // 'spec' | 'review'

  // Client-side pagination for root comments
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(3);

  // Auto-fetch user if not provided
  const [me, setMe] = useState(currentUser || null);
  useEffect(() => {
    if (!currentUser) {
      (async () => {
        try {
          const u = await getUser();
          setMe(u);
        } catch {
          setMe(null);
        }
      })();
    } else {
      setMe(currentUser);
    }
  }, [currentUser]);

  const myId =
    me?.id ?? me?.userId ?? me?.uid ?? me?.sub ?? (me?.user?.id ?? me?.user?.userId ?? null);

  const load = async () => {
    try {
      setError(null);
      const data = await listProductComments(productId);
      setComments(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load comments");
    }
  };
  useEffect(() => {
    if (productId) load();
  }, [productId]);

  // Reset to page 1 when tab/data/pageSize changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, comments, pageSize]);

  const onPost = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      setPosting(true);
      await addProductComment(productId, {
        content: text.trim(),
        rating: rating ? Number(rating) : undefined,
      });
      setText("");
      setRating(0);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  const sendReply = async (commentId, content) => {
    try {
      setPosting(true);
      await replyProductComment(productId, commentId, { content });
      // clear draft & close box
      setReplyDrafts((d) => {
        const nd = { ...d };
        delete nd[commentId];
        return nd;
      });
      setReplyingId(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to send reply");
    } finally {
      setPosting(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await deleteProductComment(id);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to delete comment");
    }
  };

  const openReply = (commentId) => {
    setReplyingId(commentId);
    setReplyDrafts((d) => ({ ...d, [commentId]: d[commentId] ?? "" }));
  };

  const safeKey = (c, idx) => c?.id || `${c?.userId || "u"}-${c?.createdAt || ""}-${idx}`;

  const Comment = ({ c, depth = 0, index = 0 }) => {
    const isOwner = !!myId && myId === c.userId;
    const canReply = !isOwner && depth === 0; // UI: only reply to root comments (backend enforces too)
    const showReplyBox = replyingId === c.id;
    const draft = replyDrafts[c.id] ?? "";

    return (
      <div className="mb-3" key={safeKey(c, index)}>
        <div
          className="p-3"
          style={{ border: "1px solid #e9ecef", borderRadius: 16, background: "#fff" }}
        >
          <div className="d-flex align-items-start gap-3">
            <Avatar seed={c.userId || "user"} />
            <div className="flex-grow-1">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <strong>{(c.userId || "").slice(0, 8) || "User"}</strong>
                {typeof c.rating === "number" && depth === 0 && (
                  <span className="d-inline-flex align-items-center gap-1 text-warning">
                    <StarReadOnly value={c.rating} />{" "}
                    <small className="text-muted">{Number(c.rating).toFixed(1)}</small>
                  </span>
                )}
                <small className="text-muted">
                  {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                </small>
                {isOwner && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-danger ms-auto p-0"
                    onClick={() => onDelete(c.id)}
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className="mt-2 text-body">{c.content}</div>

              {/* Render Images */}
              {c.imageIds && c.imageIds.length > 0 && (
                <div className="d-flex gap-2 mt-2 flex-wrap">
                  {c.imageIds.map((imgId) => (
                    <img
                      key={imgId}
                      src={`/v1/file-storage/get/${imgId}`}
                      alt="Review"
                      style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }}
                      onClick={() => window.open(`/v1/file-storage/get/${imgId}`, '_blank')}
                      className="cursor-pointer border"
                    />
                  ))}
                </div>
              )}

              {/* Render Shop Reply (Single String) */}
              {c.reply && (
                <div className="bg-light p-3 rounded mt-3 border-start border-4 border-success">
                  <strong>{t('product.reviews.shopResponse')}:</strong>
                  <p className="mb-0 mt-1">{c.reply}</p>
                  {c.repliedAt && (
                    <small className="text-muted">
                      {new Date(c.repliedAt).toLocaleString()}
                    </small>
                  )}
                </div>
              )}

              {canReply && (
                <div className="mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => openReply(c.id)}
                  >
                    Reply
                  </button>
                </div>
              )}

              {showReplyBox && (
                <ReplyEditor
                  key={`editor-${c.id}`}            // keep editor state stable per comment
                  initial={draft}
                  disabled={posting}
                  onSend={(val) => sendReply(c.id, val)}
                  onCancel={() => {
                    setReplyingId(null);
                    setReplyDrafts((d) => ({ ...d, [c.id]: "" }));
                  }}
                />
              )}

              {Array.isArray(c.replies) &&
                c.replies.map((r, i) => (
                  <div key={safeKey(r, i)} className="mt-2 ms-4">
                    <Comment c={r} depth={depth + 1} index={i} />
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ------- Pagination (client-side) -------
  const totalRoots = comments.length;
  const totalPages = Math.max(1, Math.ceil(totalRoots / pageSize));
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const start = (pageClamped - 1) * pageSize;
  const end = Math.min(start + pageSize, totalRoots);
  const pagedRoots = comments.slice(start, end);

  const specDesc = (product?.longDescription || product?.description || "").trim();

  return (
    <div className="mt-4">
      <div className="row">
        {/* LEFT */}
        <div className="col-lg-7 mb-4">
          {/* Tabs */}
          <div className="d-flex align-items-center justify-content-between mb-3">
            <ul className="nav nav-tabs border-0">
              <li className="nav-item">
                <button
                  type="button"
                  onClick={() => setActiveTab("spec")}
                  className={`nav-link fw-semibold ${activeTab === "spec" ? "active text-success" : "text-success"
                    }`}
                  style={{ background: "transparent" }}
                >
                  Specification
                </button>
              </li>
              <li className="nav-item">
                <button
                  type="button"
                  onClick={() => setActiveTab("review")}
                  className={`nav-link fw-semibold ${activeTab === "review" ? "active" : ""}`}
                  style={{ borderColor: "transparent transparent #0d6efd transparent" }}
                >
                  Reviews
                </button>
              </li>
            </ul>

            {activeTab === "review" && (
              <div className="d-flex align-items-center gap-2">
                {product?.userId && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('open-chat-with-product', {
                        detail: {
                          shopOwnerId: product.userId,
                          productId: product.id
                        }
                      }));
                    }}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <i className="fas fa-comments me-1"></i>
                    Chat với shop
                  </button>
                )}
                <div className="d-none d-md-flex align-items-center gap-2 ms-auto">
                  <small className="text-muted">Show:</small>
                  <select
                    className="form-select form-select-sm"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    style={{ width: 80 }}
                  >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* SPEC CONTENT */}
          {activeTab === "spec" && (
            <div
              className="p-3"
              style={{ border: "1px solid #e9ecef", borderRadius: 16, background: "#fff" }}
            >
              <h6 className="mb-2">{product?.name || "Product"}</h6>
              <ul className="list-unstyled mb-3 small text-muted">
                {product?.id && (
                  <li>
                    <strong>SKU:</strong> {product.id}
                  </li>
                )}
                {product?.brand?.name && (
                  <li>
                    <strong>Brand:</strong> {product.brand.name}
                  </li>
                )}
                {product?.category?.name && (
                  <li>
                    <strong>Category:</strong> {product.category.name}
                  </li>
                )}
                {typeof product?.stock === "number" && (
                  <li>
                    <strong>Stock:</strong> {product.stock}
                  </li>
                )}
              </ul>
              <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                {specDesc || "No description for this product yet."}
              </p>
            </div>
          )}

          {/* REVIEW LIST + Pagination */}
          {activeTab === "review" && (
            <>
              {error && <div className="alert alert-danger">{error}</div>}
              {totalRoots === 0 && <p className="text-muted">No comments yet.</p>}

              {pagedRoots.map((c, i) => (
                <Comment key={safeKey(c, i)} c={c} index={i} />
              ))}

              {/* Pager */}
              {totalRoots > 0 && (
                <div className="d-flex flex-wrap align-items-center justify-content-between mt-2">
                  <small className="text-muted">
                    Showing {start + 1}-{end} of {totalRoots}
                  </small>
                  <nav>
                    <ul className="pagination pagination-sm mb-0">
                      <li className={`page-item ${pageClamped === 1 ? "disabled" : ""}`}>
                        <button className="page-link" onClick={() => setPage(pageClamped - 1)}>
                          Prev
                        </button>
                      </li>

                      {Array.from({ length: totalPages }).map((_, i) => {
                        const idx = i + 1;
                        const show =
                          idx === 1 ||
                          idx === totalPages ||
                          Math.abs(idx - pageClamped) <= 1 ||
                          (pageClamped <= 2 && idx <= 3) ||
                          (pageClamped >= totalPages - 1 && idx >= totalPages - 2);

                        if (!show) {
                          if (idx === 2 || idx === totalPages - 1) {
                            return (
                              <li key={`dots-${idx}`} className="page-item disabled">
                                <span className="page-link">…</span>
                              </li>
                            );
                          }
                          return null;
                        }
                        return (
                          <li key={idx} className={`page-item ${idx === pageClamped ? "active" : ""}`}>
                            <button className="page-link" onClick={() => setPage(idx)}>
                              {idx}
                            </button>
                          </li>
                        );
                      })}

                      <li className={`page-item ${pageClamped === totalPages ? "disabled" : ""}`}>
                        <button className="page-link" onClick={() => setPage(pageClamped + 1)}>
                          Next
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT: Leave a review */}
        <div className="col-lg-5">
          <div className="p-3 p-md-4" style={{ border: "1px solid #e9ecef", borderRadius: 16 }}>
            <h5 className="mb-3">Leave a review</h5>
            <form onSubmit={onPost}>
              <div className="mb-3">
                <label className="form-label small text-muted">Enter your feedback</label>
                <textarea
                  className="form-control border-0 border-bottom rounded-0"
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write your review…"
                />
              </div>
              {/* Demo fields (not posted) */}
              <div className="mb-3">
                <label className="form-label small text-muted">Full Name</label>
                <input
                  className="form-control border-0 border-bottom rounded-0"
                  type="text"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="mb-3">
                <label className="form-label small text-muted">Email Address</label>
                <input
                  className="form-control border-0 border-bottom rounded-0"
                  type="email"
                  placeholder="you@example.com"
                />
              </div>
              <div className="mb-3 d-flex align-items-center gap-3">
                <StarInput value={rating} onChange={setRating} />
                <span className="text-muted small">Your rating</span>
              </div>
              <button disabled={posting} className="btn btn-outline-success rounded-pill px-4">
                SUBMIT
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
