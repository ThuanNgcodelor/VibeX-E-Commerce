import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import { shopNotifyFollowers } from '../../api/notification';
import { getFollowerCount } from '../../api/user';
import './ShopNotifyFollowersPage.css';

const NOTIFICATION_TYPES = [
    { value: 'SHOP_ANNOUNCEMENT', label: '📢 Thông báo chung', icon: '📢' },
    { value: 'SHOP_FLASH_SALE', label: '🔥 Flash Sale', icon: '🔥' },
    { value: 'SHOP_NEW_PRODUCT', label: '🆕 Sản phẩm mới', icon: '🆕' },
    { value: 'SHOP_PROMOTION', label: '🎁 Khuyến mãi', icon: '🎁' },
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
            const count = await getFollowerCount();
            setFollowerCount(count || 0);
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
                title: '🔥 Flash Sale đang diễn ra!',
                message: 'Giảm giá sốc lên đến 50% cho tất cả sản phẩm. Nhanh tay mua ngay!',
                type: 'SHOP_FLASH_SALE'
            },
            'SHOP_NEW_PRODUCT': {
                title: '🆕 Sản phẩm mới ra mắt!',
                message: 'Shop vừa cập nhật sản phẩm mới. Ghé thăm ngay để xem nhé!',
                type: 'SHOP_NEW_PRODUCT'
            },
            'SHOP_PROMOTION': {
                title: '🎁 Ưu đãi đặc biệt cho bạn!',
                message: 'Mã giảm giá độc quyền dành cho followers. Sử dụng ngay hôm nay!',
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
            Swal.fire('Lỗi', 'Vui lòng nhập tiêu đề và nội dung', 'warning');
            return;
        }

        if (followerCount === 0) {
            Swal.fire('Thông báo', 'Shop chưa có follower nào', 'info');
            return;
        }

        const result = await Swal.fire({
            title: 'Xác nhận gửi thông báo',
            text: `Thông báo sẽ được gửi đến ${followerCount} followers của bạn`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Gửi ngay',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#10b981',
        });

        if (!result.isConfirmed) return;

        setLoading(true);
        try {
            const response = await shopNotifyFollowers(formData);

            Swal.fire({
                title: 'Thành công!',
                text: `Đã gửi thông báo đến ${response.sentCount} followers`,
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
            Swal.fire('Lỗi', 'Không thể gửi thông báo. Vui lòng thử lại.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="shop-notify-page">
            <div className="page-header">
                <div className="header-left">
                    <h1>📣 Thông báo cho Followers</h1>
                    <p className="subtitle">Gửi thông báo đến những người theo dõi shop của bạn</p>
                </div>
                <div className="follower-badge">
                    <span className="follower-icon">👥</span>
                    <span className="follower-count">{followerCount.toLocaleString()}</span>
                    <span className="follower-label">followers</span>
                </div>
            </div>

            <div className="quick-templates">
                <span className="templates-label">Mẫu nhanh:</span>
                {NOTIFICATION_TYPES.slice(1).map(type => (
                    <button
                        key={type.value}
                        type="button"
                        className="template-btn"
                        onClick={() => handleQuickTemplate(type.value)}
                    >
                        {type.icon} {type.label.split(' ')[1]}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="notification-form">
                <div className="form-group">
                    <label htmlFor="type">Loại thông báo</label>
                    <select
                        id="type"
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="form-select"
                    >
                        {NOTIFICATION_TYPES.map(type => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="title">Tiêu đề *</label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        placeholder="Nhập tiêu đề thông báo..."
                        className="form-input"
                        maxLength={100}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="message">Nội dung *</label>
                    <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleInputChange}
                        placeholder="Nhập nội dung thông báo..."
                        className="form-textarea"
                        rows={4}
                        maxLength={300}
                    />
                    <span className="char-count">{formData.message.length}/300</span>
                </div>

                <div className="form-group">
                    <label htmlFor="actionUrl">Link (tùy chọn)</label>
                    <input
                        type="text"
                        id="actionUrl"
                        name="actionUrl"
                        value={formData.actionUrl}
                        onChange={handleInputChange}
                        placeholder="/shop/your-shop hoặc /flash-sale/123..."
                        className="form-input"
                    />
                </div>

                <div className="form-footer">
                    <p className="send-info">
                        ⚡ Sẽ gửi đến <strong>{followerCount.toLocaleString()}</strong> followers
                    </p>
                    <button
                        type="submit"
                        className="btn-submit"
                        disabled={loading || followerCount === 0}
                    >
                        {loading ? '⏳ Đang gửi...' : '🚀 Gửi thông báo'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ShopNotifyFollowersPage;
