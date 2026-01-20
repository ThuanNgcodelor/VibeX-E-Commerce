import React, { useEffect, useState } from 'react';
import {
    getAllSubscriptionPlans, deleteSubscriptionPlan, toggleSubscriptionPlanActive,
    createSubscriptionPlan, updateSubscriptionPlan,
    getPlanPricing, createPlanPricing, updatePlanPricing, deletePlanPricing,
    getPlanFeatures, createPlanFeature, updatePlanFeature, deletePlanFeature, reorderPlanFeatures
} from '../../api/subscriptionPlan';
import PricingManagement from '../../components/admin/subscription/PricingManagement';
import FeaturesManagement from '../../components/admin/subscription/FeaturesManagement';
import Swal from 'sweetalert2';
import '../../assets/admin/css/SubscriptionPlanManagement.css';
import '../../assets/admin/css/Validation.css';

const SubscriptionPlanManagementPage = () => {
    const [plans, setPlans] = useState([]);
    const [filteredPlans, setFilteredPlans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // FREESHIP_XTRA, VOUCHER_XTRA, BOTH
    const [filterStatus, setFilterStatus] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [activeTab, setActiveTab] = useState('basic'); // 'basic', 'pricing', 'features'

    // Pricing and Features state
    const [pricingList, setPricingList] = useState([]);
    const [featuresList, setFeaturesList] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        description: '',
        subscriptionType: 'FREESHIP_XTRA',
        colorHex: '#4caf50',
        icon: 'truck',
        commissionPaymentRate: 0.04,
        commissionFixedRate: 0.04,
        commissionFreeshipRate: 0.08,
        commissionVoucherRate: 0.05,
        voucherMaxPerItem: 50000,
        freeshipEnabled: false,
        voucherEnabled: false,
        isActive: true
    });
    const [errors, setErrors] = useState({});

    const validate = () => {
        const newErrors = {};
        if (!formData.code.trim()) newErrors.code = 'Code is required';
        if (!formData.name.trim()) newErrors.name = 'Name is required';
        if (!formData.subscriptionType) newErrors.subscriptionType = 'Type is required';

        // Commission rates validation (0-100)
        if (formData.commissionPaymentRate < 0 || formData.commissionPaymentRate > 1) newErrors.commissionPaymentRate = 'Rate must be 0-1';
        if (formData.commissionFixedRate < 0 || formData.commissionFixedRate > 1) newErrors.commissionFixedRate = 'Rate must be 0-1';
        if (formData.commissionFreeshipRate < 0 || formData.commissionFreeshipRate > 1) newErrors.commissionFreeshipRate = 'Rate must be 0-1';
        if (formData.commissionVoucherRate < 0 || formData.commissionVoucherRate > 1) newErrors.commissionVoucherRate = 'Rate must be 0-1';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    useEffect(() => {
        filterPlans();
    }, [plans, searchTerm, filterType, filterStatus]);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const data = await getAllSubscriptionPlans();
            setPlans(data);
        } catch (error) {
            console.error('Error fetching plans:', error);
            Swal.fire('Error!', 'Failed to fetch subscription plans.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const filterPlans = () => {
        let filtered = [...plans];

        if (searchTerm) {
            filtered = filtered.filter(plan =>
                plan.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                plan.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                plan.description?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (filterType !== 'all') {
            filtered = filtered.filter(plan => plan.subscriptionType === filterType);
        }

        if (filterStatus !== 'all') {
            const isActive = filterStatus === 'active';
            filtered = filtered.filter(plan => plan.isActive === isActive);
        }

        setFilteredPlans(filtered);
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
                await deleteSubscriptionPlan(id);
                setPlans(prev => prev.filter(p => p.id !== id));
                Swal.fire('Deleted!', 'Plan has been deleted.', 'success');
            } catch (error) {
                console.error('Error deleting plan:', error);
                Swal.fire('Error!', error.response?.data?.message || 'Failed to delete plan.', 'error');
            }
        }
    };

    const handleToggleActive = async (id) => {
        try {
            await toggleSubscriptionPlanActive(id);
            setPlans(prev => prev.map(p =>
                p.id === id ? { ...p, isActive: !p.isActive } : p
            ));
            Swal.fire('Success!', 'Plan status updated.', 'success');
        } catch (error) {
            console.error('Error toggling plan:', error);
            Swal.fire('Error!', 'Failed to update plan status.', 'error');
        }
    };

    const loadPlanDetails = async (planId) => {
        try {
            setLoadingDetails(true);
            const [pricing, features] = await Promise.all([
                getPlanPricing(planId),
                getPlanFeatures(planId)
            ]);
            setPricingList(pricing || []);
            setFeaturesList(features || []);
        } catch (error) {
            console.error('Error loading plan details:', error);
            setPricingList([]);
            setFeaturesList([]);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleEdit = async (plan) => {
        setEditingPlan(plan);
        setFormData({
            code: plan.code || '',
            name: plan.name || '',
            description: plan.description || '',
            subscriptionType: plan.subscriptionType || 'FREESHIP_XTRA',
            colorHex: plan.colorHex || '#4caf50',
            icon: plan.icon || 'truck',
            commissionPaymentRate: plan.commissionPaymentRate || 0.04,
            commissionFixedRate: plan.commissionFixedRate || 0.04,
            commissionFreeshipRate: plan.commissionFreeshipRate || 0.08,
            commissionVoucherRate: plan.commissionVoucherRate || 0.05,
            voucherMaxPerItem: plan.voucherMaxPerItem || 50000,
            freeshipEnabled: plan.freeshipEnabled || false,
            voucherEnabled: plan.voucherEnabled || false,
            isActive: plan.isActive !== undefined ? plan.isActive : true
        });
        setActiveTab('basic');
        setShowModal(true);

        // Load pricing and features if editing existing plan
        if (plan.id) {
            await loadPlanDetails(plan.id);
        }
    };

    const handleCreate = () => {
        setEditingPlan(null);
        setPricingList([]);
        setFeaturesList([]);
        setFormData({
            code: '',
            name: '',
            description: '',
            subscriptionType: 'FREESHIP_XTRA',
            colorHex: '#4caf50',
            icon: 'truck',
            commissionPaymentRate: 0.04,
            commissionFixedRate: 0.04,
            commissionFreeshipRate: 0.08,
            commissionVoucherRate: 0.05,
            voucherMaxPerItem: 50000,
            freeshipEnabled: false,
            voucherEnabled: false,
            isActive: true
        });
        setActiveTab('basic');
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) return;

        try {
            if (editingPlan) {
                await updateSubscriptionPlan(editingPlan.id, formData);
                Swal.fire('Success!', 'Plan updated successfully.', 'success');
            } else {
                const newPlan = await createSubscriptionPlan(formData);
                setEditingPlan(newPlan); // Set to enable pricing/features management
                Swal.fire('Success!', 'Plan created successfully. You can now add pricing and features.', 'success');
            }

            // Don't close modal after create - allow adding pricing/features
            if (!editingPlan) {
                setActiveTab('pricing'); // Switch to pricing tab after create
            } else {
                setShowModal(false);
            }
            fetchPlans();
        } catch (error) {
            console.error('Error saving plan:', error);
            Swal.fire('Error!', error.response?.data?.message || 'Failed to save plan.', 'error');
        }
    };

    // Pricing CRUD handlers
    const handleAddPricing = async (pricingData) => {
        if (!editingPlan?.id) {
            Swal.fire('Error!', 'Please save the plan first before adding pricing.', 'error');
            return;
        }
        const newPricing = await createPlanPricing(editingPlan.id, pricingData);
        setPricingList([...pricingList, newPricing]);
        Swal.fire('Success!', 'Pricing added successfully.', 'success');
    };

    const handleUpdatePricing = async (pricingId, pricingData) => {
        await updatePlanPricing(pricingId, pricingData);
        setPricingList(prev => prev.map(p =>
            p.id === pricingId ? { ...p, ...pricingData } : p
        ));
        Swal.fire('Success!', 'Pricing updated successfully.', 'success');
    };

    const handleDeletePricing = async (pricingId) => {
        await deletePlanPricing(pricingId);
        setPricingList(prev => prev.filter(p => p.id !== pricingId));
    };

    // Features CRUD handlers
    const handleAddFeature = async (featureData) => {
        if (!editingPlan?.id) {
            Swal.fire('Error!', 'Please save the plan first before adding features.', 'error');
            return;
        }
        const newFeature = await createPlanFeature(editingPlan.id, featureData);
        setFeaturesList([...featuresList, newFeature]);
        Swal.fire('Success!', 'Feature added successfully.', 'success');
    };

    const handleUpdateFeature = async (featureId, featureData) => {
        await updatePlanFeature(featureId, featureData);
        setFeaturesList(prev => prev.map(f =>
            f.id === featureId ? { ...f, ...featureData } : f
        ));
        Swal.fire('Success!', 'Feature updated successfully.', 'success');
    };

    const handleDeleteFeature = async (featureId) => {
        await deletePlanFeature(featureId);
        setFeaturesList(prev => prev.filter(f => f.id !== featureId));
    };

    const handleReorderFeatures = async (featureIds) => {
        if (!editingPlan?.id) return;
        await reorderPlanFeatures(editingPlan.id, featureIds);
        // Reload features to get updated order
        const updated = await getPlanFeatures(editingPlan.id);
        setFeaturesList(updated);
    };

    const getTypeBadge = (type) => {
        const badges = {
            'FREESHIP_XTRA': { label: 'Freeship Xtra', color: 'success' },
            'VOUCHER_XTRA': { label: 'Voucher Xtra', color: 'warning' },
            'BOTH': { label: 'Both', color: 'primary' },
            'NONE': { label: 'None', color: 'secondary' }
        };
        const badge = badges[type] || { label: type, color: 'secondary' };
        return <span className={`type-badge badge-${badge.color}`}>{badge.label}</span>;
    };

    const stats = {
        total: plans.length,
        active: plans.filter(p => p.isActive).length,
        freeshipXtra: plans.filter(p => p.subscriptionType === 'FREESHIP_XTRA').length,
        voucherXtra: plans.filter(p => p.subscriptionType === 'VOUCHER_XTRA').length,
        both: plans.filter(p => p.subscriptionType === 'BOTH').length
    };

    return (
        <div className="subscription-plan-management-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Subscription Plan Management</h1>
                    <p className="page-subtitle">Manage subscription plans for shop owners</p>
                </div>
                <button className="btn-create" onClick={handleCreate}>
                    <i className="fas fa-plus"></i> Create Plan
                </button>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon stat-icon-total">
                        <i className="fas fa-tags"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Total Plans</span>
                        <h2 className="stat-value">{stats.total}</h2>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon stat-icon-active">
                        <i className="fas fa-check-circle"></i>
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Active Plans</span>
                        <h2 className="stat-value">{stats.active}</h2>
                    </div>
                </div>
            </div>

            {/* Plans Table Card */}
            <div className="card plans-table-card">
                <div className="card-header">
                    <h3 className="card-title">All Plans</h3>
                    <div className="header-actions">
                        <div className="search-box">
                            <i className="fas fa-search"></i>
                            <input
                                type="text"
                                placeholder="Search plans..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>

                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Types</option>
                            <option value="FREESHIP_XTRA">Freeship Xtra</option>
                            <option value="VOUCHER_XTRA">Voucher Xtra</option>
                            <option value="BOTH">Both</option>
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
                            <p>Loading plans...</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="plans-table">
                                <thead>
                                    <tr>
                                        <th>Icon</th>
                                        <th>Code</th>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Commission</th>
                                        <th>Pricing</th>
                                        <th>Features</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPlans.length > 0 ? (
                                        filteredPlans.map((plan) => (
                                            <tr key={plan.id}>
                                                <td>
                                                    <div className="plan-icon" style={{ backgroundColor: plan.colorHex + '20' }}>
                                                        <i className={`fas fa-${plan.icon}`} style={{ color: plan.colorHex }}></i>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="plan-code">{plan.code}</span>
                                                </td>
                                                <td>
                                                    <div className="plan-name-cell">
                                                        <span className="plan-name-text">{plan.name}</span>
                                                        {plan.description && (
                                                            <span className="plan-desc">{plan.description.substring(0, 50)}...</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>{getTypeBadge(plan.subscriptionType)}</td>
                                                <td>
                                                    <div className="commission-cell">
                                                        <span className="commission-chip">
                                                            Payment: {(plan.commissionPaymentRate * 100).toFixed(1)}%
                                                        </span>
                                                        <span className="commission-chip">
                                                            Fixed: {(plan.commissionFixedRate * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="pricing-cell">
                                                        {plan.pricing && plan.pricing.length > 0 ? (
                                                            plan.pricing.map((p, idx) => (
                                                                <span key={idx} className="pricing-chip">
                                                                    {p.planDuration === 'MONTHLY' ? '📅 Monthly' : '📅 Yearly'}: {p.price?.toLocaleString('vi-VN')}đ
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="no-data-text">No pricing</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="features-cell">
                                                        {plan.features && plan.features.length > 0 ? (
                                                            <span className="features-badge" title={plan.features.map(f => f.featureText).join('\n')}>
                                                                <i className="fas fa-list-check"></i> {plan.features.length} feature{plan.features.length > 1 ? 's' : ''}
                                                            </span>
                                                        ) : (
                                                            <span className="no-data-text">No features</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <label className="toggle-switch">
                                                        <input
                                                            type="checkbox"
                                                            checked={plan.isActive}
                                                            onChange={() => handleToggleActive(plan.id)}
                                                        />
                                                        <span className="toggle-slider"></span>
                                                    </label>
                                                </td>
                                                <td>
                                                    <div className="action-buttons">
                                                        <button
                                                            onClick={() => handleEdit(plan)}
                                                            className="btn-action btn-edit"
                                                            title="Edit Plan"
                                                        >
                                                            <i className="fas fa-edit"></i>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(plan.id)}
                                                            className="btn-action btn-delete"
                                                            title="Delete Plan"
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="9" className="no-data">
                                                <i className="fas fa-inbox"></i>
                                                <p>No plans found</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal - Simple version for now */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingPlan ? 'Edit Plan' : 'Create New Plan'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="modal-tabs">
                            <button
                                type="button"
                                className={`tab-button ${activeTab === 'basic' ? 'active' : ''}`}
                                onClick={() => setActiveTab('basic')}
                            >
                                <i className="fas fa-info-circle"></i> Basic Info
                            </button>
                            {editingPlan?.id && (
                                <>
                                    <button
                                        type="button"
                                        className={`tab-button ${activeTab === 'pricing' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('pricing')}
                                    >
                                        <i className="fas fa-dollar-sign"></i> Pricing ({pricingList.length})
                                    </button>
                                    <button
                                        type="button"
                                        className={`tab-button ${activeTab === 'features' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('features')}
                                    >
                                        <i className="fas fa-list-check"></i> Features ({featuresList.length})
                                    </button>
                                </>
                            )}
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {/* Basic Info Tab */}
                                {activeTab === 'basic' && (
                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label>Code *</label>
                                            <input
                                                type="text"
                                                className={`form-input ${errors.code ? 'error' : ''}`}
                                                value={formData.code}
                                                onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                                                disabled={!!editingPlan}
                                                placeholder="e.g. FREESHIP_XTRA"
                                            />
                                            {errors.code && <span className="error-message">{errors.code}</span>}
                                        </div>

                                        <div className="form-group">
                                            <label>Name *</label>
                                            <input
                                                type="text"
                                                className={`form-input ${errors.name ? 'error' : ''}`}
                                                value={formData.name}
                                                onChange={(e) => handleInputChange('name', e.target.value)}
                                                placeholder="e.g. Freeship Xtra"
                                            />
                                            {errors.name && <span className="error-message">{errors.name}</span>}
                                        </div>

                                        <div className="form-group full-width">
                                            <label>Description</label>
                                            <textarea
                                                className="form-input"
                                                rows="3"
                                                value={formData.description}
                                                onChange={(e) => handleInputChange('description', e.target.value)}
                                                placeholder="Subscription plan description..."
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Type *</label>
                                            <select
                                                className={`form-input ${errors.subscriptionType ? 'error' : ''}`}
                                                value={formData.subscriptionType}
                                                onChange={(e) => handleInputChange('subscriptionType', e.target.value)}
                                            >
                                                <option value="FREESHIP_XTRA">Freeship Xtra</option>
                                                <option value="VOUCHER_XTRA">Voucher Xtra</option>
                                                <option value="BOTH">Both</option>
                                            </select>
                                            {errors.subscriptionType && <span className="error-message">{errors.subscriptionType}</span>}
                                        </div>

                                        <div className="form-group">
                                            <label>Color (Hex)</label>
                                            <input
                                                type="color"
                                                className="form-input"
                                                value={formData.colorHex}
                                                onChange={(e) => handleInputChange('colorHex', e.target.value)}
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Icon (FontAwesome)</label>
                                            <div className="icon-select-wrapper" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                <div className="selected-icon-preview" style={{
                                                    width: '38px',
                                                    height: '38px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: formData.colorHex ? formData.colorHex + '20' : '#f0f0f0',
                                                    borderRadius: '8px',
                                                    color: formData.colorHex || '#666'
                                                }}>
                                                    <i className={`fas fa-${formData.icon}`}></i>
                                                </div>
                                                <select
                                                    className="form-input"
                                                    value={formData.icon}
                                                    onChange={(e) => handleInputChange('icon', e.target.value)}
                                                    style={{ flex: 1 }}
                                                >
                                                    <option value="truck">Truck (Shipping)</option>
                                                    <option value="shipping-fast">Fast Shipping</option>
                                                    <option value="ticket-alt">Ticket (Voucher)</option>
                                                    <option value="tag">Tag (Discount)</option>
                                                    <option value="tags">Tags</option>
                                                    <option value="percent">Percentage</option>
                                                    <option value="box-open">Box Open</option>
                                                    <option value="store">Store</option>
                                                    <option value="store-alt">Store Alt</option>
                                                    <option value="crown">Crown (Premium)</option>
                                                    <option value="star">Star</option>
                                                    <option value="gem">Gem (Diamond)</option>
                                                    <option value="rocket">Rocket</option>
                                                    <option value="gift">Gift</option>
                                                    <option value="check-circle">Check Circle</option>
                                                    <option value="medal">Medal</option>
                                                    <option value="award">Award</option>
                                                    <option value="fire">Fire (Hot)</option>
                                                    <option value="bolt">Bolt (Flash)</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Commission Rates Section */}
                                        <div className="form-group full-width">
                                            <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem', color: '#FF6B35' }}>Commission Rates</h4>
                                        </div>

                                        <div className="form-group">
                                            <label>Payment Rate (%) *</label>
                                            <input
                                                type="number"
                                                className={`form-input ${errors.commissionPaymentRate ? 'error' : ''}`}
                                                value={(formData.commissionPaymentRate * 100).toFixed(2)}
                                                onChange={(e) => handleInputChange('commissionPaymentRate', parseFloat(e.target.value) / 100)}
                                                step="0.01"
                                                min="0"
                                                max="100"
                                            />
                                            {errors.commissionPaymentRate && <span className="error-message">{errors.commissionPaymentRate}</span>}
                                        </div>

                                        <div className="form-group">
                                            <label>Fixed Rate (%) *</label>
                                            <input
                                                type="number"
                                                className={`form-input ${errors.commissionFixedRate ? 'error' : ''}`}
                                                value={(formData.commissionFixedRate * 100).toFixed(2)}
                                                onChange={(e) => handleInputChange('commissionFixedRate', parseFloat(e.target.value) / 100)}
                                                step="0.01"
                                                min="0"
                                                max="100"
                                            />
                                            {errors.commissionFixedRate && <span className="error-message">{errors.commissionFixedRate}</span>}
                                        </div>

                                        <div className="form-group">
                                            <label>Freeship Rate (%) *</label>
                                            <input
                                                type="number"
                                                className={`form-input ${errors.commissionFreeshipRate ? 'error' : ''}`}
                                                value={(formData.commissionFreeshipRate * 100).toFixed(2)}
                                                onChange={(e) => handleInputChange('commissionFreeshipRate', parseFloat(e.target.value) / 100)}
                                                step="0.01"
                                                min="0"
                                                max="100"
                                            />
                                            {errors.commissionFreeshipRate && <span className="error-message">{errors.commissionFreeshipRate}</span>}
                                        </div>

                                        <div className="form-group">
                                            <label>Voucher Rate (%) *</label>
                                            <input
                                                type="number"
                                                className={`form-input ${errors.commissionVoucherRate ? 'error' : ''}`}
                                                value={(formData.commissionVoucherRate * 100).toFixed(2)}
                                                onChange={(e) => handleInputChange('commissionVoucherRate', parseFloat(e.target.value) / 100)}
                                                step="0.01"
                                                min="0"
                                                max="100"
                                            />
                                            {errors.commissionVoucherRate && <span className="error-message">{errors.commissionVoucherRate}</span>}
                                        </div>

                                        <div className="form-group">
                                            <label>Voucher Max Per Item (VND)</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={formData.voucherMaxPerItem}
                                                onChange={(e) => setFormData({
                                                    ...formData,
                                                    voucherMaxPerItem: parseFloat(e.target.value)
                                                })}
                                                min="0"
                                            />
                                        </div>

                                        <div className="form-group">
                                            {/* Empty for grid alignment */}
                                        </div>

                                        {/* Feature Toggles */}
                                        <div className="form-group checkbox-group">
                                            <label className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.freeshipEnabled}
                                                    onChange={(e) => setFormData({ ...formData, freeshipEnabled: e.target.checked })}
                                                />
                                                <span>Freeship Enabled</span>
                                            </label>
                                        </div>

                                        <div className="form-group checkbox-group">
                                            <label className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.voucherEnabled}
                                                    onChange={(e) => setFormData({ ...formData, voucherEnabled: e.target.checked })}
                                                />
                                                <span>Voucher Enabled</span>
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
                                )}

                                {/* Pricing Tab */}
                                {activeTab === 'pricing' && (
                                    <PricingManagement
                                        planId={editingPlan?.id}
                                        pricingList={pricingList}
                                        onAdd={handleAddPricing}
                                        onUpdate={handleUpdatePricing}
                                        onDelete={handleDeletePricing}
                                    />
                                )}

                                {/* Features Tab */}
                                {activeTab === 'features' && (
                                    <FeaturesManagement
                                        planId={editingPlan?.id}
                                        featuresList={featuresList}
                                        onAdd={handleAddFeature}
                                        onUpdate={handleUpdateFeature}
                                        onDelete={handleDeleteFeature}
                                        onReorder={handleReorderFeatures}
                                    />
                                )}
                            </div>

                            {activeTab === 'basic' && (
                                <div className="modal-footer">
                                    <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-save">
                                        <i className="fas fa-save"></i> {editingPlan ? 'Update' : 'Create'} Plan
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </div >
            )}
        </div >
    );
};

export default SubscriptionPlanManagementPage;
