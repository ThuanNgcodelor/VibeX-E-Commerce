import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { getProvinces, getDistricts, getWards } from '../../api/ghn.js';
import { reverseGeocodeOSM } from '../../api/osm.js';
import createShopOwner, { getUserRequests } from '../../api/role_request.js';

import Cookies from 'js-cookie';
import '../../assets/admin/css/RegisterShopOwner.css';
import { useNavigate } from 'react-router-dom';
const vibeLogo = '/game/assets/logo.png';


const RegisterShopOwner = () => {
    // 0: Welcome, 1: Shop Info, 2: Tax, 3: Identity, 4: Complete
    const [currentStep, setCurrentStep] = useState(0);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [registrationHistory, setRegistrationHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // hiển thị địa chỉ đã lưu ở Step 1
    const [address, setAddress] = useState("");
    const navigate = useNavigate();

    // =========================
    // GHN Address (Step 1 Modal)
    // =========================
    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);

    const [provinceId, setProvinceId] = useState('');
    const [provinceName, setProvinceName] = useState('');
    const [districtId, setDistrictId] = useState('');
    const [districtName, setDistrictName] = useState('');
    const [wardCode, setWardCode] = useState('');
    const [wardName, setWardName] = useState('');

    const [detailAddress, setDetailAddress] = useState('');

    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingDistricts, setLoadingDistricts] = useState(false);
    const [loadingWards, setLoadingWards] = useState(false);


    const [coords, setCoords] = useState(null);
    const [locating, setLocating] = useState(false);

    // =========================
    // FORM STATE
    // =========================
    const [shopInfo, setShopInfo] = useState({
        shopName: '',
        ownerName: '',
        email: '',
        phone: '',
        reason: ''
    });

    const [taxInfo, setTaxInfo] = useState({
        businessType: 'CA_NHAN', // Sửa từ PERSONAL -> CA_NHAN để khớp backend enum
        email: '',
        taxCode: ''
    });

    const [idInfo, setIdInfo] = useState({
        idType: 'CCCD',
        idNumber: '',
        fullName: ''
    });

    const [frontFile, setFrontFile] = useState(null);
    const [backFile, setBackFile] = useState(null);
    const [frontPreview, setFrontPreview] = useState(null);
    const [backPreview, setBackPreview] = useState(null);

    // ✅ CAPTCHA & Security
    const [isAgreed, setIsAgreed] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});

    const steps = [
        "Shop Info",
        "Tax Info",
        "Identity",
        "Complete"
    ];

    // ====== helper match địa danh ======
    const normalizeVN = (s = "") =>
        s
            .toString()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

    const stripAdminPrefix = (s = "") => {
        const n = normalizeVN(s);
        return n
            .replace(/\b(tp|thanh pho|tinh|quan|huyen|thi xa|thi tran|phuong|xa|thon|ap)\b/g, "")
            .replace(/\s+/g, " ")
            .trim();
    };

    const findLoose = (list, targetName, getName) => {
        if (!targetName) return null;
        const normTarget = stripAdminPrefix(targetName);
        return list.find(item => stripAdminPrefix(getName(item)) === normTarget);
    };

    const handleAgreementClick = (e) => {
        setIsAgreed(!isAgreed);
    };

    // ====== VALIDATION HELPERS ======
    const isEmpty = (value) => !value || String(value).trim().length === 0;

    const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(String(email).trim());
    };

    const isValidPhone = (phone) => {
        const phoneStr = String(phone).trim();
        return phoneStr.startsWith('0') && phoneStr.length === 10 && /^\d+$/.test(phoneStr);
    };

    const isValidIdNumber = (idNumber) => {
        return String(idNumber).trim().length >= 9;
    };



    // ====== Validation ======
    const validateStep = (step) => {
        let errors = {};

        if (step === 1) {
            // Tên shop
            if (isEmpty(shopInfo.shopName)) {
                errors.shopName = "Shop name is required";
            }

            // Tên chủ hàng
            if (isEmpty(shopInfo.ownerName)) {
                errors.ownerName = "Owner name is required";
            }

            // Địa chỉ nhận hàng
            if (isEmpty(address)) {
                errors.address = "Please select an address";
            }

            // Email
            if (isEmpty(shopInfo.email)) {
                errors.email = "Email is required";
            } else if (!isValidEmail(shopInfo.email)) {
                errors.email = "Invalid email address";
            }

            // Số điện thoại
            if (isEmpty(shopInfo.phone)) {
                errors.phone = "Phone number is required";
            } else if (!isValidPhone(shopInfo.phone)) {
                errors.phone = "Phone number must start with 0 and have 10 digits"; // Consider adding key for this specific error
            }

            // Lý do đăng ký
            if (isEmpty(shopInfo.reason)) {
                errors.reason = "Reason is required";
            }
        }

        if (step === 2) {
            // Email kinh doanh
            if (isEmpty(taxInfo.email)) {
                errors.taxEmail = "Business email is required";
            } else if (!isValidEmail(taxInfo.email)) {
                errors.taxEmail = "Invalid business email";
            }

            // Mã số thuế
            if (isEmpty(taxInfo.taxCode)) {
                errors.taxCode = "Tax code is required";
            }
        }

        if (step === 3) {
            // Số định danh
            if (isEmpty(idInfo.idNumber)) {
                errors.idNumber = "ID number is required";
            } else if (!isValidIdNumber(idInfo.idNumber)) {
                errors.idNumber = "ID number must have at least 9 digits";
            }

            // Họ tên
            if (isEmpty(idInfo.fullName)) {
                errors.fullName = "Full name is required";
            }

            // Ảnh mặt trước
            if (!frontFile) {
                errors.frontImage = "Front ID image is required";
            }

            // Ảnh mặt sau
            if (!backFile) {
                errors.backImage = "Back ID image is required";
            }

            // Xác nhận thỏa thuận
            if (!isAgreed) {
                errors.agreement = "You must read and agree to the terms";
            }
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const Stepper = () => (
        <div className="vibe-stepper-container">
            {steps.map((label, index) => {
                const stepNum = index + 1;
                const isDone = stepNum < currentStep;
                const isActive = stepNum === currentStep;
                const isPassed = stepNum <= currentStep;

                return (
                    <div key={index} className="stepper-item">
                        {index < steps.length - 1 && (
                            <div className="stepper-line">
                                <div className="stepper-line-bg"></div>
                                <div className={`stepper-line-fill ${isDone ? 'done' : ''}`}></div>
                            </div>
                        )}

                        <div className={`stepper-dot ${isPassed ? 'active' : ''}`}>
                            <div className={`dot-inner ${(isActive || isDone) ? 'show' : ''}`}></div>
                        </div>

                        <div className={`stepper-label ${isPassed ? 'active' : ''}`}>{label}</div>
                    </div>
                );
            })}
        </div>
    );

    // ===== Load provinces for Step 1 modal when open modal =====
    useEffect(() => {
        if (!showAddressModal) return;

        // reset mỗi lần mở modal
        setProvinceId(''); setProvinceName('');
        setDistrictId(''); setDistrictName('');
        setWardCode(''); setWardName('');
        setDistricts([]); setWards([]);
        setDetailAddress('');
        setCoords(null);
        setLocating(false);

        const load = async () => {
            try {
                setLoadingProvinces(true);
                const data = await getProvinces();
                setProvinces(data || []);
            } catch (e) {
                console.error('Load provinces failed:', e);
                setProvinces([]);
            } finally {
                setLoadingProvinces(false);
            }
        };

        load();
    }, [showAddressModal]);



    // ✅ Check authentication khi component load
    useEffect(() => {
        const token = Cookies.get('accessToken');
        if (!token) {
            Swal.fire({
                icon: 'warning',
                title: 'Login Required',
                text: 'Please login to continue.'
            });
            navigate('/login');
        }
    }, [navigate]);

    // ✅ Load User Registration History
    useEffect(() => {
        const fetchHistory = async () => {
            const token = Cookies.get('accessToken');
            if (!token) return;

            try {
                setLoadingHistory(true);
                const data = await getUserRequests();
                // Sort by creation time desc
                const sorted = (data || []).sort((a, b) => new Date(b.creationTimestamp) - new Date(a.creationTimestamp));
                setRegistrationHistory(sorted);
            } catch (error) {
                console.error("Failed to load history:", error);
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchHistory();
    }, []);

    // HANDLERS FOR INPUTS
    const handleShopChange = (e) => {
        const { name, value } = e.target;
        setShopInfo(prev => ({ ...prev, [name]: value }));
        if (fieldErrors[name]) {
            setFieldErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleTaxChange = (e) => {
        const { name, value } = e.target;
        setTaxInfo(prev => ({ ...prev, [name]: value }));
        const errorKey = name === 'email' ? 'taxEmail' : name;
        if (fieldErrors[errorKey]) {
            setFieldErrors(prev => ({ ...prev, [errorKey]: null }));
        }
    };

    const handleIdChange = (e) => {
        const { name, value } = e.target;
        setIdInfo(prev => ({ ...prev, [name]: value }));
        if (fieldErrors[name]) {
            setFieldErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({
                icon: 'error',
                title: 'File too large',
                text: 'Maximum file size is 5MB.'
            });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            if (type === 'front') {
                setFrontFile(file);
                setFrontPreview(reader.result);
            } else {
                setBackFile(file);
                setBackPreview(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    // =========================
    // Step 1 handlers (Modal)
    // =========================
    const handleProvinceChange = async (e) => {
        const selectedId = e.target.value ? parseInt(e.target.value, 10) : '';
        const selected = provinces.find(p => p.ProvinceID === selectedId);

        setProvinceId(selectedId);
        setProvinceName(selected?.ProvinceName || '');

        setDistricts([]); setWards([]);
        setDistrictId(''); setDistrictName('');
        setWardCode(''); setWardName('');

        if (!selectedId) return;

        try {
            setLoadingDistricts(true);
            const data = await getDistricts(selectedId);
            setDistricts(data || []);
        } catch (err) {
            console.error('Load districts failed:', err);
            setDistricts([]);
        } finally {
            setLoadingDistricts(false);
        }
    };

    const handleDistrictChange = async (e) => {
        const selectedId = e.target.value ? parseInt(e.target.value, 10) : '';
        const selected = districts.find(d => d.DistrictID === selectedId);

        setDistrictId(selectedId);
        setDistrictName(selected?.DistrictName || '');

        setWards([]);
        setWardCode(''); setWardName('');

        if (!selectedId) return;

        try {
            setLoadingWards(true);
            const data = await getWards(selectedId);
            setWards(data || []);
        } catch (err) {
            console.error('Load wards failed:', err);
            setWards([]);
        } finally {
            setLoadingWards(false);
        }
    };

    const handleWardChange = (e) => {
        const code = e.target.value || '';
        const selected = wards.find(w => w.WardCode === code);

        setWardCode(code);
        setWardName(selected?.WardName || '');
    };

    // ✅ ĐỊNH VỊ: lấy GPS + reverse geocode OSM => tự điền detailAddress + auto chọn tỉnh/huyện/xã
    const handleLocate = () => {
        if (locating) return;

        if (!navigator.geolocation) {
            Swal.fire({
                icon: 'error',
                title: 'GPS Not Supported',
                text: 'Your browser does not support geolocation.'
            });
            return;
        }

        setLocating(true);

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const lat = pos.coords.latitude;
                    const lon = pos.coords.longitude;
                    setCoords({ lat, lng: lon });

                    // nếu provinces chưa có => load
                    let provList = provinces;
                    if (!provList || provList.length === 0) {
                        const pData = await getProvinces();
                        provList = pData || [];
                        setProvinces(provList);
                    }

                    const data = await reverseGeocodeOSM(lat, lon);

                    // set địa chỉ chi tiết cho textarea
                    const road = data?.address?.road || data?.address?.pedestrian || "";
                    const house = data?.address?.house_number || "";
                    const composed = `${house ? house + " " : ""}${road}`.trim();
                    setDetailAddress(composed || data?.display_name || "");

                    // OSM field mapping
                    const osmProvince =
                        data?.address?.state || data?.address?.province || data?.address?.region || "";

                    const osmDistrict =
                        data?.address?.county ||
                        data?.address?.city_district ||
                        data?.address?.district ||
                        data?.address?.city ||
                        "";

                    const osmWard =
                        data?.address?.suburb ||
                        data?.address?.quarter ||
                        data?.address?.neighbourhood ||
                        data?.address?.town ||
                        data?.address?.village ||
                        data?.address?.hamlet ||
                        "";

                    // ===== 1) MATCH PROVINCE =====
                    const p = findLoose(provList, osmProvince, (x) => x.ProvinceName);
                    if (!p) return;

                    setProvinceId(p.ProvinceID);
                    setProvinceName(p.ProvinceName);

                    // reset cấp dưới
                    setDistricts([]); setWards([]);
                    setDistrictId(''); setDistrictName('');
                    setWardCode(''); setWardName('');

                    // ===== 2) LOAD + MATCH DISTRICT =====
                    setLoadingDistricts(true);
                    const dList = await getDistricts(p.ProvinceID);
                    setDistricts(dList || []);
                    setLoadingDistricts(false);

                    const d = findLoose(dList || [], osmDistrict, (x) => x.DistrictName);
                    if (!d) return;

                    setDistrictId(d.DistrictID);
                    setDistrictName(d.DistrictName);

                    // reset ward
                    setWards([]);
                    setWardCode(''); setWardName('');

                    // ===== 3) LOAD + MATCH WARD =====
                    setLoadingWards(true);
                    const wList = await getWards(d.DistrictID);
                    setWards(wList || []);
                    setLoadingWards(false);

                    const w = findLoose(wList || [], osmWard, (x) => x.WardName);
                    if (!w) return;

                    setWardCode(w.WardCode);
                    setWardName(w.WardName);

                } catch (err) {
                    console.error(err);
                    Swal.fire({
                        icon: 'error',
                        title: 'Address Not Found',
                        text: 'Could not determine address from your location.'
                    });
                } finally {
                    setLocating(false);
                    setLoadingDistricts(false);
                    setLoadingWards(false);
                }
            },
            (err) => {
                console.error(err);
                setLocating(false);
                if (err.code === 1) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Permission Denied',
                        text: 'Please enable location access.'
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Location Error',
                        text: 'Failed to retrieve location.'
                    });
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const handleSaveAddress = () => {
        if (!provinceId || !districtId || !wardCode) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Address',
                text: 'Please select a valid address.'
            });
            return;
        }
        if (!detailAddress.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Missing Details',
                text: 'Please enter detailed address.'
            });
            return;
        }

        const full =
            `${detailAddress.trim()}, ` +
            `${wardName ? wardName + ', ' : ''}` +
            `${districtName ? districtName + ', ' : ''}` +
            `${provinceName || ''}`;

        setAddress(full.trim().replace(/,+\s*$/, ''));
        setShowAddressModal(false);
    };





    // =========================
    // RENDER
    // =========================
    return (
        <div className="vibe-register-page">
            <header className="vibe-header">
                <div className="header-container">
                    <div className="header-left">
                        <span className="header-title">Register to become a Vibe Seller</span>
                    </div>
                </div>
            </header>

            <div className="back-home-container">
                <button className="btn-back-home" onClick={() => navigate('/')}>
                    <span className="back-icon">←</span>
                    <span className="back-text">Back to Home</span>
                </button>
            </div>

            <main className="vibe-main-content">
                <div className="vibe-card">
                    {currentStep === 0 && (
                        <div className="welcome-screen animate-fade-in">
                            <h2>Welcome to Vibe</h2>
                            <p>Register to become a seller and grow your business with us.</p>

                            {loadingHistory ? (
                                <p>Loading history...</p>
                            ) : (
                                <>
                                    {/* LIST HISTORY IF EXISTS */}
                                    {registrationHistory.length > 0 && (
                                        <div className="history-section">
                                            <h3 className="history-title">Previous Applications</h3>
                                            <div className="history-list">
                                                {registrationHistory.map((req) => (
                                                    <div key={req.id} className={`history-item ${req.status.toLowerCase()}`}>
                                                        <div className="history-header">
                                                            <span className={`status-badge ${req.status.toLowerCase()}`}>{req.status}</span>
                                                            <span className="history-date">{new Date(req.creationTimestamp).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="history-body">
                                                            {req.status === 'PENDING' && <p>Your application is currently under review.</p>}
                                                            {req.status === 'APPROVED' && <p>Your shop has been approved!</p>}
                                                            {req.status === 'REJECTED' && (
                                                                <div className="rejection-box">
                                                                    <strong>Reason for Rejection:</strong>
                                                                    <p>{req.adminNote || "No reason provided."}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Disable register button if there is a pending request */}
                                    {registrationHistory.some(r => r.status === 'PENDING') ? (
                                        <div className="pending-alert">
                                            <p>You have a pending registration. Please wait for admin approval.</p>
                                        </div>
                                    ) : (
                                        <button onClick={() => setCurrentStep(1)} className="btn-primary btn-large mt-4">Register Now</button>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {currentStep > 0 && currentStep < 4 && <Stepper />}

                    {/* STEP 1 */}
                    {currentStep === 1 && (
                        <div className="form-container animate-fade-in">
                            <FormGroup label="Shop Name" required count={`${shopInfo.shopName.length}/30`} error={fieldErrors.shopName}>
                                <input
                                    type="text"
                                    name="shopName"
                                    value={shopInfo.shopName}
                                    onChange={handleShopChange}
                                    placeholder="VD: Vibe"
                                    className={`vibe-input ${fieldErrors.shopName ? 'input-error' : ''}`}
                                    required
                                    maxLength={30}
                                />
                            </FormGroup>
                            <FormGroup label="Shop Owner Name" required count={`${shopInfo.ownerName.length}/30`} error={fieldErrors.ownerName}>
                                <input
                                    type="text"
                                    name="ownerName"
                                    value={shopInfo.ownerName}
                                    onChange={handleShopChange}
                                    placeholder="VD: Nguyen Van A"
                                    className={`vibe-input ${fieldErrors.ownerName ? 'input-error' : ''}`}
                                    required
                                    maxLength={30}
                                />
                            </FormGroup>

                            <FormGroup label="Pickup Address" required error={fieldErrors.address}>
                                {address ? (
                                    <div className={`address-display ${fieldErrors.address ? 'input-error' : ''}`} onClick={() => setShowAddressModal(true)}>
                                        {address} <span className="edit-link">Edit</span>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowAddressModal(true)} className={`btn-outline ${fieldErrors.address ? 'input-error' : ''}`}>+ Add</button>
                                )}
                            </FormGroup>

                            <FormGroup label="Email" required error={fieldErrors.email}>
                                <input
                                    type="email"
                                    name="email"
                                    value={shopInfo.email}
                                    onChange={handleShopChange}
                                    placeholder="vd@gmail.com"
                                    className={`vibe-input ${fieldErrors.email ? 'input-error' : ''}`}
                                    required
                                />
                            </FormGroup>

                            <FormGroup label="Phone Number" required error={fieldErrors.phone}>
                                <div className="input-group">
                                    <input
                                        type="text"
                                        name="phone"
                                        value={shopInfo.phone}
                                        onChange={handleShopChange}
                                        placeholder="0987654321"
                                        className={`vibe-input ${fieldErrors.phone ? 'input-error' : ''}`}
                                        required
                                    />
                                </div>
                            </FormGroup>

                            <FormGroup label="Reason for Role Request" required error={fieldErrors.reason}>
                                <input
                                    type="text"
                                    name="reason"
                                    value={shopInfo.reason}
                                    onChange={handleShopChange}
                                    placeholder=""
                                    className={`vibe-input ${fieldErrors.reason ? 'input-error' : ''}`}
                                    required
                                />
                            </FormGroup>
                        </div>
                    )}

                    {/* STEP 2 */}
                    {currentStep === 2 && (
                        <div className="form-container animate-fade-in">
                            <div className="info-alert-blue mb-6">
                                <i className="info-icon">ⓘ</i> Please provide accurate tax information.
                            </div>

                            <FormGroup label="Business Type">
                                <div className="radio-group">
                                    <label><input type="radio" name="businessType" value="CA_NHAN" checked={taxInfo.businessType === 'CA_NHAN'} onChange={handleTaxChange} /> Individual</label>
                                    <label><input type="radio" name="businessType" value="HO_KINH_DOANH" checked={taxInfo.businessType === 'HO_KINH_DOANH'} onChange={handleTaxChange} /> Business Household</label>
                                    <label><input type="radio" name="businessType" value="CONG_TY" checked={taxInfo.businessType === 'CONG_TY'} onChange={handleTaxChange} /> Company</label>
                                </div>
                            </FormGroup>

                            <FormGroup label="Business Address" required error={fieldErrors.address}>
                                {address ? (
                                    <div className={`address-display ${fieldErrors.address ? 'input-error' : ''}`} onClick={() => setShowAddressModal(true)}>
                                        {address} <span className="edit-link">Edit</span>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowAddressModal(true)} className={`btn-outline ${fieldErrors.address ? 'input-error' : ''}`}>+ Add</button>
                                )}
                            </FormGroup>

                            <FormGroup label="Email" count={`${taxInfo.email.length}/100`} error={fieldErrors.taxEmail}>
                                <input
                                    type="email"
                                    name="email"
                                    value={taxInfo.email}
                                    onChange={handleTaxChange}
                                    className={`vibe-input ${fieldErrors.taxEmail ? 'input-error' : ''}`}
                                />
                            </FormGroup>

                            <FormGroup label="Tax Code" count={`${taxInfo.taxCode.length}/14`} error={fieldErrors.taxCode}>
                                <input
                                    type="text"
                                    name="taxCode"
                                    value={taxInfo.taxCode}
                                    onChange={handleTaxChange}
                                    placeholder="Enter value"
                                    className={`vibe-input ${fieldErrors.taxCode ? 'input-error' : ''}`}
                                />
                            </FormGroup>
                        </div>
                    )}

                    {/* STEP 3 */}
                    {currentStep === 3 && (
                        <div className="form-container animate-fade-in">
                            <div className="info-alert-blue mb-6">
                                <i className="info-icon">ⓘ</i> Please provide Identity Information of the Shop Owner or Legal Representative.
                            </div>

                            <FormGroup label="Identity Type">
                                <div className="radio-group">
                                    <label><input type="radio" name="idType" value="CCCD" checked={idInfo.idType === 'CCCD'} onChange={handleIdChange} /> Citizen Identity Card (CCCD)</label>
                                    <label><input type="radio" name="idType" value="CMND" checked={idInfo.idType === 'CMND'} onChange={handleIdChange} /> ID Card (CMND)</label>
                                    <label><input type="radio" name="idType" value="HO_CHIEU" checked={idInfo.idType === 'HO_CHIEU'} onChange={handleIdChange} /> Passport</label>
                                </div>
                            </FormGroup>

                            <FormGroup label="Citizen Identity Card Number (CCCD)" required count={`${idInfo.idNumber.length}/12`} error={fieldErrors.idNumber}>
                                <input
                                    type="text"
                                    name="idNumber"
                                    value={idInfo.idNumber}
                                    onChange={handleIdChange}
                                    placeholder="Enter value"
                                    className={`vibe-input ${fieldErrors.idNumber ? 'input-error' : ''}`}
                                    required
                                />
                            </FormGroup>

                            <FormGroup label="Full Name" required count={`${idInfo.fullName.length}/100`} error={fieldErrors.fullName}>
                                <input
                                    type="text"
                                    name="fullName"
                                    value={idInfo.fullName}
                                    onChange={handleIdChange}
                                    placeholder="Enter value"
                                    className={`vibe-input ${fieldErrors.fullName ? 'input-error' : ''}`}
                                    required
                                />
                                <div className="sub-label">Per ID/CCCD/Passport</div>
                            </FormGroup>

                            <FormGroup label="Front Image" required error={fieldErrors.frontImage}>
                                <div className="id-image-upload">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(e, 'front')}
                                        style={{ display: 'none' }}
                                        id="front-image-input"
                                    />
                                    <label htmlFor="front-image-input" className={`image-upload-box ${fieldErrors.frontImage ? 'input-error' : ''}`}>
                                        {frontPreview ? (
                                            <img src={frontPreview} alt="Front" className="image-preview" />
                                        ) : (
                                            <div className="upload-placeholder">
                                                <span className="plus">+</span>
                                                <span>Upload Front Image</span>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </FormGroup>

                            <FormGroup label="Back Image" required error={fieldErrors.backImage}>
                                <div className="id-image-upload">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(e, 'back')}
                                        style={{ display: 'none' }}
                                        id="back-image-input"
                                    />
                                    <label htmlFor="back-image-input" className={`image-upload-box ${fieldErrors.backImage ? 'input-error' : ''}`}>
                                        {backPreview ? (
                                            <img src={backPreview} alt="Back" className="image-preview" />
                                        ) : (
                                            <div className="upload-placeholder">
                                                <span className="plus">+</span>
                                                <span>Upload Back Image</span>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </FormGroup>

                            <div className="info-note" style={{ padding: '12px', background: '#f5f5f5', borderRadius: '4px', marginBottom: '16px' }}>
                                <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                                    📝 <b>Note: Image must be clear, no glare, no missing corners.</b>
                                </p>
                            </div>

                            <div className="agreement-section" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={handleAgreementClick}>
                                <input
                                    type="checkbox"
                                    id="agree"
                                    className={`vibe-checkbox ${fieldErrors.agreement ? 'input-error' : ''}`}
                                    checked={isAgreed}
                                    readOnly
                                />
                                <label htmlFor="agree" style={{ cursor: 'pointer', color: fieldErrors.agreement ? '#ee4d2d' : 'inherit' }}>I agree to Vibe's Terms & Conditions</label>
                            </div>
                            {fieldErrors.agreement && <div className="validation-error-text" style={{ marginLeft: '24px' }}>{fieldErrors.agreement}</div>}
                        </div>
                    )}

                    {/* STEP 4 */}
                    {currentStep === 4 && (
                        <div className="welcome-screen animate-fade-in" style={{ padding: '80px 0' }}>
                            <div className="success-animation-container">
                                <div className="success-icon-large">
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </div>
                                <div className="success-ripple"></div>
                            </div>
                            <h2 className="success-title">Submission Successful!</h2>
                            <p className="success-desc">
                                Your shop owner registration has been sent to our administration team.
                                <br />
                                We will review your request and notify you via email shortly.
                            </p>
                            <div className="success-actions">
                                <button className="btn-home-primary" onClick={() => navigate('/')}>
                                    Return to Homepage
                                </button>
                            </div>
                        </div>
                    )}

                    {/* FOOTER */}
                    {currentStep > 0 && currentStep < 4 && (
                        <div className="form-footer">
                            <button onClick={() => setCurrentStep(currentStep - 1)} className="btn-ghost">Back</button>
                            <div className="footer-right">
                                <button className="btn-ghost px-10">Save</button>
                                <button
                                    onClick={async () => {
                                        // Validation trước khi chuyển bước
                                        const isValid = validateStep(currentStep);
                                        if (!isValid) {
                                            return;
                                        }



                                        // ✅ Bước cuối submit data
                                        if (currentStep === 3) {
                                            // ✅ Check authentication trước khi submit
                                            const token = Cookies.get('accessToken');
                                            if (!token) {
                                                Swal.fire({
                                                    icon: 'warning',
                                                    title: 'Session Expired',
                                                    text: 'Please login again!'
                                                });
                                                navigate('/login');
                                                return;
                                            }

                                            // SUBMIT LOGIC
                                            try {
                                                const businessAddress = `${detailAddress.trim()}, ${wardName}, ${districtName}, ${provinceName}`.trim();

                                                const fullPayload = {
                                                    roleRequest: {
                                                        role: "SHOP_OWNER",
                                                        reason: shopInfo.reason.trim() || "Register to sell on Vibe"
                                                    },
                                                    shopDetails: {
                                                        shopName: shopInfo.shopName.trim(),
                                                        ownerName: shopInfo.ownerName.trim(),
                                                        phone: shopInfo.phone.trim(),
                                                        provinceId: parseInt(provinceId),
                                                        provinceName: provinceName,
                                                        districtId: parseInt(districtId),
                                                        districtName: districtName,
                                                        wardCode: wardCode,
                                                        wardName: wardName,
                                                        streetAddress: detailAddress.trim(),
                                                        latitude: coords?.lat || null,
                                                        longitude: coords?.lng || null
                                                    },
                                                    taxInfo: {
                                                        businessType: taxInfo.businessType,
                                                        businessAddress: businessAddress,
                                                        email: taxInfo.email.trim() || shopInfo.email.trim(),
                                                        taxCode: taxInfo.taxCode.trim() || null
                                                    },
                                                    identification: {
                                                        identificationType: idInfo.idType,
                                                        identificationNumber: idInfo.idNumber.trim(),
                                                        fullName: idInfo.fullName.trim(),
                                                        imageFrontUrl: null,
                                                        imageBackUrl: null
                                                    }
                                                };

                                                console.log('✅ Submitting payload:', JSON.stringify(fullPayload, null, 2));

                                                // Gọi API
                                                await createShopOwner(fullPayload, frontFile, backFile);

                                                // Chuyển sang màn hình thành công
                                                setCurrentStep(4);
                                            } catch (error) {
                                                console.error("❌ Submit failed:", error);
                                                let errorMsg = "An error occurred while submitting. Please try again later.";
                                                if (error.response?.data?.message) {
                                                    errorMsg = error.response.data.message;
                                                }
                                                Swal.fire({
                                                    icon: 'error',
                                                    title: 'Registration Failed',
                                                    text: errorMsg
                                                });
                                            }
                                        } else {
                                            // Chuyển sang bước tiếp theo
                                            const next = currentStep + 1;
                                            setCurrentStep(next);
                                        }
                                    }}
                                    className="btn-primary px-10"
                                >
                                    {currentStep === 3 ? "Complete" : "Next"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* ===== MODAL ĐỊA CHỈ (GHN) - STEP 1 ===== */}
            {showAddressModal && (
                <div className="vibe-modal-overlay">
                    <div className="vibe-modal-container animate-scale-up">
                        <div className="vibe-modal-header">
                            <span className="modal-title">Add New Address</span>
                            <span className="modal-close-icon" onClick={() => setShowAddressModal(false)}>&times;</span>
                        </div>

                        <div className="vibe-modal-body">
                            <div className="modal-row-flex">
                                <div className="modal-input-wrapper">
                                    <label className="modal-inner-label">Full Name</label>
                                    <input type="text" placeholder="Enter value" className="modal-input-clean" />
                                </div>
                                <div className="modal-input-wrapper">
                                    <label className="modal-inner-label">Phone Number</label>
                                    <input type="text" placeholder="Enter value" className="modal-input-clean" />
                                </div>
                            </div>

                            <div className="modal-section">
                                <div className="modal-label-bold">Address</div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                    <select className="vibe-input" value={provinceId || ''} onChange={handleProvinceChange} disabled={loadingProvinces}>
                                        <option value="">{loadingProvinces ? "Loading..." : "Select Province/City"}</option>
                                        {provinces.map(p => <option key={p.ProvinceID} value={p.ProvinceID}>{p.ProvinceName}</option>)}
                                    </select>

                                    <select className="vibe-input" value={districtId || ''} onChange={handleDistrictChange} disabled={!provinceId || loadingDistricts}>
                                        <option value="">{loadingDistricts ? "Loading..." : "Select District"}</option>
                                        {districts.map(d => <option key={d.DistrictID} value={d.DistrictID}>{d.DistrictName}</option>)}
                                    </select>

                                    <select className="vibe-input" value={wardCode || ''} onChange={handleWardChange} disabled={!districtId || loadingWards}>
                                        <option value="">{loadingWards ? "Loading..." : "Select Ward"}</option>
                                        {wards.map(w => <option key={w.WardCode} value={w.WardCode}>{w.WardName}</option>)}
                                    </select>
                                </div>

                                <div style={{ marginTop: 10, fontSize: 13, color: '#999' }}>
                                    {provinceName || districtName || wardName
                                        ? `${provinceName}${districtName ? ' / ' + districtName : ''}${wardName ? ' / ' + wardName : ''}`
                                        : "Please select province, district and ward"}
                                </div>
                            </div>

                            <div className="modal-section">
                                <div className="modal-label-bold">Detailed Address</div>
                                <textarea
                                    value={detailAddress}
                                    onChange={(e) => setDetailAddress(e.target.value)}
                                    placeholder="Enter detailed address (e.g. House number, street name...)"
                                    className="modal-textarea-clean"
                                />
                            </div>

                            <div
                                className="modal-location-box"
                                onClick={handleLocate}
                                style={{ cursor: locating ? "not-allowed" : "pointer", opacity: locating ? 0.6 : 1 }}
                            >
                                <div className="loc-left">
                                    <div className="loc-circle">
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                        </svg>
                                    </div>
                                    <div className="loc-info">
                                        <div className="loc-title">{locating ? "Locating..." : "Use Current Location"}</div>
                                        <div className="loc-desc">
                                            {coords ? `Lat: ${coords.lat.toFixed(6)} - Lng: ${coords.lng.toFixed(6)}` : "Click to get your GPS location"}
                                        </div>
                                    </div>
                                </div>
                                <div className="loc-arrow">›</div>
                            </div>
                        </div>

                        <div className="vibe-modal-footer">
                            <button onClick={() => setShowAddressModal(false)} className="btn-modal-cancel">Cancel</button>
                            <button onClick={handleSaveAddress} className="btn-modal-submit">Save</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

const FormGroup = ({ label, children, required, count, error }) => (
    <div style={{ display: 'flex', marginBottom: '24px', flexDirection: 'column' }}>
        <div style={{ display: 'flex' }}>
            <div style={{ width: '180px', textAlign: 'right', paddingRight: '20px', paddingTop: '10px', fontSize: '14px', color: '#555' }}>
                {required && <span style={{ color: '#ee4d2d', marginRight: '4px' }}>*</span>}{label}
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
                {children}
                {count && <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '12px', color: '#ccc' }}>{count}</span>}
                {error && <span className="validation-error-text">{error}</span>}
            </div>
        </div>
    </div>
);

export default RegisterShopOwner;
