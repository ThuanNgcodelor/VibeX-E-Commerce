import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import shopCoinAPI from '../../../api/shopCoin/shopCoinAPI';

export default function CoinManagement() {
    const [users, setUsers] = useState([]);
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const [pageSize] = useState(10); // Default page size

    const [newMission, setNewMission] = useState({
        title: '',
        description: '',
        rewardAmount: 10,
        actionCode: '',
        targetCount: 1
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    useEffect(() => {
        fetchCoins();
        fetchMissions();
    }, [currentPage]); // Fetch when page changes

    const fetchCoins = async () => {
        try {
            setLoading(true);
            const params = {
                page: currentPage,
                size: pageSize
            };
            const data = await shopCoinAPI.getAllShopCoins(params);

            // Handle Page<ShopCoinAdminDto>
            if (data.content) {
                setUsers(data.content);
                setTotalPages(data.totalPages);
                setTotalElements(data.totalElements);
            } else {
                setUsers(data);
            }
            setError(null);
        } catch (err) {
            console.error("Failed to fetch coins", err);
            setError("Failed to load coin data.");
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 0 && newPage < totalPages) {
            setCurrentPage(newPage);
        }
    };

    const fetchMissions = async () => {
        try {
            const data = await shopCoinAPI.getAllMissions();
            setMissions(data);
        } catch (err) {
            console.error("Failed to fetch missions", err);
        }
    };

    const handleCreateMission = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await shopCoinAPI.updateMission(editId, newMission);
                alert("Mission updated successfully!");
                setIsEditing(false);
                setEditId(null);
            } else {
                await shopCoinAPI.createMission(newMission);
                alert("Mission created successfully!");
            }
            setNewMission({ title: '', description: '', rewardAmount: 10, actionCode: '', targetCount: 1 });
            fetchMissions();
        } catch (err) {
            console.error("Failed to save mission", err);
            alert("Failed to save mission");
        }
    };

    const handleEdit = (mission) => {
        setNewMission({
            title: mission.title,
            description: mission.description,
            rewardAmount: mission.rewardAmount,
            actionCode: mission.actionCode,
            targetCount: mission.targetCount
        });
        setIsEditing(true);
        setEditId(mission.id);
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this mission?")) {
            try {
                await shopCoinAPI.deleteMission(id);
                alert("Mission deleted successfully");
                fetchMissions();
            } catch (err) {
                console.error("Failed to delete mission", err);
                alert("Failed to delete mission");
            }
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditId(null);
        setNewMission({ title: '', description: '', rewardAmount: 10, actionCode: '', targetCount: 1 });
    };

    return (
        <div className="container-fluid" id="container-wrapper">
            <div className="d-sm-flex align-items-center justify-content-between mb-4">
                <h1 className="h3 mb-0 text-gray-800">Coin Management</h1>
                <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link to="/admin">Home</Link></li>
                    <li className="breadcrumb-item active" aria-current="page">Coin Management</li>
                </ol>
            </div>

            <div className="row">
                <div className="col-lg-12">
                    <div className="card mb-4">
                        <div className="card-header py-3 d-flex flex-row align-items-center justify-content-between">
                            <h6 className="m-0 font-weight-bold text-primary">User Coin Balances</h6>
                            <div>
                                <button className="btn btn-sm btn-primary" onClick={fetchCoins}>
                                    <i className="fas fa-sync-alt fa-sm text-white-50 mr-1"></i> Refresh
                                </button>
                            </div>
                        </div>
                        <div className="table-responsive p-3">
                            {loading ? (
                                <div className="text-center p-3">Loading...</div>
                            ) : error ? (
                                <div className="alert alert-danger">{error}</div>
                            ) : (
                                <table className="table align-items-center table-flush table-hover" id="dataTableHover">
                                    <thead className="thead-light">
                                        <tr>
                                            <th>Username</th>
                                            <th>Email</th>
                                            <th>Points (Xu)</th>
                                            <th>Last Check-in</th>
                                            <th>Streaks (Days)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.length > 0 ? (
                                            users.map((user) => (
                                                <tr key={user.userId}>
                                                    <td>{user.username}</td>
                                                    <td>{user.email}</td>
                                                    <td className="font-weight-bold text-warning">
                                                        {user.points?.toLocaleString()} <i className="fas fa-coins"></i>
                                                    </td>
                                                    <td>{user.lastCheckInDate || 'Never'}</td>
                                                    <td>
                                                        {user.consecutiveDays > 0 ? (
                                                            <span className="badge badge-success">{user.consecutiveDays} days</span>
                                                        ) : (
                                                            <span className="badge badge-secondary">0 days</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" className="text-center">No coin data found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="card-footer" style={{ borderTop: '1px solid #e3e6f0' }}>
                                <div className="row align-items-center">
                                    <div className="col-4">
                                        <span className="small text-muted">
                                            Showing {(currentPage * pageSize) + 1} to {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} users
                                        </span>
                                    </div>

                                    <div className="col-4 d-flex justify-content-center">
                                        <nav aria-label="Pagination">
                                            <ul className="pagination mb-0">
                                                <li className={`page-item ${currentPage === 0 ? "disabled" : ""}`}>
                                                    <button
                                                        className="page-link"
                                                        onClick={() => handlePageChange(currentPage - 1)}
                                                        disabled={currentPage === 0}
                                                        title="Previous"
                                                    >
                                                        <i className="fas fa-chevron-left"></i>
                                                    </button>
                                                </li>

                                                {Array.from({ length: totalPages }, (_, i) => i).map((p) => (
                                                    <li key={p} className={`page-item ${p === currentPage ? "active" : ""}`}>
                                                        <button
                                                            className="page-link"
                                                            onClick={() => handlePageChange(p)}
                                                        >
                                                            {p + 1}
                                                        </button>
                                                    </li>
                                                ))}

                                                <li className={`page-item ${currentPage === totalPages - 1 ? "disabled" : ""}`}>
                                                    <button
                                                        className="page-link"
                                                        onClick={() => handlePageChange(currentPage + 1)}
                                                        disabled={currentPage === totalPages - 1}
                                                        title="Next"
                                                    >
                                                        <i className="fas fa-chevron-right"></i>
                                                    </button>
                                                </li>
                                            </ul>
                                        </nav>
                                    </div>

                                    <div className="col-4"></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Mission Management Section */}
            <div className="row">
                <div className="col-lg-12">
                    <div className="card mb-4">
                        <div className="card-header py-3 d-flex flex-row align-items-center justify-content-between">
                            <h6 className="m-0 font-weight-bold text-primary">Mission Management</h6>
                        </div>
                        <div className="card-body">
                            {/* Create Mission Form */}
                            <form onSubmit={handleCreateMission} className="mb-4 p-3 border rounded">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <h5>{isEditing ? 'Update Mission' : 'Add New Mission'}</h5>
                                    {isEditing && (
                                        <button type="button" className="btn btn-sm btn-secondary" onClick={handleCancelEdit}>
                                            Cancel Edit
                                        </button>
                                    )}
                                </div>
                                <div className="form-row">
                                    <div className="form-group col-md-3">
                                        <label>Title</label>
                                        <input type="text" className="form-control" required
                                            value={newMission.title}
                                            onChange={(e) => setNewMission({ ...newMission, title: e.target.value })} />
                                    </div>
                                    <div className="form-group col-md-3">
                                        <label>Action Code (Unique)</label>
                                        <select className="form-control" required
                                            value={newMission.actionCode}
                                            onChange={(e) => setNewMission({ ...newMission, actionCode: e.target.value })}>
                                            <option value="">Select Action...</option>
                                            <option value="VIEW_PRODUCT">VIEW_PRODUCT (Xem sản phẩm)</option>
                                            <option value="REVIEW_ORDER">REVIEW_ORDER (Đánh giá đơn)</option>
                                            <option value="VIEW_CART">VIEW_CART (Xem giỏ hàng)</option>
                                            <option value="FOLLOW_SHOP">FOLLOW_SHOP (Theo dõi shop)</option>
                                        </select>
                                    </div>
                                    <div className="form-group col-md-2">
                                        <label>Reward (Xu)</label>
                                        <input type="number" className="form-control" required
                                            value={newMission.rewardAmount}
                                            onChange={(e) => setNewMission({ ...newMission, rewardAmount: parseInt(e.target.value) })} />
                                    </div>
                                    <div className="form-group col-md-2">
                                        <label>Target Count</label>
                                        <input type="number" className="form-control" required min="1"
                                            value={newMission.targetCount}
                                            onChange={(e) => setNewMission({ ...newMission, targetCount: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Description</label>
                                    <input type="text" className="form-control" required
                                        value={newMission.description}
                                        onChange={(e) => setNewMission({ ...newMission, description: e.target.value })} />
                                </div>
                                <button type="submit" className={`btn ${isEditing ? 'btn-warning' : 'btn-success'}`}>
                                    {isEditing ? 'Update Mission' : 'Create Mission'}
                                </button>
                            </form>

                            {/* Mission List */}
                            <table className="table align-items-center table-flush table-hover">
                                <thead className="thead-light">
                                    <tr>
                                        <th>Title</th>
                                        <th>Code</th>
                                        <th>Reward</th>
                                        <th>Target</th>
                                        <th>Description</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {missions.length > 0 ? (
                                        missions.map((mission) => (
                                            <tr key={mission.id}>
                                                <td>{mission.title}</td>
                                                <td><span className="badge badge-info">{mission.actionCode}</span></td>
                                                <td className="text-warning font-weight-bold">{mission.rewardAmount} Xu</td>
                                                <td>{mission.targetCount}</td>
                                                <td>{mission.description}</td>
                                                <td>
                                                    <button className="btn btn-sm btn-info mr-2" onClick={() => handleEdit(mission)}>Edit</button>
                                                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(mission.id)}>Delete</button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan="5" className="text-center">No missions defined.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
