import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import { adminBroadcast } from '../../api/notification';
import './AdminNotificationPage.css';

const NOTIFICATION_TYPES = [
    { value: 'ADMIN_BROADCAST', label: 'General Announcement', icon: 'fas fa-bullhorn', color: '#3b82f6' },
    { value: 'SYSTEM_MAINTENANCE', label: 'System Maintenance', icon: 'fas fa-tools', color: '#ef4444' },
];

const AdminNotificationPage = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        type: 'ADMIN_BROADCAST',
        actionUrl: ''
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTypeSelect = (typeValue) => {
        setFormData(prev => ({ ...prev, type: typeValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.message.trim()) {
            Swal.fire('Error', 'Please enter title and message', 'warning');
            return;
        }

        const result = await Swal.fire({
            title: 'Confirm Broadcast',
            text: 'This notification will be sent to ALL users. Are you sure?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Send',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#ee4d2d',
        });

        if (!result.isConfirmed) return;

        setLoading(true);
        try {
            const response = await adminBroadcast(formData);

            if (response.success === false) {
                throw new Error(response.message || 'Failed to broadcast notification');
            }

            Swal.fire({
                title: 'Success!',
                text: `Notification sent to ${response.sentCount} users`,
                icon: 'success',
            });

            // Reset form
            setFormData({
                title: '',
                message: '',
                type: 'ADMIN_BROADCAST',
                actionUrl: ''
            });
        } catch (error) {
            console.error('Broadcast error:', error);
            Swal.fire('Error', error.message || 'Failed to send notification. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-notification-page">
            <div className="page-header">
                <h1><i className="fas fa-bullhorn text-primary me-2" style={{ color: '#ee4d2d !important' }}></i>System Broadcast</h1>
                <p className="subtitle">Send notifications to all users in the system</p>
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
                                    borderColor: formData.type === type.value ? '#ee4d2d' : ''
                                }}
                            >
                                <div
                                    className="tab-icon-wrapper"
                                    style={{
                                        background: formData.type === type.value ? '#ee4d2d' : '#f3f4f6',
                                        color: formData.type === type.value ? 'white' : '#6b7280'
                                    }}
                                >
                                    <i className={type.icon} style={{ color: formData.type === type.value ? 'white' : type.color }}></i>
                                </div>
                                <span className="tab-label" style={{ color: formData.type === type.value ? '#ee4d2d' : '' }}>
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
                        placeholder="Enter notification content..."
                        className="form-textarea"
                        rows={5}
                        maxLength={500}
                    />
                    <span className="char-count">{formData.message.length}/500</span>
                </div>

                <div className="form-group">
                    <label htmlFor="actionUrl">Action Link (Optional)</label>
                    <input
                        type="text"
                        id="actionUrl"
                        name="actionUrl"
                        value={formData.actionUrl}
                        onChange={handleInputChange}
                        placeholder="/flash-sale or external URL..."
                        className="form-input"
                    />
                </div>

                <div className="form-actions">
                    <button
                        type="submit"
                        className="btn-submit"
                        disabled={loading}
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

export default AdminNotificationPage;
