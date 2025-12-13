import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createShopOwnerRegistration, getUserRoleRequests } from '../../../api/user.js';
import { getProvinces, getDistricts, getWards } from '../../../api/ghn.js';
import './RoleRequestForm.css';

export default function RoleRequestForm() {
    const { t } = useTranslation();
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
            setMessage(t('roleRequest.failedToLoadProvinces'));
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
            setMessage(t('roleRequest.failedToLoadDistricts'));
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
            setMessage(t('roleRequest.failedToLoadWards'));
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
            setMessage(t('roleRequest.shopNameRequired'));
            setMessageType('error');
            return false;
        }
        
        if (!ownerName.trim()) {
            setMessage(t('roleRequest.ownerNameRequired'));
            setMessageType('error');
            return false;
        }
        
        if (!phone.trim()) {
            setMessage(t('roleRequest.phoneRequired'));
            setMessageType('error');
            return false;
        }
        
        if (!streetAddress.trim()) {
            setMessage(t('roleRequest.streetAddressRequired'));
            setMessageType('error');
            return false;
        }
        
        if (!provinceId || !provinceName) {
            setMessage(t('roleRequest.provinceRequired'));
            setMessageType('error');
            return false;
        }
        
        if (!districtId || !districtName) {
            setMessage(t('roleRequest.districtRequired'));
            setMessageType('error');
            return false;
        }
        
        if (!wardCode || !wardName) {
            setMessage(t('roleRequest.wardRequired'));
            setMessageType('error');
            return false;
        }
        
        if (!reason.trim()) {
            setMessage(t('roleRequest.reasonRequired'));
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

            setMessage(t('roleRequest.successMessage'));
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
            const errorMessage = error.message || t('roleRequest.errorMessage');
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
            'PENDING': { text: t('roleRequest.pending'), class: 'badge-warning' },
            'APPROVED': { text: t('roleRequest.approved'), class: 'badge-success' },
            'REJECTED': { text: t('roleRequest.rejected'), class: 'badge-danger' }
        };
        
        const statusInfo = statusMap[status] || { text: status, class: 'badge-secondary' };
        return <span className={`badge ${statusInfo.class}`}>{statusInfo.text}</span>;
    };

    return (
        <div className="myaccount-content">
            <h3>{t('roleRequest.title')}</h3>
            <p className="text-muted mb-4">{t('roleRequest.description')}</p>
            
            {/* Form to create shop owner registration */}
            <div className="account-details-form">
                <form onSubmit={handleSubmit}>
                    {/* Shop Information Section */}
                    <div style={{ marginBottom: '30px' }}>
                        <h5 style={{ color: '#ee4d2d', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #ee4d2d' }}>
                            {t('roleRequest.shopInformation')}
                        </h5>
                        
                        <div className="single-input-item">
                            <label htmlFor="shopName" className="required">{t('roleRequest.shopName')}</label>
                            <input
                                id="shopName"
                                type="text"
                                value={shopName}
                                onChange={(e) => setShopName(e.target.value)}
                                className="form-control"
                                placeholder={t('roleRequest.enterShopName')}
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        <div className="single-input-item">
                            <label htmlFor="ownerName" className="required">{t('roleRequest.ownerName')}</label>
                            <input
                                id="ownerName"
                                type="text"
                                value={ownerName}
                                onChange={(e) => setOwnerName(e.target.value)}
                                className="form-control"
                                placeholder={t('roleRequest.enterOwnerName')}
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        <div className="single-input-item">
                            <label htmlFor="phone" className="required">{t('roleRequest.phoneNumber')}</label>
                            <input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="form-control"
                                placeholder={t('roleRequest.enterPhoneNumber')}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Address Section */}
                    <div style={{ marginBottom: '30px' }}>
                        <h5 style={{ color: '#ee4d2d', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #ee4d2d' }}>
                            {t('roleRequest.shopAddress')}
                        </h5>
                        
                        <div className="single-input-item">
                            <label className="required">{t('roleRequest.provinceCity')}</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <select
                                    value={provinceId || ''}
                                    onChange={handleProvinceChange}
                                    disabled={loadingProvinces || isSubmitting}
                                    className="form-control"
                                    required
                                >
                                    <option value="">{loadingProvinces ? t('roleRequest.loading') : t('roleRequest.selectProvince')}</option>
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
                                    <option value="">{loadingDistricts ? t('roleRequest.loading') : t('roleRequest.selectDistrict')}</option>
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
                                    <option value="">{loadingWards ? t('roleRequest.loading') : t('roleRequest.selectWard')}</option>
                                    {wards.map(ward => (
                                        <option key={ward.WardCode} value={ward.WardCode}>
                                            {ward.WardName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="single-input-item">
                            <label htmlFor="streetAddress" className="required">{t('roleRequest.streetAddress')}</label>
                            <input
                                id="streetAddress"
                                type="text"
                                value={streetAddress}
                                onChange={(e) => setStreetAddress(e.target.value)}
                                className="form-control"
                                placeholder={t('roleRequest.streetAddressPlaceholder')}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Role Request Reason Section */}
                    <div style={{ marginBottom: '30px' }}>
                        <h5 style={{ color: '#ee4d2d', marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #ee4d2d' }}>
                            {t('roleRequest.roleRequestReason')}
                        </h5>
                        
                        <div className="single-input-item">
                            <label htmlFor="reason" className="required">{t('roleRequest.whyShopOwner')}</label>
                            <textarea
                                id="reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows="4"
                                className="form-control"
                                placeholder={t('roleRequest.reasonPlaceholder')}
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
                            {isSubmitting ? t('roleRequest.submitting') : t('roleRequest.submitRegistration')}
                        </button>
                    </div>
                </form>
            </div>

            {/* List of submitted requests */}
            <div className="mt-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4>{t('roleRequest.registrationHistory')}</h4>
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
                            {showRequests ? t('roleRequest.hideHistory') : t('roleRequest.viewHistory')}
                        </button>
                    </div>
                </div>
                
                {showRequests && (
                    <div className="myaccount-table table-responsive">
                        <table className="table table-bordered">
                            <thead className="thead-light">
                                <tr>
                                    <th>{t('roleRequest.requestedRole')}</th>
                                    <th>{t('roleRequest.reason')}</th>
                                    <th>{t('roleRequest.status')}</th>
                                    <th>{t('roleRequest.createdAt')}</th>
                                    <th>{t('roleRequest.adminNote')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {userRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="text-center">{t('roleRequest.noRequestsYet')}</td>
                                    </tr>
                                ) : (
                                    userRequests.map((request) => (
                                        <tr key={request.id}>
                                            <td>
                                                <strong>
                                                    {request.requestedRole === 'SHOP_OWNER' ? t('roleRequest.shopOwner') : request.requestedRole}
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
