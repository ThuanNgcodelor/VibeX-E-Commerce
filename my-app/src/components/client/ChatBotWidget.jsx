import React from "react";
import Cookies from "js-cookie";
import { useTranslation } from 'react-i18next';
import { getConversations, getMessages, sendMessage, markAsRead, startConversation } from "../../api/chat";
import { connectWebSocket, subscribeToConversation, disconnectWebSocket, isConnected } from "../../utils/websocket";
import { fetchImageById } from "../../api/image";
import { getUser, getShopOwnerByUserId } from "../../api/user";
import { fetchProductById, fetchProductImageById } from "../../api/product";

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
      return t('chat.yesterday');
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

// Mock data for chat conversations (fallback)
const MOCK_CONVERSATIONS = [
  {
    id: 1,
    name: "Flash Titan",
    avatar: "FT",
    avatarColor: "#1e3a8a",
    lastMessage: "[Dán nhãn]",
    date: "26/11",
    unread: 0
  },
  {
    id: 2,
    name: "njn.official",
    avatar: "NJN JEWELRY",
    avatarColor: "#000000",
    lastMessage: "dạ, nhẫn này unisex c...",
    date: "15/09",
    unread: 0
  },
  {
    id: 3,
    name: "Bàn Phím Univer...",
    avatar: "UM",
    avatarColor: "#fbbf24",
    lastMessage: "Cảm ơn bạn đã quan t...",
    date: "09/09",
    unread: 0
  },
  {
    id: 4,
    name: "rem_kinh_bac",
    avatar: "R",
    avatarColor: "#1f2937",
    lastMessage: "Bấm vào để xem chi ti...",
    date: "31/08",
    unread: 0
  },
  {
    id: 5,
    name: "Profitness Sport...",
    avatar: "PRO FITNESS",
    avatarColor: "#000000",
    lastMessage: "Không bán sample ạ",
    date: "08/07",
    unread: 0
  },
  {
    id: 6,
    name: "hyperkeeb",
    avatar: "HK",
    avatarColor: "#000000",
    lastMessage: "dạ đc á bạn ưi",
    date: "26/05",
    unread: 0
  },
  {
    id: 7,
    name: "Wheystore Hồ C...",
    avatar: "W",
    avatarColor: "#dc2626",
    lastMessage: "[Dán nhãn]",
    date: "25/04",
    unread: 0
  },
  {
    id: 8,
    name: "Bao Cao Su Rẻ 69",
    avatar: "9",
    avatarColor: "#dc2626",
    lastMessage: "Cảm ơn bạn đã mua h...",
    date: "31/03",
    unread: 0
  }
];

export default function ChatBotWidget() {
  const { t } = useTranslation();
  // Chỉ render phía client để tránh lỗi khi SSR/ssg
  const [isClient, setIsClient] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const [selectedChat, setSelectedChat] = React.useState(null);
  const [conversations, setConversations] = React.useState([]);
  const [messages, setMessages] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterType, setFilterType] = React.useState("all");
  const [loading, setLoading] = React.useState(false);
  const [messageInput, setMessageInput] = React.useState("");
  const [wsSubscription, setWsSubscription] = React.useState(null);
  const [imageUrls, setImageUrls] = React.useState({});
  const [currentUserId, setCurrentUserId] = React.useState(null);
  const [productImageUrl, setProductImageUrl] = React.useState(null);
  const [shopNames, setShopNames] = React.useState({}); // Cache shop names: { userId: shopName }
  const messagesEndRef = React.useRef(null);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Get current user ID - chỉ khi có token
  React.useEffect(() => {
    const token = Cookies.get("accessToken");
    if (!token) {
      setCurrentUserId(null);
      return;
    }

    getUser().then(user => {
      setCurrentUserId(user?.id || user?.userId || null);
    }).catch((err) => {
      // Silently fail if 401 (guest or invalid token)
      if (err?.response?.status === 401) {
        Cookies.remove("accessToken");
      }
      setCurrentUserId(null);
    });
  }, []);

  React.useEffect(() => {
    const handleOpenChat = async (event) => {
      const { shopOwnerId, productId } = event.detail || {};
      if (!shopOwnerId) return;

      try {
        // Start or get conversation
        const conversation = await startConversation(shopOwnerId, productId || null);

        // Open chat panel
        setOpen(true);
        setMinimized(false);

        await loadConversations();

        // Select the conversation
        setSelectedChat(conversation);

        if (productId && conversation?.id) {
          try {
            // Send automatic product link message
            await sendMessage(
              conversation.id,
              'I would like to ask about this product:', // "I want to ask about this product"
              'PRODUCT_LINK',
              null, // imageId
              productId
            );

            // Reload messages to show the new product link
            const msgs = await getMessages(conversation.id, 0, 50);
            setMessages(msgs.reverse ? msgs.reverse() : msgs);
          } catch (msgError) {
            console.error('Error sending product link message:', msgError);
            // Continue anyway - the chat is still open
          }
        }
      } catch (error) {
        console.error('Error opening chat:', error);
        alert('Failed to open chat. Please try again.');
      }
    };

    window.addEventListener('open-chat-with-product', handleOpenChat);
    return () => {
      window.removeEventListener('open-chat-with-product', handleOpenChat);
    };
  }, []);

  // Load conversations when chat opens OR in embedded mode on mount
  React.useEffect(() => {
    if (open && !minimized) {
      loadConversations();
      connectWebSocket(
        (message) => {
          // Handle incoming messages
          if (message.conversationId === selectedChat?.id) {
            setMessages(prev => [...prev, message]);
            scrollToBottom();
          }
          // Refresh conversations list
          loadConversations();
        },
        (error) => {
          console.error('WebSocket error:', error);
        },
        currentUserId
      ).catch(err => console.error('Failed to connect WebSocket:', err));
    }

    return () => {
      if (wsSubscription) {
        wsSubscription.unsubscribe();
      }
      disconnectWebSocket();
    };
  }, [open, minimized]);

  // Load product data and image when conversation with product is selected
  React.useEffect(() => {
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
  React.useEffect(() => {
    if (selectedChat?.id) {
      loadMessages(selectedChat.id);

      // Chỉ mark as read nếu conversation đã có messages (tránh lỗi khi conversation mới tạo)
      // Đợi một chút để đảm bảo conversation đã được lưu vào DB
      setTimeout(() => {
        markAsRead(selectedChat.id)
          .then(() => {
            // Refresh conversations to update unread count in badge
            loadConversations();
          })
          .catch(err => {
            // Không hiển thị lỗi nếu conversation chưa tồn tại (có thể là conversation mới)
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
            // Avoid duplicates
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
  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = (instant = false) => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
    }, 100);
  };

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await getConversations();
      const convs = Array.isArray(data) ? data : [];
      setConversations(convs);

      // Load shop names for shop owners
      const shopOwnerIds = [...new Set(convs.map(conv => conv.shopOwnerId).filter(Boolean))];
      const newShopNames = { ...shopNames };
      await Promise.all(shopOwnerIds.map(async (shopOwnerId) => {
        if (!newShopNames[shopOwnerId]) {
          try {
            const shopOwner = await getShopOwnerByUserId(shopOwnerId);
            if (shopOwner?.shopName) {
              newShopNames[shopOwnerId] = shopOwner.shopName;
            }
          } catch (err) {
            console.error(`Error loading shop name for ${shopOwnerId}:`, err);
          }
        }
      }));
      setShopNames(newShopNames);
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
      // Reverse để hiển thị từ cũ đến mới
      const reversedData = Array.isArray(data) ? data.reverse() : [];
      setMessages(reversedData);

      // Load images for messages
      loadMessageImages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    } finally {
      setLoading(false);
      // Scroll sau khi loading hoàn tất và DOM đã render
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 200);
    }
  };

  const loadMessageImages = async (msgs) => {
    const imagePromises = msgs
      .filter(m => m.imageId)
      .map(async (msg) => {
        try {
          const res = await fetchImageById(msg.imageId);
          const blob = new Blob([res.data], {
            type: res.headers["content-type"] || "image/jpeg",
          });
          const url = URL.createObjectURL(blob);
          setImageUrls(prev => ({ ...prev, [msg.imageId]: url }));
        } catch (err) {
          console.error(`Error loading image ${msg.imageId}:`, err);
        }
      });
    await Promise.all(imagePromises);
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
          const imgRes = await fetchProductImageById(product.imageId);
          const blob = new Blob([imgRes.data], {
            type: imgRes.headers["content-type"] || "image/jpeg",
          });
          const url = URL.createObjectURL(blob);
          setProductImageUrl(url);
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
      // Message will be added via WebSocket
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const filteredConversations = React.useMemo(() => {
    // Don't use mock data, show real conversations only
    let filtered = conversations;

    if (searchQuery.trim()) {
      filtered = filtered.filter(conv => {
        const name = conv.opponent?.username || conv.name || '';
        const title = conv.title || '';
        return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          title.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    if (filterType === "unread") {
      filtered = filtered.filter(conv => (conv.unreadCount || 0) > 0);
    }

    return filtered;
  }, [conversations, searchQuery, filterType]);

  // Calculate total unread count for badge
  const totalUnreadCount = React.useMemo(() => {
    return conversations.reduce((total, conv) => total + (conv.unreadCount || 0), 0);
  }, [conversations]);

  // Load conversations when user is logged in (for unread badge even when chat is closed)
  React.useEffect(() => {
    if (currentUserId) {
      loadConversations();
    }
  }, [currentUserId]);

  if (!isClient) return null;

  return (
    <>
      {!open && (
        <button
          className="shopee-chat-fab"
          onClick={() => setOpen(true)}
          title="Chat"
          aria-label="Open chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z" fill="currentColor" />
            <path d="M7 9H17V11H7V9ZM7 12H15V14H7V12Z" fill="currentColor" />
          </svg>
          <span>Chat</span>
          {totalUnreadCount > 0 && (
            <span className="shopee-chat-fab-badge">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </span>
          )}
        </button>
      )}

      {/* Minimized Banner */}
      {open && minimized && (
        <div
          className="shopee-chat-minimized-banner"
          onClick={() => setMinimized(false)}
        >
          <span>{t('chat.viewChatWindow')}</span>
        </div>
      )}

      {open && !minimized && (
        <div className="shopee-chat-panel">
          <div className="shopee-chat-container">
            {/* Left Sidebar - Chat List */}
            <div className="shopee-chat-sidebar">
              <div className="shopee-chat-sidebar-header">
                <h2 className="shopee-chat-title">Chat</h2>
              </div>

              <div className="shopee-chat-search-section">
                <div className="shopee-chat-search-wrapper">
                  <i className="fas fa-search shopee-chat-search-icon"></i>
                  <input
                    type="text"
                    className="shopee-chat-search-input"
                    placeholder={t('chat.searchByName')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select
                  className="shopee-chat-filter-dropdown"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">{t('chat.all')}</option>
                  <option value="unread">{t('chat.unread')}</option>
                </select>
              </div>

              <div className="shopee-chat-list">
                {loading && conversations.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                    <i className="fas fa-spinner fa-spin"></i> Loading...
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                    {t('chat.noConversations')}
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    // Client side: Hiển thị tên shop (shopName) thay vì username
                    // Ưu tiên: shopName > opponent username > title > shop owner ID > "Unknown"
                    let name = t('chat.unknown');
                    if (conv.shopOwnerId && shopNames[conv.shopOwnerId]) {
                      name = shopNames[conv.shopOwnerId];
                    } else if (conv.opponent?.username) {
                      name = conv.opponent.username;
                    } else if (conv.title) {
                      name = conv.title;
                    } else if (conv.shopOwnerId) {
                      name = `Shop ${conv.shopOwnerId.substring(0, 8)}`;
                    }

                    const lastMsg = conv.lastMessageContent || 'Start a conversation';
                    const date = formatDate(conv.lastMessageAt, t);
                    const unread = conv.unreadCount || 0;
                    const avatarColor = conv.opponent?.id ?
                      `#${conv.opponent.id.substring(0, 6)}` :
                      (conv.product?.id ? `#${conv.product.id.substring(0, 6)}` : '#EE4D2D');

                    return (
                      <div
                        key={conv.id}
                        className={`shopee-chat-item ${selectedChat?.id === conv.id ? 'active' : ''}`}
                        onClick={() => setSelectedChat(conv)}
                      >
                        <div
                          className="shopee-chat-avatar"
                          style={{ backgroundColor: avatarColor }}
                        >
                          {getInitials(name)}
                        </div>
                        <div className="shopee-chat-item-content">
                          <div className="shopee-chat-item-header">
                            <span className="shopee-chat-item-name">{name}</span>
                            {date && <span className="shopee-chat-item-date">{date}</span>}
                          </div>
                          <div className="shopee-chat-item-message">
                            {lastMsg}
                            {unread > 0 && (
                              <span style={{
                                marginLeft: '8px',
                                background: '#EE4D2D',
                                color: '#fff',
                                borderRadius: '10px',
                                padding: '2px 6px',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}>
                                {unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Panel - Chat Content or Welcome */}
            <div className="shopee-chat-main">
              <div className="shopee-chat-main-header">
                <div className="shopee-chat-main-header-actions">
                  <button
                    className="shopee-chat-icon-btn"
                    title="Minimize"
                    onClick={() => setMinimized(true)}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                  <button className="shopee-chat-icon-btn" title="More options">
                    <i className="fas fa-chevron-down"></i>
                  </button>
                  <button
                    className="shopee-chat-icon-btn"
                    title="Close"
                    onClick={() => setOpen(false)}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              </div>

              {!selectedChat ? (
                <div className="shopee-chat-welcome">
                  <div className="shopee-chat-welcome-illustration">
                    <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Laptop */}
                      <rect x="30" y="80" width="140" height="90" rx="4" fill="#E5E7EB" />
                      <rect x="35" y="85" width="130" height="80" rx="2" fill="#F3F4F6" />
                      {/* Screen lines */}
                      <line x1="50" y1="100" x2="150" y2="100" stroke="#9CA3AF" strokeWidth="2" />
                      <line x1="50" y1="120" x2="150" y2="120" stroke="#9CA3AF" strokeWidth="2" />
                      {/* Chat bubble */}
                      <circle cx="160" cy="60" r="25" fill="#EE4D2D" />
                      <circle cx="160" cy="60" r="8" fill="#FFFFFF" opacity="0.8" />
                      <circle cx="155" cy="58" r="3" fill="#FFFFFF" />
                      <circle cx="165" cy="58" r="3" fill="#FFFFFF" />
                      <circle cx="160" cy="64" r="3" fill="#FFFFFF" />
                    </svg>
                  </div>
                  <h3 className="shopee-chat-welcome-title">
                    Chào mừng bạn đến với Shopee Chat
                  </h3>
                  <p className="shopee-chat-welcome-subtitle">
                    Start chatting with our sellers now!
                  </p>
                </div>
              ) : (
                <div className="shopee-chat-content">
                  {/* Chat Header */}
                  <div className="shopee-chat-content-header">
                    <div className="shopee-chat-header-name">
                      {selectedChat.shopOwnerId && shopNames[selectedChat.shopOwnerId]
                        ? shopNames[selectedChat.shopOwnerId]
                        : (selectedChat.opponent?.username || selectedChat.title || t('chat.shop'))}
                    </div>
                  </div>

                  {/* Product Card - Hiển thị khi có product và có name */}
                  {selectedChat.product && selectedChat.product.name && (
                    <div className="shopee-chat-product-card">
                      <div className="shopee-chat-product-label">
                        {t('chat.talkingAboutProduct')}
                      </div>
                      <div className="shopee-chat-product-info">
                        {productImageUrl && (
                          <div className="shopee-chat-product-thumbnail">
                            <img src={productImageUrl} alt={selectedChat.product.name || 'Product'} />
                          </div>
                        )}
                        <div className="shopee-chat-product-details">
                          <div className="shopee-chat-product-name">
                            {selectedChat.product.name}
                          </div>
                          {selectedChat.product.price && (
                            <div className="shopee-chat-product-price">
                              {selectedChat.product.price.toLocaleString('vi-VN')} ₫
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="shopee-chat-messages">
                    {loading && messages.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                        <i className="fas fa-spinner fa-spin"></i> Loading messages...
                      </div>
                    ) : messages.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                        {t('chat.noMessages')}
                      </div>
                    ) : (
                      messages.map((msg, idx) => {
                        // Determine if message is from current user
                        const isOwn = currentUserId && msg.senderId === currentUserId;
                        const prevMsg = idx > 0 ? messages[idx - 1] : null;
                        const showDate = !prevMsg ||
                          new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

                        return (
                          <React.Fragment key={msg.id}>
                            {showDate && (
                              <div style={{
                                textAlign: 'center',
                                margin: '16px 0',
                                fontSize: '12px',
                                color: '#999'
                              }}>
                                {new Date(msg.createdAt).toLocaleDateString('vi-VN', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </div>
                            )}
                            <div style={{
                              display: 'flex',
                              justifyContent: isOwn ? 'flex-end' : 'flex-start',
                              marginBottom: '8px',
                              padding: '0 16px'
                            }}>
                              <div style={{
                                maxWidth: '70%',
                                background: isOwn ? '#EE4D2D' : '#fff',
                                color: isOwn ? '#fff' : '#222',
                                padding: '8px 12px',
                                borderRadius: '12px',
                                border: isOwn ? 'none' : '1px solid #e0e0e0',
                                wordWrap: 'break-word'
                              }}>
                                {!isOwn && (
                                  <div style={{ fontSize: '11px', marginBottom: '4px', opacity: 0.8 }}>
                                    {msg.senderName}
                                  </div>
                                )}
                                <div>{msg.content}</div>
                                {msg.imageId && imageUrls[msg.imageId] && (
                                  <img
                                    src={imageUrls[msg.imageId]}
                                    alt="Message"
                                    style={{ maxWidth: '200px', marginTop: '8px', borderRadius: '8px' }}
                                  />
                                )}
                                <div style={{
                                  fontSize: '10px',
                                  marginTop: '4px',
                                  opacity: 0.7,
                                  textAlign: 'right'
                                }}>
                                  {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                  {isOwn && msg.deliveryStatus === 'READ' && (
                                    <span style={{ marginLeft: '4px' }}>✓✓</span>
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
                  <form className="shopee-chat-input-form" onSubmit={handleSendMessage}>
                    <input
                      type="text"
                      className="shopee-chat-input-field"
                      placeholder="Nhập tin nhắn..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      className="shopee-chat-send-btn"
                      disabled={!messageInput.trim() || loading}
                    >
                      <i className="fas fa-paper-plane"></i>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .shopee-chat-fab {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 1100;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border: none;
          border-radius: 24px;
          background: #EE4D2D;
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(238, 77, 45, 0.3);
          transition: all 0.2s;
        }
        .shopee-chat-fab:hover {
          background: #f05d40;
          box-shadow: 0 6px 16px rgba(238, 77, 45, 0.4);
        }
        .shopee-chat-fab svg {
          width: 20px;
          height: 20px;
        }
        .shopee-chat-fab-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ff0000;
          color: white;
          font-size: 11px;
          font-weight: 600;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .shopee-chat-minimized-banner {
          position: fixed;
          top: 0;
          right: 20px;
          z-index: 1100;
          background: #000;
          color: #fff;
          padding: 8px 16px;
          border-radius: 0 0 8px 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          transition: all 0.2s;
        }

        .shopee-chat-minimized-banner:hover {
          background: #333;
        }

        .shopee-chat-panel {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 1100;
          width: 900px;
          height: 600px;
          max-width: calc(100vw - 40px);
          max-height: calc(100vh - 40px);
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .shopee-chat-panel {
            right: 0;
            bottom: 0;
            width: 100vw;
            height: 100vh;
            max-width: 100vw;
            max-height: 100vh;
            border-radius: 0;
          }
        }

        .shopee-chat-container {
          display: flex;
          height: 100%;
          width: 100%;
        }

        /* Left Sidebar */
        .shopee-chat-sidebar {
          width: 320px;
          background: #fff;
          border-right: 1px solid #f0f0f0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .shopee-chat-sidebar {
            width: 100%;
          }
        }

        .shopee-chat-sidebar-header {
          padding: 16px 20px;
          border-bottom: 1px solid #f0f0f0;
        }

        .shopee-chat-title {
          font-size: 20px;
          font-weight: 500;
          color: #EE4D2D;
          margin: 0;
        }

        .shopee-chat-search-section {
          padding: 12px;
          display: flex;
          gap: 8px;
          border-bottom: 1px solid #f0f0f0;
        }

        .shopee-chat-search-wrapper {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
        }

        .shopee-chat-search-icon {
          position: absolute;
          left: 12px;
          color: #999;
          font-size: 14px;
        }

        .shopee-chat-search-input {
          width: 100%;
          padding: 8px 12px 8px 36px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          font-size: 14px;
          outline: none;
        }

        .shopee-chat-search-input:focus {
          border-color: #EE4D2D;
        }

        .shopee-chat-filter-dropdown {
          padding: 8px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          font-size: 14px;
          background: #fff;
          cursor: pointer;
          outline: none;
        }

        .shopee-chat-filter-dropdown:focus {
          border-color: #EE4D2D;
        }

        .shopee-chat-list {
          flex: 1;
          overflow-y: auto;
          background: #fafafa;
        }

        .shopee-chat-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          cursor: pointer;
          border-bottom: 1px solid #f0f0f0;
          transition: background 0.2s;
        }

        .shopee-chat-item:hover {
          background: #f5f5f5;
        }

        .shopee-chat-item.active {
          background: #fff5f0;
        }

        .shopee-chat-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .shopee-chat-item-content {
          flex: 1;
          min-width: 0;
        }

        .shopee-chat-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .shopee-chat-item-name {
          font-size: 14px;
          font-weight: 500;
          color: #222;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .shopee-chat-item-date {
          font-size: 12px;
          color: #999;
          flex-shrink: 0;
          margin-left: 8px;
        }

        .shopee-chat-item-message {
          font-size: 13px;
          color: #666;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Right Panel */
        .shopee-chat-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #fff;
        }

        .shopee-chat-main-header {
          padding: 12px 16px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          justify-content: flex-end;
        }

        .shopee-chat-main-header-actions {
          display: flex;
          gap: 8px;
        }

        .shopee-chat-icon-btn {
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          color: #666;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .shopee-chat-icon-btn:hover {
          background: #f5f5f5;
          color: #222;
        }

        .shopee-chat-welcome {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          background: #fafafa;
        }

        .shopee-chat-welcome-illustration {
          margin-bottom: 24px;
        }

        .shopee-chat-welcome-title {
          font-size: 18px;
          font-weight: 500;
          color: #222;
          margin: 0 0 8px 0;
          text-align: center;
        }

        .shopee-chat-welcome-subtitle {
          font-size: 14px;
          color: #999;
          margin: 0;
          text-align: center;
        }

        .shopee-chat-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .shopee-chat-content-header {
          padding: 12px 16px;
          border-bottom: 1px solid #f0f0f0;
          background: #fff;
        }

        .shopee-chat-header-name {
          font-weight: 500;
          font-size: 16px;
          color: #222;
        }

        .shopee-chat-product-card {
          background: #fff;
          border-bottom: 1px solid #f0f0f0;
          padding: 16px;
        }

        .shopee-chat-product-label {
          font-size: 13px;
          color: #666;
          margin-bottom: 12px;
        }

        .shopee-chat-product-info {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .shopee-chat-product-thumbnail {
          width: 60px;
          height: 60px;
          flex-shrink: 0;
          border-radius: 4px;
          overflow: hidden;
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
        }

        .shopee-chat-product-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .shopee-chat-product-details {
          flex: 1;
          min-width: 0;
        }

        .shopee-chat-product-name {
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

        .shopee-chat-product-price {
          font-size: 15px;
          font-weight: 600;
          color: #EE4D2D;
          margin-bottom: 4px;
        }

        .shopee-chat-product-id {
          font-size: 12px;
          color: #999;
        }

        .shopee-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 0;
          background: #fafafa;
        }

        .shopee-chat-input-form {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid #f0f0f0;
          background: #fff;
        }

        .shopee-chat-input-field {
          flex: 1;
          padding: 10px 16px;
          border: 1px solid #e0e0e0;
          border-radius: 20px;
          outline: none;
          font-size: 14px;
        }

        .shopee-chat-input-field:focus {
          border-color: #EE4D2D;
        }

        .shopee-chat-send-btn {
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

        .shopee-chat-send-btn:hover:not(:disabled) {
          background: #f05d40;
        }

        .shopee-chat-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Scrollbar styling */
        .shopee-chat-list::-webkit-scrollbar,
        .shopee-chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .shopee-chat-list::-webkit-scrollbar-track,
        .shopee-chat-messages::-webkit-scrollbar-track {
          background: #f1f1f1;
        }

        .shopee-chat-list::-webkit-scrollbar-thumb,
        .shopee-chat-messages::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 3px;
        }

        .shopee-chat-list::-webkit-scrollbar-thumb:hover,
        .shopee-chat-messages::-webkit-scrollbar-thumb:hover {
          background: #999;
        }

        /* Responsive styles */
        @media (max-width: 768px) {
          .shopee-chat-fab {
            right: 10px;
            bottom: 10px;
            padding: 10px 16px;
            font-size: 12px;
          }

          .shopee-chat-fab span {
            display: none;
          }

          .shopee-chat-minimized-banner {
            right: 0;
            width: 100%;
            border-radius: 0;
            text-align: center;
          }

          .shopee-chat-container {
            flex-direction: column;
          }

          .shopee-chat-sidebar {
            width: 100%;
            height: 40%;
            border-right: none;
            border-bottom: 1px solid #f0f0f0;
          }

          .shopee-chat-main {
            height: 60%;
          }

          .shopee-chat-search-section {
            flex-direction: column;
          }

          .shopee-chat-filter-dropdown {
            width: 100%;
            margin-top: 8px;
          }

          .shopee-chat-item {
            padding: 10px 12px;
          }

          .shopee-chat-avatar {
            width: 40px;
            height: 40px;
            font-size: 12px;
          }

          .shopee-chat-message-content {
            max-width: 85%;
          }

          .shopee-chat-input-form {
            padding: 10px 12px;
          }

          .shopee-chat-input-field {
            font-size: 14px;
            padding: 8px 12px;
          }

          .shopee-chat-send-btn {
            width: 36px;
            height: 36px;
          }
        }

        @media (max-width: 480px) {
          .shopee-chat-panel {
            right: 0;
            bottom: 0;
            width: 100vw;
            height: 100vh;
            border-radius: 0;
          }

          .shopee-chat-sidebar {
            height: 35%;
          }

          .shopee-chat-main {
            height: 65%;
          }

          .shopee-chat-title {
            font-size: 18px;
          }

          .shopee-chat-item-name {
            font-size: 13px;
          }

          .shopee-chat-item-message {
            font-size: 12px;
          }
        }
      `}</style>
    </>
  );
}
