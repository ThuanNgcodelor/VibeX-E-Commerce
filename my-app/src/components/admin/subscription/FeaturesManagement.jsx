import React, { useState } from 'react';
import Swal from 'sweetalert2';
import './SubscriptionComponents.css';

const FeaturesManagement = ({
    planId,
    featuresList,
    onAdd,
    onUpdate,
    onDelete,
    onReorder
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editingFeature, setEditingFeature] = useState(null);
    const [formData, setFormData] = useState({
        featureText: '',
        displayOrder: 0
    });

    // Drag and drop state
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    const handleEdit = (feature) => {
        setEditingFeature(feature);
        setFormData({
            featureText: feature.featureText,
            displayOrder: feature.displayOrder
        });
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditingFeature(null);
        setFormData({
            featureText: '',
            displayOrder: 0
        });
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault(); // Optional since called from onClick

        // Validation
        if (!formData.featureText.trim()) {
            Swal.fire('Error!', 'Feature text cannot be empty', 'error');
            return;
        }

        try {
            const dataToSave = {
                ...formData,
                displayOrder: editingFeature ? formData.displayOrder : featuresList.length
            };

            if (editingFeature) {
                await onUpdate(editingFeature.id, dataToSave);
            } else {
                await onAdd(dataToSave);
            }
            handleCancel();
        } catch (error) {
            console.error('Error saving feature:', error);
            Swal.fire('Error!', error.response?.data?.message || 'Failed to save feature', 'error');
        }
    };

    const handleDeleteClick = async (featureId) => {
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
                await onDelete(featureId);
                // Success shown by parent or confirmation is enough
            } catch (error) {
                console.error('Error deleting feature:', error);
                Swal.fire('Error!', 'Failed to delete feature', 'error');
            }
        }
    };

    const moveUp = async (index) => {
        if (index === 0) return;
        const newList = [...featuresList];
        [newList[index], newList[index - 1]] = [newList[index - 1], newList[index]];
        await reorderFeatures(newList);
    };

    const moveDown = async (index) => {
        if (index === featuresList.length - 1) return;
        const newList = [...featuresList];
        [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
        await reorderFeatures(newList);
    };

    const reorderFeatures = async (newList) => {
        try {
            const featureIds = newList.map(f => f.id);
            await onReorder(featureIds);
        } catch (error) {
            console.error('Error reordering features:', error);
            Swal.fire('Error!', 'Failed to reorder features', 'error');
        }
    };

    // Drag and drop handlers
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget);
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e) => {
        e.currentTarget.style.opacity = '';
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDragLeave = (e) => {
        // Only clear if we're actually leaving the item
        if (e.currentTarget === e.target) {
            setDragOverIndex(null);
        }
    };

    const handleDrop = async (e, dropIndex) => {
        e.preventDefault();
        e.stopPropagation();

        if (draggedIndex === null || draggedIndex === dropIndex) {
            setDragOverIndex(null);
            return;
        }

        const newList = [...sortedFeatures];
        const draggedItem = newList[draggedIndex];

        // Remove dragged item
        newList.splice(draggedIndex, 1);
        // Insert at new position
        newList.splice(dropIndex, 0, draggedItem);

        await reorderFeatures(newList);
        setDragOverIndex(null);
    };

    const sortedFeatures = [...(featuresList || [])].sort((a, b) => a.displayOrder - b.displayOrder);

    return (
        <div className="features-management">
            <div className="section-header">
                <h4>Plan Features</h4>
                {!isEditing && (
                    <button className="btn-add-small" onClick={() => setIsEditing(true)}>
                        <i className="fas fa-plus"></i> Add Feature
                    </button>
                )}
            </div>

            {/* Feature Form */}
            {isEditing && (
                <div className="feature-form-card">
                    <div className="feature-form-content">
                        <div className="form-group">
                            <label>Feature Text *</label>
                            <textarea
                                className="form-input"
                                rows="3"
                                value={formData.featureText}
                                onChange={(e) => setFormData({ ...formData, featureText: e.target.value })}
                                required
                                placeholder="E.g., Free shipping on all orders"
                            />
                        </div>

                        <div className="form-actions">
                            <button type="button" className="btn-cancel-small" onClick={handleCancel}>
                                Cancel
                            </button>
                            <button type="button" className="btn-save-small" onClick={handleSubmit}>
                                <i className="fas fa-save"></i> {editingFeature ? 'Update' : 'Add'} Feature
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Features List with Drag and Drop */}
            {sortedFeatures.length > 0 ? (
                <div className="features-list">
                    {sortedFeatures.map((feature, index) => (
                        <div
                            key={feature.id}
                            className={`feature-item ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                            draggable="true"
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                        >
                            <div className="feature-drag-handle" title="Drag to reorder">
                                <i className="fas fa-grip-vertical"></i>
                            </div>

                            <div className="feature-order">
                                <span className="order-number">{index + 1}</span>
                                <div className="order-controls">
                                    <button
                                        className={`btn-order ${index === 0 ? 'disabled' : ''}`}
                                        onClick={() => moveUp(index)}
                                        disabled={index === 0}
                                        title="Move Up"
                                    >
                                        <i className="fas fa-chevron-up"></i>
                                    </button>
                                    <button
                                        className={`btn-order ${index === sortedFeatures.length - 1 ? 'disabled' : ''}`}
                                        onClick={() => moveDown(index)}
                                        disabled={index === sortedFeatures.length - 1}
                                        title="Move Down"
                                    >
                                        <i className="fas fa-chevron-down"></i>
                                    </button>
                                </div>
                            </div>

                            <div className="feature-content">
                                <i className="fas fa-check-circle feature-icon"></i>
                                <span className="feature-text">{feature.featureText}</span>
                            </div>

                            <div className="feature-actions">
                                <button
                                    type="button"
                                    className="btn-icon btn-edit-icon"
                                    onClick={() => handleEdit(feature)}
                                    title="Edit Feature"
                                >
                                    <i className="fas fa-edit"></i>
                                </button>
                                <button
                                    type="button"
                                    className="btn-icon btn-delete-icon"
                                    onClick={() => handleDeleteClick(feature.id)}
                                    title="Delete Feature"
                                >
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <i className="fas fa-inbox"></i>
                    <p>No features yet. Click "Add Feature" to create one.</p>
                </div>
            )}
        </div>
    );
};

export default FeaturesManagement;
