import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import imgFallback from "../../../assets/images/shop/6.png";
import {
    fetchProductImageById,
} from "../../../api/product.js";
import { searchProducts } from "../../../api/searchApi.js";
import { trackSearch } from "../../../api/tracking";
import { fetchCategories } from "../../../api/categoryApi.js";

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
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [imageUrls, setImageUrls] = useState({});
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [cached, setCached] = useState(false);

    // Search & Pagination
    const urlQuery = searchParams.get('q') || "";
    const [query, setQuery] = useState(urlQuery);
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState("relevance");

    // Filter states
    const [selectedAreas, setSelectedAreas] = useState([]);
    const [priceMin, setPriceMin] = useState("");
    const [priceMax, setPriceMax] = useState("");
    const [categories, setCategories] = useState([]);
    const [availableCategories, setAvailableCategories] = useState([]);
    const [showFilters, setShowFilters] = useState(true);

    const createdUrlsRef = useRef([]);

    // Load categories from backend
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const response = await fetchCategories();
                setAvailableCategories(response || []);
            } catch (error) {
                console.error("Failed to load categories:", error);
            }
        };
        loadCategories();
    }, []);

    // Load products with search API
    useEffect(() => {
        const loadProducts = async () => {
            setLoading(true);
            try {
                const response = await searchProducts({
                    query: debouncedQuery,
                    filters: {
                        priceMin: priceMin ? parseFloat(priceMin) : null,
                        priceMax: priceMax ? parseFloat(priceMax) : null,
                        categories: categories.length > 0 ? categories : null,
                        locations: selectedAreas.length > 0 ? selectedAreas : null,
                    },
                    page: page - 1, // Backend expects 0-indexed
                    size: PAGE_SIZE,
                    sortBy: sortBy
                });

                setProducts(response.products || []);
                setTotal(response.total || 0);
                setTotalPages(response.totalPages || 1);
                setCached(response.cached || false);

                // Track search if has query
                if (debouncedQuery && debouncedQuery.trim().length >= 2) {
                    trackSearch(debouncedQuery, response.total || 0);
                }
            } catch (error) {
                console.error("Failed to search products:", error);
                setProducts([]);
                setTotal(0);
                setTotalPages(1);
            } finally {
                setLoading(false);
            }
        };
        loadProducts();
    }, [debouncedQuery, page, sortBy, priceMin, priceMax, categories, selectedAreas]);

    // Sync URL query parameter
    useEffect(() => {
        const urlQuery = searchParams.get('q') || "";
        if (urlQuery !== query) {
            setQuery(urlQuery);
        }
    }, [searchParams, query]);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
        return () => clearTimeout(t);
    }, [query]);

    // Reset to page 1 when filters/search change
    useEffect(() => {
        setPage(1);
    }, [debouncedQuery, sortBy, priceMin, priceMax, categories, selectedAreas]);

    // Use currentPage from API response
    const currentPage = Math.min(page, totalPages);

    // Load images for current page
    useEffect(() => {
        if (products.length === 0) {
            setImageUrls({});
            return;
        }

        let isActive = true;
        const newUrls = {};
        const tempCreatedUrls = [];

        const loadImages = async () => {
            await Promise.all(
                products.map(async (product) => {
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
    }, [products]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            navigate(`/shop?q=${encodeURIComponent(query.trim())}`);
        }
    };

    const clearAllFilters = () => {
        setSelectedAreas([]);
        setPriceMin("");
        setPriceMax("");
        setCategories([]);
    };

    const setQuickPrice = (min, max) => {
        setPriceMin(min ? min.toString() : "");
        setPriceMax(max ? max.toString() : "");
    };

    const removeFilter = (type, value) => {
        if (type === 'price') {
            setPriceMin("");
            setPriceMax("");
        } else if (type === 'location') {
            setSelectedAreas(selectedAreas.filter(a => a !== value));
        } else if (type === 'category') {
            setCategories(categories.filter(c => c !== value));
        }
    };

    const hasActiveFilters = () => {
        return priceMin || priceMax || selectedAreas.length > 0 || categories.length > 0;
    };

    const formatSoldCount = (count) => {
        if (!count || count === 0) return "0";
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}k`.replace('.0', '');
        }
        return count.toString();
    };

    const formatPrice = (price) => {
        if (!price) return "";
        const num = parseFloat(price);
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}tr`.replace('.0', 'tr');
        }
        if (num >= 1000) {
            return `${(num / 1000).toFixed(0)}k`;
        }
        return num.toString();
    };

    // Vietnamese provinces/cities
    const provinces = [
        "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ", "Bình Dương"
    ];

    if (loading) {
        return (
            <div className="container py-5 text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">{t('search.loading')}</span>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', paddingTop: '12px', paddingBottom: '20px', background: '#f5f5f5' }}>
            <div className="container" style={{ maxWidth: '1250px' }}>
                {/* Search Result Title */}
                <div style={{ marginBottom: '12px', fontSize: '16px', color: '#262626', fontWeight: 500 }}>
                    {t('search.searchResults', { keyword: debouncedQuery || query || '' })}
                    {total > 0 && <span style={{ color: '#757575', fontWeight: 400 }}> ({total} {t('search.products')})</span>}
                </div>

                {/* Active Filters Bar */}
                {hasActiveFilters() && (
                    <div style={{ background: '#fff', borderRadius: '4px', padding: '10px 12px', marginBottom: '12px', border: '1px solid #f0f0f0' }}>
                        <div className="d-flex align-items-center flex-wrap gap-2">
                            <span style={{ fontSize: '13px', color: '#757575', marginRight: '4px' }}>
                                <i className="fa fa-filter" style={{ marginRight: '6px' }}></i>
                                {t('search.activeFilters')}:
                            </span>
                            {(priceMin || priceMax) && (
                                <span
                                    style={{
                                        background: '#fff3f0',
                                        color: '#ee4d2d',
                                        fontSize: '12px',
                                        padding: '4px 8px',
                                        borderRadius: '12px',
                                        border: '1px solid #ee4d2d',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                    onClick={() => removeFilter('price')}
                                >
                                    {formatPrice(priceMin) || '0'} - {formatPrice(priceMax) || '∞'}
                                    <i className="fa fa-times" style={{ fontSize: '10px' }}></i>
                                </span>
                            )}
                            {selectedAreas.map(area => (
                                <span
                                    key={area}
                                    style={{
                                        background: '#fff3f0',
                                        color: '#ee4d2d',
                                        fontSize: '12px',
                                        padding: '4px 8px',
                                        borderRadius: '12px',
                                        border: '1px solid #ee4d2d',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                    onClick={() => removeFilter('location', area)}
                                >
                                    {area}
                                    <i className="fa fa-times" style={{ fontSize: '10px' }}></i>
                                </span>
                            ))}
                            {categories.map(cat => (
                                <span
                                    key={cat}
                                    style={{
                                        background: '#fff3f0',
                                        color: '#ee4d2d',
                                        fontSize: '12px',
                                        padding: '4px 8px',
                                        borderRadius: '12px',
                                        border: '1px solid #ee4d2d',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                    onClick={() => removeFilter('category', cat)}
                                >
                                    {cat}
                                    <i className="fa fa-times" style={{ fontSize: '10px' }}></i>
                                </span>
                            ))}
                            <button
                                onClick={clearAllFilters}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#ee4d2d',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    padding: '0 4px'
                                }}
                            >
                                {t('search.clearAll')}
                            </button>
                        </div>
                    </div>
                )}

                <div className="row g-3">
                    {/* Left Sidebar - Filters */}
                    <div className="col-12 col-lg-2 col-md-3">
                        <div style={{ position: 'sticky', top: '70px' }}>
                            {/* Mobile Toggle Button */}
                            <button
                                className="btn w-100 d-lg-none mb-2"
                                onClick={() => setShowFilters(!showFilters)}
                                style={{
                                    background: '#fff',
                                    border: '1px solid #ee4d2d',
                                    color: '#ee4d2d',
                                    fontSize: '14px',
                                    padding: '8px'
                                }}
                            >
                                <i className={`fa fa-${showFilters ? 'minus' : 'plus'}`} style={{ marginRight: '8px' }}></i>
                                {showFilters ? t('search.hideFilters') : t('search.showFilters')}
                            </button>

                            <div style={{
                                borderRadius: '4px',
                                padding: '12px',
                                border: '1px solid #f0f0f0',
                                background: '#fff',
                                display: showFilters ? 'block' : 'none'
                            }} className="d-lg-block">
                                <h6 style={{ fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '12px' }}>
                                    <i className="fa fa-sliders" style={{ marginRight: '8px' }}></i>
                                    {t('search.searchFilters')}
                                </h6>

                                {/* Smart Price Range */}
                                <div className="mb-3" style={{ borderBottom: '1px solid #f5f5f5', paddingBottom: '12px' }}>
                                    <h6 style={{ fontSize: '13px', fontWeight: 600, color: '#444', marginBottom: '8px' }}>
                                        {t('search.priceRange')}
                                    </h6>

                                    {/* Quick Price Buttons */}
                                    <div className="d-flex flex-wrap gap-1 mb-2">
                                        {[
                                            { label: '< 100k', min: null, max: 100000 },
                                            { label: '100k-500k', min: 100000, max: 500000 },
                                            { label: '500k-1tr', min: 500000, max: 1000000 },
                                            { label: '> 1tr', min: 1000000, max: null }
                                        ].map(preset => (
                                            <button
                                                key={preset.label}
                                                onClick={() => setQuickPrice(preset.min, preset.max)}
                                                style={{
                                                    fontSize: '11px',
                                                    padding: '4px 8px',
                                                    background: (priceMin === (preset.min?.toString() || "") &&
                                                        priceMax === (preset.max?.toString() || "")) ? '#ee4d2d' : '#fff',
                                                    color: (priceMin === (preset.min?.toString() || "") &&
                                                        priceMax === (preset.max?.toString() || "")) ? '#fff' : '#555',
                                                    border: '1px solid #e5e5e5',
                                                    borderRadius: '12px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Range */}
                                    <div className="d-flex gap-2">
                                        <input
                                            type="number"
                                            className="form-control form-control-sm"
                                            placeholder="Min"
                                            value={priceMin}
                                            onChange={(e) => setPriceMin(e.target.value)}
                                            style={{ fontSize: '12px', height: '30px' }}
                                        />
                                        <span style={{ alignSelf: 'center', color: '#999' }}>-</span>
                                        <input
                                            type="number"
                                            className="form-control form-control-sm"
                                            placeholder="Max"
                                            value={priceMax}
                                            onChange={(e) => setPriceMax(e.target.value)}
                                            style={{ fontSize: '12px', height: '30px' }}
                                        />
                                    </div>
                                </div>

                                {/* Category */}
                                {availableCategories.length > 0 && (
                                    <div className="mb-3" style={{ borderBottom: '1px solid #f5f5f5', paddingBottom: '12px' }}>
                                        <h6 style={{ fontSize: '13px', fontWeight: 600, color: '#444', marginBottom: '8px' }}>
                                            {t('search.category')}
                                        </h6>
                                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                            {availableCategories.map((cat) => (
                                                <div key={cat.id} className="form-check mb-2">
                                                    <input
                                                        className="form-check-input"
                                                        type="checkbox"
                                                        id={`cat-${cat.id}`}
                                                        checked={categories.includes(cat.name)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setCategories([...categories, cat.name]);
                                                            } else {
                                                                setCategories(categories.filter(c => c !== cat.name));
                                                            }
                                                        }}
                                                        style={{ cursor: 'pointer', marginTop: '3px' }}
                                                    />
                                                    <label className="form-check-label" htmlFor={`cat-${cat.id}`} style={{ fontSize: '13px', color: '#555', cursor: 'pointer' }}>
                                                        {cat.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Location */}
                                <div className="mb-3">
                                    <h6 style={{ fontSize: '13px', fontWeight: 600, color: '#444', marginBottom: '8px' }}>
                                        {t('search.location')}
                                    </h6>
                                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                        {provinces.map((province) => (
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
                                                    style={{ cursor: 'pointer', marginTop: '3px' }}
                                                />
                                                <label className="form-check-label" htmlFor={`area-${province}`} style={{ fontSize: '13px', color: '#555', cursor: 'pointer' }}>
                                                    {province}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    className="btn w-100"
                                    onClick={clearAllFilters}
                                    style={{
                                        fontSize: '13px',
                                        padding: '8px',
                                        background: '#fff',
                                        color: '#ee4d2d',
                                        border: '1px solid #ee4d2d',
                                        borderRadius: '2px',
                                        fontWeight: 600
                                    }}
                                >
                                    <i className="fa fa-times-circle" style={{ marginRight: '6px' }}></i>
                                    {t('search.clearAll')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Content - Product Grid */}
                    <div className="col-12 col-lg-10 col-md-9">
                        {/* Sort Tabs */}
                        <div style={{ background: '#fff', borderRadius: '4px', padding: '8px 10px', marginBottom: '10px', border: '1px solid #f0f0f0' }}>
                            <div className="d-flex align-items-center flex-wrap" style={{ gap: '6px' }}>
                                <span style={{ fontSize: '13px', color: '#757575', marginRight: '4px' }}>{t('search.sortBy')}</span>
                                {[
                                    { key: 'relevance', label: t('search.relevance') },
                                    { key: 'newest', label: t('search.newest') },
                                    { key: 'bestselling', label: t('search.bestselling') }
                                ].map((btn) => {
                                    const active = sortBy === btn.key;
                                    return (
                                        <button
                                            key={btn.key}
                                            className="btn"
                                            onClick={() => setSortBy(btn.key)}
                                            style={{
                                                padding: '6px 10px',
                                                fontSize: '12.5px',
                                                fontWeight: active ? 600 : 500,
                                                color: active ? '#fff' : '#555',
                                                background: active ? '#ee4d2d' : '#fff',
                                                border: active ? '1px solid #ee4d2d' : '1px solid #e5e5e5',
                                                borderRadius: '2px',
                                                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'
                                            }}
                                        >
                                            {btn.label}
                                        </button>
                                    );
                                })}

                                {/* Price dropdown */}
                                <div className="dropdown">
                                    <button
                                        className="btn dropdown-toggle"
                                        type="button"
                                        data-bs-toggle="dropdown"
                                        style={{
                                            padding: '6px 10px',
                                            fontSize: '12.5px',
                                            fontWeight: sortBy.startsWith('price') ? 600 : 500,
                                            color: sortBy.startsWith('price') ? '#fff' : '#555',
                                            background: sortBy.startsWith('price') ? '#ee4d2d' : '#fff',
                                            border: sortBy.startsWith('price') ? '1px solid #ee4d2d' : '1px solid #e5e5e5',
                                            borderRadius: '2px',
                                            boxShadow: sortBy.startsWith('price') ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'
                                        }}
                                    >
                                        {t('search.price')}
                                    </button>
                                    <ul className="dropdown-menu">
                                        <li>
                                            <button className="dropdown-item" onClick={() => setSortBy('price-asc')}>
                                                {t('search.priceLowToHigh')}
                                            </button>
                                        </li>
                                        <li>
                                            <button className="dropdown-item" onClick={() => setSortBy('price-desc')}>
                                                {t('search.priceHighToLow')}
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {products.length === 0 ? (
                            <div className="text-center py-5" style={{ background: '#fff', borderRadius: '4px' }}>
                                <i className="fa fa-search" style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }}></i>
                                <p style={{ fontSize: '16px', color: '#757575' }}>{t('search.noProductsFound')}</p>
                            </div>
                        ) : (
                            <>
                                <div className="row g-2 g-sm-3">
                                    {products.map((product) => {
                                        const hasDiscount = product.originalPrice && Number(product.originalPrice) > Number(product.price);
                                        const discountPercent = hasDiscount
                                            ? Math.round(((Number(product.originalPrice) - Number(product.price)) / Number(product.originalPrice)) * 100)
                                            : 0;

                                        return (
                                            <div className="col-6 col-sm-4 col-md-3 col-lg-2-4 col-xl-2-4" key={product.id} style={{ marginBottom: '10px' }}>
                                                <div
                                                    style={{
                                                        background: '#fff',
                                                        borderRadius: '3px',
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
                                                        <div style={{ position: 'relative', paddingTop: '100%', background: '#f7f7f7' }}>
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
                                                        </div>

                                                        {/* Product Info */}
                                                        <div style={{ padding: '8px 7px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                            <h6
                                                                style={{
                                                                    fontSize: '11.5px',
                                                                    fontWeight: 400,
                                                                    color: '#212121',
                                                                    marginBottom: '6px',
                                                                    lineHeight: '1.35',
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
                                                                <div className="d-flex align-items-center gap-1 mb-1 flex-wrap">
                                                                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#ee4d2d' }}>
                                                                        {Number(product.price || 0).toLocaleString('vi-VN')}₫
                                                                    </div>
                                                                    {hasDiscount && (
                                                                        <div style={{ fontSize: '11px', color: '#9e9e9e', textDecoration: 'line-through' }}>
                                                                            {Number(product.originalPrice).toLocaleString('vi-VN')}₫
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="d-flex align-items-center gap-1 mb-1" style={{ fontSize: '10px' }}>
                                                                    {product.averageRating && product.averageRating > 0 ? (
                                                                        <>
                                                                            <span style={{ color: '#ffc107', fontSize: '9px' }}>
                                                                                {'★'.repeat(Math.floor(product.averageRating))}{'☆'.repeat(5 - Math.floor(product.averageRating))}
                                                                            </span>
                                                                            <span style={{ color: '#757575' }}>({product.averageRating.toFixed(1)})</span>
                                                                        </>
                                                                    ) : (
                                                                        <span style={{ color: '#d9d9d9', fontSize: '9px' }}>☆☆☆☆☆</span>
                                                                    )}
                                                                    <span style={{ color: '#9e9e9e', marginLeft: '4px' }}>
                                                                        {t('search.sold')} {formatSoldCount(product.soldCount || 0)}
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: '10px', color: '#9e9e9e', marginBottom: '1px' }}>
                                                                    {t('search.freeShipping')}
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
                            </>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
        @media (min-width: 1200px) {
          .col-lg-2-4, .col-xl-2-4 {
            flex: 0 0 20%;
            max-width: 20%;
          }
        }
        @media (max-width: 1199px) and (min-width: 992px) {
          .col-lg-3 {
            flex: 0 0 25%;
            max-width: 25%;
          }
        }
        @media (max-width: 991px) and (min-width: 768px) {
          .col-md-4 {
            flex: 0 0 33.3333%;
            max-width: 33.3333%;
          }
        }
        @media (max-width: 767px) {
          .col-sm-6 {
            flex: 0 0 50%;
            max-width: 50%;
          }
        }
      `}</style>
        </div >
    );
};

export default SearchProduct;
