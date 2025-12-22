import { useEffect, useState } from "react";

export default function CategoryForm({ category, onSubmit, onCancel, submitting }) {
    const [form, setForm] = useState({
        name: '',
        description: ''
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

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
    }, [category]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
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

        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit?.(form, category?.id, imageFile);
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
                            className="form-input"
                            required
                        />
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
                                    className="form-input"
                                    required={!category && !imagePreview}
                                />
                                <small>Max size: 5MB. Formats: JPG, PNG, GIF</small>
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
