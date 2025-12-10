import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import imgFallback from "../../../assets/images/shop/6.png";
import {
  fetchProductImageById,
  fetchProducts,
} from "../../../api/product.js";

const USE_OBJECT_URL = true;

const arrayBufferToDataUrl = (buffer, contentType) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return `data:${contentType || "image/png"};base64,${base64}`;
};

const PAGE_SIZE = 40;

const SearchProduct = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState({});

  // Search & Pagination
  const urlQuery = searchParams.get('q') || "";
  const [query, setQuery] = useState(urlQuery);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("relevance");

  // Filter states
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [selectedShipping, setSelectedShipping] = useState([]);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [shopTypes, setShopTypes] = useState([]);
  const [condition, setCondition] = useState("");
  const [rating, setRating] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [categories, setCategories] = useState([]);

  const createdUrlsRef = useRef([]);

  // Load all products
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetchProducts();
        const list = Array.isArray(res?.data) ? res.data : res?.data?.content || [];
        setProducts(list);
      } catch (error) {
        console.error("Failed to fetch products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  // Sync URL query parameter
  useEffect(() => {
    const urlQuery = searchParams.get('q') || "";
    if (urlQuery !== query) {
      setQuery(urlQuery);
    }
  }, [searchParams]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, sortBy]);

  // Helper: compute total stock
  const totalStockOf = (p) => {
    if (!p || !Array.isArray(p.sizes)) return 0;
    return p.sizes.reduce((sum, size) => sum + (Number(size?.stock) || 0), 0);
  };

  // Filter by search
  const filteredBySearch = useMemo(() => {
    if (!debouncedQuery) return products;
    const q = debouncedQuery.toLowerCase();
    return products.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [products, debouncedQuery]);

  // Apply sorting
  const sorted = useMemo(() => {
    const arr = [...filteredBySearch].filter((p) => totalStockOf(p) > 0);
    
    if (sortBy === "newest") {
      return arr;
    } else if (sortBy === "bestselling") {
      return arr.sort((a, b) => (b.soldOf || 0) - (a.soldOf || 0));
    } else if (sortBy === "price-asc") {
      return arr.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === "price-desc") {
      return arr.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }
    return arr;
  }, [filteredBySearch, sortBy]);

  // Pagination
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, currentPage]);

  // Load images for current page
  useEffect(() => {
    if (pageItems.length === 0) {
      setImageUrls({});
      return;
    }

    let isActive = true;
    const newUrls = {};
    const tempCreatedUrls = [];

    const loadImages = async () => {
      await Promise.all(
        pageItems.map(async (product) => {
          try {
            if (product.imageId) {
              const res = await fetchProductImageById(product.imageId);
              const contentType = res.headers?.["content-type"] || "image/png";

              if (USE_OBJECT_URL) {
                const blob = new Blob([res.data], { type: contentType });
                const url = URL.createObjectURL(blob);
                newUrls[product.id] = url;
                tempCreatedUrls.push(url);
              } else {
                newUrls[product.id] = arrayBufferToDataUrl(res.data, contentType);
              }
            } else {
              newUrls[product.id] = imgFallback;
            }
          } catch {
            newUrls[product.id] = imgFallback;
          }
        })
      );

      if (!isActive) return;

      if (USE_OBJECT_URL && createdUrlsRef.current.length) {
        createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      }
      createdUrlsRef.current = tempCreatedUrls;

      setImageUrls(newUrls);
    };

    loadImages();

    return () => {
      isActive = false;
      if (USE_OBJECT_URL && createdUrlsRef.current.length) {
        createdUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        createdUrlsRef.current = [];
      }
    };
  }, [pageItems]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const clearAllFilters = () => {
    setSelectedAreas([]);
    setSelectedShipping([]);
    setPriceMin("");
    setPriceMax("");
    setShopTypes([]);
    setCondition("");
    setRating([]);
    setPromotions([]);
    setCategories([]);
  };

  const formatSoldCount = (count) => {
    if (!count || count === 0) return "0";
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`.replace('.0', '');
    }
    return count.toString();
  };

  // Vietnamese provinces/cities
  const provinces = [
    "Hà Nội", "TP. Hồ Chí Minh", "Hải Phòng", "Đà Nẵng", "Cần Thơ",
    "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu",
    "Bắc Ninh", "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước"
  ];

  // Demo categories
  const categoryList = [
    "Piggy Bank", "Home & Living", "Toys", "Tools & Utilities"
  ];

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingTop: '20px' }}>
      <div className="container">
        {/* Search Result Title */}
        {debouncedQuery && (
          <div style={{ marginBottom: '12px', fontSize: '14px', color: '#757575' }}>
            Search results for keyword '{debouncedQuery}'
          </div>
        )}

        <div className="row">
          {/* Left Sidebar - Filters */}
          <div className="col-md-3 mb-4 mb-md-0" style={{ paddingRight: '8px' }}>
            <div style={{ background: '#fff', borderRadius: '4px', padding: '16px', marginBottom: '12px' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: '#212121' }}>
                  SEARCH FILTERS
                </h6>
                <button
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={clearAllFilters}
                  style={{ fontSize: '14px', color: '#ee4d2d', padding: 0, fontWeight: 500 }}
                >
                  CLEAR ALL
                </button>
              </div>

              {/* Location */}
              <div className="mb-4" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' }}>
                <h6 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px', color: '#212121' }}>
                  Location
                </h6>
                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {provinces.slice(0, 5).map((province) => (
                    <div key={province} className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`area-${province}`}
                        checked={selectedAreas.includes(province)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAreas([...selectedAreas, province]);
                          } else {
                            setSelectedAreas(selectedAreas.filter(a => a !== province));
                          }
                        }}
                        style={{ marginTop: '4px', cursor: 'pointer' }}
                      />
                      <label className="form-check-label" htmlFor={`area-${province}`} style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                        {province}
                      </label>
                    </div>
                  ))}
                  <button className="btn btn-link p-0 text-decoration-none" style={{ fontSize: '13px', color: '#ee4d2d', padding: 0 }}>
                    More...
                  </button>
                </div>
              </div>

              {/* Category */}
              <div className="mb-4" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' }}>
                <h6 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px', color: '#212121' }}>
                  Category
                </h6>
                <div>
                  {categoryList.map((cat) => (
                    <div key={cat} className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`cat-${cat}`}
                        checked={categories.includes(cat)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCategories([...categories, cat]);
                          } else {
                            setCategories(categories.filter(c => c !== cat));
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <label className="form-check-label" htmlFor={`cat-${cat}`} style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                        {cat}
                      </label>
                    </div>
                  ))}
                  <button className="btn btn-link p-0 text-decoration-none" style={{ fontSize: '13px', color: '#ee4d2d', padding: 0 }}>
                    More...
                  </button>
                </div>
              </div>

              {/* Shipping Unit */}
              <div className="mb-4" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' }}>
                <h6 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px', color: '#212121' }}>
                  Shipping Unit
                </h6>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="shipping-fast"
                    checked={selectedShipping.includes('fast')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedShipping([...selectedShipping, 'fast']);
                      } else {
                        setSelectedShipping(selectedShipping.filter(s => s !== 'fast'));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label" htmlFor="shipping-fast" style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                    Fast
                  </label>
                </div>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="shipping-economical"
                    checked={selectedShipping.includes('economical')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedShipping([...selectedShipping, 'economical']);
                      } else {
                        setSelectedShipping(selectedShipping.filter(s => s !== 'economical'));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label" htmlFor="shipping-economical" style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                    Economical
                  </label>
                </div>
                <button className="btn btn-link p-0 text-decoration-none" style={{ fontSize: '13px', color: '#ee4d2d', padding: 0 }}>
                  Thêm...
                </button>
          </div>

              {/* Price Range */}
              <div className="mb-4" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' }}>
                <h6 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px', color: '#212121' }}>
                  Price Range
                </h6>
                <div className="d-flex gap-2 mb-2">
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="₫ FROM"
                    value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                    style={{ fontSize: '13px', height: '32px' }}
                  />
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="₫ TO"
                    value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                    style={{ fontSize: '13px', height: '32px' }}
                  />
                </div>
                <button
                  className="btn btn-sm w-100"
                  style={{ 
                    fontSize: '13px', 
                    padding: '8px', 
                    background: '#ee4d2d', 
                    color: '#fff',
                    border: 'none',
                    borderRadius: '2px',
                    fontWeight: 500
                  }}
                >
                  APPLY
                </button>
              </div>

              {/* Shop Type */}
              <div className="mb-4" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' }}>
                <h6 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px', color: '#212121' }}>
                  Shop Type
                </h6>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="shop-mall"
                    checked={shopTypes.includes('mall')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setShopTypes([...shopTypes, 'mall']);
                      } else {
                        setShopTypes(shopTypes.filter(t => t !== 'mall'));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label" htmlFor="shop-mall" style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                    Shop Mall
                  </label>
                </div>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="shop-favorite"
                    checked={shopTypes.includes('favorite')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setShopTypes([...shopTypes, 'favorite']);
                      } else {
                        setShopTypes(shopTypes.filter(t => t !== 'favorite'));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label" htmlFor="shop-favorite" style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                    Favorite Shop+
                  </label>
                </div>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="shop-reputable"
                    checked={shopTypes.includes('reputable')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setShopTypes([...shopTypes, 'reputable']);
                      } else {
                        setShopTypes(shopTypes.filter(t => t !== 'reputable'));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label" htmlFor="shop-reputable" style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                    Street Shop
                  </label>
                </div>
                <button className="btn btn-link p-0 text-decoration-none" style={{ fontSize: '13px', color: '#ee4d2d', padding: 0 }}>
                  Thêm...
                </button>
              </div>

              {/* Condition */}
              <div className="mb-4" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' }}>
                <h6 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px', color: '#212121' }}>
                  Condition
                </h6>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="condition-new"
                    checked={condition === 'new' || condition === ''}
                    onChange={() => setCondition(condition === 'new' ? '' : 'new')}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label" htmlFor="condition-new" style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                    New
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="condition-used"
                    checked={condition === 'used'}
                    onChange={() => setCondition(condition === 'used' ? '' : 'used')}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label" htmlFor="condition-used" style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                    Used
                  </label>
                </div>
              </div>

              {/* Rating */}
              <div className="mb-4" style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: '16px' }}>
                <h6 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px', color: '#212121' }}>
                  Rating
                </h6>
                {[5, 4, 3, 2, 1].map((stars) => (
                  <div key={stars} className="form-check mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`rating-${stars}`}
                      checked={rating.includes(stars)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRating([...rating, stars]);
                        } else {
                          setRating(rating.filter(r => r !== stars));
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <label className="form-check-label d-flex align-items-center" htmlFor={`rating-${stars}`} style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                      <span style={{ color: '#ffc107', marginRight: '4px', fontSize: '12px' }}>
                        {'★'.repeat(stars)}
                      </span>
                      {stars === 5 ? '5 stars' : `${stars} stars & up`}
                    </label>
                  </div>
                ))}
              </div>

              {/* Promotions & Vouchers */}
              <div>
                <h6 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px', color: '#212121' }}>
                  Promotions & Vouchers
                </h6>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="promo-sale"
                    checked={promotions.includes('sale')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPromotions([...promotions, 'sale']);
                      } else {
                        setPromotions(promotions.filter(p => p !== 'sale'));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label" htmlFor="promo-sale" style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                    On Sale
                  </label>
                </div>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="promo-stock"
                    checked={promotions.includes('stock')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPromotions([...promotions, 'stock']);
                      } else {
                        setPromotions(promotions.filter(p => p !== 'stock'));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label" htmlFor="promo-stock" style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                    In Stock
                  </label>
                </div>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="promo-wholesale"
                    checked={promotions.includes('wholesale')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPromotions([...promotions, 'wholesale']);
                      } else {
                        setPromotions(promotions.filter(p => p !== 'wholesale'));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label" htmlFor="promo-wholesale" style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                    Retail Price (Wholesale)
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="promo-company"
                    checked={promotions.includes('company')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPromotions([...promotions, 'company']);
                      } else {
                        setPromotions(promotions.filter(p => p !== 'company'));
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label" htmlFor="promo-company" style={{ fontSize: '13px', color: '#212121', cursor: 'pointer' }}>
                    Company Available
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content - Product Grid */}
          <div className="col-md-9" style={{ paddingLeft: '8px' }}>
            {/* Sort Tabs */}
            <div style={{ background: '#fff', borderRadius: '4px', padding: '12px 16px', marginBottom: '12px' }}>
              <div className="d-flex align-items-center gap-4 flex-wrap">
                <span style={{ fontSize: '14px', color: '#757575' }}>Sort by:</span>
                <button
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => setSortBy('relevance')}
                  style={{
                    fontSize: '14px',
                    color: sortBy === 'relevance' ? '#ee4d2d' : '#212121',
                    fontWeight: sortBy === 'relevance' ? 600 : 400,
                    padding: '4px 8px',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: sortBy === 'relevance' ? '2px solid #ee4d2d' : '2px solid transparent',
                    borderRadius: 0
                  }}
                >
                  Relevance
                </button>
                <button
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => setSortBy('newest')}
                  style={{
                    fontSize: '14px',
                    color: sortBy === 'newest' ? '#ee4d2d' : '#212121',
                    fontWeight: sortBy === 'newest' ? 600 : 400,
                    padding: '4px 8px',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: sortBy === 'newest' ? '2px solid #ee4d2d' : '2px solid transparent',
                    borderRadius: 0
                  }}
                >
                  Newest
                </button>
                <button
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => setSortBy('bestselling')}
                  style={{
                    fontSize: '14px',
                    color: sortBy === 'bestselling' ? '#ee4d2d' : '#212121',
                    fontWeight: sortBy === 'bestselling' ? 600 : 400,
                    padding: '4px 8px',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: sortBy === 'bestselling' ? '2px solid #ee4d2d' : '2px solid transparent',
                    borderRadius: 0
                  }}
                >
                  Bestselling
                </button>
                <div className="dropdown d-inline">
                  <button
                    className="btn btn-link dropdown-toggle p-0 text-decoration-none"
                    type="button"
                    data-bs-toggle="dropdown"
                    style={{
                      fontSize: '14px',
                      color: sortBy.startsWith('price') ? '#ee4d2d' : '#212121',
                      fontWeight: sortBy.startsWith('price') ? 600 : 400,
                      padding: '4px 8px',
                      border: 'none',
                      background: 'transparent',
                      borderBottom: sortBy.startsWith('price') ? '2px solid #ee4d2d' : '2px solid transparent',
                      borderRadius: 0
                    }}
                  >
                    Price
                    {sortBy === 'price-asc' && ' ↑'}
                    {sortBy === 'price-desc' && ' ↓'}
                  </button>
                  <ul className="dropdown-menu">
                    <li>
                      <button className="dropdown-item" onClick={() => setSortBy('price-asc')}>
                        Price: Low to High ↑
                      </button>
                    </li>
                    <li>
                      <button className="dropdown-item" onClick={() => setSortBy('price-desc')}>
                        Price: High to Low ↓
                      </button>
                    </li>
                  </ul>
          </div>
        </div>
      </div>

            {pageItems.length === 0 ? (
              <div className="text-center py-5" style={{ background: '#fff', borderRadius: '4px' }}>
                <p style={{ fontSize: '16px', color: '#757575' }}>No products found.</p>
            </div>
            ) : (
              <>
                <div className="row g-2">
                  {pageItems.map((product) => {
                    const hasDiscount = product.originalPrice && Number(product.originalPrice) > Number(product.price);
                    const discountPercent = hasDiscount
                      ? Math.round(((Number(product.originalPrice) - Number(product.price)) / Number(product.originalPrice)) * 100)
                      : 0;

                    return (
                      <div className="col-6 col-sm-4 col-md-3 col-lg-2-4" key={product.id} style={{ marginBottom: '12px' }}>
                        <div
                          style={{
                            background: '#fff',
                            borderRadius: '4px',
                            overflow: 'hidden',
                  position: 'relative',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            cursor: 'pointer',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <Link
                            to={`/product/${product.id}`}
                            style={{ textDecoration: 'none', color: 'inherit', flex: 1, display: 'flex', flexDirection: 'column' }}
                          >
                            {/* Product Image */}
                            <div style={{ position: 'relative', paddingTop: '100%', background: '#f5f5f5' }}>
                  <img
                    src={imageUrls[product.id] || imgFallback}
                                alt={product.name}
                    onError={(e) => {
                      e.currentTarget.src = imgFallback;
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                              {/* Discount Badge */}
                              {hasDiscount && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: '8px',
                                    left: '8px',
                                    background: '#ee4d2d',
                                    color: '#fff',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: '2px',
                                    lineHeight: '1.2'
                                  }}
                                >
                                  -{discountPercent}%
                                </div>
                              )}
                              {/* Favorite/Mall Badge */}
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '8px',
                                  right: '8px',
                                  background: 'rgba(0,0,0,0.5)',
                                  color: '#fff',
                                  fontSize: '10px',
                                  fontWeight: 500,
                                  padding: '2px 6px',
                                  borderRadius: '2px'
                                }}
                              >
                                Favorite+
                              </div>
                </div>

                            {/* Product Info */}
                            <div style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                              <h6
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 400,
                                  color: '#212121',
                                  marginBottom: '8px',
                                  lineHeight: '1.4',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  minHeight: '32px',
                                  wordBreak: 'break-word'
                                }}
                              >
                                {product.name}
                              </h6>
                              <div style={{ marginTop: 'auto' }}>
                                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#ee4d2d' }}>
                                    {Number(product.price || 0).toLocaleString('vi-VN')}₫
                                  </div>
                                  {hasDiscount && (
                                    <div style={{ fontSize: '12px', color: '#757575', textDecoration: 'line-through' }}>
                                      {Number(product.originalPrice).toLocaleString('vi-VN')}₫
                                    </div>
                    )}
                  </div>
                                <div className="d-flex align-items-center gap-1 mb-1" style={{ fontSize: '11px' }}>
                                  <span style={{ color: '#ffc107', fontSize: '10px' }}>★★★★★</span>
                                  <span style={{ color: '#757575' }}>Sold {formatSoldCount(product.soldOf || 0)}</span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#757575', marginBottom: '2px' }}>
                                  Free Shipping
                                </div>
                                <div style={{ fontSize: '11px', color: '#757575' }}>
                                  Ho Chi Minh City
                </div>
              </div>
            </div>
                          </Link>
                        </div>
        </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="d-flex justify-content-center align-items-center gap-3 mt-4">
                    <button
                      className="btn btn-sm"
                      onClick={() => setPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      style={{
                        fontSize: '14px',
                        padding: '6px 12px',
                        background: currentPage === 1 ? '#f5f5f5' : '#fff',
                        color: currentPage === 1 ? '#ccc' : '#212121',
                        border: '1px solid #e5e5e5',
                        borderRadius: '2px'
                      }}
                    >
                      &lt;
                    </button>
                    <span style={{ fontSize: '14px', color: '#757575' }}>
                      {currentPage}/{totalPages}
                    </span>
                    <button
                      className="btn btn-sm"
                      onClick={() => setPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      style={{
                        fontSize: '14px',
                        padding: '6px 12px',
                        background: currentPage === totalPages ? '#f5f5f5' : '#fff',
                        color: currentPage === totalPages ? '#ccc' : '#212121',
                        border: '1px solid #e5e5e5',
                        borderRadius: '2px'
                      }}
                    >
                      &gt;
                    </button>
                  </div>
                )}

                {/* See More Button */}
                {currentPage < totalPages && (
                  <div className="text-center mt-4">
                    <button
                      className="btn"
                      onClick={() => setPage(currentPage + 1)}
                      style={{
                        fontSize: '14px',
                        padding: '10px 40px',
                        background: '#fff',
                        color: '#ee4d2d',
                        border: '1px solid #ee4d2d',
                        borderRadius: '2px',
                        fontWeight: 500
                      }}
                    >
                      See More
                    </button>
            </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 1200px) {
          .col-lg-2-4 {
            flex: 0 0 20%;
            max-width: 20%;
          }
        }
      `}</style>
    </div>
  );
};

export default SearchProduct;
