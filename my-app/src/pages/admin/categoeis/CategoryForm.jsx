import { useEffect, useState } from "react";
import "../../../assets/admin/css/Validation.css";

export default function CategoryForm({ category, onSubmit, onCancel, submitting }) {
    const [form, setForm] = useState({
        name: '',
        description: ''
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (category) {
            setForm({
                name: category.name || '',
                description: category.description || ''
            });
            setImagePreview(category.imageUrl || null);
        } else {
            setForm({ name: '', description: '' });
            setImagePreview(null);
        }
        setImageFile(null);
        setErrors({});
    }, [category]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        // Clear error when user types
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Image size must be less than 5MB');
            return;
        }

        setImageFile(file);
        // Clear image error
        if (errors.image) {
            setErrors(prev => ({ ...prev, image: null }));
        }

        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const validate = () => {
        const newErrors = {};

        if (!form.name.trim()) {
            newErrors.name = 'Category name is required';
        }

        // Image is required only for new categories
        if (!category && !imageFile) {
            newErrors.image = 'Category image is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validate()) {
            onSubmit?.(form, category?.id, imageFile);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="modal-body">
                <div className="form-grid">
                    {/* Name */}
                    <div className="form-group">
                        <label>Category Name *</label>
                        <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="Enter category name"
                            className={`form-input ${errors.name ? 'error' : ''}`}
                        />
                        {errors.name && <span className="error-message">{errors.name}</span>}
                    </div>

                    {/* Description */}
                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            name="description"
                            value={form.description}
                            onChange={handleChange}
                            placeholder="Enter category description"
                            className="form-input"
                            rows="3"
                        />
                    </div>

                    {/* Image Upload */}
                    <div className="form-group full-width">
                        <label>Category Image {!category && '*'}</label>
                        <div className="image-upload-section">
                            {imagePreview && (
                                <div className="image-preview-container">
                                    <img src={imagePreview} alt="Preview" />
                                    <button
                                        type="button"
                                        className="remove-image-btn"
                                        onClick={handleRemoveImage}
                                        title="Remove image"
                                    >
                                        ×
                                    </button>
                                </div>
                            )}
                            <div className="image-upload-info">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className={`form-input ${errors.image ? 'error' : ''}`}
                                />
                                <small>Max size: 5MB. Formats: JPG, PNG, GIF</small>
                                {errors.image && <span className="error-message">{errors.image}</span>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={onCancel}>
                    Cancel
                </button>
                <button type="submit" className="btn-save" disabled={submitting}>
                    {submitting ? (
                        <>
                            <i className="fas fa-spinner fa-spin"></i>
                            {category ? 'Updating...' : 'Creating...'}
                        </>
                    ) : (
                        <>
                            <i className="fas fa-save"></i>
                            {category ? 'Update' : 'Create'} Category
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
