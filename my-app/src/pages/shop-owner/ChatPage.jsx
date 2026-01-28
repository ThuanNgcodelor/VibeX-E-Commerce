import React, { useEffect, useState, useRef } from "react";
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';
import { getConversations, getMessages, sendMessage, markAsRead } from "../../api/chat";
import { connectWebSocket, subscribeToConversation, disconnectWebSocket, isConnected } from "../../utils/websocket";
import { getUser, getUserById } from "../../api/user";
import { fetchProductById } from "../../api/product";
import '../../components/shop-owner/ShopOwnerLayout.css';

// Helper functions
const formatDate = (dateString, t) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return t('shopOwner.chat.yesterday');
    } else if (days < 7) {
      return date.toLocaleDateString('vi-VN', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    }
  } catch {
    return '';
  }
};

const getInitials = (name) => {
  if (!name) return 'U';
  const words = name.trim().split(' ');
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export default function ChatPage() {
  const { t } = useTranslation();
  const [selectedChat, setSelectedChat] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [loading, setLoading] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [wsSubscription, setWsSubscription] = useState(null);

  const [currentUserId, setCurrentUserId] = useState(null);
  const [productImageUrl, setProductImageUrl] = useState(null);
  const [userNames, setUserNames] = useState({}); // Cache user names: { userId: username }
  const messagesEndRef = useRef(null);

  // Get current user ID
  useEffect(() => {
    getUser().then(user => {
      setCurrentUserId(user?.id || user?.userId || null);
    }).catch(() => {
      setCurrentUserId(null);
    });
  }, []);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    if (currentUserId) {
      connectWebSocket(
        (message) => {
          // ✅ FIX: Handle conversation updates from /topic/user/{userId}/conversations
          // Backend pushes notification when there's a new message in ANY conversation
          console.log('Received conversation update:', message);

          // Reload conversations list to update lastMessage and unreadCount
          // This ensures shop owner sees new messages in real-time
          loadConversations();
        },
        (error) => {
          console.error('WebSocket error:', error);
        },
        currentUserId  // ✅ IMPORTANT: Pass userId to subscribe to /topic/user/{userId}/conversations
      ).catch(err => console.error('Failed to connect WebSocket:', err));
    }

    return () => {
      if (wsSubscription) {
        wsSubscription.unsubscribe();
      }
      disconnectWebSocket();
    };
  }, [currentUserId]);

  // Load product data and image when conversation with product is selected
  useEffect(() => {
    if (selectedChat?.productId) {
      loadProductData(selectedChat.productId);
    } else {
      setProductImageUrl(null);
      // Clear product data if no productId
      if (selectedChat) {
        setSelectedChat(prev => ({ ...prev, product: null }));
      }
    }
  }, [selectedChat?.productId]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedChat?.id) {
      loadMessages(selectedChat.id);

      // Mark as read with delay
      setTimeout(() => {
        markAsRead(selectedChat.id)
          .then(() => {
            // Refresh conversations to update unread count
            loadConversations();
          })
          .catch(err => {
            if (!err?.response?.data?.message?.includes('not found')) {
              console.error('Error marking as read:', err);
            }
          });
      }, 500);

      // Subscribe to WebSocket for this conversation
      if (isConnected()) {
        // Unsubscribe previous subscription if exists
        if (wsSubscription) {
          wsSubscription.unsubscribe();
        }

        const sub = subscribeToConversation(selectedChat.id, (message) => {
          console.log('Received message via WebSocket:', message);
          setMessages(prev => {
            if (prev.some(m => m.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          });
          scrollToBottom();
          // Refresh conversations to update unread count
          loadConversations();
        });
        setWsSubscription(sub);
      } else {
        // If not connected, try to connect
        connectWebSocket(
          (message) => {
            if (message.conversationId === selectedChat?.id) {
              setMessages(prev => {
                if (prev.some(m => m.id === message.id)) {
                  return prev;
                }
                return [...prev, message];
              });
              scrollToBottom();
            }
            loadConversations();
          },
          (error) => {
            console.error('WebSocket error:', error);
          },
          currentUserId
        ).then(() => {
          // After connection, subscribe
          if (isConnected()) {
            const sub = subscribeToConversation(selectedChat.id, (message) => {
              setMessages(prev => {
                if (prev.some(m => m.id === message.id)) {
                  return prev;
                }
                return [...prev, message];
              });
              scrollToBottom();
              loadConversations();
            });
            setWsSubscription(sub);
          }
        }).catch(err => console.error('Failed to connect WebSocket:', err));
      }
    }

    return () => {
      if (wsSubscription) {
        wsSubscription.unsubscribe();
        setWsSubscription(null);
      }
    };
  }, [selectedChat?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await getConversations();
      let convs = Array.isArray(data) ? data : [];

      // ✅ FIX: Sort conversations by lastMessageAt DESC (newest first)
      convs = convs.sort((a, b) => {
        const dateA = a.lastMessageAt ? new Date(a.lastMessageAt) : new Date(0);
        const dateB = b.lastMessageAt ? new Date(b.lastMessageAt) : new Date(0);
        return dateB - dateA; // DESC order - newest first
      });

      setConversations(convs);

      // Load usernames for clients (shop-owner side)
      const clientIds = [...new Set(convs.map(conv => conv.clientId).filter(Boolean))];
      const newUserNames = { ...userNames };
      await Promise.all(clientIds.map(async (clientId) => {
        if (!newUserNames[clientId]) {
          try {
            const user = await getUserById(clientId);
            if (user?.username) {
              newUserNames[clientId] = user.username;
            }
          } catch (err) {
            console.error(`Error loading username for ${clientId}:`, err);
            // Fallback: use opponent username if available
            const conv = convs.find(c => c.clientId === clientId);
            if (conv?.opponent?.username) {
              newUserNames[clientId] = conv.opponent.username;
            }
          }
        }
      }));
      setUserNames(newUserNames);

      // ✅ Dispatch custom event to notify components (e.g., Sidebar badge)
      window.dispatchEvent(new CustomEvent('conversation-list-updated'));
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      setLoading(true);
      const data = await getMessages(conversationId, 0, 50);
      setMessages(Array.isArray(data) ? data.reverse() : []);

      // Load images for messages

    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };



  const loadProductData = async (productId) => {
    try {
      // Fetch product data
      const productRes = await fetchProductById(productId);
      const product = productRes.data;

      // Update selectedChat with full product data
      if (product) {
        setSelectedChat(prev => ({ ...prev, product }));

        // Load product image
        if (product?.imageId) {
          setProductImageUrl(`/v1/file-storage/get/${product.imageId}`);
        } else if (product?.imageUrl) {
          setProductImageUrl(product.imageUrl);
        } else {
          setProductImageUrl(null);
        }
      }
    } catch (err) {
      console.error(`Error loading product data:`, err);
      setProductImageUrl(null);
      // Clear product data on error
      setSelectedChat(prev => ({ ...prev, product: null }));
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const content = messageInput.trim();
    if (!content || !selectedChat?.id || loading) return;

    try {
      setMessageInput("");
      await sendMessage(selectedChat.id, content);
    } catch (error) {
      console.error('Error sending message:', error);
      Swal.fire({
        icon: 'error',
        title: 'Lỗi',
        text: t('shopOwner.chat.sendMessageFailed'),
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
    }
  };

  const filteredConversations = React.useMemo(() => {
    let filtered = conversations;

    if (searchQuery.trim()) {
      filtered = filtered.filter(conv => {
        const name = conv.opponent?.username || conv.title || '';
        const productName = conv.product?.name || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          productName.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    if (filterType === "unread") {
      filtered = filtered.filter(conv => (conv.unreadCount || 0) > 0);
    }

    return filtered;
  }, [conversations, searchQuery, filterType]);

  return (
    <div className="chat-page-container">
      <div className="chat-page-header">
        <h2 className="chat-page-title">
          <i className="fas fa-comments me-2"></i>
          {t('shopOwner.chat.title')}
        </h2>
        <div className="chat-page-stats">
          <span className="stat-item">
            <i className="fas fa-inbox me-1"></i>
            {conversations.length} {t('shopOwner.chat.conversations')}
          </span>
          <span className="stat-item">
            <i className="fas fa-envelope me-1"></i>
            {conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0)} {t('shopOwner.chat.unread')}
          </span>
        </div>
      </div>

      <div className="chat-page-content">
        {/* Left Sidebar - Conversation List */}
        <div className="chat-sidebar">
          <div className="chat-search-section">
            <div className="chat-search-wrapper">
              <i className="fas fa-search chat-search-icon"></i>
              <input
                type="text"
                className="chat-search-input"
                placeholder={t('shopOwner.chat.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="chat-filter-dropdown"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">{t('shopOwner.chat.all')}</option>
              <option value="unread">{t('shopOwner.chat.unreadFilter')}</option>
            </select>
          </div>

          <div className="chat-list">
            {loading && conversations.length === 0 ? (
              <div className="chat-empty-state">
                <i className="fas fa-spinner fa-spin"></i> {t('shopOwner.chat.loading')}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="chat-empty-state">
                <i className="fas fa-inbox"></i>
                <p>{t('shopOwner.chat.noConversations')}</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                // Shop-owner side: Hiển thị username của client
                // Ưu tiên: cached username > opponent username > title > "Customer"
                let name = t('shopOwner.chat.customer');
                if (conv.clientId && userNames[conv.clientId]) {
                  name = userNames[conv.clientId];
                } else if (conv.opponent?.username) {
                  name = conv.opponent.username;
                } else if (conv.title) {
                  name = conv.title;
                } else if (conv.clientId) {
                  name = `User ${conv.clientId.substring(0, 8)}`;
                }

                const lastMsg = conv.lastMessageContent || t('shopOwner.chat.startConversation');
                const date = formatDate(conv.lastMessageAt, t);
                const unread = conv.unreadCount || 0;
                const avatarColor = conv.opponent?.id ?
                  `#${conv.opponent.id.substring(0, 6)}` :
                  (conv.product?.id ? `#${conv.product.id.substring(0, 6)}` : '#EE4D2D');

                return (
                  <div
                    key={conv.id}
                    className={`chat-item ${selectedChat?.id === conv.id ? 'active' : ''}`}
                    onClick={() => setSelectedChat(conv)}
                  >
                    <div
                      className="chat-avatar"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {getInitials(name)}
                    </div>
                    <div className="chat-item-content">
                      <div className="chat-item-header">
                        <span className="chat-item-name">{name}</span>
                        {date && <span className="chat-item-date">{date}</span>}
                      </div>
                      <div className="chat-item-message">
                        {lastMsg}
                        {unread > 0 && (
                          <span className="chat-unread-badge">{unread}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel - Chat Content */}
        <div className="chat-main">
          {!selectedChat ? (
            <div className="chat-welcome">
              <div className="chat-welcome-illustration">
                <i className="fas fa-comments"></i>
              </div>
              <h3>{t('shopOwner.chat.selectConversation')}</h3>
              <p>{t('shopOwner.chat.selectConversationDesc')}</p>
            </div>
          ) : (
            <div className="chat-content">
              {/* Chat Header */}
              <div className="chat-content-header">
                <div className="chat-header-name">
                  {selectedChat.clientId && userNames[selectedChat.clientId]
                    ? userNames[selectedChat.clientId]
                    : (selectedChat.opponent?.username || selectedChat.title || t('shopOwner.chat.customer'))}
                </div>
              </div>

              {/* Product Card - Hiển thị khi có product và có name */}
              {selectedChat.product && selectedChat.product.name && (
                <div className="chat-product-card">
                  <div className="chat-product-label">
                    {t('shopOwner.chat.talkingAboutProduct')}
                  </div>
                  <div className="chat-product-info">
                    {productImageUrl && (
                      <div className="chat-product-thumbnail">
                        <img src={productImageUrl} alt={selectedChat.product.name || 'Product'} />
                      </div>
                    )}
                    <div className="chat-product-details">
                      <div className="chat-product-name">
                        {selectedChat.product.name}
                      </div>
                      {selectedChat.product.price && (
                        <div className="chat-product-price">
                          {selectedChat.product.price.toLocaleString('vi-VN')} ₫
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="chat-messages">
                {loading && messages.length === 0 ? (
                  <div className="chat-empty-state">
                    <i className="fas fa-spinner fa-spin"></i> {t('shopOwner.chat.loadingMessages')}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty-state">
                    <i className="fas fa-comment"></i>
                    <p>{t('shopOwner.chat.noMessages')}</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOwn = currentUserId && msg.senderId === currentUserId;
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showDate = !prevMsg ||
                      new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (
                          <div className="chat-date-divider">
                            {new Date(msg.createdAt).toLocaleDateString('vi-VN', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </div>
                        )}
                        <div className={`chat-message ${isOwn ? 'own' : 'other'}`}>
                          {!isOwn && (
                            <div className="chat-message-avatar">
                              {getInitials(
                                selectedChat.clientId && userNames[selectedChat.clientId]
                                  ? userNames[selectedChat.clientId]
                                  : (msg.senderName || 'C')
                              )}
                            </div>
                          )}
                          <div className="chat-message-content">
                            <div className="chat-message-bubble">
                              <div className="chat-message-text">{msg.content}</div>
                              {msg.imageId && (
                                <img
                                  src={`/v1/file-storage/get/${msg.imageId}`}
                                  alt="Message"
                                  className="chat-message-image"
                                  loading="lazy"
                                />
                              )}
                            </div>
                            <div className="chat-message-time">
                              {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                              {isOwn && msg.deliveryStatus === 'READ' && (
                                <span className="chat-read-indicator">✓✓</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form className="chat-input-form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="chat-input-field"
                  placeholder={t('shopOwner.chat.typeMessage')}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="chat-send-btn"
                  disabled={!messageInput.trim() || loading}
                >
                  <i className="fas fa-paper-plane"></i>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .chat-page-container {
          padding: 16px; /* ✅ Reduced from 20px */
          height: calc(100vh - 60px); /* ✅ Reduced from 80px to give more height */
          display: flex;
          flex-direction: column;
          background: #f5f5f5;
        }

        .chat-page-header {
          background: #fff;
          padding: 15px 20px; /* ✅ More compact vertical padding */
          border-radius: 8px;
          margin-bottom: 15px; /* ✅ Reduced margin */
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chat-page-title {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          color: #EE4D2D;
        }

        .chat-page-stats {
          display: flex;
          gap: 20px;
        }

        .stat-item {
          color: #666;
          font-size: 14px;
        }

        .chat-page-content {
          flex: 1;
          display: flex;
          gap: 20px;
          overflow: hidden;
        }

        /* Sidebar */
        .chat-sidebar {
          width: 320px; /* ✅ Reduced from 350px to give more space to chat */
          min-width: 280px; /* ✅ Add min-width for responsive */
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .chat-search-section {
          padding: 16px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          gap: 8px;
        }

        .chat-search-wrapper {
          flex: 1;
          position: relative;
        }

        .chat-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #999;
        }

        .chat-search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          font-size: 14px;
          outline: none;
        }

        .chat-search-input:focus {
          border-color: #EE4D2D;
        }

        .chat-filter-dropdown {
          padding: 8px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          font-size: 14px;
          background: #fff;
          cursor: pointer;
        }

        .chat-list {
          flex: 1;
          overflow-y: auto;
          background: #fafafa;
        }

        .chat-item {
          display: flex;
          gap: 12px;
          padding: 16px;
          cursor: pointer;
          border-bottom: 1px solid #f0f0f0;
          transition: background 0.2s;
        }

        .chat-item:hover {
          background: #f5f5f5;
        }

        .chat-item.active {
          background: #fff5f0;
          border-left: 3px solid #EE4D2D;
        }

        .chat-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .chat-item-content {
          flex: 1;
          min-width: 0;
        }

        .chat-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .chat-item-name {
          font-size: 14px;
          font-weight: 500;
          color: #222;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .chat-item-date {
          font-size: 12px;
          color: #999;
          flex-shrink: 0;
          margin-left: 8px;
        }

        .chat-item-message {
          font-size: 13px;
          color: #666;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          position: relative;
        }

        .chat-unread-badge {
          background: #EE4D2D;
          color: #fff;
          border-radius: 10px;
          padding: 2px 6px;
          font-size: 10px;
          margin-left: 8px;
          font-weight: 600;
        }

        .chat-empty-state {
          padding: 40px 20px;
          text-align: center;
          color: #999;
        }

        .chat-empty-state i {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        /* Main Chat Area */
        .chat-main {
          flex: 1;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .chat-welcome {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #999;
        }

        .chat-welcome-illustration i {
          font-size: 120px;
          margin-bottom: 24px;
          opacity: 0.3;
        }

        .chat-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .chat-content-header {
          padding: 16px 20px;
          border-bottom: 1px solid #f0f0f0;
          background: #fff;
        }

        .chat-header-name {
          font-size: 16px;
          font-weight: 500;
          color: #222;
        }

        .chat-product-card {
          background: #fff;
          border-bottom: 1px solid #f0f0f0;
          padding: 16px 20px;
        }

        .chat-product-label {
          font-size: 13px;
          color: #666;
          margin-bottom: 12px;
        }

        .chat-product-info {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .chat-product-thumbnail {
          width: 60px;
          height: 60px;
          flex-shrink: 0;
          border-radius: 4px;
          overflow: hidden;
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
        }

        .chat-product-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .chat-product-details {
          flex: 1;
          min-width: 0;
        }

        .chat-product-name {
          font-size: 14px;
          font-weight: 500;
          color: #222;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .chat-product-price {
          font-size: 15px;
          font-weight: 600;
          color: #EE4D2D;
          margin-bottom: 4px;
        }

        .chat-product-id {
          font-size: 12px;
          color: #999;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px; /* ✅ Reduced padding from 20px */
          background: #fafafa;
          min-height: 400px; /* ✅ Ensure minimum height for comfortable chatting */
        }

        .chat-date-divider {
          text-align: center;
          margin: 16px 0;
          font-size: 12px;
          color: #999;
        }

        .chat-message {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .chat-message.own {
          flex-direction: row-reverse;
        }

        .chat-message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #EE4D2D;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .chat-message-content {
          max-width: 70%;
        }

        .chat-message-bubble {
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          padding: 10px 14px;
          word-wrap: break-word;
        }

        .chat-message.own .chat-message-bubble {
          background: #EE4D2D;
          color: #fff;
          border: none;
        }

        .chat-message-text {
          font-size: 14px;
          line-height: 1.5;
        }

        .chat-message-image {
          max-width: 200px;
          border-radius: 8px;
          margin-top: 8px;
        }

        .chat-message-time {
          font-size: 11px;
          color: #999;
          margin-top: 4px;
          text-align: right;
        }

        .chat-message.own .chat-message-time {
          text-align: left;
        }

        .chat-read-indicator {
          margin-left: 4px;
          color: #4CAF50;
        }

        .chat-input-form {
          display: flex;
          gap: 8px;
          padding: 16px 20px;
          border-top: 1px solid #f0f0f0;
          background: #fff;
        }

        .chat-input-field {
          flex: 1;
          padding: 10px 16px;
          border: 1px solid #e0e0e0;
          border-radius: 20px;
          outline: none;
          font-size: 14px;
        }

        .chat-input-field:focus {
          border-color: #EE4D2D;
        }

        .chat-send-btn {
          width: 40px;
          height: 40px;
          border: none;
          border-radius: 50%;
          background: #EE4D2D;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .chat-send-btn:hover:not(:disabled) {
          background: #f05d40;
        }

        .chat-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Scrollbar */
        .chat-list::-webkit-scrollbar,
        .chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .chat-list::-webkit-scrollbar-track,
        .chat-messages::-webkit-scrollbar-track {
          background: #f1f1f1;
        }

        .chat-list::-webkit-scrollbar-thumb,
        .chat-messages::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 3px;
        }

        .chat-list::-webkit-scrollbar-thumb:hover,
        .chat-messages::-webkit-scrollbar-thumb:hover {
          background: #999;
        }
      `}</style>
    </div>
  );
}

