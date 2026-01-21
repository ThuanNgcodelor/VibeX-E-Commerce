import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import { shopNotifyFollowers } from '../../api/notification';
import { getFollowerCount, getUser } from '../../api/user';
import './ShopNotifyFollowersPage.css';

const NOTIFICATION_TYPES = [
    { value: 'SHOP_ANNOUNCEMENT', label: '📢 General Announcement', icon: 'fas fa-bullhorn' },
    { value: 'SHOP_FLASH_SALE', label: '🔥 Flash Sale', icon: 'fas fa-bolt' },
    { value: 'SHOP_NEW_PRODUCT', label: '🆕 New Product', icon: 'fas fa-box-open' },
    { value: 'SHOP_PROMOTION', label: '🎁 Promotion', icon: 'fas fa-ticket-alt' },
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
                    <h1>📣 Notify Followers</h1>
                    <p className="subtitle">Send notifications to your shop followers</p>
                </div>
                <div className="follower-badge">
                    <span className="follower-icon">👥</span>
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
                        <i className={`${type.icon} me-1`}></i> {type.label.split(' ').slice(1).join(' ')}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="notification-form">
                <div className="form-group">
                    <label htmlFor="type">Notification Type</label>
                    <div className="select-wrapper">
                        {/* Custom select styling might be needed, but simplified for now */}
                        <select
                            id="type"
                            name="type"
                            value={formData.type}
                            onChange={handleInputChange}
                            className="form-select"
                        >
                            {NOTIFICATION_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label.replace(/^[^\s]+\s/, '')} ({type.label.split(' ')[0]})
                                </option>
                            ))}
                        </select>
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
                        ⚡ Will send to <strong>{followerCount.toLocaleString()}</strong> followers
                    </p>
                    <button
                        type="submit"
                        className="btn-submit"
                        disabled={loading || followerCount === 0}
                    >
                        {loading ? '⏳ Sending...' : '🚀 Send Notification'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ShopNotifyFollowersPage;
