import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
    createLiveRoom,
    getMyLiveRooms,
    startLive,
    endLive,
    getLiveRoomDetails
} from '../../api/live';
import '../../components/shop-owner/ShopOwnerLayout.css';

export default function LiveStreamPage() {
    const { t } = useTranslation();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showStreamKeyModal, setShowStreamKeyModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [newRoom, setNewRoom] = useState({
        title: '',
        description: '',
        thumbnailUrl: ''
    });

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            setLoading(true);
            const response = await getMyLiveRooms(0, 20);
            setRooms(response.content || []);
        } catch (error) {
            console.error('Error fetching rooms:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        try {
            const room = await createLiveRoom(newRoom);
            setRooms([room, ...rooms]);
            setNewRoom({ title: '', description: '', thumbnailUrl: '' });
            setShowCreateModal(false);
            // Show stream key
            setSelectedRoom(room);
            setShowStreamKeyModal(true);
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Không thể tạo phòng live. Vui lòng thử lại!');
        }
    };

    const handleStartLive = async (roomId) => {
        try {
            const updated = await startLive(roomId);
            setRooms(rooms.map(r => r.id === roomId ? updated : r));
        } catch (error) {
            console.error('Error starting live:', error);
            alert('Không thể bắt đầu live.');
        }
    };

    const handleEndLive = async (roomId) => {
        if (!window.confirm('Bạn có chắc muốn kết thúc livestream?')) return;
        try {
            const updated = await endLive(roomId);
            setRooms(rooms.map(r => r.id === roomId ? updated : r));
        } catch (error) {
            console.error('Error ending live:', error);
            alert('Không thể kết thúc live.');
        }
    };

    const handleShowStreamKey = async (room) => {
        try {
            const details = await getLiveRoomDetails(room.id);
            setSelectedRoom(details);
            setShowStreamKeyModal(true);
        } catch (error) {
            console.error('Error getting stream key:', error);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Đã copy vào clipboard!');
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'LIVE':
                return <span className="badge bg-danger">🔴 LIVE</span>;
            case 'PENDING':
                return <span className="badge bg-warning text-dark">⏳ Chờ stream</span>;
            case 'ENDED':
                return <span className="badge bg-secondary">✓ Đã kết thúc</span>;
            default:
                return <span className="badge bg-light text-dark">{status}</span>;
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header d-flex justify-content-between align-items-center mb-4">
                <h1>🎬 Quản lý Livestream</h1>
                <button
                    className="btn btn-danger"
                    onClick={() => setShowCreateModal(true)}
                >
                    <i className="fas fa-plus me-2"></i>
                    Tạo phòng Live
                </button>
            </div>

            {/* Stats Cards */}
            <div className="row g-3 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body text-center">
                            <h3 className="text-danger mb-0">
                                {rooms.filter(r => r.status === 'LIVE').length}
                            </h3>
                            <small className="text-muted">Đang Live</small>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body text-center">
                            <h3 className="text-warning mb-0">
                                {rooms.filter(r => r.status === 'PENDING').length}
                            </h3>
                            <small className="text-muted">Chờ Stream</small>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body text-center">
                            <h3 className="text-secondary mb-0">
                                {rooms.filter(r => r.status === 'ENDED').length}
                            </h3>
                            <small className="text-muted">Đã Kết Thúc</small>
                        </div>
                    </div>
                </div>
            </div>

            {/* Room List */}
            <div className="card border-0 shadow-sm">
                <div className="card-header bg-white">
                    <h5 className="mb-0">Danh sách phòng Live</h5>
                </div>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : rooms.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="fas fa-video fa-3x text-muted mb-3"></i>
                            <p className="text-muted">Chưa có phòng live nào</p>
                            <button
                                className="btn btn-outline-danger"
                                onClick={() => setShowCreateModal(true)}
                            >
                                Tạo phòng đầu tiên
                            </button>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Tiêu đề</th>
                                        <th>Trạng thái</th>
                                        <th>Người xem</th>
                                        <th>Đơn hàng</th>
                                        <th>Doanh thu</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rooms.map(room => (
                                        <tr key={room.id}>
                                            <td>
                                                <div className="fw-bold">{room.title}</div>
                                                <small className="text-muted">
                                                    {new Date(room.createdAt).toLocaleDateString('vi-VN')}
                                                </small>
                                            </td>
                                            <td>{getStatusBadge(room.status)}</td>
                                            <td>
                                                <i className="fas fa-eye me-1"></i>
                                                {room.viewerCount || 0}
                                            </td>
                                            <td>{room.totalOrders || 0}</td>
                                            <td>
                                                {new Intl.NumberFormat('vi-VN', {
                                                    style: 'currency',
                                                    currency: 'VND'
                                                }).format(room.totalRevenue || 0)}
                                            </td>
                                            <td>
                                                <div className="btn-group btn-group-sm">
                                                    {room.status === 'PENDING' && (
                                                        <>
                                                            <button
                                                                className="btn btn-outline-primary"
                                                                onClick={() => handleShowStreamKey(room)}
                                                                title="Xem Stream Key"
                                                            >
                                                                <i className="fas fa-key"></i>
                                                            </button>
                                                            <button
                                                                className="btn btn-success"
                                                                onClick={() => handleStartLive(room.id)}
                                                                title="Bắt đầu Live"
                                                            >
                                                                <i className="fas fa-play"></i>
                                                            </button>
                                                        </>
                                                    )}
                                                    {room.status === 'LIVE' && (
                                                        <>
                                                            <Link
                                                                to={`/shop-owner/live/${room.id}`}
                                                                className="btn btn-outline-primary"
                                                                title="Xem Live"
                                                            >
                                                                <i className="fas fa-tv"></i>
                                                            </Link>
                                                            <button
                                                                className="btn btn-danger"
                                                                onClick={() => handleEndLive(room.id)}
                                                                title="Kết thúc"
                                                            >
                                                                <i className="fas fa-stop"></i>
                                                            </button>
                                                        </>
                                                    )}
                                                    {room.status === 'ENDED' && (
                                                        <span className="text-muted small">
                                                            Đã kết thúc lúc {room.endedAt ?
                                                                new Date(room.endedAt).toLocaleTimeString('vi-VN') :
                                                                '--'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Room Modal */}
            {showCreateModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">🎬 Tạo phòng Live mới</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setShowCreateModal(false)}
                                ></button>
                            </div>
                            <form onSubmit={handleCreateRoom}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label">Tiêu đề *</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={newRoom.title}
                                            onChange={(e) => setNewRoom({ ...newRoom, title: e.target.value })}
                                            placeholder="VD: Flash Sale Cuối Năm"
                                            required
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Mô tả</label>
                                        <textarea
                                            className="form-control"
                                            rows="3"
                                            value={newRoom.description}
                                            onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                                            placeholder="Mô tả về buổi livestream..."
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setShowCreateModal(false)}
                                    >
                                        Hủy
                                    </button>
                                    <button type="submit" className="btn btn-danger">
                                        <i className="fas fa-plus me-2"></i>
                                        Tạo phòng
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Stream Key Modal */}
            {showStreamKeyModal && selectedRoom && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header bg-dark text-white">
                                <h5 className="modal-title">🔑 Stream Key</h5>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setShowStreamKeyModal(false)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                <div className="alert alert-warning">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    <strong>Bảo mật:</strong> Không chia sẻ Stream Key này với bất kỳ ai!
                                </div>

                                <div className="mb-4">
                                    <label className="form-label fw-bold">RTMP Server:</label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control bg-light"
                                            value="rtmp://localhost:1935/live"
                                            readOnly
                                        />
                                        <button
                                            className="btn btn-outline-secondary"
                                            onClick={() => copyToClipboard('rtmp://localhost:1935/live')}
                                        >
                                            <i className="fas fa-copy"></i>
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="form-label fw-bold">Stream Key:</label>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            className="form-control bg-light font-monospace"
                                            value={selectedRoom.streamKey || 'N/A'}
                                            readOnly
                                        />
                                        <button
                                            className="btn btn-outline-secondary"
                                            onClick={() => copyToClipboard(selectedRoom.streamKey)}
                                        >
                                            <i className="fas fa-copy"></i>
                                        </button>
                                    </div>
                                </div>

                                <div className="card bg-light">
                                    <div className="card-body">
                                        <h6 className="card-title">📹 Cách sử dụng với OBS:</h6>
                                        <ol className="mb-0 small">
                                            <li>Mở OBS Studio</li>
                                            <li>Vào Settings → Stream</li>
                                            <li>Service: Custom</li>
                                            <li>Server: <code>rtmp://localhost:1935/live</code></li>
                                            <li>Stream Key: Copy key ở trên</li>
                                            <li>Click "Start Streaming"</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowStreamKeyModal(false)}
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
