import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Hls from 'hls.js';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import Cookies from 'js-cookie';
import Header from '../../components/client/Header';
import Footer from '../../components/client/Footer';
import { getLiveRoom, getRecentChats, getLiveProducts, addLiveItemToCart } from '../../api/live';
import { fetchProductById } from '../../api/product';
import { getUser } from '../../api/user';
import { LOCAL_BASE_URL } from '../../config/config.js';

import { useTranslation } from 'react-i18next'; // Added import

export default function LiveWatchPage() {
    const { t } = useTranslation(); // Added hook
    const { roomId } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const containerRef = useRef(null); // Added container ref
    const chatContainerRef = useRef(null);
    const stompClientRef = useRef(null);
    const [room, setRoom] = useState(null);
    const [messages, setMessages] = useState([]);

    // Controls State
    const [isMuted, setIsMuted] = useState(true);

    // Size Selection Modal State
    const [showSizeModal, setShowSizeModal] = useState(false);
    const [selectedLiveProduct, setSelectedLiveProduct] = useState(null);
    const [productSizes, setProductSizes] = useState([]);
    const [loadingSizes, setLoadingSizes] = useState(false);
    const [selectedSizeId, setSelectedSizeId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewerCount, setViewerCount] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [userInfo, setUserInfo] = useState(null);
    const [products, setProducts] = useState([]);
    const [addingToCart, setAddingToCart] = useState(null);
    const [reactions, setReactions] = useState([]); // Floating reactions

    // Check if user is logged in via cookie
    const token = Cookies.get('accessToken');
    const isLoggedIn = !!token;

    // Fetch room data and user info
    useEffect(() => {
        fetchRoom();
        fetchChats();
        // Fetch user info if logged in
        if (isLoggedIn) {
            getUser().then(setUserInfo).catch(console.error);
        }
    }, [roomId, isLoggedIn]);

    // WebSocket connection
    useEffect(() => {
        if (!roomId) return;

        // WebSocket connects through Gateway (port 8080) which routes to notification-service
        const wsUrl = (LOCAL_BASE_URL || 'http://localhost:8080') + '/ws/live';

        const client = new Client({
            webSocketFactory: () => new SockJS(wsUrl),
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
            debug: (str) => console.log('STOMP: ', str),
            onConnect: () => {
                console.log('WebSocket connected for room:', roomId);
                setIsConnected(true);

                // Subscribe to viewer count updates
                client.subscribe(`/topic/live/${roomId}/viewers`, (message) => {
                    const data = JSON.parse(message.body);
                    console.log('Viewer count update:', data);
                    setViewerCount(data.count || 0);
                });

                // Subscribe to chat messages
                client.subscribe(`/topic/live/${roomId}/chat`, (message) => {
                    const chatMsg = JSON.parse(message.body);
                    console.log('New chat message:', chatMsg);
                    setMessages(prev => [...prev, chatMsg]);

                    // Auto scroll
                    if (chatContainerRef.current) {
                        setTimeout(() => {
                            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                        }, 100);
                    }
                });

                // Subscribe to product updates
                client.subscribe(`/topic/live/${roomId}/product`, (message) => {
                    const productData = JSON.parse(message.body);
                    console.log('Product update:', productData);
                    setProducts(Array.isArray(productData) ? productData : [productData]);
                });

                // Subscribe to reactions
                client.subscribe(`/topic/live/${roomId}/reaction`, (message) => {
                    const reaction = JSON.parse(message.body);
                    if (reaction && reaction.type) {
                        handleAddReaction(reaction.type);
                    }
                });

                // Join room to increment viewer count
                client.publish({
                    destination: `/app/live/${roomId}/join`,
                    body: JSON.stringify({})
                });
            },
            onDisconnect: () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);
            },
            onStompError: (frame) => {
                console.error('STOMP error:', frame);
            }
        });

        client.activate();
        stompClientRef.current = client;

        // Cleanup on unmount
        return () => {
            if (stompClientRef.current && stompClientRef.current.connected) {
                // Leave room before disconnecting
                stompClientRef.current.publish({
                    destination: `/app/live/${roomId}/leave`,
                    body: JSON.stringify({})
                });
                stompClientRef.current.deactivate();
            }
        };
    }, [roomId]);

    useEffect(() => {
        // Use streamUrl directly from API response (streamKey is not exposed to public)
        if (room && room.streamUrl && videoRef.current) {
            const streamUrl = room.streamUrl;

            if (Hls.isSupported()) {
                const hls = new Hls({
                    liveDurationInfinity: true,
                    lowLatencyMode: true
                });
                hls.loadSource(streamUrl);
                hls.attachMedia(videoRef.current);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    videoRef.current.play().catch(e => console.log('Autoplay prevented'));
                });
                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        console.error('HLS Error:', data);
                        // Don't show error if stream just hasn't started yet
                        if (room.status === 'LIVE') {
                            setError(t('liveStream.watch.connectError'));
                        }
                    }
                });

                return () => hls.destroy();
            } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
                videoRef.current.src = streamUrl;
            }
        }
    }, [room]);

    const fetchRoom = async () => {
        try {
            const data = await getLiveRoom(roomId);
            setRoom(data);
            setViewerCount(data.viewerCount || 0);
        } catch (err) {
            setError(t('liveStream.watch.roomNotFound'));
        } finally {
            setLoading(false);
        }
    };

    const fetchChats = async () => {
        try {
            const chats = await getRecentChats(roomId);
            setMessages(chats.reverse()); // Newest at bottom

            // Auto scroll to bottom
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
        } catch (err) {
            console.error('Error fetching chats:', err);
        }
    };

    // Fetch live products on mount
    const fetchProducts = async () => {
        try {
            const prods = await getLiveProducts(roomId);
            setProducts(prods || []);
        } catch (err) {
            console.error('Error fetching products:', err);
        }
    };

    // Call fetchProducts when room is loaded
    useEffect(() => {
        if (room) {
            fetchProducts();
        }
    }, [room]);

    // Open Size Modal
    const handleOpenSizeModal = async (product) => {
        if (!isLoggedIn) {
            alert(t('liveStream.watch.loginRequired'));
            return;
        }
        setSelectedLiveProduct(product);
        setShowSizeModal(true);
        setLoadingSizes(true);
        setProductSizes([]);
        setSelectedSizeId(null);

        try {
            const response = await fetchProductById(product.productId);
            const details = response.data;
            if (details && details.sizes) {
                setProductSizes(details.sizes);
                // Auto select first available if any
                const available = details.sizes.find(s => s.stock > 0);
                if (available) setSelectedSizeId(available.id);
            }
        } catch (error) {
            console.error("Error fetching product details", error);
        } finally {
            setLoadingSizes(false);
        }
    };

    // Confirm Add to Cart
    const handleConfirmAddToCart = async () => {
        if (!selectedSizeId) {
            alert(t('liveStream.watch.selectVariation'));
            return;
        }
        if (!selectedLiveProduct) return;

        setAddingToCart(selectedLiveProduct.id);
        try {
            await addLiveItemToCart({
                productId: selectedLiveProduct.productId,
                sizeId: selectedSizeId,
                quantity: 1,
                liveRoomId: roomId,
                liveProductId: selectedLiveProduct.id,
                livePrice: selectedLiveProduct.livePrice,
                originalPrice: selectedLiveProduct.originalPrice
            });
            alert(t('liveStream.watch.addedToCart'));
            setShowSizeModal(false);
            // navigate('/cart'); // Optional: user might want to stay in live stream
        } catch (err) {
            console.error('Error adding to cart:', err);
            alert(t('liveStream.watch.addToCartError'));
        } finally {
            setAddingToCart(null);
        }
    };

    // --- Reaction Logic ---
    const handleAddReaction = (type) => {
        const id = Date.now() + Math.random();
        // Random position for variety
        const randomX = Math.floor(Math.random() * 100);

        const newReaction = { id, type, x: randomX };

        setReactions(prev => [...prev, newReaction]);

        // Remove after animation
        setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== id));
        }, 2000); // 2s duration
    };

    const sendReaction = (type) => {
        if (!stompClientRef.current?.connected) return;

        // Optimistic update (show immediate on own screen)
        // handleAddReaction(type); // Optional: WebSocket broadcast doubles it? No, usually fine.

        stompClientRef.current.publish({
            destination: `/app/live/${roomId}/reaction`,
            body: JSON.stringify({
                type: type,
                userId: userInfo?.id || null, // Optional
                // username: ...
            })
        });
    };

    const REACTION_ICONS = {
        LIKE: '👍',
        HEART: '❤️',
        HAHA: '😂',
        WOW: '😮',
        SAD: '😢',
        ANGRY: '😡'
    };



    // Send chat message
    const sendChat = () => {
        if (!chatInput.trim() || !stompClientRef.current?.connected || !isLoggedIn) return;

        stompClientRef.current.publish({
            destination: `/app/live/${roomId}/chat`,
            body: JSON.stringify({
                message: chatInput.trim(),
                username: userInfo?.userDetails?.fullName || userInfo?.username || 'Người xem',
                avatarUrl: userInfo?.userDetails?.avatarUrl || null,
                isOwner: false // Regular viewer
            })
        });
        setChatInput('');

        // Auto scroll after sending
        setTimeout(() => {
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
        }, 100);
    };

    if (loading) {
        return (
            <div className="wrapper" style={{ background: '#F5F5F5', minHeight: '100vh' }}>
                <Header />
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '60vh'
                }}>
                    <div className="spinner-border text-danger" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    if (error || !room) {
        return (
            <div className="wrapper" style={{ background: '#F5F5F5', minHeight: '100vh' }}>
                <Header />
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '60vh'
                }}>
                    <div style={{ fontSize: '60px', marginBottom: '20px' }}>😢</div>
                    <h2>{error || t('liveStream.watch.roomNotFound')}</h2>
                    <Link to="/live" className="btn btn-danger mt-3">
                        {t('liveStream.watch.backToList')}
                    </Link>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="wrapper" style={{ background: '#1a1a1a', minHeight: '100vh' }}>
            <Header />
            <main style={{ padding: '20px' }}>
                <div style={{
                    maxWidth: '1400px',
                    margin: '0 auto',
                    display: 'grid',
                    gridTemplateColumns: '1fr 350px',
                    gap: '20px',
                    minHeight: 'calc(100vh - 200px)'
                }}>
                    {/* Video Section */}
                    <div>
                        <div ref={containerRef} style={{    // Changed: Added ref here for fullscreen
                            position: 'relative',
                            background: '#000',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            paddingTop: '56.25%',
                            // width: '100%', // Ensure width fills parent
                        }}>
                            <video
                                ref={videoRef}
                                // controls // Removed native controls
                                autoPlay
                                playsInline
                                muted={isMuted}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%'
                                }}
                            />

                            {/* Custom Controls Overlay */}
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                padding: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '5px',
                                zIndex: 30, // Ensure above other overlays
                                opacity: 1, // Always visible or use hover state if preferred
                                transition: 'opacity 0.3s'
                            }}>
                                {/* Red Live Progress Bar - Static (No Seeking) */}
                                <div style={{
                                    width: '100%',
                                    height: '4px',
                                    background: '#444',
                                    borderRadius: '2px',
                                    overflow: 'hidden',
                                    marginBottom: '5px'
                                }}>
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        background: '#ee4d2d',
                                        boxShadow: '0 0 10px #ee4d2d'
                                    }}></div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        {/* Play/Pause (Optional, mostly just Pause for Live) - Skipping to keep it simple as requested "fixed" */}

                                        {/* Volume */}
                                        <button
                                            onClick={() => {
                                                if (videoRef.current) {
                                                    videoRef.current.muted = !videoRef.current.muted;
                                                    setIsMuted(videoRef.current.muted);
                                                }
                                            }}
                                            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: '20px' }}
                                        >
                                            {isMuted ? '🔇' : '🔊'}
                                        </button>

                                        {/* LIVE Badge */}
                                        <div style={{
                                            background: '#ee4d2d',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 'bold',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <div style={{ width: '6px', height: '6px', background: 'white', borderRadius: '50%' }}></div>
                                            LIVE
                                        </div>

                                        {/* Timer (Optional) */}
                                        <span style={{ fontSize: '13px', marginLeft: '5px' }}>
                                            {/* You can add a duration timer here if needed */}
                                        </span>
                                    </div>

                                    {/* Fullscreen */}
                                    <button
                                        onClick={() => {
                                            if (containerRef.current) {
                                                if (!document.fullscreenElement) {
                                                    containerRef.current.requestFullscreen().catch(err => {
                                                        console.error(`Error attempting to enable fullscreen: ${err.message}`);
                                                    });
                                                } else {
                                                    document.exitFullscreen();
                                                }
                                            }
                                        }}
                                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: '20px' }}
                                    >
                                        ⛶
                                    </button>
                                </div>
                            </div>

                            {/* Live Badge (Top Left) - Kept existing */}
                            {room.status === 'LIVE' && (
                                <div style={{
                                    position: 'absolute',
                                    top: '15px',
                                    left: '15px',
                                    background: '#ee4d2d',
                                    color: 'white',
                                    padding: '6px 14px',
                                    borderRadius: '4px',
                                    fontSize: '13px',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    zIndex: 10
                                }}>
                                    <span style={{
                                        width: '8px',
                                        height: '8px',
                                        background: 'white',
                                        borderRadius: '50%',
                                        animation: 'pulse 1s infinite'
                                    }}></span>
                                    LIVE
                                </div>
                            )}

                            {/* Viewer Count - Kept existing */}
                            <div style={{
                                position: 'absolute',
                                top: '15px',
                                right: '15px',
                                background: 'rgba(0,0,0,0.7)',
                                color: 'white',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                fontSize: '13px',
                                zIndex: 10
                            }}>
                                {t('liveStream.watch.viewerCount', { count: viewerCount })}
                            </div>

                            {/* Floating Reactions Overlay - Kept existing */}
                            <div style={{
                                position: 'absolute',
                                bottom: '60px', // Raised slightly to avoid controls
                                right: '20px',
                                width: '100px',
                                height: '300px',
                                pointerEvents: 'none',
                                zIndex: 20,
                                overflow: 'hidden'
                            }}>
                                {reactions.map(r => (
                                    <div
                                        key={r.id}
                                        style={{
                                            position: 'absolute',
                                            bottom: '-20px',
                                            left: `${r.x}%`,
                                            fontSize: '24px',
                                            animation: 'floatUp 2s ease-out forwards'
                                        }}
                                    >
                                        {REACTION_ICONS[r.type] || '❤️'}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Stream Info */}
                        <div style={{
                            background: '#2a2a2a',
                            borderRadius: '8px',
                            padding: '20px',
                            marginTop: '15px'
                        }}>
                            <h1 style={{
                                color: 'white',
                                fontSize: '20px',
                                margin: '0 0 15px'
                            }}>
                                {room.title}
                            </h1>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: '#ee4d2d',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    color: 'white',
                                    overflow: 'hidden'
                                }}>
                                    {room.shopAvatarUrl ? (
                                        <img
                                            src={room.shopAvatarUrl}
                                            alt={room.shopName}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : '🏪'}
                                </div>
                                <div>
                                    <div style={{ color: 'white', fontWeight: '600' }}>
                                        {room.shopName || 'Shop'}
                                    </div>
                                    <Link
                                        to={`/shop/${room.shopOwnerId}`}
                                        style={{ color: '#ee4d2d', fontSize: '13px' }}
                                    >
                                        {t('liveStream.watch.viewShop')}
                                    </Link>
                                </div>
                            </div>

                            {room.description && (
                                <p style={{
                                    color: '#aaa',
                                    marginTop: '15px',
                                    fontSize: '14px'
                                }}>
                                    {room.description}
                                </p>
                            )}
                        </div>

                        {/* Live Products Section */}
                        {products.length > 0 && (
                            <div style={{
                                background: '#2a2a2a',
                                borderRadius: '8px',
                                padding: '15px',
                                marginTop: '15px'
                            }}>
                                <h3 style={{ color: 'white', fontSize: '16px', margin: '0 0 15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {t('liveStream.watch.productsLive')}
                                    <span style={{ background: '#ee4d2d', color: 'white', fontSize: '11px', padding: '2px 8px', borderRadius: '10px' }}>
                                        {products.length}
                                    </span>
                                </h3>
                                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '10px' }}>
                                    {products.map(product => (
                                        <div
                                            key={product.id}
                                            style={{
                                                minWidth: '160px',
                                                background: '#333',
                                                borderRadius: '8px',
                                                overflow: 'hidden',
                                                flexShrink: 0,
                                                border: product.isFeatured ? '2px solid #ffc107' : 'none'
                                            }}
                                        >
                                            {/* Product Image */}
                                            <div style={{
                                                height: '120px',
                                                background: '#444',
                                                position: 'relative',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {product.productImageUrl ? (
                                                    <img
                                                        src={product.productImageUrl}
                                                        alt={product.productName}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <span style={{ color: '#666', fontSize: '30px' }}>📦</span>
                                                )}
                                                {product.isFeatured && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '5px',
                                                        left: '5px',
                                                        background: '#ffc107',
                                                        color: '#333',
                                                        fontSize: '10px',
                                                        padding: '2px 6px',
                                                        borderRadius: '3px',
                                                        fontWeight: '600'
                                                    }}>
                                                        {t('liveStream.watch.hot')}
                                                    </div>
                                                )}
                                                {product.discountPercent > 0 && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '5px',
                                                        right: '5px',
                                                        background: '#ee4d2d',
                                                        color: 'white',
                                                        fontSize: '10px',
                                                        padding: '2px 6px',
                                                        borderRadius: '3px',
                                                        fontWeight: '600'
                                                    }}>
                                                        -{Math.round(product.discountPercent)}%
                                                    </div>
                                                )}
                                            </div>
                                            {/* Product Info */}
                                            <div style={{ padding: '10px' }}>
                                                <div style={{
                                                    color: 'white',
                                                    fontSize: '13px',
                                                    marginBottom: '8px',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {product.productName}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                                    {product.isOutOfStock ? (
                                                        <span style={{ color: '#999', fontSize: '13px', fontWeight: '600' }}>
                                                            {t('liveStream.watch.outOfStock')}
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <span style={{ color: '#ee4d2d', fontWeight: '600', fontSize: '14px' }}>
                                                                ₫{(product.livePrice || 0).toLocaleString()}
                                                            </span>
                                                            {product.originalPrice > product.livePrice && (
                                                                <span style={{
                                                                    color: '#888',
                                                                    fontSize: '11px',
                                                                    textDecoration: 'line-through'
                                                                }}>
                                                                    ₫{product.originalPrice.toLocaleString()}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                {/* Remaining Quantity */}
                                                {!product.isOutOfStock && product.remainingQuantity != null && (
                                                    <div style={{ fontSize: '11px', color: '#ffc107', marginBottom: '10px' }}>
                                                        {t('liveStream.watch.remaining', { count: product.remainingQuantity, limit: product.quantityLimit })}
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => handleOpenSizeModal(product)}
                                                    disabled={addingToCart === product.id || product.isOutOfStock}
                                                    style={{
                                                        width: '100%',
                                                        background: product.isOutOfStock ? '#666' : (addingToCart === product.id ? '#999' : '#ee4d2d'),
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '8px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        cursor: (addingToCart === product.id || product.isOutOfStock) ? 'not-allowed' : 'pointer',
                                                        opacity: product.isOutOfStock ? 0.6 : 1
                                                    }}
                                                >
                                                    {product.isOutOfStock ? '❌ Hết hàng' : (addingToCart === product.id ? 'Đang thêm...' : '🛒 Thêm vào giỏ')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chat Section */}
                    <div style={{
                        background: '#2a2a2a',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        {/* Chat Header */}
                        <div style={{
                            padding: '15px 20px',
                            borderBottom: '1px solid #444',
                            color: 'white',
                            fontWeight: '600'
                        }}>
                            {t('liveStream.watch.chatHeader')}
                        </div>



                        {/* Chat Messages */}
                        <div
                            ref={chatContainerRef}
                            style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: '15px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                            }}
                        >
                            {messages.length === 0 ? (
                                <div style={{
                                    color: '#888',
                                    textAlign: 'center',
                                    marginTop: '50px'
                                }}>
                                    {t('liveStream.watch.noMessages')}
                                </div>
                            ) : (
                                messages.map((msg, index) => (
                                    <ChatMessage key={msg.id || index} message={msg} />
                                ))
                            )}
                        </div>

                        {/* Chat Input */}
                        <div style={{
                            padding: '15px',
                            borderTop: '1px solid #444'
                        }}>
                            {/* Quick Reactions Bar */}
                            <div style={{
                                display: 'flex',
                                gap: '15px',
                                marginBottom: '10px',
                                paddingLeft: '5px'
                            }}>
                                {Object.keys(REACTION_ICONS).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => sendReaction(type)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            fontSize: '20px',
                                            cursor: 'pointer',
                                            transition: 'transform 0.1s',
                                            padding: '0'
                                        }}
                                        onMouseDown={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                        title={type}
                                    >
                                        {REACTION_ICONS[type]}
                                    </button>
                                ))}
                            </div>
                            {isLoggedIn ? (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && sendChat()}
                                        placeholder={t('liveStream.watch.chatPlaceholder')}
                                        style={{
                                            flex: 1,
                                            background: '#444',
                                            border: 'none',
                                            borderRadius: '20px',
                                            padding: '10px 20px',
                                            color: 'white',
                                            fontSize: '14px',
                                            outline: 'none'
                                        }}
                                    />
                                    <button
                                        onClick={sendChat}
                                        disabled={!chatInput.trim() || !isConnected}
                                        style={{
                                            background: chatInput.trim() && isConnected ? '#ee4d2d' : '#666',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '20px',
                                            padding: '10px 20px',
                                            cursor: chatInput.trim() && isConnected ? 'pointer' : 'not-allowed',
                                            fontSize: '14px',
                                            fontWeight: '600'
                                        }}
                                    >
                                        {t('liveStream.watch.send')}
                                    </button>
                                </div>
                            ) : (
                                <Link
                                    to="/login"
                                    style={{
                                        display: 'block',
                                        background: '#444',
                                        borderRadius: '20px',
                                        padding: '10px 20px',
                                        color: '#888',
                                        fontSize: '14px',
                                        textDecoration: 'none',
                                        textAlign: 'center'
                                    }}
                                >
                                    {t('liveStream.watch.loginToChat')}
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </main >

            {/* CSS */}
            < style > {`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                @keyframes floatUp {
                    0% { transform: translateY(0) scale(1); opacity: 1; }
                    100% { transform: translateY(-200px) scale(1.5); opacity: 0; }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                @keyframes floatUp {
                    0% { transform: translateY(0) scale(1); opacity: 1; }
                    100% { transform: translateY(-200px) scale(1.5); opacity: 0; }
                }
            `}</style >
            {/* Size Selection Modal */}
            {
                showSizeModal && selectedLiveProduct && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.7)', zIndex: 9999,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            background: '#333', padding: '20px', borderRadius: '8px',
                            width: '90%', maxWidth: '400px', color: 'white'
                        }}>
                            <h3 style={{ marginTop: 0 }}>{t('liveStream.watch.selectSizeTitle')}</h3>

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                {selectedLiveProduct.productImageUrl && (
                                    <img src={selectedLiveProduct.productImageUrl} style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }} alt="" />
                                )}
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{selectedLiveProduct.productName}</div>
                                    <div style={{ color: '#ee4d2d' }}>₫{selectedLiveProduct.livePrice?.toLocaleString()}</div>
                                </div>
                            </div>

                            {loadingSizes ? (
                                <div>{t('liveStream.watch.loadingInfo')}</div>
                            ) : (
                                <div style={{ marginBottom: '20px' }}>
                                    <div style={{ marginBottom: '8px', fontSize: '14px', color: '#ccc' }}>Kích thước:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {productSizes.map(size => {
                                            const isSelected = selectedSizeId === size.id;
                                            const isOutOfStock = size.stock <= 0;
                                            return (
                                                <button
                                                    key={size.id}
                                                    onClick={() => !isOutOfStock && setSelectedSizeId(size.id)}
                                                    disabled={isOutOfStock}
                                                    style={{
                                                        padding: '6px 12px',
                                                        border: isSelected ? '1px solid #ee4d2d' : '1px solid #555',
                                                        background: isSelected ? 'rgba(238, 77, 45, 0.1)' : (isOutOfStock ? '#444' : 'transparent'),
                                                        color: isSelected ? '#ee4d2d' : (isOutOfStock ? '#888' : 'white'),
                                                        borderRadius: '4px',
                                                        cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                                                        opacity: isOutOfStock ? 0.5 : 1
                                                    }}
                                                >
                                                    {size.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                                <button
                                    onClick={() => setShowSizeModal(false)}
                                    style={{
                                        flex: 1, padding: '10px',
                                        background: '#555', border: 'none', borderRadius: '4px',
                                        color: 'white', cursor: 'pointer'
                                    }}
                                >
                                    {t('liveStream.watch.cancel')}
                                </button>
                                <button
                                    onClick={handleConfirmAddToCart}
                                    disabled={!selectedSizeId || addingToCart}
                                    style={{
                                        flex: 1, padding: '10px',
                                        background: (!selectedSizeId || addingToCart) ? '#777' : '#ee4d2d',
                                        border: 'none', borderRadius: '4px',
                                        color: 'white', cursor: (!selectedSizeId || addingToCart) ? 'not-allowed' : 'pointer',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    {addingToCart ? t('liveStream.watch.adding') : t('liveStream.watch.addToCart')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

function ChatMessage({ message }) {
    const isSystem = message.type === 'SYSTEM' || message.type === 'ORDER';

    return (
        <div style={{
            display: 'flex',
            gap: '10px',
            padding: isSystem ? '8px 12px' : '0',
            background: isSystem ? (message.type === 'ORDER' ? 'rgba(238, 77, 45, 0.2)' : 'rgba(255,255,255,0.05)') : 'transparent',
            borderRadius: isSystem ? '8px' : '0'
        }}>
            {!isSystem && (
                <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: '#ee4d2d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: 'white',
                    flexShrink: 0,
                    overflow: 'hidden'
                }}>
                    {message.avatarUrl ? (
                        <img
                            src={message.avatarUrl}
                            alt={message.username}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (message.username?.[0] || '?').toUpperCase()}
                </div>
            )}
            <div style={{ flex: 1 }}>
                {!isSystem && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '2px'
                    }}>
                        <span style={{
                            color: message.isOwner ? '#ffc107' : '#ee4d2d',
                            fontSize: '12px',
                            fontWeight: message.isOwner ? '600' : 'normal'
                        }}>
                            {message.username || 'User'}
                        </span>
                        {message.isOwner && (
                            <span style={{
                                background: '#ffc107',
                                color: '#333',
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '3px',
                                fontWeight: '600'
                            }}>
                                {t('liveStream.watch.shopOwner')}
                            </span>
                        )}
                    </div>
                )}
                <div style={{
                    color: isSystem ? '#ffc107' : 'white',
                    fontSize: '14px',
                    wordBreak: 'break-word'
                }}>
                    {message.message}
                </div>
            </div>
        </div>
    );
}
