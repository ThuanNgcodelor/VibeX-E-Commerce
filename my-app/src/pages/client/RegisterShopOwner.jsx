import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getProvinces, getDistricts, getWards } from '../../api/ghn.js';
import { reverseGeocodeOSM } from '../../api/osm.js';
import createShopOwner from '../../api/role_request.js';
import Cookies from 'js-cookie';
import '../../assets/admin/css/RegisterShopOwner.css';
import { useNavigate } from 'react-router-dom';

const RegisterShopOwner = () => {
    const { t } = useTranslation();
    // 0: Chào mừng, 1: Thông tin Shop, 2: Thuế, 3: Định danh, 4: Hoàn tất
    const [currentStep, setCurrentStep] = useState(0);
    const [showAddressModal, setShowAddressModal] = useState(false);

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

    // ✅ ĐỊNH VỊ (Step 1)
    const [coords, setCoords] = useState(null); // {lat, lng}
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

    const steps = [
        t('roleRequest.steps.shopInfo'),
        t('roleRequest.steps.taxInfo'),
        t('roleRequest.steps.identity'),
        t('roleRequest.steps.complete')
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
        const t = stripAdminPrefix(targetName);

        let hit = list.find(x => stripAdminPrefix(getName(x)) === t);
        if (hit) return hit;

        hit = list.find(x => stripAdminPrefix(getName(x)).includes(t));
        if (hit) return hit;

        hit = list.find(x => t.includes(stripAdminPrefix(getName(x))));
        return hit || null;
    };

    const Stepper = () => (
        <div className="shopee-stepper-container">
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
            alert('Bạn cần đăng nhập để đăng ký trở thành shop owner!');
            navigate('/login');
        }
    }, [navigate]);

    // HANDLERS FOR INPUTS
    const handleShopChange = (e) => {
        const { name, value } = e.target;
        setShopInfo(prev => ({ ...prev, [name]: value }));
    };

    const handleTaxChange = (e) => {
        const { name, value } = e.target;
        setTaxInfo(prev => ({ ...prev, [name]: value }));
    };

    const handleIdChange = (e) => {
        const { name, value } = e.target;
        setIdInfo(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("Kích thước file không được vượt quá 5MB");
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
            alert("Trình duyệt không hỗ trợ định vị GPS.");
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
                    alert("Không lấy được địa chỉ từ vị trí.");
                } finally {
                    setLocating(false);
                    setLoadingDistricts(false);
                    setLoadingWards(false);
                }
            },
            (err) => {
                console.error(err);
                setLocating(false);
                if (err.code === 1) alert("Bạn đã từ chối quyền định vị.");
                else alert("Định vị thất bại, vui lòng thử lại.");
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const handleSaveAddress = () => {
        if (!provinceId || !districtId || !wardCode) {
            alert('Vui lòng chọn đủ Tỉnh/TP, Quận/Huyện, Phường/Xã.');
            return;
        }
        if (!detailAddress.trim()) {
            alert('Vui lòng nhập địa chỉ chi tiết.');
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
        <div className="shopee-register-page">
            <header className="shopee-header">
                <div className="header-container">
                    <div className="header-left">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/f/fe/Shopee.svg" alt="Shopee" />
                        <span className="header-title">{t('roleRequest.headerTitle')}</span>
                    </div>
                    <div className="header-right">
                        <div className="uni-dropdown">
                            <img src="https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/ca5a12a1012586030388.png" alt="uni icon" />
                            <span>Shopee Uni</span>
                        </div>
                    </div>
                </div>
            </header>

            <button className="btn-back-home" onClick={() => navigate('/')}>
                <span className="back-icon">←</span>
                <span className="back-text">{t('roleRequest.backHome')}</span>
            </button>

            <main className="shopee-main-content">
                <div className="shopee-card">
                    {currentStep === 0 && (
                        <div className="welcome-screen animate-fade-in">
                            <div className="welcome-img-container">
                                <img src="https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/ca5a12a1012586030388.png" alt="welcome" />
                            </div>
                            <h2>{t('roleRequest.welcome.title')}</h2>
                            <p>{t('roleRequest.welcome.description')}</p>
                            <button onClick={() => setCurrentStep(1)} className="btn-primary btn-large">{t('roleRequest.welcome.registerButton')}</button>
                        </div>
                    )}

                    {currentStep > 0 && currentStep < 4 && <Stepper />}

                    {/* STEP 1 */}
                    {currentStep === 1 && (
                        <div className="form-container animate-fade-in">
                            <FormGroup label={t('roleRequest.step1.shopName')} required count={`${shopInfo.shopName.length}/30`}>
                                <input
                                    type="text"
                                    name="shopName"
                                    value={shopInfo.shopName}
                                    onChange={handleShopChange}
                                    placeholder="VD: Vibe"
                                    className="shopee-input"
                                    maxLength={30}
                                />
                            </FormGroup>
                            <FormGroup label={t('roleRequest.step1.ownerName')} required count={`${shopInfo.ownerName.length}/30`}>
                                <input
                                    type="text"
                                    name="ownerName"
                                    value={shopInfo.ownerName}
                                    onChange={handleShopChange}
                                    placeholder="VD: Nguyen Van A"
                                    className="shopee-input"
                                    maxLength={30}
                                />
                            </FormGroup>

                            <FormGroup label={t('roleRequest.step1.pickupAddress')} required>
                                {address ? (
                                    <div className="address-display" onClick={() => setShowAddressModal(true)}>
                                        {address} <span className="edit-link">{t('roleRequest.step1.edit')}</span>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowAddressModal(true)} className="btn-outline">{t('roleRequest.step1.add')}</button>
                                )}
                            </FormGroup>

                            <FormGroup label="Email" required>
                                <input
                                    type="email"
                                    name="email"
                                    value={shopInfo.email}
                                    onChange={handleShopChange}
                                    placeholder="vd@gmail.com"
                                    className="shopee-input"
                                />
                            </FormGroup>

                            <FormGroup label={t('roleRequest.step1.phone')} required>
                                <div className="input-group">
                                    <input
                                        type="text"
                                        name="phone"
                                        value={shopInfo.phone}
                                        onChange={handleShopChange}
                                        placeholder="0987654321"
                                        className="shopee-input"
                                    />
                                </div>
                            </FormGroup>

                            <FormGroup label={t('roleRequest.step1.reason')} required>
                                <input
                                    type="text"
                                    name="reason"
                                    value={shopInfo.reason}
                                    onChange={handleShopChange}
                                    placeholder=""
                                    className="shopee-input"
                                />
                            </FormGroup>

                        </div>
                    )}

                    {/* STEP 2 */}
                    {currentStep === 2 && (
                        <div className="form-container animate-fade-in">
                            <div className="info-alert-blue mb-6">
                                <i className="info-icon">ⓘ</i> {t('roleRequest.step2.taxNotice')}
                            </div>

                            <FormGroup label={t('roleRequest.step2.businessType')}>
                                <div className="radio-group">
                                    <label><input type="radio" name="businessType" value="CA_NHAN" checked={taxInfo.businessType === 'CA_NHAN'} onChange={handleTaxChange} /> {t('roleRequest.step2.personal')}</label>
                                    <label><input type="radio" name="businessType" value="HO_KINH_DOANH" checked={taxInfo.businessType === 'HO_KINH_DOANH'} onChange={handleTaxChange} /> {t('roleRequest.step2.household')}</label>
                                    <label><input type="radio" name="businessType" value="CONG_TY" checked={taxInfo.businessType === 'CONG_TY'} onChange={handleTaxChange} /> {t('roleRequest.step2.company')}</label>
                                </div>
                            </FormGroup>

                            <FormGroup label={t('roleRequest.step2.businessAddress')} required>
                                {address ? (
                                    <div className="address-display" onClick={() => setShowAddressModal(true)}>
                                        {address} <span className="edit-link">{t('roleRequest.step1.edit')}</span>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowAddressModal(true)} className="btn-outline">{t('roleRequest.step1.add')}</button>
                                )}
                            </FormGroup>

                            <FormGroup label="Email" count={`${taxInfo.email.length}/100`}>
                                <input
                                    type="email"
                                    name="email"
                                    value={taxInfo.email}
                                    onChange={handleTaxChange}
                                    className="shopee-input"
                                />
                            </FormGroup>

                            <FormGroup label={t('roleRequest.step2.taxCode')} count={`${taxInfo.taxCode.length}/14`}>
                                <input
                                    type="text"
                                    name="taxCode"
                                    value={taxInfo.taxCode}
                                    onChange={handleTaxChange}
                                    placeholder={t('roleRequest.modal.enterValue')}
                                    className="shopee-input"
                                />
                            </FormGroup>
                        </div>
                    )}

                    {/* STEP 3 */}
                    {currentStep === 3 && (
                        <div className="form-container animate-fade-in">
                            <div className="info-alert-blue mb-6">
                                <i className="info-icon">ⓘ</i> {t('roleRequest.step3.identityNotice')}
                            </div>

                            <FormGroup label={t('roleRequest.step3.idType')}>
                                <div className="radio-group">
                                    <label><input type="radio" name="idType" value="CCCD" checked={idInfo.idType === 'CCCD'} onChange={handleIdChange} /> {t('roleRequest.step3.cccd')}</label>
                                    <label><input type="radio" name="idType" value="CMND" checked={idInfo.idType === 'CMND'} onChange={handleIdChange} /> {t('roleRequest.step3.cmnd')}</label>
                                    <label><input type="radio" name="idType" value="HO_CHIEU" checked={idInfo.idType === 'HO_CHIEU'} onChange={handleIdChange} /> {t('roleRequest.step3.passport')}</label>
                                </div>
                            </FormGroup>

                            <FormGroup label={t('roleRequest.step3.idNumber')} required count={`${idInfo.idNumber.length}/12`}>
                                <input
                                    type="text"
                                    name="idNumber"
                                    value={idInfo.idNumber}
                                    onChange={handleIdChange}
                                    placeholder={t('roleRequest.modal.enterValue')}
                                    className="shopee-input"
                                />
                            </FormGroup>

                            <FormGroup label={t('roleRequest.step3.fullName')} required count={`${idInfo.fullName.length}/100`}>
                                <input
                                    type="text"
                                    name="fullName"
                                    value={idInfo.fullName}
                                    onChange={handleIdChange}
                                    placeholder={t('roleRequest.modal.enterValue')}
                                    className="shopee-input"
                                />
                                <div className="sub-label">{t('roleRequest.step3.fullNameHint')}</div>
                            </FormGroup>

                            <FormGroup label={t('roleRequest.step3.frontImage')} required>
                                <div className="id-image-upload">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(e, 'front')}
                                        style={{ display: 'none' }}
                                        id="front-image-input"
                                    />
                                    <label htmlFor="front-image-input" className="image-upload-box">
                                        {frontPreview ? (
                                            <img src={frontPreview} alt="Front" className="image-preview" />
                                        ) : (
                                            <div className="upload-placeholder">
                                                <span className="plus">+</span>
                                                <span>{t('roleRequest.step3.uploadFront')}</span>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </FormGroup>

                            <FormGroup label={t('roleRequest.step3.backImage')} required>
                                <div className="id-image-upload">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileChange(e, 'back')}
                                        style={{ display: 'none' }}
                                        id="back-image-input"
                                    />
                                    <label htmlFor="back-image-input" className="image-upload-box">
                                        {backPreview ? (
                                            <img src={backPreview} alt="Back" className="image-preview" />
                                        ) : (
                                            <div className="upload-placeholder">
                                                <span className="plus">+</span>
                                                <span>{t('roleRequest.step3.uploadBack')}</span>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </FormGroup>

                            <div className="info-note" style={{ padding: '12px', background: '#f5f5f5', borderRadius: '4px', marginBottom: '16px' }}>
                                <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                                    📝 <b>{t('roleRequest.step3.imageNote')}</b>
                                </p>
                            </div>

                            <div className="agreement-section">
                                <input type="checkbox" id="agree" className="shopee-checkbox" />
                                <label htmlFor="agree">{t('roleRequest.step3.agreement')}</label>
                            </div>
                        </div>
                    )}

                    {/* STEP 4 */}
                    {currentStep === 4 && (
                        <div className="welcome-screen animate-fade-in">
                            <div className="success-icon">✓</div>
                            <h2>{t('roleRequest.step4.successTitle')}</h2>
                            <p>{t('roleRequest.step4.successMessage')}</p>
                            <button className="btn-back-home" onClick={() => navigate('/')}>
                                <span className="back-icon">←</span>
                                <span className="back-text">{t('roleRequest.backHome')}</span>
                            </button>
                        </div>
                    )}

                    {/* FOOTER */}
                    {currentStep > 0 && currentStep < 4 && (
                        <div className="form-footer">
                            <button onClick={() => setCurrentStep(currentStep - 1)} className="btn-ghost">{t('roleRequest.buttons.back')}</button>
                            <div className="footer-right">
                                <button className="btn-ghost px-10">{t('roleRequest.buttons.save')}</button>
                                <button
                                    onClick={async () => {
                                        // ✅ Bước cuối submit data
                                        if (currentStep === 3) {
                                            // ✅ Check authentication trước khi submit
                                            const token = Cookies.get('accessToken');
                                            if (!token) {
                                                alert('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!');
                                                navigate('/login');
                                                return;
                                            }

                                            // Validation cơ bản
                                            if (!shopInfo.shopName || !shopInfo.ownerName || !shopInfo.phone) {
                                                alert("Vui lòng điền đầy đủ thông tin shop.");
                                                return;
                                            }
                                            if (!address) {
                                                alert("Vui lòng chọn địa chỉ lấy hàng.");
                                                return;
                                            }
                                            if (!idInfo.idNumber || !idInfo.fullName) {
                                                alert("Vui lòng điền đầy đủ thông tin định danh.");
                                                return;
                                            }

                                            // SUBMIT LOGIC - Cấu trúc đúng theo FullShopRegistrationRequest
                                            try {
                                                // Build businessAddress from shop address (Step 1)
                                                const businessAddress = `${detailAddress.trim()}, ${wardName}, ${districtName}, ${provinceName}`.trim();

                                                // Validate all required fields before sending
                                                if (!provinceId || !districtId || !wardCode || !detailAddress.trim()) {
                                                    alert("Dữ liệu địa chỉ không đầy đủ. Vui lòng chọn lại địa chỉ.");
                                                    return;
                                                }

                                                const fullPayload = {
                                                    roleRequest: {
                                                        role: "SHOP_OWNER",
                                                        reason: shopInfo.reason.trim() || "Đăng ký bán hàng trên Vibe"
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
                                                console.error("❌ Error response:", error.response);
                                                console.error("❌ Error data:", error.response?.data);

                                                // Extract detailed error message
                                                let errorMsg = "Đã xảy ra lỗi";

                                                if (error.response?.data) {
                                                    const errData = error.response.data;

                                                    // Check for validation errors
                                                    if (errData.errors && Array.isArray(errData.errors)) {
                                                        errorMsg = errData.errors.map(e => `${e.field}: ${e.message}`).join('\n');
                                                    }
                                                    // Check for single error message
                                                    else if (errData.message) {
                                                        errorMsg = errData.message;
                                                    }
                                                    // Check for error field
                                                    else if (errData.error) {
                                                        errorMsg = errData.error;
                                                    }
                                                    // Fallback to stringified data
                                                    else {
                                                        errorMsg = JSON.stringify(errData);
                                                    }
                                                } else if (error.message) {
                                                    errorMsg = error.message;
                                                }

                                                alert(`❌ Đăng ký thất bại:\n\n${errorMsg}\n\nVui lòng kiểm tra console để xem chi tiết.`);
                                            }
                                        } else {
                                            // Chuyển sang bước tiếp theo
                                            const next = currentStep + 1;
                                            setCurrentStep(next);
                                        }
                                    }}
                                    className="btn-primary px-10"
                                >
                                    {currentStep === 3 ? t('roleRequest.buttons.complete') : t('roleRequest.buttons.next')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* ===== MODAL ĐỊA CHỈ (GHN) - STEP 1 ===== */}
            {showAddressModal && (
                <div className="shopee-modal-overlay">
                    <div className="shopee-modal-container animate-scale-up">
                        <div className="shopee-modal-header">
                            <span className="modal-title">{t('roleRequest.modal.addAddress')}</span>
                            <span className="modal-close-icon" onClick={() => setShowAddressModal(false)}>&times;</span>
                        </div>

                        <div className="shopee-modal-body">
                            <div className="modal-row-flex">
                                <div className="modal-input-wrapper">
                                    <label className="modal-inner-label">{t('roleRequest.modal.fullName')}</label>
                                    <input type="text" placeholder={t('roleRequest.modal.enterValue')} className="modal-input-clean" />
                                </div>
                                <div className="modal-input-wrapper">
                                    <label className="modal-inner-label">{t('roleRequest.modal.phone')}</label>
                                    <input type="text" placeholder={t('roleRequest.modal.enterValue')} className="modal-input-clean" />
                                </div>
                            </div>

                            <div className="modal-section">
                                <div className="modal-label-bold">{t('roleRequest.modal.address')}</div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                    <select className="shopee-input" value={provinceId || ''} onChange={handleProvinceChange} disabled={loadingProvinces}>
                                        <option value="">{loadingProvinces ? t('roleRequest.loading') : t('roleRequest.selectProvince')}</option>
                                        {provinces.map(p => <option key={p.ProvinceID} value={p.ProvinceID}>{p.ProvinceName}</option>)}
                                    </select>

                                    <select className="shopee-input" value={districtId || ''} onChange={handleDistrictChange} disabled={!provinceId || loadingDistricts}>
                                        <option value="">{loadingDistricts ? t('roleRequest.loading') : t('roleRequest.selectDistrict')}</option>
                                        {districts.map(d => <option key={d.DistrictID} value={d.DistrictID}>{d.DistrictName}</option>)}
                                    </select>

                                    <select className="shopee-input" value={wardCode || ''} onChange={handleWardChange} disabled={!districtId || loadingWards}>
                                        <option value="">{loadingWards ? t('roleRequest.loading') : t('roleRequest.selectWard')}</option>
                                        {wards.map(w => <option key={w.WardCode} value={w.WardCode}>{w.WardName}</option>)}
                                    </select>
                                </div>

                                <div style={{ marginTop: 10, fontSize: 13, color: '#999' }}>
                                    {provinceName || districtName || wardName
                                        ? `${provinceName}${districtName ? ' / ' + districtName : ''}${wardName ? ' / ' + wardName : ''}`
                                        : t('roleRequest.modal.addressPlaceholder')}
                                </div>
                            </div>

                            <div className="modal-section">
                                <div className="modal-label-bold">{t('roleRequest.modal.detailAddress')}</div>
                                <textarea
                                    value={detailAddress}
                                    onChange={(e) => setDetailAddress(e.target.value)}
                                    placeholder={t('roleRequest.modal.detailPlaceholder')}
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
                                        <div className="loc-title">{locating ? t('roleRequest.modal.locating') : t('roleRequest.modal.locate')}</div>
                                        <div className="loc-desc">
                                            {coords ? `Lat: ${coords.lat.toFixed(6)} - Lng: ${coords.lng.toFixed(6)}` : t('roleRequest.modal.locateHelp')}
                                        </div>
                                    </div>
                                </div>
                                <div className="loc-arrow">›</div>
                            </div>
                        </div>

                        <div className="shopee-modal-footer">
                            <button onClick={() => setShowAddressModal(false)} className="btn-modal-cancel">{t('roleRequest.buttons.cancel')}</button>
                            <button onClick={handleSaveAddress} className="btn-modal-submit">{t('roleRequest.buttons.save')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const FormGroup = ({ label, children, required, count }) => (
    <div style={{ display: 'flex', marginBottom: '24px' }}>
        <div style={{ width: '180px', textAlign: 'right', paddingRight: '20px', paddingTop: '10px', fontSize: '14px', color: '#555' }}>
            {required && <span style={{ color: '#ee4d2d', marginRight: '4px' }}>*</span>}{label}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
            {children}
            {count && <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '12px', color: '#ccc' }}>{count}</span>}
        </div>
    </div>
);

export default RegisterShopOwner;
