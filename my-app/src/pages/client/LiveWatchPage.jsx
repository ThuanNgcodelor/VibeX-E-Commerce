import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import Hls from 'hls.js';
import Header from '../../components/client/Header';
import Footer from '../../components/client/Footer';
import { getLiveRoom, getRecentChats, getStreamUrl } from '../../api/live';

export default function LiveWatchPage() {
    const { roomId } = useParams();
    const videoRef = useRef(null);
    const chatContainerRef = useRef(null);
    const [room, setRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewerCount, setViewerCount] = useState(0);

    useEffect(() => {
        fetchRoom();
        fetchChats();

        // Auto refresh chats every 5 seconds
        const chatInterval = setInterval(fetchChats, 5000);

        return () => {
            clearInterval(chatInterval);
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
                            setError('Không thể kết nối đến stream. Vui lòng thử lại.');
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
            setError('Không tìm thấy phòng live');
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
                    <h2>{error || 'Không tìm thấy phòng live'}</h2>
                    <Link to="/live" className="btn btn-danger mt-3">
                        ← Quay lại danh sách Live
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
                        {/* Video Player */}
                        <div style={{
                            position: 'relative',
                            background: '#000',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            paddingTop: '56.25%'
                        }}>
                            <video
                                ref={videoRef}
                                controls
                                autoPlay
                                playsInline
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%'
                                }}
                            />

                            {/* Live Badge */}
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

                            {/* Viewer Count */}
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
                                👁 {viewerCount} đang xem
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
                                        Xem Shop →
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
                            💬 Chat trực tiếp
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
                                    Chưa có tin nhắn nào
                                </div>
                            ) : (
                                messages.map((msg, index) => (
                                    <ChatMessage key={msg.id || index} message={msg} />
                                ))
                            )}
                        </div>

                        {/* Chat Input Placeholder */}
                        <div style={{
                            padding: '15px',
                            borderTop: '1px solid #444'
                        }}>
                            <div style={{
                                background: '#444',
                                borderRadius: '20px',
                                padding: '10px 20px',
                                color: '#888',
                                fontSize: '14px'
                            }}>
                                Đăng nhập để chat...
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* CSS */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
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
                        color: '#ee4d2d',
                        fontSize: '12px',
                        marginBottom: '2px'
                    }}>
                        {message.username || 'User'}
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
