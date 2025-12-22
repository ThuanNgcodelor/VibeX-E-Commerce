import React, { useState } from 'react';
import Swal from 'sweetalert2';
import './SubscriptionComponents.css';

const PricingManagement = ({
    planId,
    pricingList,
    onAdd,
    onUpdate,
    onDelete
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editingPricing, setEditingPricing] = useState(null);
    const [formData, setFormData] = useState({
        planDuration: 'MONTHLY',
        price: 0,
        isActive: true
    });

    const handleEdit = (pricing) => {
        setEditingPricing(pricing);
        setFormData({
            planDuration: pricing.planDuration,
            price: pricing.price,
            isActive: pricing.isActive
        });
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditingPricing(null);
        setFormData({
            planDuration: 'MONTHLY',
            price: 0,
            isActive: true
        });
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault(); // Optional since called from onClick

        // Validation
        if (formData.price <= 0) {
            Swal.fire('Error!', 'Price must be greater than 0', 'error');
            return;
        }

        // Check duplicate duration (only when creating  new)
        if (!editingPricing) {
            const exists = pricingList.some(p => p.planDuration === formData.planDuration);
            if (exists) {
                Swal.fire('Error!', `Pricing for ${formData.planDuration} already exists`, 'error');
                return;
            }
        }

        try {
            if (editingPricing) {
                await onUpdate(editingPricing.id, formData);
            } else {
                await onAdd(formData);
            }
            handleCancel();
        } catch (error) {
            console.error('Error saving pricing:', error);
            Swal.fire('Error!', error.response?.data?.message || 'Failed to save pricing', 'error');
        }
    };

    const handleDeleteClick = async (pricingId) => {
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
                await onDelete(pricingId);
                // Success shown by parent or confirmation is enough
            } catch (error) {
                console.error('Error deleting pricing:', error);
                Swal.fire('Error!', 'Failed to delete pricing', 'error');
            }
        }
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(price);
    };

    return (
        <div className="pricing-management">
            <div className="section-header">
                <h4>Pricing Options</h4>
                {!isEditing && (
                    <button className="btn-add-small" onClick={() => setIsEditing(true)}>
                        <i className="fas fa-plus"></i> Add Pricing
                    </button>
                )}
            </div>

            {/* Pricing Form */}
            {isEditing && (
                <div className="pricing-form-card">
                    <div className="pricing-form-content">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Duration *</label>
                                <select
                                    className="form-input"
                                    value={formData.planDuration}
                                    onChange={(e) => setFormData({ ...formData, planDuration: e.target.value })}
                                    disabled={!!editingPricing} // Cannot change duration when editing
                                    required
                                >
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="YEARLY">Yearly</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Price (VNĐ) *</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                    min="0"
                                    step="1000"
                                    required
                                    placeholder="0"
                                />
                            </div>

                            <div className="form-group checkbox-inline">
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

                        <div className="form-actions">
                            <button type="button" className="btn-cancel-small" onClick={handleCancel}>
                                Cancel
                            </button>
                            <button type="button" className="btn-save-small" onClick={handleSubmit}>
                                <i className="fas fa-save"></i> {editingPricing ? 'Update' : 'Add'} Pricing
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pricing Table */}
            {pricingList && pricingList.length > 0 ? (
                <div className="pricing-table-wrapper">
                    <table className="pricing-table">
                        <thead>
                            <tr>
                                <th>Duration</th>
                                <th>Price</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pricingList.map((pricing) => (
                                <tr key={pricing.id}>
                                    <td>
                                        <span className={`duration-badge ${pricing.planDuration.toLowerCase()}`}>
                                            {pricing.planDuration === 'MONTHLY' ? 'Monthly' : 'Yearly'}
                                        </span>
                                    </td>
                                    <td className="price-cell">
                                        {formatPrice(pricing.price)}
                                        <span className="duration-label">
                                            /{pricing.planDuration === 'MONTHLY' ? 'month' : 'year'}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${pricing.isActive ? 'active' : 'inactive'}`}>
                                            {pricing.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-buttons-inline">
                                            <button
                                                type="button"
                                                className="btn-icon btn-edit-icon"
                                                onClick={() => handleEdit(pricing)}
                                                title="Edit Pricing"
                                            >
                                                <i className="fas fa-edit"></i>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-icon btn-delete-icon"
                                                onClick={() => handleDeleteClick(pricing.id)}
                                                title="Delete Pricing"
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="empty-state">
                    <i className="fas fa-inbox"></i>
                    <p>No pricing options yet. Click "Add Pricing" to create one.</p>
                </div>
            )}
        </div>
    );
};

export default PricingManagement;
