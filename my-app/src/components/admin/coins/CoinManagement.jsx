import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import shopCoinAPI from '../../../api/shopCoin/shopCoinAPI';
import Swal from 'sweetalert2';

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
    const [topUser, setTopUser] = useState(null);

    useEffect(() => {
        fetchCoins();
        fetchMissions();
        fetchTopUser();
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
            if (data && data.content) {
                setUsers(Array.isArray(data.content) ? data.content : []);
                setTotalPages(data.totalPages || 0);
                setTotalElements(data.totalElements || 0);
            } else {
                setUsers(Array.isArray(data) ? data : []);
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

    const fetchTopUser = async () => {
        try {
            // Try to fetch 1 user, sorted by points desc
            const params = {
                page: 0,
                size: 1,
                sort: 'points,desc'
            };
            const data = await shopCoinAPI.getAllShopCoins(params);
            if (data && data.content && data.content.length > 0) {
                setTopUser(data.content[0]);
            }
        } catch (err) {
            console.warn("Failed to fetch top user", err);
        }
    };

    const fetchMissions = async () => {
        try {
            const data = await shopCoinAPI.getAllMissions();
            setMissions(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch missions", err);
        }
    };

    const handleCreateMission = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await shopCoinAPI.updateMission(editId, newMission);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Mission updated successfully!',
                    timer: 1500,
                    showConfirmButton: false
                });
                setIsEditing(false);
                setEditId(null);
            } else {
                await shopCoinAPI.createMission(newMission);
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: 'Mission created successfully!',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
            setNewMission({ title: '', description: '', rewardAmount: 10, actionCode: '', targetCount: 1 });
            fetchMissions();
        } catch (err) {
            console.error("Failed to save mission", err);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to save mission'
            });
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
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        });

        if (result.isConfirmed) {
            try {
                await shopCoinAPI.deleteMission(id);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    text: 'Mission has been deleted.',
                    timer: 1500,
                    showConfirmButton: false
                });
                fetchMissions();
            } catch (err) {
                console.error("Failed to delete mission", err);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to delete mission'
                });
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

            {/* Stats Dashboard */}
            <div className="row mb-4">
                {/* Total Users */}
                <div className="col-xl-4 col-md-6 mb-4">
                    <div className="card h-100 shadow-sm border-0" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                        <div className="card-body">
                            <div className="row no-gutters align-items-center">
                                <div className="col mr-2">
                                    <div className="text-xs font-weight-bold text-uppercase mb-1" style={{ opacity: 0.8 }}>
                                        Participants (Users)</div>
                                    <div className="h5 mb-0 font-weight-bold">{totalElements}</div>
                                </div>
                                <div className="col-auto">
                                    <i className="fas fa-users fa-2x text-white-50"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Active Missions */}
                <div className="col-xl-4 col-md-6 mb-4">
                    <div className="card h-100 shadow-sm border-0" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                        <div className="card-body">
                            <div className="row no-gutters align-items-center">
                                <div className="col mr-2">
                                    <div className="text-xs font-weight-bold text-uppercase mb-1" style={{ opacity: 0.8 }}>
                                        Active Missions</div>
                                    <div className="h5 mb-0 font-weight-bold">{missions.length}</div>
                                </div>
                                <div className="col-auto">
                                    <i className="fas fa-tasks fa-2x text-white-50"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top User */}
                <div className="col-xl-4 col-md-6 mb-4">
                    <div className="card h-100 shadow-sm border-0" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
                        <div className="card-body">
                            <div className="row no-gutters align-items-center">
                                <div className="col mr-2">
                                    <div className="text-xs font-weight-bold text-uppercase mb-1" style={{ opacity: 0.8 }}>
                                        Top Coin Holder</div>
                                    <div className="h5 mb-0 font-weight-bold">
                                        {topUser ? `${topUser.username} (${topUser.points?.toLocaleString()})` : '-'}
                                    </div>
                                </div>
                                <div className="col-auto">
                                    <i className="fas fa-crown fa-2x text-white-50"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
                                            <th>Points (Coins)</th>
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
                                <div className="row">
                                    <div className="form-group col-md-3 col-sm-6 mb-3">
                                        <label>Title</label>
                                        <input type="text" className="form-control" required
                                            value={newMission.title}
                                            onChange={(e) => setNewMission({ ...newMission, title: e.target.value })} />
                                    </div>
                                    <div className="form-group col-md-3 col-sm-6 mb-3">
                                        <label>Action Code (Unique)</label>
                                        <select className="form-control" required
                                            value={newMission.actionCode}
                                            onChange={(e) => setNewMission({ ...newMission, actionCode: e.target.value })}>
                                            <option value="">Select Action...</option>
                                            <option value="VIEW_PRODUCT">VIEW_PRODUCT (View Product)</option>
                                            <option value="REVIEW_ORDER">REVIEW_ORDER (Review Order)</option>
                                            <option value="VIEW_CART">VIEW_CART (View Cart)</option>
                                            <option value="FOLLOW_SHOP">FOLLOW_SHOP (Follow Shop)</option>
                                        </select>
                                    </div>
                                    <div className="form-group col-md-3 col-sm-6 mb-3">
                                        <label>Reward (Coins)</label>
                                        <input type="number" className="form-control" required
                                            value={newMission.rewardAmount}
                                            onChange={(e) => setNewMission({ ...newMission, rewardAmount: parseInt(e.target.value) })} />
                                    </div>
                                    <div className="form-group col-md-3 col-sm-6 mb-3">
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
                                                <td className="text-warning font-weight-bold">{mission.rewardAmount} Coins</td>
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
