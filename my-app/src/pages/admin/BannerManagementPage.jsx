import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getAllBanners, deleteBanner, toggleBannerActive, createBanner, updateBanner } from '../../api/banner';
import { fetchImageById } from '../../api/image';
import Swal from 'sweetalert2';
import '../../assets/admin/css/BannerManagement.css';

const BannerManagementPage = () => {
    const [banners, setBanners] = useState([]);
    const [filteredBanners, setFilteredBanners] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPosition, setFilterPosition] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        altText: '',
        linkUrl: '',
        linkType: 'NONE',
        targetId: '',
        openInNewTab: false,
        position: 'LEFT_MAIN',
        displayOrder: 0,
        startDate: '',
        endDate: '',
        isActive: true
    });

    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [bannerImageUrls, setBannerImageUrls] = useState({}); // Store loaded image URLs by banner ID
    const createdUrlsRef = useRef([]); // Track created blob URLs for cleanup

    useEffect(() => {
        fetchBanners();

        // Cleanup blob URLs on unmount
        return () => {
            createdUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            createdUrlsRef.current = [];
        };
    }, []);

    useEffect(() => {
        filterBanners();
    }, [banners, searchTerm, filterPosition, filterStatus]);

    const fetchBanners = async () => {
        try {
            setLoading(true);
            const data = await getAllBanners();
            setBanners(data);

            // Load images for all banners
            await loadBannerImages(data);
        } catch (error) {
            console.error('Error fetching banners:', error);
            Swal.fire('Error!', 'Failed to fetch banners.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadBannerImages = async (banners) => {
        const imagePromises = banners.map(async (banner) => {
            // Priority: imageId > imageUrl
            if (banner.imageId) {
                try {
                    const response = await fetchImageById(banner.imageId);
                    const blob = new Blob([response.data], {
                        type: response.headers['content-type'] || 'image/jpeg'
                    });
                    const url = URL.createObjectURL(blob);
                    createdUrlsRef.current.push(url);
                    return { bannerId: banner.id, url };
                } catch (error) {
                    console.error(`Error loading image for banner ${banner.id}:`, error);
                    // Fallback to imageUrl if fetch fails
                    if (banner.imageUrl) {
                        return { bannerId: banner.id, url: buildImageUrl(banner.imageUrl) };
                    }
                    return { bannerId: banner.id, url: null };
                }
            } else if (banner.imageUrl) {
                // Use imageUrl as fallback
                return { bannerId: banner.id, url: buildImageUrl(banner.imageUrl) };
            }
            return { bannerId: banner.id, url: null };
        });

        const results = await Promise.all(imagePromises);
        const urlMap = {};
        results.forEach(({ bannerId, url }) => {
            if (url) {
                urlMap[bannerId] = url;
            }
        });
        setBannerImageUrls(prev => ({ ...prev, ...urlMap }));
    };

    // Helper to build full image URL from relative path or return full URL as-is
    const buildImageUrl = (imageUrl) => {
        if (!imageUrl) return null;

        // If already a full URL (starts with http:// or https://), return as-is
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return imageUrl;
        }

        // For relative paths (e.g., /file-storage/get/xxx or file-storage/get/xxx):
        // In development: Vite proxy will forward /file-storage/* to backend
        // In production: nginx/API gateway handles the routing
        // So we just need to ensure the path starts with /
        const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
        return path;
    };

    const filterBanners = () => {
        let filtered = [...banners];

        if (searchTerm) {
            filtered = filtered.filter(banner =>
                banner.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                banner.description?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (filterPosition !== 'all') {
            filtered = filtered.filter(banner => banner.position === filterPosition);
        }

        if (filterStatus !== 'all') {
            const isActive = filterStatus === 'active';
            filtered = filtered.filter(banner => banner.isActive === isActive);
        }

        setFilteredBanners(filtered);
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
            try {
                await deleteBanner(id);
                setBanners(prev => prev.filter(b => b.id !== id));
                Swal.fire('Deleted!', 'Banner has been deleted.', 'success');
            } catch (error) {
                console.error('Error deleting banner:', error);
                Swal.fire('Error!', 'Failed to delete banner.', 'error');
            }
        }
    };

    const handleToggleActive = async (id) => {
        try {
            await toggleBannerActive(id);
            setBanners(prev => prev.map(b =>
                b.id === id ? { ...b, isActive: !b.isActive } : b
            ));
            Swal.fire('Success!', 'Banner status updated.', 'success');
        } catch (error) {
            console.error('Error toggling banner:', error);
            Swal.fire('Error!', 'Failed to update banner status.', 'error');
        }
    };

    const handleEdit = (banner) => {
        setEditingBanner(banner);
        setFormData({
            title: banner.title || '',
            description: banner.description || '',
            altText: banner.altText || '',
            linkUrl: banner.linkUrl || '',
            linkType: banner.linkType || 'NONE',
            targetId: banner.targetId || '',
            openInNewTab: banner.openInNewTab || false,
            position: banner.position || 'LEFT_MAIN',
            displayOrder: banner.displayOrder || 0,
            startDate: banner.startDate ? banner.startDate.substring(0, 16) : '',
            endDate: banner.endDate ? banner.endDate.substring(0, 16) : '',
            isActive: banner.isActive !== undefined ? banner.isActive : true
        });
        // Use loaded image URL if available, otherwise use imageUrl from banner
        setImagePreview(bannerImageUrls[banner.id] || banner.imageUrl);
        setShowModal(true);
    };

    const handleCreate = () => {
        setEditingBanner(null);
        setFormData({
            title: '',
            description: '',
            altText: '',
            linkUrl: '',
            linkType: 'NONE',
            targetId: '',
            openInNewTab: false,
            position: 'LEFT_MAIN',
            displayOrder: 0,
            startDate: '',
            endDate: '',
            isActive: true
        });
        setImageFile(null);
        setImagePreview(null);
        setShowModal(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title) {
            Swal.fire('Error!', 'Title is required.', 'error');
            return;
        }

        if (!editingBanner && !imageFile) {
            Swal.fire('Error!', 'Image is required for new banner.', 'error');
            return;
        }

        try {
            const data = new FormData();

            const requestData = {
                title: formData.title,
                description: formData.description,
                altText: formData.altText,
                linkUrl: formData.linkUrl,
                linkType: formData.linkType,
                targetId: formData.targetId,
                openInNewTab: formData.openInNewTab,
                position: formData.position,
                displayOrder: parseInt(formData.displayOrder),
                startDate: formData.startDate || null,
                endDate: formData.endDate || null,
                isActive: formData.isActive
            };

            data.append('request', new Blob([JSON.stringify(requestData)], { type: 'application/json' }));

            if (imageFile) {
                data.append('image', imageFile);
            }

            let savedBanner;
            if (editingBanner) {
                savedBanner = await updateBanner(editingBanner.id, data);
                Swal.fire('Success!', 'Banner updated successfully.', 'success');
            } else {
                savedBanner = await createBanner(data);
                Swal.fire('Success!', 'Banner created successfully.', 'success');
            }

            setShowModal(false);
            setImageFile(null);
            setImagePreview(null);

            // Reload banners and images
            await fetchBanners();
        } catch (error) {
            console.error('Error saving banner:', error);
            Swal.fire('Error!', 'Failed to save banner.', 'error');
        }
    };

    const getPositionBadge = (position) => {
        const badges = {
            'LEFT_MAIN': { label: 'Main Left', color: 'primary' },
            'RIGHT_TOP': { label: 'Top Right', color: 'success' },
            'RIGHT_BOTTOM': { label: 'Bottom Right', color: 'info' }
        };
        const badge = badges[position] || { label: position, color: 'secondary' };
        return <span className={`position-badge badge-${badge.color}`}>{badge.label}</span>;
    };

    const stats = {
        total: banners.length,
        active: banners.filter(b => b.isActive).length,
        leftMain: banners.filter(b => b.position === 'LEFT_MAIN').length,
        rightTop: banners.filter(b => b.position === 'RIGHT_TOP').length,
        rightBottom: banners.filter(b => b.position === 'RIGHT_BOTTOM').length
    };

    return (
        <div className="banner-management-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Banner Management</h1>
                    <p className="page-subtitle">Manage promotional banners and advertisements</p>
                </div>
                <button className="btn-create" onClick={handleCreate}>
                    <i className="fas fa-plus"></i> Create Banner
                </button>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon stat-icon-total">
                        <i className="fas fa-images"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Total Banners</span>
                        <h2 className="stat-value">{stats.total}</h2>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon stat-icon-active">
                        <i className="fas fa-check-circle"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Active Banners</span>
                        <h2 className="stat-value">{stats.active}</h2>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon stat-icon-left">
                        <i className="fas fa-rectangle-landscape"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Left Main</span>
                        <h2 className="stat-value">{stats.leftMain}</h2>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon stat-icon-right">
                        <i className="fas fa-th-large"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Right Banners</span>
                        <h2 className="stat-value">{stats.rightTop + stats.rightBottom}</h2>
                    </div>
                </div>
            </div>

            {/* Banner Table Card */}
            <div className="card banners-table-card">
                <div className="card-header">
                    <h3 className="card-title">All Banners</h3>
                    <div className="header-actions">
                        <div className="search-box">
                            <i className="fas fa-search"></i>
                            <input
                                type="text"
                                placeholder="Search banners..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>

                        <select
                            value={filterPosition}
                            onChange={(e) => setFilterPosition(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Positions</option>
                            <option value="LEFT_MAIN">Left Main</option>
                            <option value="RIGHT_TOP">Right Top</option>
                            <option value="RIGHT_BOTTOM">Right Bottom</option>
                        </select>

                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                <div className="card-body">
                    {loading ? (
                        <div className="loading-state">
                            <i className="fas fa-spinner fa-spin"></i>
                            <p>Loading banners...</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="banners-table">
                                <thead>
                                    <tr>
                                        <th>Preview</th>
                                        <th>Title</th>
                                        <th>Position</th>
                                        <th>Display Order</th>
                                        <th>Schedule</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredBanners.length > 0 ? (
                                        filteredBanners.map((banner) => (
                                            <tr key={banner.id}>
                                                <td>
                                                    <div className="banner-preview">
                                                        {bannerImageUrls[banner.id] ? (
                                                            <img src={bannerImageUrls[banner.id]} alt={banner.altText || banner.title} />
                                                        ) : banner.imageId ? (
                                                            <div className="no-image">
                                                                <i className="fas fa-spinner fa-spin"></i>
                                                                <span>Loading...</span>
                                                            </div>
                                                        ) : (
                                                            <div className="no-image">
                                                                <i className="fas fa-image"></i>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="banner-title-cell">
                                                        <span className="banner-title-text">{banner.title}</span>
                                                        {banner.description && (
                                                            <span className="banner-desc">{banner.description.substring(0, 50)}...</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>{getPositionBadge(banner.position)}</td>
                                                <td>
                                                    <span className="order-badge">{banner.displayOrder}</span>
                                                </td>
                                                <td>
                                                    <div className="schedule-cell">
                                                        {banner.startDate && (
                                                            <span className="schedule-date">
                                                                <i className="fas fa-calendar-start"></i>
                                                                {new Date(banner.startDate).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                        {banner.endDate && (
                                                            <span className="schedule-date">
                                                                <i className="fas fa-calendar-end"></i>
                                                                {new Date(banner.endDate).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                        {!banner.startDate && !banner.endDate && (
                                                            <span className="schedule-permanent">Always</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <label className="toggle-switch">
                                                        <input
                                                            type="checkbox"
                                                            checked={banner.isActive}
                                                            onChange={() => handleToggleActive(banner.id)}
                                                        />
                                                        <span className="toggle-slider"></span>
                                                    </label>
                                                </td>
                                                <td>
                                                    <div className="action-buttons">
                                                        <button
                                                            onClick={() => handleEdit(banner)}
                                                            className="btn-action btn-edit"
                                                            title="Edit Banner"
                                                        >
                                                            <i className="fas fa-edit"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(banner.id)}
                                                            className="btn-action btn-delete"
                                                            title="Delete Banner"
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="no-data">
                                                <i className="fas fa-inbox"></i>
                                                <p>No banners found</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingBanner ? 'Edit Banner' : 'Create New Banner'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-grid">
                                    <div className="form-group full-width">
                                        <label>Title *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="form-group full-width">
                                        <label>Description</label>
                                        <textarea
                                            className="form-input"
                                            rows="3"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group full-width">
                                        <label>Banner Image {!editingBanner && '*'}</label>
                                        <input
                                            type="file"
                                            className="form-input"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            required={!editingBanner}
                                        />
                                        {imagePreview && (
                                            <div className="image-preview-container">
                                                <img src={imagePreview} alt="Preview" className="image-preview" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="form-group">
                                        <label>Alt Text</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={formData.altText}
                                            onChange={(e) => setFormData({ ...formData, altText: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Position *</label>
                                        <select
                                            className="form-input"
                                            value={formData.position}
                                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                            required
                                        >
                                            <option value="LEFT_MAIN">Left Main (Large)</option>
                                            <option value="RIGHT_TOP">Right Top (Small)</option>
                                            <option value="RIGHT_BOTTOM">Right Bottom (Small)</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Display Order</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={formData.displayOrder}
                                            onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                                            min="0"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Link URL</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={formData.linkUrl}
                                            onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                                            placeholder="https://..."
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Link Type</label>
                                        <select
                                            className="form-input"
                                            value={formData.linkType}
                                            onChange={(e) => setFormData({ ...formData, linkType: e.target.value })}
                                        >
                                            <option value="NONE">None</option>
                                            <option value="INTERNAL">Internal</option>
                                            <option value="EXTERNAL">External</option>
                                            <option value="PRODUCT">Product</option>
                                            <option value="CATEGORY">Category</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Target ID</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={formData.targetId}
                                            onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
                                            placeholder="Product/Category ID"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Start Date</label>
                                        <input
                                            type="datetime-local"
                                            className="form-input"
                                            value={formData.startDate}
                                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>End Date</label>
                                        <input
                                            type="datetime-local"
                                            className="form-input"
                                            value={formData.endDate}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        />
                                    </div>

                                    <div className="form-group checkbox-group">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={formData.openInNewTab}
                                                onChange={(e) => setFormData({ ...formData, openInNewTab: e.target.checked })}
                                            />
                                            <span>Open in New Tab</span>
                                        </label>
                                    </div>

                                    <div className="form-group checkbox-group">
                                        <label className="checkbox-label">
                                            <input
                                                type="checkbox"
                                                checked={formData.isActive}
                                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                            />
                                            <span>Active</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-save">
                                    <i className="fas fa-save"></i> {editingBanner ? 'Update' : 'Create'} Banner
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BannerManagementPage;
