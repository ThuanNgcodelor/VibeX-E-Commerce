import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import { shopNotifyFollowers } from '../../api/notification';
import { getFollowerCount, getUser } from '../../api/user';
import './ShopNotifyFollowersPage.css';

const NOTIFICATION_TYPES = [
    { value: 'SHOP_ANNOUNCEMENT', label: 'General Announcement', icon: 'fas fa-bullhorn', color: '#3b82f6' },
    { value: 'SHOP_FLASH_SALE', label: 'Flash Sale', icon: 'fas fa-bolt', color: '#ef4444' },
    { value: 'SHOP_NEW_PRODUCT', label: 'New Product', icon: 'fas fa-box-open', color: '#10b981' },
    { value: 'SHOP_PROMOTION', label: 'Promotion', icon: 'fas fa-ticket-alt', color: '#f59e0b' },
];

const ShopNotifyFollowersPage = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [followerCount, setFollowerCount] = useState(0);
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        type: 'SHOP_ANNOUNCEMENT',
        actionUrl: ''
    });

    useEffect(() => {
        fetchFollowerCount();
    }, []);

    const fetchFollowerCount = async () => {
        try {
            const user = await getUser();
            if (user && user.id) {
                const count = await getFollowerCount(user.id);
                setFollowerCount(count || 0);
            }
        } catch (error) {
            console.error('Failed to fetch follower count:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTypeSelect = (typeValue) => {
        setFormData(prev => ({ ...prev, type: typeValue }));
    };

    const handleQuickTemplate = (type) => {
        const templates = {
            'SHOP_FLASH_SALE': {
                title: '🔥 Flash Sale is happening!',
                message: 'Shocking discounts up to 50% on all products. Buy now!',
                type: 'SHOP_FLASH_SALE'
            },
            'SHOP_NEW_PRODUCT': {
                title: '🆕 New Product Arrival!',
                message: 'We just updated new products. Visit our shop to check them out!',
                type: 'SHOP_NEW_PRODUCT'
            },
            'SHOP_PROMOTION': {
                title: '🎁 Special Offer for You!',
                message: 'Exclusive voucher for followers. Use it today!',
                type: 'SHOP_PROMOTION'
            }
        };
        if (templates[type]) {
            setFormData(prev => ({ ...prev, ...templates[type] }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.message.trim()) {
            Swal.fire('Error', 'Please enter title and message', 'warning');
            return;
        }

        if (followerCount === 0) {
            Swal.fire('Notice', 'Shop has no followers yet', 'info');
            return;
        }

        const result = await Swal.fire({
            title: 'Confirm Send',
            text: `Notification will be sent to ${followerCount} followers`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Send Now',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#10b981',
        });

        if (!result.isConfirmed) return;

        setLoading(true);
        try {
            const response = await shopNotifyFollowers(formData);

            Swal.fire({
                title: 'Success!',
                text: `Sent notification to ${response.sentCount} followers`,
                icon: 'success',
            });

            // Reset form
            setFormData({
                title: '',
                message: '',
                type: 'SHOP_ANNOUNCEMENT',
                actionUrl: ''
            });
        } catch (error) {
            Swal.fire('Error', 'Failed to send notification. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="shop-notify-page">
            <div className="page-header">
                <div className="header-left">
                    <h1><i className="fas fa-bullhorn text-primary me-2"></i>Notify Followers</h1>
                    <p className="subtitle">Send notifications to your shop followers</p>
                </div>
                <div className="follower-badge">
                    <i className="fas fa-users follower-icon"></i>
                    <span className="follower-count">{followerCount.toLocaleString()}</span>
                    <span className="follower-label">followers</span>
                </div>
            </div>

            <div className="quick-templates">
                <span className="templates-label">Quick Templates:</span>
                {NOTIFICATION_TYPES.slice(1).map(type => (
                    <button
                        key={type.value}
                        type="button"
                        className="template-btn"
                        onClick={() => handleQuickTemplate(type.value)}
                    >
                        <i className={`${type.icon} me-1`} style={{ color: type.color }}></i> {type.label}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="notification-form">
                <div className="form-group">
                    <label>Notification Type</label>
                    <div className="type-tabs">
                        {NOTIFICATION_TYPES.map(type => (
                            <div
                                key={type.value}
                                className={`type-tab ${formData.type === type.value ? 'active' : ''}`}
                                onClick={() => handleTypeSelect(type.value)}
                                style={{
                                    borderColor: formData.type === type.value ? type.color : ''
                                }}
                            >
                                <div
                                    className="tab-icon-wrapper"
                                    style={{
                                        background: formData.type === type.value ? type.color : '#f3f4f6',
                                        color: formData.type === type.value ? 'white' : '#6b7280'
                                    }}
                                >
                                    <i className={type.icon}></i>
                                </div>
                                <span className="tab-label" style={{ color: formData.type === type.value ? type.color : '' }}>
                                    {type.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="title">Title *</label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        placeholder="Enter notification title..."
                        className="form-input"
                        maxLength={100}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="message">Message *</label>
                    <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleInputChange}
                        placeholder="Enter notification message..."
                        className="form-textarea"
                        rows={4}
                        maxLength={300}
                    />
                    <span className="char-count">{formData.message.length}/300</span>
                </div>

                <div className="form-group">
                    <label htmlFor="actionUrl">Link (Optional)</label>
                    <input
                        type="text"
                        id="actionUrl"
                        name="actionUrl"
                        value={formData.actionUrl}
                        onChange={handleInputChange}
                        placeholder="/shop/your-shop or /flash-sale/123..."
                        className="form-input"
                    />
                </div>

                <div className="form-footer">
                    <p className="send-info">
                        <i className="fas fa-bolt me-1 text-warning"></i>
                        Will send to <strong>{followerCount.toLocaleString()}</strong> followers
                    </p>
                    <button
                        type="submit"
                        className="btn-submit"
                        disabled={loading || followerCount === 0}
                    >
                        {loading ? (
                            <span><i className="fas fa-spinner fa-spin me-2"></i>Sending...</span>
                        ) : (
                            <span><i className="fas fa-paper-plane me-2"></i>Send Notification</span>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ShopNotifyFollowersPage;
