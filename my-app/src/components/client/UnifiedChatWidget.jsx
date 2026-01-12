import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Cookies from 'js-cookie';
import { getConversations } from '../../api/chat';
import ChatBotWidget from './ChatBotWidget';
import AIChatWidget from './AIChatWidget';
import './UnifiedChatWidget.css';

export default function UnifiedChatWidget() {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('shop'); // 'shop' or 'ai'
    const [shopUnreadCount, setShopUnreadCount] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);

    // Check if user is logged in
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        const token = Cookies.get('accessToken');
        setIsLoggedIn(!!token);
    }, []);

    // Listen for shop chat unread updates
    useEffect(() => {
        const updateUnreadCount = async () => {
            if (!isLoggedIn) {
                setShopUnreadCount(0);
                return;
            }

            try {
                const conversations = await getConversations();
                const total = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
                setShopUnreadCount(total);
            } catch (error) {
                console.error('Error loading unread count:', error);
                setShopUnreadCount(0);
            }
        };

        // Update on mount and when opened
        if (isLoggedIn) {
            updateUnreadCount();

            // Poll every 30 seconds when logged in
            const interval = setInterval(updateUnreadCount, 30000);
            return () => clearInterval(interval);
        }
    }, [isLoggedIn, isOpen]);

    // Listen for custom events from shop chat
    useEffect(() => {
        const handleUnreadUpdate = (event) => {
            setShopUnreadCount(event.detail || 0);
        };

        const handleOpenChat = () => {
            setIsOpen(true);
            setIsMinimized(false);
            setActiveTab('shop');
        };

        window.addEventListener('shop-chat-unread-update', handleUnreadUpdate);
        window.addEventListener('open-unified-chat', handleOpenChat);

        return () => {
            window.removeEventListener('shop-chat-unread-update', handleUnreadUpdate);
            window.removeEventListener('open-unified-chat', handleOpenChat);
        };
    }, []);

    // When shop chat has unread, default to shop tab
    useEffect(() => {
        if (isOpen && shopUnreadCount > 0 && activeTab !== 'shop') {
            // Don't auto-switch if user is already in AI tab
            // Just show badge
        }
    }, [shopUnreadCount]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
    };

    return (
        <>
            {/* Unified FAB Button */}
            {!isOpen && (
                <button
                    className="unified-chat-fab"
                    onClick={() => {
                        setIsOpen(true);
                        setIsMinimized(false);
                    }}
                    title={t('chat.openChat', 'Mở chat')}
                    aria-label="Open chat"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="currentColor" />
                        <circle cx="8" cy="10" r="1.5" fill="white" />
                        <circle cx="12" cy="10" r="1.5" fill="white" />
                        <circle cx="16" cy="10" r="1.5" fill="white" />
                    </svg>
                    <span>Chat</span>
                    {shopUnreadCount > 0 && (
                        <span className="unified-chat-badge">
                            {shopUnreadCount > 99 ? '99+' : shopUnreadCount}
                        </span>
                    )}
                </button>
            )}

            {/* Minimized Banner */}
            {isOpen && isMinimized && (
                <div
                    className="unified-chat-minimized"
                    onClick={() => setIsMinimized(false)}
                >
                    <span>{t('chat.viewChatWindow', 'Xem cửa sổ chat')}</span>
                    {shopUnreadCount > 0 && (
                        <span className="unified-minimized-badge">{shopUnreadCount}</span>
                    )}
                </div>
            )}

            {/* Unified Chat Panel */}
            {isOpen && !isMinimized && (
                <div className="unified-chat-panel">
                    {/* Tab Header */}
                    <div className="unified-chat-header">
                        <div className="unified-chat-tabs">
                            <button
                                className={`unified-chat-tab ${activeTab === 'shop' ? 'active' : ''}`}
                                onClick={() => handleTabChange('shop')}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="currentColor" />
                                </svg>
                                <span>{t('chat.shopChat', 'Shop Chat')}</span>
                                {shopUnreadCount > 0 && (
                                    <span className="unified-tab-badge">{shopUnreadCount > 99 ? '99+' : shopUnreadCount}</span>
                                )}
                            </button>
                            <button
                                className={`unified-chat-tab ${activeTab === 'ai' ? 'active' : ''}`}
                                onClick={() => handleTabChange('ai')}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" fill="currentColor" />
                                    <circle cx="9" cy="10" r="1.5" fill="white" />
                                    <circle cx="15" cy="10" r="1.5" fill="white" />
                                    <path d="M12 16C14.21 16 16 14.67 16 13H8C8 14.67 9.79 16 12 16Z" fill="white" />
                                </svg>
                                <span>{t('chat.aiAssistant', 'AI Assistant')}</span>
                            </button>
                        </div>
                        <div className="unified-chat-header-actions">
                            <button
                                className="unified-chat-header-btn"
                                onClick={() => setIsMinimized(true)}
                                title={t('chat.minimize', 'Thu nhỏ')}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M19 13H5v-2h14v2z" fill="currentColor" />
                                </svg>
                            </button>
                            <button
                                className="unified-chat-header-btn"
                                onClick={() => setIsOpen(false)}
                                title={t('chat.close', 'Đóng')}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="unified-chat-content">
                        <div className={`unified-tab-pane ${activeTab === 'shop' ? 'active' : ''}`}>
                            {activeTab === 'shop' && (
                                <ChatBotWidget
                                    embedded={true}
                                    onUnreadUpdate={(count) => setShopUnreadCount(count)}
                                />
                            )}
                        </div>
                        <div className={`unified-tab-pane ${activeTab === 'ai' ? 'active' : ''}`}>
                            {activeTab === 'ai' && (
                                <AIChatWidget embedded={true} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
