import React, { useState, useEffect } from 'react';
import { createShopOwnerRegistration, getUserRoleRequests } from '../../../api/user.js';
import { getProvinces, getDistricts, getWards } from '../../../api/ghn.js';
import './RoleRequestForm.css';

export default function RoleRequestForm() {
    // Shop Owner Information
    const [shopName, setShopName] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [phone, setPhone] = useState('');
    const [streetAddress, setStreetAddress] = useState('');
    
    // GHN Address
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);
    const [provinceId, setProvinceId] = useState(null);
    const [provinceName, setProvinceName] = useState('');
    const [districtId, setDistrictId] = useState(null);
    const [districtName, setDistrictName] = useState('');
    const [wardCode, setWardCode] = useState('');
    const [wardName, setWardName] = useState('');
    
    // Loading states
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingDistricts, setLoadingDistricts] = useState(false);
    const [loadingWards, setLoadingWards] = useState(false);
    
    // Role Request
    const [reason, setReason] = useState('');
    
    // Form state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');
    const [userRequests, setUserRequests] = useState([]);
    const [showRequests, setShowRequests] = useState(false);

    // Load provinces on mount
    useEffect(() => {
        loadProvinces();
        loadUserRequests();
    }, []);

    const loadProvinces = async () => {
        try {
            setLoadingProvinces(true);
            const data = await getProvinces();
            setProvinces(data || []);
        } catch (error) {
            console.error('Error loading provinces:', error);
            setMessage('Failed to load provinces. Please refresh the page.');
            setMessageType('error');
        } finally {
            setLoadingProvinces(false);
        }
    };

    const loadDistricts = async (provinceId) => {
        if (!provinceId) {
            setDistricts([]);
            setWards([]);
            setDistrictId(null);
            setDistrictName('');
            setWardCode('');
            setWardName('');
            return;
        }
        
        try {
            setLoadingDistricts(true);
            const data = await getDistricts(provinceId);
            setDistricts(data || []);
            setWards([]);
            setDistrictId(null);
            setDistrictName('');
            setWardCode('');
            setWardName('');
        } catch (error) {
            console.error('Error loading districts:', error);
            setMessage('Failed to load districts. Please try again.');
            setMessageType('error');
        } finally {
            setLoadingDistricts(false);
        }
    };

    const loadWards = async (districtId) => {
        if (!districtId) {
            setWards([]);
            setWardCode('');
            setWardName('');
            return;
        }
        
        try {
            setLoadingWards(true);
            const data = await getWards(districtId);
            setWards(data || []);
            setWardCode('');
            setWardName('');
        } catch (error) {
            console.error('Error loading wards:', error);
            setMessage('Failed to load wards. Please try again.');
            setMessageType('error');
        } finally {
            setLoadingWards(false);
        }
    };

    const handleProvinceChange = (e) => {
        const selectedId = e.target.value ? parseInt(e.target.value) : null;
        const selectedProvince = provinces.find(p => p.ProvinceID === selectedId);
        
        setProvinceId(selectedId);
        setProvinceName(selectedProvince?.ProvinceName || '');
        loadDistricts(selectedId);
    };

    const handleDistrictChange = (e) => {
        const selectedId = e.target.value ? parseInt(e.target.value) : null;
        const selectedDistrict = districts.find(d => d.DistrictID === selectedId);
        
        setDistrictId(selectedId);
        setDistrictName(selectedDistrict?.DistrictName || '');
        loadWards(selectedId);
    };

    const handleWardChange = (e) => {
        const selectedWardCode = e.target.value || '';
        const selectedWard = wards.find(w => w.WardCode === selectedWardCode);
        
        setWardCode(selectedWardCode);
        setWardName(selectedWard?.WardName || '');
    };

    const validateForm = () => {
        if (!shopName.trim()) {
            setMessage('Shop name is required');
            setMessageType('error');
            return false;
        }
        
        if (!ownerName.trim()) {
            setMessage('Owner name is required');
            setMessageType('error');
            return false;
        }
        
        if (!phone.trim()) {
            setMessage('Phone number is required');
            setMessageType('error');
            return false;
        }
        
        if (!streetAddress.trim()) {
            setMessage('Street address is required');
            setMessageType('error');
            return false;
        }
        
        if (!provinceId || !provinceName) {
            setMessage('Please select a province/city');
            setMessageType('error');
            return false;
        }
        
        if (!districtId || !districtName) {
            setMessage('Please select a district/county');
            setMessageType('error');
            return false;
        }
        
        if (!wardCode || !wardName) {
            setMessage('Please select a ward/commune');
            setMessageType('error');
            return false;
        }
        
        if (!reason.trim()) {
            setMessage('Please enter a reason for your role request');
            setMessageType('error');
            return false;
        }
        
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            const registrationData = {
                roleRequest: {
                    role: 'SHOP_OWNER',
                    reason: reason.trim()
                },
                shopDetails: {
                    shopName: shopName.trim(),
                    ownerName: ownerName.trim(),
                    phone: phone.trim(),
                    provinceId: provinceId,
                    provinceName: provinceName,
                    districtId: districtId,
                    districtName: districtName,
                    wardCode: wardCode,
                    wardName: wardName,
                    streetAddress: streetAddress.trim(),
                    latitude: null,
                    longitude: null
                }
            };

            await createShopOwnerRegistration(registrationData);

            setMessage('Your shop owner registration has been submitted successfully! An admin will review and respond shortly.');
            setMessageType('success');
            
            // Reset form
            setShopName('');
            setOwnerName('');
            setPhone('');
            setStreetAddress('');
            setProvinceId(null);
            setProvinceName('');
            setDistrictId(null);
            setDistrictName('');
            setWardCode('');
            setWardName('');
            setReason('');
            setDistricts([]);
            setWards([]);
            
            // Refresh requests list
            loadUserRequests();
            
        } catch (error) {
            console.error('Error creating shop owner registration:', error);
            const errorMessage = error.message || 'An error occurred while submitting your request. Please try again later.';
            setMessage(errorMessage);
            setMessageType('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const loadUserRequests = async () => {
        try {
            const requests = await getUserRoleRequests();
            setUserRequests(requests);
        } catch (error) {
            console.error('Error loading user requests:', error);
        }
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            'PENDING': { text: 'Pending', class: 'badge-warning' },
            'APPROVED': { text: 'Approved', class: 'badge-success' },
            'REJECTED': { text: 'Rejected', class: 'badge-danger' }
        };
        
        const statusInfo = statusMap[status] || { text: status, class: 'badge-secondary' };
        return <span className={`badge ${statusInfo.class}`}>{statusInfo.text}</span>;
    };

    return (
        <div className="myaccount-content">
            <h3>Shop Owner Registration</h3>
            <p className="text-muted mb-4">Fill in your shop information below to request Shop Owner role. Your request will be reviewed by an admin.</p>
            
            {/* Form to create shop owner registration */}
            <div className="account-details-form">
                <form onSubmit={handleSubmit}>
                    {/* Shop Information Section */}
                    <div style={{ marginBottom: '30px' }}>
                        <h5 style={{ color: '#ee4d2d', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #ee4d2d' }}>
                            Shop Information
                        </h5>
                        
                        <div className="single-input-item">
                            <label htmlFor="shopName" className="required">Shop Name</label>
                            <input
                                id="shopName"
                                type="text"
                                value={shopName}
                                onChange={(e) => setShopName(e.target.value)}
                                className="form-control"
                                placeholder="Enter your shop name"
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        <div className="single-input-item">
                            <label htmlFor="ownerName" className="required">Owner Name</label>
                            <input
                                id="ownerName"
                                type="text"
                                value={ownerName}
                                onChange={(e) => setOwnerName(e.target.value)}
                                className="form-control"
                                placeholder="Enter owner's full name"
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        <div className="single-input-item">
                            <label htmlFor="phone" className="required">Phone Number</label>
                            <input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="form-control"
                                placeholder="Enter phone number"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Address Section */}
                    <div style={{ marginBottom: '30px' }}>
                        <h5 style={{ color: '#ee4d2d', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #ee4d2d' }}>
                            Shop Address
                        </h5>
                        
                        <div className="single-input-item">
                            <label className="required">Province/City, District/County, Ward/Commune</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <select
                                    value={provinceId || ''}
                                    onChange={handleProvinceChange}
                                    disabled={loadingProvinces || isSubmitting}
                                    className="form-control"
                                    required
                                >
                                    <option value="">{loadingProvinces ? 'Loading...' : 'Select Province'}</option>
                                    {provinces.map(province => (
                                        <option key={province.ProvinceID} value={province.ProvinceID}>
                                            {province.ProvinceName}
                                        </option>
                                    ))}
                                </select>
                                
                                <select
                                    value={districtId || ''}
                                    onChange={handleDistrictChange}
                                    disabled={!provinceId || loadingDistricts || isSubmitting}
                                    className="form-control"
                                    required
                                >
                                    <option value="">{loadingDistricts ? 'Loading...' : 'Select District'}</option>
                                    {districts.map(district => (
                                        <option key={district.DistrictID} value={district.DistrictID}>
                                            {district.DistrictName}
                                        </option>
                                    ))}
                                </select>
                                
                                <select
                                    value={wardCode}
                                    onChange={handleWardChange}
                                    disabled={!districtId || loadingWards || isSubmitting}
                                    className="form-control"
                                    required
                                >
                                    <option value="">{loadingWards ? 'Loading...' : 'Select Ward'}</option>
                                    {wards.map(ward => (
                                        <option key={ward.WardCode} value={ward.WardCode}>
                                            {ward.WardName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="single-input-item">
                            <label htmlFor="streetAddress" className="required">Street Address</label>
                            <input
                                id="streetAddress"
                                type="text"
                                value={streetAddress}
                                onChange={(e) => setStreetAddress(e.target.value)}
                                className="form-control"
                                placeholder="Enter detailed street address (house number, street name)"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Role Request Reason Section */}
                    <div style={{ marginBottom: '30px' }}>
                        <h5 style={{ color: '#ee4d2d', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #ee4d2d' }}>
                            Role Request Reason
                        </h5>
                        
                        <div className="single-input-item">
                            <label htmlFor="reason" className="required">Why do you want to become a Shop Owner?</label>
                            <textarea
                                id="reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows="4"
                                className="form-control"
                                placeholder="Please describe why you want to become a shop owner and what products/services you plan to offer..."
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                    
                    {message && (
                        <div className={`alert ${messageType === 'success' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '20px' }}>
                            {message}
                        </div>
                    )}
                    
                    <div className="single-input-item">
                        <button
                            type="submit"
                            className="check-btn sqr-btn"
                            disabled={isSubmitting}
                            style={{
                                backgroundColor: '#ee4d2d',
                                color: '#fff',
                                padding: '12px 30px',
                                fontSize: '16px',
                                fontWeight: 600,
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                                opacity: isSubmitting ? 0.7 : 1,
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Registration'}
                        </button>
                    </div>
                </form>
            </div>

            {/* List of submitted requests */}
            <div className="mt-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4>Registration History</h4>
                    <div className="single-input-item">
                        <button
                            className="btn"
                            onClick={() => {
                                setShowRequests(!showRequests);
                                if (!showRequests) {
                                    loadUserRequests();
                                }
                            }}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#f5f5f5',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            {showRequests ? 'Hide' : 'View'} History
                        </button>
                    </div>
                </div>
                
                {showRequests && (
                    <div className="myaccount-table table-responsive">
                        <table className="table table-bordered">
                            <thead className="thead-light">
                                <tr>
                                    <th>Requested Role</th>
                                    <th>Reason</th>
                                    <th>Status</th>
                                    <th>Created At</th>
                                    <th>Admin Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="text-center">No requests yet</td>
                                    </tr>
                                ) : (
                                    userRequests.map((request) => (
                                        <tr key={request.id}>
                                            <td>
                                                <strong>
                                                    {request.requestedRole === 'SHOP_OWNER' ? 'Shop Owner' : request.requestedRole}
                                                </strong>
                                            </td>
                                            <td>{request.reason}</td>
                                            <td>{getStatusBadge(request.status)}</td>
                                            <td>{request.creationTimestamp ? new Date(request.creationTimestamp).toLocaleDateString('en-US') : '-'}</td>
                                            <td>{request.adminNote || '-'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
