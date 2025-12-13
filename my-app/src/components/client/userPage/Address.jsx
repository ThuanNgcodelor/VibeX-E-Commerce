import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { createAddress, getAllAddress, getUser, deleteAddress, updateAddress, setDefaultAddress } from "../../../api/user.js";
import { getProvinces, getDistricts, getWards } from "../../../api/ghn.js";
import Loading from "../Loading.jsx";

const GOOGLE_MAPS_API_KEY = "AIzaSyBN_rkyxM1uIXvFEXfRvAMVq3nxRtqO4eo";

const mapContainerStyle = {
    width: '100%',
    height: '400px',
    borderRadius: '4px'
};

const defaultCenter = {
    lat: 10.0452, // Cần Thơ
    lng: 105.7469
};

// Move libraries outside component to avoid re-render warning
const GOOGLE_MAPS_LIBRARIES = ['places'];

export default function Address() {
    const { t } = useTranslation();
    const [, setUserData] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [addresses, setAddress] = useState([]);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [addressToDelete, setAddressToDelete] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    // GHN Location Data
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingDistricts, setLoadingDistricts] = useState(false);
    const [loadingWards, setLoadingWards] = useState(false);

    // Google Maps State
    const [mapCenter, setMapCenter] = useState(defaultCenter);
    const [markerPosition, setMarkerPosition] = useState(null);
    const [showMap, setShowMap] = useState(false);
    const mapRef = useRef(null);

    // Address Form State
    const [newAddress, setNewAddress] = useState({
        addressName: 'Nhà Riêng', // Default to "Nhà Riêng"
        recipientName: '',
        recipientPhone: '',
        provinceId: null,
        provinceName: '',
        districtId: null,
        districtName: '',
        wardCode: '',
        wardName: '',
        streetAddress: '',
        isDefault: false,
        latitude: null,
        longitude: null
    });

    const [editAddress, setEditAddress] = useState({
        id: '',
        addressName: 'Nhà Riêng',
        recipientName: '',
        recipientPhone: '',
        provinceId: null,
        provinceName: '',
        districtId: null,
        districtName: '',
        wardCode: '',
        wardName: '',
        streetAddress: '',
        isDefault: false,
        latitude: null,
        longitude: null
    });

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries: GOOGLE_MAPS_LIBRARIES
    });

    useEffect(() => {
        getUser().then((data) => setUserData(data));
        fetchAddresses();
        loadProvinces();
    }, []);

    // Load GHN Provinces
    const loadProvinces = async () => {
        try {
            setLoadingProvinces(true);
            setError(''); // Clear previous errors
            const data = await getProvinces();
            setProvinces(data || []);
            if (data && data.length === 0) {
                setError('No provinces found. Please check GHN API configuration.');
            }
        } catch (err) {
            console.error('Error loading provinces:', err);
            const errorMessage = err.message || 'Failed to load provinces';
            
            // Show user-friendly error message
            if (errorMessage.includes('not configured')) {
                setError('GHN API is not configured. You can still add addresses manually. To enable GHN location selection, please configure VITE_GHN_TOKEN and VITE_GHN_SHOP_ID in .env file. See console for details.');
            } else if (errorMessage.includes('authentication failed') || errorMessage.includes('401')) {
                setError('GHN API authentication failed. Please check your VITE_GHN_TOKEN in .env file. Token may be invalid or expired. See console for details.');
            } else {
                setError(errorMessage);
            }
        } finally {
            setLoadingProvinces(false);
        }
    };

    // Load Districts when province changes
    const handleProvinceChange = async (provinceId, provinceName, isEdit = false) => {
        if (!provinceId) {
            if (isEdit) {
                setEditAddress(prev => ({
                    ...prev,
                    provinceId: null,
                    provinceName: '',
                    districtId: null,
                    districtName: '',
                    wardCode: '',
                    wardName: ''
                }));
            } else {
                setNewAddress(prev => ({
                    ...prev,
                    provinceId: null,
                    provinceName: '',
                    districtId: null,
                    districtName: '',
                    wardCode: '',
                    wardName: ''
                }));
            }
            setDistricts([]);
            setWards([]);
            return;
        }

        try {
            setLoadingDistricts(true);
            const data = await getDistricts(provinceId);
            setDistricts(data || []);
            setWards([]);

            if (isEdit) {
                setEditAddress(prev => ({
                    ...prev,
                    provinceId,
                    provinceName,
                    districtId: null,
                    districtName: '',
                    wardCode: '',
                    wardName: ''
                }));
            } else {
                setNewAddress(prev => ({
                    ...prev,
                    provinceId,
                    provinceName,
                    districtId: null,
                    districtName: '',
                    wardCode: '',
                    wardName: ''
                }));
            }
        } catch (err) {
            console.error('Error loading districts:', err);
            setError('Failed to load districts');
        } finally {
            setLoadingDistricts(false);
        }
    };

    // Load Wards when district changes
    const handleDistrictChange = async (districtId, districtName, isEdit = false) => {
        if (!districtId) {
            if (isEdit) {
                setEditAddress(prev => ({
                    ...prev,
                    districtId: null,
                    districtName: '',
                    wardCode: '',
                    wardName: ''
                }));
            } else {
                setNewAddress(prev => ({
                    ...prev,
                    districtId: null,
                    districtName: '',
                    wardCode: '',
                    wardName: ''
                }));
            }
            setWards([]);
            return;
        }

        try {
            setLoadingWards(true);
            const data = await getWards(districtId);
            setWards(data || []);

            if (isEdit) {
                setEditAddress(prev => ({
                    ...prev,
                    districtId,
                    districtName,
                    wardCode: '',
                    wardName: ''
                }));
            } else {
                setNewAddress(prev => ({
                    ...prev,
                    districtId,
                    districtName,
                    wardCode: '',
                    wardName: ''
                }));
            }
        } catch (err) {
            console.error('Error loading wards:', err);
            setError('Failed to load wards');
        } finally {
            setLoadingWards(false);
        }
    };

    // Handle Ward selection
    const handleWardChange = (wardCode, wardName, isEdit = false) => {
        if (isEdit) {
            setEditAddress(prev => ({
                ...prev,
                wardCode,
                wardName
            }));
        } else {
            setNewAddress(prev => ({
                ...prev,
                wardCode,
                wardName
            }));
        }
    };

    // Google Maps handlers
    const handleMapClick = (e) => {
        if (e.latLng) {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            setMarkerPosition({ lat, lng });
            
            // Update address form with coordinates
            if (showEditModal) {
                setEditAddress(prev => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng
                }));
            } else {
                setNewAddress(prev => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng
                }));
            }
        }
    };

    const handleMapLoad = (map) => {
        mapRef.current = map;
    };

    const toggleMap = () => {
        setShowMap(!showMap);
    };

    // Address CRUD operations
    const fetchAddresses = async () => {
        try {
            setFetching(true);
            const data = await getAllAddress();
            setAddress(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching addresses:', error);
            setError('Failed to fetch addresses');
        } finally {
            setFetching(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        // Validate GHN fields
        if (!newAddress.provinceId || !newAddress.districtId || !newAddress.wardCode) {
            setError(t('address.selectProvince') + ', ' + t('address.selectDistrict') + ', ' + t('address.selectWard'));
            setLoading(false);
            return;
        }

        try {
            await createAddress(newAddress);
            setSuccess(t('address.saveSuccess'));
            setShowModal(false);
            resetNewAddressForm();
            await fetchAddresses();
        } catch (err) {
            console.error('Error creating address:', err);
            setError(err.response?.data?.message || t('address.error'));
        } finally {
            setLoading(false);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        // Validate GHN fields
        if (!editAddress.provinceId || !editAddress.districtId || !editAddress.wardCode) {
            setError(t('address.selectProvince') + ', ' + t('address.selectDistrict') + ', ' + t('address.selectWard'));
            setLoading(false);
            return;
        }

        try {
            await updateAddress(editAddress);
            setSuccess(t('address.updateSuccess'));
            setShowEditModal(false);
            await fetchAddresses();
        } catch (err) {
            console.error('Error updating address:', err);
            setError(err.response?.data?.message || t('address.error'));
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = async (address) => {
        try {
            setLoading(true);
            
            // Load districts and wards for the address
            if (address.provinceId) {
                await handleProvinceChange(address.provinceId, address.provinceName || '', true);
            }
            if (address.districtId) {
                await handleDistrictChange(address.districtId, address.districtName || '', true);
            }

            setEditAddress({
                id: address.id,
                addressName: address.addressName || 'Nhà Riêng',
                recipientName: address.recipientName || '',
                recipientPhone: address.recipientPhone || '',
                provinceId: address.provinceId || null,
                provinceName: address.provinceName || '',
                districtId: address.districtId || null,
                districtName: address.districtName || '',
                wardCode: address.wardCode || '',
                wardName: address.wardName || '',
                streetAddress: address.streetAddress || '',
                isDefault: address.isDefault || false,
                latitude: address.latitude || null,
                longitude: address.longitude || null
            });

            // Set map center and marker if coordinates exist
            if (address.latitude && address.longitude) {
                setMapCenter({ lat: address.latitude, lng: address.longitude });
                setMarkerPosition({ lat: address.latitude, lng: address.longitude });
            }

            setShowEditModal(true);
        } catch (error) {
            console.error('Error loading address:', error);
            setError('Failed to load address data');
        } finally {
            setLoading(false);
        }
    };

    const handleSetDefault = async (address) => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const addressId = address.id;
            if (!addressId) {
                setError('Address ID not found');
                return;
            }
            await setDefaultAddress(addressId);
            setSuccess(t('address.setDefaultSuccess'));
            await fetchAddresses();
        } catch (error) {
            console.error('Error setting default address:', error);
            setError(t('address.error'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (address) => {
        setAddressToDelete(address);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        if (!addressToDelete) return;
        try {
            const addressId = addressToDelete.id;
            if (!addressId) {
                setError('Address ID not found');
                return;
            }
            await deleteAddress(addressId);
            setSuccess(t('address.deleteSuccess'));
            await fetchAddresses();
        } catch (error) {
            console.error('Error deleting address:', error);
            setError(t('address.error'));
        } finally {
            setShowDeleteConfirm(false);
            setAddressToDelete(null);
        }
    };

    const resetNewAddressForm = () => {
            setNewAddress({
            addressName: 'Nhà Riêng',
                recipientName: '',
                recipientPhone: '',
            provinceId: null,
            provinceName: '',
            districtId: null,
            districtName: '',
            wardCode: '',
            wardName: '',
                streetAddress: '',
            isDefault: false,
            latitude: null,
            longitude: null
        });
        setDistricts([]);
        setWards([]);
        setMarkerPosition(null);
        setMapCenter(defaultCenter);
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewAddress(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleEditInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditAddress(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Render Address Form Modal (for both Add and Edit)
    const renderAddressForm = (isEdit = false) => {
        const address = isEdit ? editAddress : newAddress;
        const handleChange = isEdit ? handleEditInputChange : handleInputChange;
        const onSubmit = isEdit ? handleEditSubmit : handleSubmit;
        const onClose = () => {
            if (isEdit) {
                setShowEditModal(false);
            } else {
            setShowModal(false);
                resetNewAddressForm();
        }
    };

    return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                zIndex: 1050,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                overflow: 'auto'
            }}>
                <div style={{
                    background: 'white',
                    borderRadius: '4px',
                    width: '100%',
                    maxWidth: '800px',
                    maxHeight: '90vh',
                    overflow: 'auto'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h5 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>
                            {isEdit ? t('address.editAddress') : t('address.addNewAddress')}
                        </h5>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                fontSize: '24px',
                                color: '#999',
                                cursor: 'pointer',
                                padding: 0,
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ×
                        </button>
                    </div>

                    <form onSubmit={onSubmit}>
                        <div style={{ padding: '24px' }}>
                            {/* Full Name and Phone - Side by Side */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#222' }}>
                                        {t('address.recipientName')} *
                                    </label>
                                                <input
                                                    type="text"
                                        name="recipientName"
                                        value={address.recipientName}
                                        onChange={handleChange}
                                                    required
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '2px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                                />
                                            </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#222' }}>
                                        {t('address.recipientPhone')} *
                                    </label>
                                                <input
                                                    type="tel"
                                                    name="recipientPhone"
                                        value={address.recipientPhone}
                                        onChange={handleChange}
                                                    required
                                        placeholder={t('address.phonePlaceholder')}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '2px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                                />
                                            </div>
                                        </div>

                            {/* Province/District/Ward - Dropdown */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#222' }}>
                                    {t('address.province')}, {t('address.district')}, {t('address.ward')} *
                                </label>
                                {provinces.length === 0 && error && (
                                    <div style={{ 
                                        padding: '12px', 
                                        background: '#fff3cd', 
                                        border: '1px solid #ffc107', 
                                        borderRadius: '4px', 
                                        marginBottom: '12px',
                                        fontSize: '13px',
                                        color: '#856404'
                                    }}>
                                        <strong>⚠️ GHN API not configured:</strong> {error.includes('not configured') 
                                            ? 'Please configure VITE_GHN_TOKEN in .env file to enable location selection. You can still add addresses manually below.'
                                            : error}
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                    {/* Province */}
                                    <select
                                        name="provinceId"
                                        value={address.provinceId || ''}
                                        onChange={(e) => {
                                            const selectedProvince = provinces.find(p => p.ProvinceID === parseInt(e.target.value));
                                            handleProvinceChange(
                                                e.target.value ? parseInt(e.target.value) : null,
                                                selectedProvince?.ProvinceName || '',
                                                isEdit
                                            );
                                        }}
                                        required
                                        disabled={loadingProvinces || provinces.length === 0}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '2px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            background: provinces.length === 0 ? '#f5f5f5' : 'white',
                                            cursor: provinces.length === 0 ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        <option value="">{provinces.length === 0 ? 'GHN API not configured' : t('address.selectProvince')}</option>
                                        {provinces.map(province => (
                                            <option key={province.ProvinceID} value={province.ProvinceID}>
                                                {province.ProvinceName}
                                            </option>
                                        ))}
                                    </select>

                                    {/* District */}
                                    <select
                                        name="districtId"
                                        value={address.districtId || ''}
                                        onChange={(e) => {
                                            const selectedDistrict = districts.find(d => d.DistrictID === parseInt(e.target.value));
                                            handleDistrictChange(
                                                e.target.value ? parseInt(e.target.value) : null,
                                                selectedDistrict?.DistrictName || '',
                                                isEdit
                                            );
                                        }}
                                        required
                                        disabled={!address.provinceId || loadingDistricts}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '2px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            background: 'white'
                                        }}
                                    >
                                        <option value="">{t('address.selectDistrict')}</option>
                                        {districts.map(district => (
                                            <option key={district.DistrictID} value={district.DistrictID}>
                                                {district.DistrictName}
                                            </option>
                                        ))}
                                    </select>

                                    {/* Ward */}
                                    <select
                                        name="wardCode"
                                        value={address.wardCode || ''}
                                        onChange={(e) => {
                                            const selectedWard = wards.find(w => w.WardCode === e.target.value);
                                            handleWardChange(
                                                e.target.value || '',
                                                selectedWard?.WardName || '',
                                                isEdit
                                            );
                                        }}
                                                required
                                        disabled={!address.districtId || loadingWards}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '2px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            boxSizing: 'border-box',
                                            background: 'white'
                                        }}
                                    >
                                        <option value="">{t('address.selectWard')}</option>
                                        {wards.map(ward => (
                                            <option key={ward.WardCode} value={ward.WardCode}>
                                                {ward.WardName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                        </div>

                            {/* Specific Address */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#222' }}>
                                    {t('address.streetAddress')} *
                                </label>
                                <textarea
                                    name="streetAddress"
                                    value={address.streetAddress}
                                    onChange={handleChange}
                                                required
                                    rows={3}
                                    placeholder={t('address.streetAddressPlaceholder')}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        border: '1px solid #ddd',
                                        borderRadius: '2px',
                                        fontSize: '14px',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        resize: 'vertical'
                                    }}
                                            />
                                        </div>

                            {/* Google Maps */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ fontSize: '14px', fontWeight: 500, color: '#222' }}>
                                        {t('address.location')}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={toggleMap}
                                        style={{
                                            background: 'white',
                                            border: '1px solid #ddd',
                                            color: '#555',
                                            padding: '8px 16px',
                                            borderRadius: '2px',
                                            fontSize: '13px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {showMap ? t('common.hide') : t('common.view')}
                                    </button>
                                </div>
                                {showMap && isLoaded && (
                                    <div style={{ border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                                        <GoogleMap
                                            mapContainerStyle={mapContainerStyle}
                                            center={mapCenter}
                                            zoom={15}
                                            onClick={handleMapClick}
                                            onLoad={handleMapLoad}
                                        >
                                            {markerPosition && (
                                                <Marker position={markerPosition} />
                                            )}
                                        </GoogleMap>
                                    </div>
                                )}
                            </div>

                            {/* Address Type */}
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#222' }}>
                                    Address Type:
                                </label>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleChange({ target: { name: 'addressName', value: 'Nhà Riêng' } })}
                                        style={{
                                            padding: '10px 20px',
                                            border: `1px solid ${address.addressName === 'Nhà Riêng' ? '#ee4d2d' : '#ddd'}`,
                                            background: address.addressName === 'Nhà Riêng' ? '#fff5f0' : 'white',
                                            color: address.addressName === 'Nhà Riêng' ? '#ee4d2d' : '#555',
                                            borderRadius: '2px',
                                            fontSize: '14px',
                                            cursor: 'pointer',
                                            fontWeight: address.addressName === 'Nhà Riêng' ? 500 : 400
                                        }}
                                    >
                                        Nhà Riêng
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleChange({ target: { name: 'addressName', value: 'Văn Phòng' } })}
                                        style={{
                                            padding: '10px 20px',
                                            border: `1px solid ${address.addressName === 'Văn Phòng' ? '#ee4d2d' : '#ddd'}`,
                                            background: address.addressName === 'Văn Phòng' ? '#fff5f0' : 'white',
                                            color: address.addressName === 'Văn Phòng' ? '#ee4d2d' : '#555',
                                            borderRadius: '2px',
                                            fontSize: '14px',
                                            cursor: 'pointer',
                                            fontWeight: address.addressName === 'Văn Phòng' ? 500 : 400
                                        }}
                                    >
                                        Văn Phòng
                                    </button>
                                </div>
                            </div>

                            {/* Set as Default */}
                            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                    type="checkbox"
                                    name="isDefault"
                                    checked={address.isDefault}
                                    onChange={handleChange}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <label style={{ fontSize: '14px', color: '#222', cursor: 'pointer' }}>
                                    {t('address.setAsDefault')}
                                </label>
                                        </div>
                                    </div>

                        {/* Footer Buttons */}
                        <div style={{
                            padding: '16px 24px',
                            borderTop: '1px solid #f0f0f0',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px'
                        }}>
                                        <button
                                            type="button"
                                onClick={onClose}
                                style={{
                                    background: 'white',
                                    border: '1px solid #ddd',
                                    color: '#555',
                                    padding: '10px 20px',
                                    borderRadius: '2px',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('common.cancel')}
                                        </button>
                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    background: loading ? '#ccc' : '#ee4d2d',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '2px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    cursor: loading ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {loading ? (isEdit ? t('common.updating') : t('common.saving')) : t('common.complete')}
                                        </button>
                                    </div>
                                </form>
                            </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '0', width: '100%' }}>
            {/* Header */}
            <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid #f0f0f0', 
                background: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h4 style={{ fontSize: '18px', fontWeight: 500, color: '#222', margin: 0 }}>{t('address.title')}</h4>
                <button
                    onClick={() => {
                        setShowModal(true);
                        resetNewAddressForm();
                    }}
                    style={{
                        background: '#ee4d2d',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '2px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f05d40'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ee4d2d'}
                >
                    <i className="fa fa-plus"></i> {t('address.addNewAddress')}
                </button>
            </div>

            {/* Messages */}
            {success && (
                <div style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #f0f0f0' }}>
                    <div className="alert alert-success" style={{ margin: 0, padding: '12px', borderRadius: '4px' }}>
                        {success}
                    </div>
                </div>
            )}
            {error && (
                <div style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #f0f0f0' }}>
                    <div className="alert alert-danger" style={{ margin: 0, padding: '12px', borderRadius: '4px' }}>
                        {error}
                        </div>
                    </div>
                )}

            {/* Address List */}
            <div style={{ padding: '16px 20px', background: 'white', minHeight: '400px' }}>
                {fetching ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <Loading />
                    </div>
                ) : addresses.length > 0 ? (
                    <>
                        <div style={{ marginBottom: '12px', fontSize: '14px', color: '#222', fontWeight: 500 }}>
                            {t('address.address')}
                        </div>
                        {addresses.map((address, index) => {
                            const isDefault = address.isDefault || address.default;
                            return (
                                <div
                                    key={address.id || `address-${index}`}
                                    style={{
                                        border: '1px solid #f0f0f0',
                                        borderRadius: '4px',
                                        marginBottom: '12px',
                                        background: 'white',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* Address Header */}
                                    <div style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid #f5f5f5',
                                        background: 'white',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '12px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                            <h5 style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#222' }}>
                                                {address.recipientName || address.recipient_name || 'Unnamed'}
                                            </h5>
                                            {isDefault && (
                                                <span style={{
                                                    border: '1px solid #ee4d2d',
                                                    color: '#ee4d2d',
                                                    padding: '2px 6px',
                                                    borderRadius: '2px',
                                                    fontSize: '11px',
                                                    fontWeight: 500,
                                                    background: 'transparent'
                                                }}>
                                                    {t('address.default')}
                                                </span>
                                            )}
                                </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                                onClick={() => handleSetDefault(address)}
                                                disabled={isDefault}
                                                style={{
                                                    background: 'transparent',
                                                    border: isDefault ? '1px solid #ee4d2d' : '1px solid #ddd',
                                                    color: isDefault ? '#ee4d2d' : '#555',
                                                    padding: '6px 12px',
                                                    borderRadius: '2px',
                                                    fontSize: '12px',
                                                    cursor: isDefault ? 'not-allowed' : 'pointer',
                                                    opacity: isDefault ? 0.7 : 1
                                                }}
                                            >
                                                {t('address.setAsDefault')}
                                    </button>
                                    <button
                                                onClick={() => handleEditClick(address)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#0055aa',
                                                    padding: '6px 12px',
                                                    borderRadius: '2px',
                                                    fontSize: '12px',
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline'
                                                }}
                                            >
                                                {t('common.update')}
                                            </button>
                                            {!isDefault && (
                                    <button
                                                    onClick={() => handleDeleteClick(address)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#0055aa',
                                                        padding: '6px 12px',
                                                        borderRadius: '2px',
                                                        fontSize: '12px',
                                                        cursor: 'pointer',
                                                        textDecoration: 'underline'
                                                    }}
                                    >
                                        {t('address.delete')}
                                    </button>
                                            )}
                                </div>
                            </div>

                                    {/* Address Body */}
                                    <div style={{ padding: '14px 16px' }}>
                                        <div style={{ fontSize: '13px', color: '#222', lineHeight: '1.7' }}>
                                            <div style={{ marginBottom: '6px' }}>
                                                <strong>Name:</strong> {address.recipientName || address.recipient_name || 'N/A'}
                        </div>
                                            <div style={{ marginBottom: '6px' }}>
                                                <strong>Phone Number:</strong> {address.recipientPhone || address.recipient_phone || 'N/A'}
                    </div>
                                            <div style={{ marginBottom: '6px' }}>
                                                <strong>Address:</strong> {address.streetAddress || address.street_address || 'N/A'}
                                </div>
                                            <div>
                                                <strong>Location:</strong> {
                                                    address.wardName && address.districtName && address.provinceName
                                                        ? `${address.wardName}, ${address.districtName}, ${address.provinceName}`
                                                        : address.province || 'N/A'
                                                }
                                            </div>
                                            </div>
                                        </div>
                                        </div>
                            );
                        })}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{
                            width: '120px',
                            height: '120px',
                            margin: '0 auto 16px',
                            background: '#f5f5f5',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <i className="fa fa-map-marker-alt" style={{ fontSize: '48px', color: '#ddd' }}></i>
                                        </div>
                        <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>
                            {t('address.noAddresses')}
                        </p>
                                        </div>
                )}
                                    </div>

            {/* Modals */}
            {showModal && renderAddressForm(false)}
            {showEditModal && renderAddressForm(true)}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.45)',
                    zIndex: 1200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '4px',
                        width: '100%',
                        maxWidth: '420px',
                        padding: '20px 24px',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.12)'
                    }}>
                        <p style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#333', textAlign: 'center' }}>
                        {t('address.deleteConfirm')}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{
                                    minWidth: 100,
                                    padding: '10px 16px',
                                    border: '1px solid #ddd',
                                    background: 'white',
                                    color: '#555',
                                    borderRadius: '2px',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('address.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                style={{
                                    minWidth: 100,
                                    padding: '10px 16px',
                                    border: 'none',
                                    background: '#ee4d2d',
                                    color: 'white',
                                    borderRadius: '2px',
                                    cursor: 'pointer'
                                }}
                            >
                                {t('address.delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
