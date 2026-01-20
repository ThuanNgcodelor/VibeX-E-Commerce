import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';
import { adminBroadcast } from '../../api/notification';
import './AdminNotificationPage.css';

const NOTIFICATION_TYPES = [
    { value: 'ADMIN_BROADCAST', label: 'General Announcement' },
    { value: 'SYSTEM_MAINTENANCE', label: 'System Maintenance' },
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
            confirmButtonColor: '#3085d6',
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
                <h1>📢 System Broadcast</h1>
                <p className="subtitle">Send notifications to all users in the system</p>
            </div>

            <form onSubmit={handleSubmit} className="notification-form">
                <div className="form-group">
                    <label htmlFor="type">Notification Type</label>
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
                            <>⏳ Sending...</>
                        ) : (
                            <>📨 Send Notification</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AdminNotificationPage;
