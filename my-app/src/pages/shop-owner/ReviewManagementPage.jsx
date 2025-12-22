import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getReviewsByShopId, replyToReview } from '../../api/review.js';
import { getShopOwnerInfo } from '../../api/user.js'; // Assuming this exists or similar
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

export default function ReviewManagementPage() {
    const { t } = useTranslation();
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [replyingId, setReplyingId] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [shopId, setShopId] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch shop info first to get ID
                const shopInfo = await getShopOwnerInfo();
                // Assuming shopInfo returns the object locally or from API
                // Wait, getShopOwnerInfo in api/user.js might be what I need? 
                // Let's check api/user.js later or use a known pattern. 
                // For now, I'll assume getShopOwnerInfo returns { id: ... }
                // Actually, let's look at ShopOwnerDashboard logic. It calls `getProductStats`.
                // Let's rely on the backend to handle "current user" if possible, but the API takes shopId.
                // If I am logged in as ShopOwner, my userId IS likely the shopId or linked.
                // The backend `getShopOwnerInfo` returns `ShopOwnerDto` which has `id` (userId).

                if (shopInfo && (shopInfo.id || shopInfo.userId)) {
                    const id = shopInfo.id || shopInfo.userId;
                    setShopId(id);
                    const res = await getReviewsByShopId(id);
                    setReviews(res.data);
                }
            } catch (error) {
                console.error("Error fetching reviews:", error);
                toast.error("Failed to load reviews");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleReply = async (reviewId) => {
        if (!replyText.trim()) return;
        try {
            await replyToReview(reviewId, replyText);
            toast.success(t('shopOwner.reviews.successReply'));
            setReplyingId(null);
            setReplyText('');
            // Refresh list
            const res = await getReviewsByShopId(shopId);
            setReviews(res.data);
        } catch (error) {
            toast.error(t('shopOwner.reviews.failedReply'));
        }
    };

    return (
        <div className="container-fluid p-4">
            <h2 className="mb-4">{t('shopOwner.reviews.title')}</h2>
            {loading ? (
                <div className="text-center"><div className="spinner-border" /></div>
            ) : (
                <div className="card shadow-sm">
                    <div className="card-body">
                        {reviews.length === 0 ? (
                            <p className="text-center text-muted">{t('shopOwner.reviews.noReviews')}</p>
                        ) : (
                            <div className="list-group list-group-flush">
                                {reviews.map(review => (
                                    <div key={review.id} className="list-group-item p-3">
                                        <div className="d-flex justify-content-between">
                                            <div>
                                                <div className="mb-1">
                                                    <strong>{review.username}</strong>
                                                    <span className="text-muted small ms-2">
                                                        {format(new Date(review.createdAt), 'dd/MM/yyyy HH:mm')}
                                                    </span>
                                                </div>
                                                <div className="mb-2 text-warning">
                                                    {[...Array(5)].map((_, i) => (
                                                        <i key={i} className={`fas fa-star ${i < review.rating ? '' : 'text-muted'}`} />
                                                    ))}
                                                </div>
                                                <p className="mb-2">{review.comment}</p>
                                                {review.imageIds && review.imageIds.length > 0 && (
                                                    <div className="d-flex gap-2 mb-2">
                                                        {review.imageIds.map(img => (
                                                            <img
                                                                key={img}
                                                                src={`/v1/file-storage/get/${img}`}
                                                                alt="Review"
                                                                style={{ width: 60, height: 60, objectFit: 'cover' }}
                                                                className="rounded border"
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Product Info could go here if available in DTO */}
                                        </div>

                                        {/* Reply Section */}
                                        {review.reply ? (
                                            <div className="bg-light p-3 rounded mt-2 border-start border-4 border-success">
                                                <strong>{t('shopOwner.reviews.shopReplied')}</strong>
                                                <p className="mb-0 mt-1">{review.reply}</p>
                                                <small className="text-muted">
                                                    {review.repliedAt && format(new Date(review.repliedAt), 'dd/MM/yyyy HH:mm')}
                                                </small>
                                            </div>
                                        ) : (
                                            <div className="mt-2">
                                                {replyingId === review.id ? (
                                                    <div className="mt-2">
                                                        <textarea
                                                            className="form-control mb-2"
                                                            rows="3"
                                                            value={replyText}
                                                            onChange={(e) => setReplyText(e.target.value)}
                                                            placeholder={t('shopOwner.reviews.writeReply')}
                                                        ></textarea>
                                                        <button
                                                            className="btn btn-primary btn-sm me-2"
                                                            onClick={() => handleReply(review.id)}
                                                        >
                                                            {t('shopOwner.reviews.submit')}
                                                        </button>
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => {
                                                                setReplyingId(null);
                                                                setReplyText('');
                                                            }}
                                                        >
                                                            {t('shopOwner.reviews.cancel')}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="btn btn-outline-primary btn-sm"
                                                        onClick={() => setReplyingId(review.id)}
                                                    >
                                                        {t('shopOwner.reviews.reply')}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
