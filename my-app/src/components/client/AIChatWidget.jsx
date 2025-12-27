import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Cookies from 'js-cookie';
import { sendAIChatMessage, clearAIConversation } from '../../api/ai-chat';
import './AIChatWidget.css';

export default function AIChatWidget() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const getUserId = () => {
        const token = Cookies.get('accessToken');
        if (!token) return null;
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.userId || payload.sub || null;
        } catch {
            return null;
        }
    };

    const handleSendMessage = async (e) => {
        e?.preventDefault();
        const message = inputValue.trim();
        if (!message || isLoading) return;

        setMessages(prev => [...prev, { role: 'user', content: message }]);
        setInputValue('');
        setIsLoading(true);

        try {
            const userId = getUserId();
            const response = await sendAIChatMessage(message, conversationId, userId);

            if (response.conversationId) {
                setConversationId(response.conversationId);
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.message,
                type: response.type,
                success: response.success
            }]);
        } catch (error) {
            console.error('AI Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: t('aiChat.errorMessage', 'Xin lỗi, không thể kết nối với AI. Vui lòng thử lại sau.'),
                type: 'error',
                success: false
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearChat = async () => {
        if (conversationId) {
            try {
                await clearAIConversation(conversationId);
            } catch (error) {
                console.error('Error clearing conversation:', error);
            }
        }
        setMessages([]);
        setConversationId(null);
    };

    const handleQuickQuestion = (questionKey, defaultText) => {
        const question = t(questionKey, defaultText);
        setInputValue(question);
        setTimeout(() => {
            handleSendMessage({ preventDefault: () => { } });
        }, 100);
    };

    // Suggested questions without emojis
    const suggestedQuestions = [
        { key: 'aiChat.suggestions.findProducts', default: 'Tìm sản phẩm' },
        { key: 'aiChat.suggestions.saleProducts', default: 'Sản phẩm đang giảm giá' },
        { key: 'aiChat.suggestions.today', default: 'Hôm nay thứ mấy?' }
    ];

    // Render message content với markdown đơn giản
    const renderMessageContent = (msg) => {
        if (!msg.content) return null;

        const formattedContent = msg.content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n- /g, '<br/>• ')
            .replace(/\n\d\. /g, (match) => '<br/>' + match.trim() + ' ')
            .replace(/\n/g, '<br/>');

        return (
            <div
                className="ai-message-content"
                dangerouslySetInnerHTML={{ __html: formattedContent }}
            />
        );
    };

    return (
        <>
            {/* FAB Button */}
            {!isOpen && (
                <button
                    className="ai-chat-fab"
                    onClick={() => setIsOpen(true)}
                    title={t('aiChat.title', 'AI Assistant')}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="currentColor" />
                        <circle cx="8" cy="10" r="1.5" fill="white" />
                        <circle cx="12" cy="10" r="1.5" fill="white" />
                        <circle cx="16" cy="10" r="1.5" fill="white" />
                    </svg>
                    <span>AI</span>
                </button>
            )}

            {/* Chat Panel */}
            {isOpen && (
                <div className="ai-chat-panel">
                    {/* Header */}
                    <div className="ai-chat-header">
                        <div className="ai-chat-header-title">
                            <div className="ai-header-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="currentColor" />
                                    <circle cx="9" cy="10" r="1.5" fill="white" />
                                    <circle cx="15" cy="10" r="1.5" fill="white" />
                                    <path d="M12 16C14.21 16 16 14.67 16 13H8C8 14.67 9.79 16 12 16Z" fill="white" />
                                </svg>
                            </div>
                            <div className="ai-header-text">
                                <span className="ai-header-name">{t('aiChat.name', 'VIBE AI')}</span>
                                <span className="ai-header-status">{t('aiChat.status', 'Trợ lý mua sắm')}</span>
                            </div>
                        </div>
                        <div className="ai-chat-header-actions">
                            <button
                                onClick={handleClearChat}
                                title={t('aiChat.clearHistory', 'Xóa lịch sử')}
                                className="ai-header-btn"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z" fill="currentColor" />
                                </svg>
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                title={t('aiChat.close', 'Đóng')}
                                className="ai-header-btn"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="ai-chat-messages">
                        {messages.length === 0 && (
                            <div className="ai-chat-welcome">
                                <div className="ai-welcome-icon">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="#ee4d2d" />
                                        <circle cx="9" cy="10" r="1.5" fill="white" />
                                        <circle cx="15" cy="10" r="1.5" fill="white" />
                                        <path d="M12 16C14.21 16 16 14.67 16 13H8C8 14.67 9.79 16 12 16Z" fill="white" />
                                    </svg>
                                </div>
                                <h3>{t('aiChat.welcomeTitle', 'Xin chào! Tôi là VIBE AI')}</h3>
                                <p>{t('aiChat.welcomeDesc', 'Tôi có thể giúp bạn tìm sản phẩm, tra cứu giá cả và trả lời các câu hỏi.')}</p>

                                <div className="ai-suggested-questions">
                                    {suggestedQuestions.map((q, idx) => (
                                        <button
                                            key={idx}
                                            className="ai-suggestion-chip"
                                            onClick={() => handleQuickQuestion(q.key, q.default)}
                                        >
                                            {t(q.key, q.default)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`ai-message ${msg.role === 'user' ? 'user' : 'assistant'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="ai-message-avatar">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="#ee4d2d" />
                                            <circle cx="9" cy="10" r="1" fill="white" />
                                            <circle cx="15" cy="10" r="1" fill="white" />
                                        </svg>
                                    </div>
                                )}
                                <div className={`ai-message-bubble ${msg.type === 'error' ? 'error' : ''}`}>
                                    {renderMessageContent(msg)}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="ai-message assistant">
                                <div className="ai-message-avatar">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="#ee4d2d" />
                                        <circle cx="9" cy="10" r="1" fill="white" />
                                        <circle cx="15" cy="10" r="1" fill="white" />
                                    </svg>
                                </div>
                                <div className="ai-message-bubble loading">
                                    <span className="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form className="ai-chat-input" onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={t('aiChat.placeholder', 'Nhập câu hỏi của bạn...')}
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={!inputValue.trim() || isLoading}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor" />
                            </svg>
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
