import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Hls from 'hls.js';
import {
    createLiveRoom,
    getMyLiveRooms,
    startLive,
    endLive,
    getLiveRoomDetails,
    getStreamUrl
} from '../../api/live';

export default function LiveManagePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const videoRef = useRef(null);

    const [step, setStep] = useState('list'); // list, create, streaming
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [newRoom, setNewRoom] = useState({
        title: '',
        description: '',
        thumbnailUrl: ''
    });

    useEffect(() => {
        fetchRooms();
    }, []);

    // Setup HLS when streaming
    useEffect(() => {
        if (step === 'streaming' && currentRoom?.streamKey && videoRef.current) {
            const streamUrl = getStreamUrl(currentRoom.streamKey);

            if (Hls.isSupported()) {
                const hls = new Hls({ liveDurationInfinity: true });
                hls.loadSource(streamUrl);
                hls.attachMedia(videoRef.current);
                return () => hls.destroy();
            }
        }
    }, [step, currentRoom]);

    const fetchRooms = async () => {
        try {
            setLoading(true);
            const response = await getMyLiveRooms(0, 20);
            setRooms(response.content || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        if (!newRoom.title.trim()) return;

        try {
            const room = await createLiveRoom(newRoom);
            setCurrentRoom(room);
            setStep('streaming');
        } catch (error) {
            alert('Không thể tạo phòng live');
        }
    };

    const handleSelectRoom = async (room) => {
        try {
            const details = await getLiveRoomDetails(room.id);
            setCurrentRoom(details);
            setStep('streaming');
        } catch (error) {
            alert('Không thể lấy thông tin phòng');
        }
    };

    const handleStartLive = async () => {
        try {
            const updated = await startLive(currentRoom.id);
            setCurrentRoom(updated);
        } catch (error) {
            alert('Không thể bắt đầu live');
        }
    };

    const handleEndLive = async () => {
        if (!window.confirm('Bạn có chắc muốn kết thúc livestream?')) return;
        try {
            await endLive(currentRoom.id);
            setCurrentRoom(null);
            setStep('list');
            fetchRooms();
        } catch (error) {
            alert('Không thể kết thúc live');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Đã copy!');
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
            {/* Header */}
            <header style={{
                background: 'white',
                borderBottom: '1px solid #eee',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                        <span style={{ color: '#ee4d2d', fontWeight: 'bold', fontSize: '24px' }}>Shopee</span>
                        <span style={{ color: '#ee4d2d', fontSize: '18px' }}>Live</span>
                    </Link>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <Link to="/shop-owner" style={{
                        padding: '8px 16px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        color: '#333',
                        textDecoration: 'none',
                        fontSize: '14px'
                    }}>
                        Kênh cho Người Sáng Tạo
                    </Link>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                    }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#ee4d2d',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '14px'
                        }}>
                            S
                        </div>
                        <span style={{ fontSize: '14px' }}>Shop của bạn</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>

                {/* Step: List Rooms */}
                {step === 'list' && (
                    <div style={{ background: 'white', borderRadius: '8px', padding: '30px' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '30px'
                        }}>
                            <h1 style={{ fontSize: '24px', margin: 0 }}>Quản lý Livestream</h1>
                            <button
                                onClick={() => setStep('create')}
                                style={{
                                    background: '#ee4d2d',
                                    color: 'white',
                                    border: 'none',
                                    padding: '12px 24px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '500'
                                }}
                            >
                                + Tạo Livestream mới
                            </button>
                        </div>

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '60px' }}>Loading...</div>
                        ) : rooms.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                                <div style={{ fontSize: '48px', marginBottom: '20px' }}>📺</div>
                                <p>Chưa có phòng live nào</p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #eee' }}>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Tiêu đề</th>
                                        <th style={{ padding: '12px', textAlign: 'left' }}>Trạng thái</th>
                                        <th style={{ padding: '12px', textAlign: 'center' }}>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rooms.map(room => (
                                        <tr key={room.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '12px' }}>{room.title}</td>
                                            <td style={{ padding: '12px' }}>
                                                {room.status === 'LIVE' && <span style={{ color: '#ee4d2d' }}>🔴 LIVE</span>}
                                                {room.status === 'PENDING' && <span style={{ color: '#ffc107' }}>⏳ Chờ</span>}
                                                {room.status === 'ENDED' && <span style={{ color: '#999' }}>✓ Đã kết thúc</span>}
                                            </td>
                                            <td style={{ padding: '12px', textAlign: 'center' }}>
                                                {room.status !== 'ENDED' && (
                                                    <button
                                                        onClick={() => handleSelectRoom(room)}
                                                        style={{
                                                            background: '#ee4d2d',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '8px 16px',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Vào phòng
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {/* Step: Create Room */}
                {step === 'create' && (
                    <div style={{ background: 'white', borderRadius: '8px', padding: '30px', maxWidth: '600px', margin: '0 auto' }}>
                        <h2 style={{ marginBottom: '30px' }}>Tạo Livestream</h2>

                        <form onSubmit={handleCreateRoom}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                    <span style={{ color: 'red' }}>*</span> Tiêu đề
                                </label>
                                <input
                                    type="text"
                                    value={newRoom.title}
                                    onChange={(e) => setNewRoom({ ...newRoom, title: e.target.value })}
                                    placeholder="Nhập tiêu đề livestream"
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px'
                                    }}
                                    required
                                />
                                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                                    Không nên vượt quá 20 ký tự.
                                </div>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                    Mô tả
                                </label>
                                <textarea
                                    value={newRoom.description}
                                    onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                                    placeholder="Mô tả về buổi livestream"
                                    rows={4}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        resize: 'vertical'
                                    }}
                                />
                                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', textAlign: 'right' }}>
                                    {newRoom.description.length}/200
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => setStep('list')}
                                    style={{
                                        padding: '12px 24px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        background: 'white',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: '12px 24px',
                                        border: 'none',
                                        borderRadius: '4px',
                                        background: '#ee4d2d',
                                        color: 'white',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Tiếp tục
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Step: Streaming Room */}
                {step === 'streaming' && currentRoom && (
                    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 300px', gap: '20px' }}>
                        {/* Left Sidebar - Tool Box */}
                        <div style={{ background: 'white', borderRadius: '8px', padding: '20px' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '20px', color: '#666' }}>Tool Box</h3>
                            <div style={{
                                padding: '15px',
                                borderRadius: '8px',
                                background: '#f9f9f9',
                                marginBottom: '10px',
                                cursor: 'pointer'
                            }}>
                                <div style={{ fontSize: '24px', marginBottom: '5px' }}>🛍️</div>
                                <div style={{ fontSize: '13px' }}>Sản phẩm</div>
                            </div>
                            <div style={{
                                padding: '15px',
                                borderRadius: '8px',
                                background: '#f9f9f9',
                                cursor: 'pointer'
                            }}>
                                <div style={{ fontSize: '24px', marginBottom: '5px' }}>🎫</div>
                                <div style={{ fontSize: '13px' }}>Khuyến mãi</div>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div style={{ background: 'white', borderRadius: '8px', padding: '30px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '20px'
                            }}>
                                <div>
                                    <h2 style={{ margin: 0 }}>{currentRoom.title}</h2>
                                    <p style={{ color: '#666', margin: '5px 0 0', fontSize: '14px' }}>
                                        {currentRoom.description || 'Không có mô tả'}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={() => { setCurrentRoom(null); setStep('list'); }}
                                        style={{
                                            padding: '10px 20px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            background: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Trở lại
                                    </button>
                                    {currentRoom.status === 'PENDING' && (
                                        <button
                                            onClick={handleStartLive}
                                            style={{
                                                padding: '10px 20px',
                                                border: 'none',
                                                borderRadius: '4px',
                                                background: '#ee4d2d',
                                                color: 'white',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Bắt đầu
                                        </button>
                                    )}
                                    {currentRoom.status === 'LIVE' && (
                                        <button
                                            onClick={handleEndLive}
                                            style={{
                                                padding: '10px 20px',
                                                border: 'none',
                                                borderRadius: '4px',
                                                background: '#dc3545',
                                                color: 'white',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Kết thúc
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* OBS Instructions */}
                            <div style={{
                                background: '#1a1a1a',
                                borderRadius: '8px',
                                padding: '30px',
                                marginBottom: '20px'
                            }}>
                                <h3 style={{ color: 'white', marginBottom: '25px', textAlign: 'center' }}>
                                    Liên kết phát trực tiếp với OBS
                                </h3>

                                {/* Steps Diagram */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    gap: '30px',
                                    marginBottom: '30px'
                                }}>
                                    <StepBox number={1} title="Sao chép URL và" subtitle="Khóa bên dưới" color="#ee4d2d" />
                                    <Arrow />
                                    <StepBox number={2} title="Điền vào chỗ trống" subtitle="trong OBS bằng URL và Khóa" color="#ee4d2d" />
                                    <Arrow />
                                    <StepBox number={3} title="Nhấp vào Bắt đầu" subtitle="Phát trực tiếp trên OBS" color="#28a745" />
                                    <Arrow />
                                    <StepBox number={4} title="Làm mới để xem" subtitle="trước video trực tiếp" color="#ee4d2d" />
                                </div>

                                {/* URL and Key */}
                                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                                    <div style={{ marginBottom: '15px' }}>
                                        <label style={{ color: '#999', fontSize: '12px', display: 'block', marginBottom: '5px' }}>URL</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input
                                                type="text"
                                                value="rtmp://localhost:1935/live/"
                                                readOnly
                                                style={{
                                                    flex: 1,
                                                    padding: '10px 15px',
                                                    border: '1px solid #444',
                                                    borderRadius: '4px',
                                                    background: '#333',
                                                    color: 'white',
                                                    fontSize: '13px'
                                                }}
                                            />
                                            <button
                                                onClick={() => copyToClipboard('rtmp://localhost:1935/live/')}
                                                style={{
                                                    padding: '10px 20px',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    background: '#ee4d2d',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ color: '#999', fontSize: '12px', display: 'block', marginBottom: '5px' }}>Key</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input
                                                type="text"
                                                value={currentRoom.streamKey || 'Loading...'}
                                                readOnly
                                                style={{
                                                    flex: 1,
                                                    padding: '10px 15px',
                                                    border: '1px solid #444',
                                                    borderRadius: '4px',
                                                    background: '#333',
                                                    color: 'white',
                                                    fontSize: '13px',
                                                    fontFamily: 'monospace'
                                                }}
                                            />
                                            <button
                                                onClick={() => copyToClipboard(currentRoom.streamKey)}
                                                style={{
                                                    padding: '10px 20px',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    background: '#ee4d2d',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    fontSize: '13px'
                                                }}
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Video Preview */}
                            {currentRoom.status === 'LIVE' && (
                                <div style={{
                                    background: '#000',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    aspectRatio: '16/9'
                                }}>
                                    <video
                                        ref={videoRef}
                                        controls
                                        autoPlay
                                        muted
                                        style={{ width: '100%', height: '100%' }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Right Sidebar - Chat */}
                        <div style={{ background: 'white', borderRadius: '8px', padding: '20px' }}>
                            <h3 style={{ fontSize: '14px', marginBottom: '20px' }}>Bình luận</h3>
                            <div style={{
                                height: '300px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#999',
                                fontSize: '14px',
                                textAlign: 'center',
                                border: '2px dashed #eee',
                                borderRadius: '8px'
                            }}>
                                <div>
                                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>💬</div>
                                    Không có bình luận nào
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

// Helper Components
function StepBox({ number, title, subtitle, color }) {
    return (
        <div style={{ textAlign: 'center', width: '100px' }}>
            <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '14px'
            }}>
                {number === 3 ? 'START' : 'COPY'}
            </div>
            <div style={{ color: 'white', fontSize: '11px', lineHeight: 1.4 }}>
                {number}. {title}<br />{subtitle}
            </div>
        </div>
    );
}

function Arrow() {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            color: '#666',
            fontSize: '20px'
        }}>
            →→→
        </div>
    );
}
