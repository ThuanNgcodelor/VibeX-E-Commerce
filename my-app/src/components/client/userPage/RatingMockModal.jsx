import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { uploadMultipleImages } from "../../../api/image";

/**
 * Modern Rating Modal Component
 * Replaces the old SweetAlert mock.
 *
 * Pops:
 * - isOpen: boolean
 * - onClose: function
 * - onSubmit: function({ rating, comment, imageIds })
 * - product: object { id, name, image, shopName }
 * - initialRating: number (default 5)
 * - mode: 'quick' | 'full' (default 'full')
 */
export default function RatingModal({ isOpen, onClose, onSubmit, product, initialRating = 5, mode = 'full' }) {
    const { t } = useTranslation();
    const [rating, setRating] = useState(initialRating);
    const [comment, setComment] = useState("");
    const [images, setImages] = useState([]); // File objects
    const [previewUrls, setPreviewUrls] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [hoverRating, setHoverRating] = useState(0);

    useEffect(() => {
        if (isOpen) {
            setRating(initialRating);
            setComment("");
            setImages([]);
            setPreviewUrls([]);
            setUploading(false);
            // If quick mode, maybe default to 5 stars?
            if (mode === 'quick' && initialRating === 0) setRating(5);
        }
    }, [isOpen, initialRating, mode]);

    // Cleanup object URLs
    useEffect(() => {
        return () => {
            previewUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [previewUrls]);

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length + images.length > 5) {
            alert(t('ratingModal.maxImages'));
            return;
        }

        const newPreviews = files.map(file => URL.createObjectURL(file));
        setImages(prev => [...prev, ...files]);
        setPreviewUrls(prev => [...prev, ...newPreviews]);
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => {
            const newUrls = [...prev];
            URL.revokeObjectURL(newUrls[index]); // cleanup
            return newUrls.filter((_, i) => i !== index);
        });
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            alert(t('ratingModal.pleaseSelectRating'));
            return;
        }

        try {
            setUploading(true);
            let imageIds = [];

            if (images.length > 0) {
                imageIds = await uploadMultipleImages(images);
            }

            await onSubmit({
                rating,
                comment,
                imageIds
            });

            onClose();
        } catch (error) {
            console.error("Submit review failed:", error);
            alert(t('ratingModal.submitReviewFailed', { message: error.message }));
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header border-bottom-0 pb-0">
                        <h5 className="modal-title fw-bold">{mode === 'quick' ? t('ratingModal.quickRate') : t('ratingModal.productReview')}</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>

                    <div className="modal-body">
                        <div className={`alert ${mode === 'quick' ? 'alert-info' : 'alert-warning'} d-flex align-items-center mb-2`} role="alert" style={{ fontSize: '13px', padding: '8px 12px' }}>
                            <i className={`fas ${mode === 'quick' ? 'fa-star' : 'fa-coins'} me-2`}></i>
                            <div>{mode === 'quick' ? t('ratingModal.quickRateMessage') : t('ratingModal.shareReviewMessage')}</div>
                        </div>

                        <div className="d-flex gap-3 mb-2 align-items-center">
                            <div style={{ width: '48px', height: '48px', flexShrink: 0, border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden' }}>
                                {product?.image ? (
                                    <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div className="w-100 h-100 d-flex align-items-center justify-content-center bg-light text-muted">
                                        <i className="fas fa-image"></i>
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="fw-semibold text-truncate" style={{ maxWidth: '400px', fontSize: '14px' }}>{product?.name || 'Product Name'}</div>
                                <div className="text-muted small" style={{ fontSize: '12px' }}>{t('ratingModal.buyFrom')}: {product?.shopName || 'Shop'}</div>
                            </div>
                        </div>

                        <div className="mb-2 text-center">
                            <div className="d-flex justify-content-center gap-2 mb-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <i
                                        key={star}
                                        className={`fas fa-star fa-2x cursor-pointer ${star <= (hoverRating || rating) ? 'text-warning' : 'text-secondary'}`}
                                        style={{ cursor: 'pointer', color: star <= (hoverRating || rating) ? '#ffc107' : '#e4e5e9', fontSize: '24px' }}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                        onClick={() => setRating(star)}
                                    />
                                ))}
                            </div>
                            <div className="text-warning fw-bold" style={{ fontSize: '14px' }}>
                                {hoverRating || rating ? (
                                    (hoverRating || rating) === 5 ? t('ratingModal.excellent') :
                                        (hoverRating || rating) === 4 ? t('ratingModal.good') :
                                            (hoverRating || rating) === 3 ? t('ratingModal.average') :
                                                (hoverRating || rating) === 2 ? t('ratingModal.poor') : t('ratingModal.terrible')
                                ) : t('ratingModal.tapToRate')}
                            </div>
                        </div>

                        {mode === 'full' && (
                            <>
                                <div className="mb-2">
                                    <textarea
                                        className="form-control"
                                        rows="3"
                                        placeholder={t('rating.shareWhatYouLike')}
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                    ></textarea>
                                </div>

                                <div className="mb-2">
                                    <div className="d-flex flex-wrap gap-2">
                                        {previewUrls.map((url, idx) => (
                                            <div key={idx} className="position-relative" style={{ width: '70px', height: '70px' }}>
                                                <img src={url} alt="preview" className="w-100 h-100 object-fit-cover rounded border" />
                                                <button
                                                    className="btn btn-sm btn-danger position-absolute top-0 end-0 p-0 d-flex align-items-center justify-content-center"
                                                    style={{ width: '18px', height: '18px', borderRadius: '50%', transform: 'translate(30%, -30%)' }}
                                                    onClick={() => removeImage(idx)}
                                                >
                                                    <i className="fas fa-times" style={{ fontSize: '10px' }}></i>
                                                </button>
                                            </div>
                                        ))}

                                        {images.length < 5 && (
                                            <label className="border rounded d-flex flex-column align-items-center justify-content-center text-muted cursor-pointer" style={{ width: '70px', height: '70px', borderStyle: 'dashed !important', cursor: 'pointer' }}>
                                                <i className="fas fa-camera mb-1"></i>
                                                <span style={{ fontSize: '10px' }}>{t('ratingModal.addPhoto')}</span>
                                                <input type="file" className="d-none" accept="image/*" multiple onChange={handleImageChange} />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                    </div>
                    <div className="modal-footer border-top-0 pt-0">
                        <button type="button" className="btn btn-light" onClick={onClose} disabled={uploading}>{t('ratingModal.back')}</button>
                        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={uploading} style={{ background: '#ee4d2d', borderColor: '#ee4d2d' }}>
                            {uploading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    {t('ratingModal.sending')}
                                </>
                            ) : (mode === 'quick' ? t('ratingModal.sendNow') : t('ratingModal.complete'))}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}