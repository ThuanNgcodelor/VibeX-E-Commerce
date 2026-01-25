import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/client/Header';
import Footer from '../../components/client/Footer';
import { getLiveRooms } from '../../api/live';

import { useTranslation } from 'react-i18next'; // Added import

export default function LiveListPage() {
    const { t } = useTranslation(); // Added hook
    const [liveRooms, setLiveRooms] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLiveRooms();
        // Auto refresh every 30 seconds
        const interval = setInterval(fetchLiveRooms, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchLiveRooms = async () => {
        try {
            const response = await getLiveRooms(0, 20);
            setLiveRooms(response.content || []);
        } catch (error) {
            console.error('Error fetching live rooms:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="wrapper" style={{ background: '#F5F5F5', minHeight: '100vh' }}>
            <Header />
            <main style={{ width: '100%', padding: '20px 0' }}>
                <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 15px' }}>
                    {/* Page Header */}
                    <div style={{
                        background: 'linear-gradient(135deg, #ee4d2d 0%, #ff6b35 100%)',
                        borderRadius: '8px',
                        padding: '30px',
                        marginBottom: '20px',
                        color: 'white',
                        textAlign: 'center'
                    }}>
                        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>
                            🔴 Vibe Live
                        </h1>
                        <p style={{ margin: '10px 0 0', opacity: 0.9 }}>
                            {t('liveStream.list.subtitle')}
                        </p>
                    </div>

                    {/* Live Stats */}
                    <div style={{
                        display: 'flex',
                        gap: '20px',
                        marginBottom: '20px',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '8px',
                            padding: '15px 30px',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        }}>
                            <span style={{ fontSize: '24px' }}>🔴</span>
                            <div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ee4d2d' }}>
                                    {liveRooms.length}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>{t('liveStream.list.liveNow')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Live Rooms Grid */}
                    {loading ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '60px',
                            background: 'white',
                            borderRadius: '8px'
                        }}>
                            <div className="spinner-border text-danger" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p style={{ marginTop: '10px', color: '#666' }}>{t('liveStream.list.loading')}</p>
                        </div>
                    ) : liveRooms.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '60px',
                            background: 'white',
                            borderRadius: '8px'
                        }}>
                            <div style={{ fontSize: '60px', marginBottom: '20px' }}>📺</div>
                            <h3 style={{ color: '#333', marginBottom: '10px' }}>
                                {t('liveStream.list.emptyTitle')}
                            </h3>
                            <p style={{ color: '#666' }}>
                                {t('liveStream.list.emptySubtitle')}
                            </p>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '20px'
                        }}>
                            {liveRooms.map(room => (
                                <LiveRoomCard key={room.id} room={room} />
                            ))}
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
}

function LiveRoomCard({ room }) {
    const { t } = useTranslation();
    return (
        <Link
            to={`/live/${room.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
        >
            <div style={{
                background: 'white',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer'
            }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)';
                }}
            >
                {/* Thumbnail */}
                <div style={{
                    position: 'relative',
                    paddingTop: '56.25%', // 16:9 aspect ratio
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}>
                    {room.thumbnailUrl && (
                        <img
                            src={room.thumbnailUrl}
                            alt={room.title}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                    )}

                    {/* Live Badge */}
                    <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        background: '#ee4d2d',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
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

                    {/* Viewer Count */}
                    <div style={{
                        position: 'absolute',
                        bottom: '10px',
                        left: '10px',
                        background: 'rgba(0,0,0,0.7)',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}>
                        {t('liveStream.list.viewerCount', { count: room.viewerCount || 0 })}
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '15px' }}>
                    <h3 style={{
                        margin: '0 0 10px',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#333',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {room.title}
                    </h3>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        {/* Shop Avatar */}
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#eee',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            overflow: 'hidden'
                        }}>
                            {room.shopAvatarUrl ? (
                                <img
                                    src={room.shopAvatarUrl}
                                    alt={room.shopName}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                '🏪'
                            )}
                        </div>
                        <span style={{ fontSize: '14px', color: '#666' }}>
                            {room.shopName || 'Shop'}
                        </span>
                    </div>
                </div>
            </div>

            {/* CSS Animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </Link>
    );
}
