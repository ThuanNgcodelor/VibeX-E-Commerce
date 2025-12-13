import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getShopOwnerInfo, updateShopOwner } from '../../api/user';
import { getProvinces, getDistricts, getWards } from '../../api/ghn';
import '../../components/shop-owner/ShopOwnerLayout.css';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({
    shopName: '',
    ownerName: '',
    email: '',
    address: '',
    // GHN Address Fields
    phone: '',
    provinceId: null,
    provinceName: '',
    districtId: null,
    districtName: '',
    wardCode: '',
    wardName: '',
    streetAddress: ''
  });

  const [shopStats, setShopStats] = useState({
    verified: false,
    totalRatings: 0,
    followersCount: 0,
    followingCount: 0,
    createdAt: null,
    updatedAt: null
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errors, setErrors] = useState({});

  // GHN Location Data
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  // Load shop owner information
  useEffect(() => {
    const loadShopOwnerInfo = async () => {
      try {
        setInitialLoading(true);
        const data = await getShopOwnerInfo();

        setSettings({
          shopName: data.shopName || '',
          ownerName: data.ownerName || '',
          email: data.email || '',
          address: data.address || '',
          // GHN Address Fields
          phone: data.phone || '',
          provinceId: data.provinceId || null,
          provinceName: data.provinceName || '',
          districtId: data.districtId || null,
          districtName: data.districtName || '',
          wardCode: data.wardCode || '',
          wardName: data.wardName || '',
          streetAddress: data.streetAddress || ''
        });

        // Load districts and wards if province/district already set
        if (data.provinceId) {
          await loadDistricts(data.provinceId);
          if (data.districtId) {
            await loadWards(data.districtId);
          }
        }

        setShopStats({
          verified: data.verified || false,
          totalRatings: data.totalRatings || 0,
          followersCount: data.followersCount || 0,
          followingCount: data.followingCount || 0,
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null
        });

        // Load image if exists
        if (data.imageUrl) {
          setImagePreview(`/v1/file-storage/get/${data.imageUrl}`);
        }
      } catch (error) {
        console.error('Error loading shop owner info:', error);
        alert(t('shopOwner.settings.loadFailed'));
      } finally {
        setInitialLoading(false);
      }
    };

    loadShopOwnerInfo();
    loadProvinces();
  }, [t]);

  // Load GHN Provinces
  const loadProvinces = async () => {
    try {
      setLoadingProvinces(true);
      const data = await getProvinces();
      setProvinces(data || []);
    } catch (err) {
      console.error('Error loading provinces:', err);
    } finally {
      setLoadingProvinces(false);
    }
  };

  // Load Districts when province changes
  const loadDistricts = async (provinceId) => {
    if (!provinceId) {
      setDistricts([]);
      setWards([]);
      return;
    }

    try {
      setLoadingDistricts(true);
      const data = await getDistricts(provinceId);
      setDistricts(data || []);
      setWards([]);
    } catch (err) {
      console.error('Error loading districts:', err);
    } finally {
      setLoadingDistricts(false);
    }
  };

  // Load Wards when district changes
  const loadWards = async (districtId) => {
    if (!districtId) {
      setWards([]);
      return;
    }

    try {
      setLoadingWards(true);
      const data = await getWards(districtId);
      setWards(data || []);
    } catch (err) {
      console.error('Error loading wards:', err);
    } finally {
      setLoadingWards(false);
    }
  };

  const handleProvinceChange = async (e) => {
    const provinceId = parseInt(e.target.value);
    const selectedProvince = provinces.find(p => p.ProvinceID === provinceId);

    setSettings(prev => ({
      ...prev,
      provinceId: provinceId || null,
      provinceName: selectedProvince ? selectedProvince.ProvinceName : '',
      districtId: null,
      districtName: '',
      wardCode: '',
      wardName: ''
    }));

    await loadDistricts(provinceId);
  };

  const handleDistrictChange = async (e) => {
    const districtId = parseInt(e.target.value);
    const selectedDistrict = districts.find(d => d.DistrictID === districtId);

    setSettings(prev => ({
      ...prev,
      districtId: districtId || null,
      districtName: selectedDistrict ? selectedDistrict.DistrictName : '',
      wardCode: '',
      wardName: ''
    }));

    await loadWards(districtId);
  };

  const handleWardChange = (e) => {
    const wardCode = e.target.value;
    const selectedWard = wards.find(w => w.WardCode === wardCode);

    setSettings(prev => ({
      ...prev,
      wardCode: wardCode || '',
      wardName: selectedWard ? selectedWard.WardName : ''
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];

    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(t('shopOwner.settings.selectImageFile'));
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert(t('shopOwner.settings.imageSizeLimit'));
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setImageFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview('');
    setImageFile(null);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!settings.shopName.trim()) {
      newErrors.shopName = t('shopOwner.settings.shopNameRequired');
    } else if (settings.shopName.trim().length < 2) {
      newErrors.shopName = t('shopOwner.settings.shopNameMinLength');
    }

    if (!settings.ownerName.trim()) {
      newErrors.ownerName = t('shopOwner.settings.ownerNameRequired');
    } else if (settings.ownerName.trim().length < 2) {
      newErrors.ownerName = t('shopOwner.settings.ownerNameMinLength');
    }

    if (!settings.email.trim()) {
      newErrors.email = t('shopOwner.settings.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
      newErrors.email = t('shopOwner.settings.emailInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      alert(t('shopOwner.settings.fillRequired'));
      return;
    }

    setLoading(true);

    try {
      await updateShopOwner(settings, imageFile);
      alert(t('shopOwner.settings.saveSuccess'));
    } catch (error) {
      console.error('Error updating settings:', error);
      alert(error.message || t('shopOwner.settings.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>{t('shopOwner.settings.title')}</h1>
        </div>
        <div className="text-center py-5">
          <i className="fas fa-spinner fa-spin fa-3x" style={{ color: '#ee4d2d' }}></i>
          <p className="mt-3">{t('shopOwner.settings.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>{t('shopOwner.settings.title')}</h1>
      </div>

      {/* Shop Statistics Cards */}


      <div className="orders-table">
        <div className="table-header">
          <div className="table-title">{t('shopOwner.settings.shopInformation')}</div>
          {shopStats.createdAt && (
            <small className="text-muted">
              {t('shopOwner.settings.shopCreated')} {new Date(shopStats.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </small>
          )}
        </div>

        <div style={{ padding: '20px' }}>
          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-md-8">
                <h5 className="mb-3" style={{ color: '#ee4d2d' }}>{t('shopOwner.settings.basicInformation')}</h5>

                <div className="mb-3">
                  <label className="form-label">{t('shopOwner.settings.shopName')} <span style={{ color: 'red' }}>{t('shopOwner.settings.required')}</span></label>
                  <input
                    type="text"
                    className={`form-control ${errors.shopName ? 'is-invalid' : ''}`}
                    name="shopName"
                    value={settings.shopName}
                    onChange={handleInputChange}
                    placeholder={t('shopOwner.settings.shopName')}
                  />
                  {errors.shopName && <div className="invalid-feedback">{errors.shopName}</div>}
                </div>

                <div className="mb-3">
                  <label className="form-label">{t('shopOwner.settings.ownerName')} <span style={{ color: 'red' }}>{t('shopOwner.settings.required')}</span></label>
                  <input
                    type="text"
                    className={`form-control ${errors.ownerName ? 'is-invalid' : ''}`}
                    name="ownerName"
                    value={settings.ownerName}
                    onChange={handleInputChange}
                    placeholder={t('shopOwner.settings.ownerName')}
                  />
                  {errors.ownerName && <div className="invalid-feedback">{errors.ownerName}</div>}
                </div>

                <div className="mb-3">
                  <label className="form-label">{t('shopOwner.settings.email')} <span style={{ color: 'red' }}>{t('shopOwner.settings.required')}</span></label>
                  <input
                    type="email"
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                    name="email"
                    value={settings.email}
                    onChange={handleInputChange}
                    placeholder={t('shopOwner.settings.email')}
                  />
                  {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                </div>

                <div className="mb-3">
                  <label className="form-label">{t('shopOwner.settings.phone')} <span style={{ color: 'red' }}>{t('shopOwner.settings.required')}</span></label>
                  <input
                    type="tel"
                    className="form-control"
                    name="phone"
                    value={settings.phone}
                    onChange={handleInputChange}
                    placeholder={t('shopOwner.settings.phone')}
                  />
                  <small className="text-muted">{t('shopOwner.settings.phoneRequired')}</small>
                </div>

                <hr style={{ margin: '20px 0' }} />

                <h6 className="mb-3" style={{ color: '#ee4d2d' }}>{t('shopOwner.settings.shopAddress')}</h6>
                <small className="text-muted mb-3 d-block">{t('shopOwner.settings.addressHint')}</small>

                <div className="mb-3">
                  <label className="form-label">{t('shopOwner.settings.province')}</label>
                  <select
                    className="form-control"
                    value={settings.provinceId || ''}
                    onChange={handleProvinceChange}
                    disabled={loadingProvinces}
                  >
                    <option value="">{t('shopOwner.settings.selectProvince')}</option>
                    {provinces.map(province => (
                      <option key={province.ProvinceID} value={province.ProvinceID}>
                        {province.ProvinceName}
                      </option>
                    ))}
                  </select>
                  {loadingProvinces && <small className="text-muted">{t('shopOwner.settings.loadingProvinces')}</small>}
                </div>

                <div className="mb-3">
                  <label className="form-label">{t('shopOwner.settings.district')}</label>
                  <select
                    className="form-control"
                    value={settings.districtId || ''}
                    onChange={handleDistrictChange}
                    disabled={!settings.provinceId || loadingDistricts}
                  >
                    <option value="">{t('shopOwner.settings.selectDistrict')}</option>
                    {districts.map(district => (
                      <option key={district.DistrictID} value={district.DistrictID}>
                        {district.DistrictName}
                      </option>
                    ))}
                  </select>
                  {loadingDistricts && <small className="text-muted">{t('shopOwner.settings.loadingDistricts')}</small>}
                </div>

                <div className="mb-3">
                  <label className="form-label">{t('shopOwner.settings.ward')}</label>
                  <select
                    className="form-control"
                    value={settings.wardCode || ''}
                    onChange={handleWardChange}
                    disabled={!settings.districtId || loadingWards}
                  >
                    <option value="">{t('shopOwner.settings.selectWard')}</option>
                    {wards.map(ward => (
                      <option key={ward.WardCode} value={ward.WardCode}>
                        {ward.WardName}
                      </option>
                    ))}
                  </select>
                  {loadingWards && <small className="text-muted">{t('shopOwner.settings.loadingWards')}</small>}
                </div>

                <div className="mb-3">
                  <label className="form-label">{t('shopOwner.settings.streetAddress')} <span style={{ color: 'red' }}>{t('shopOwner.settings.required')}</span></label>
                  <textarea
                    className="form-control"
                    name="streetAddress"
                    value={settings.streetAddress}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder={t('shopOwner.settings.streetAddressPlaceholder')}
                  />
                  <small className="text-muted">{t('shopOwner.settings.streetAddressRequired')}</small>
                </div>

                <div className="mb-3">
                  <label className="form-label">{t('shopOwner.settings.addressLegacy')}</label>
                  <textarea
                    className="form-control"
                    name="address"
                    value={settings.address}
                    onChange={handleInputChange}
                    rows="2"
                    placeholder={t('shopOwner.settings.addressLegacyPlaceholder')}
                  />
                  <small className="text-muted">{t('shopOwner.settings.addressLegacyHint')}</small>
                </div>
              </div>

              <div className="col-md-4">
                <h5 className="mb-3" style={{ color: '#ee4d2d' }}>{t('shopOwner.settings.shopLogo')}</h5>

                <div className="mb-3">
                  <label className="form-label">{t('shopOwner.settings.uploadImage')}</label>
                  <input
                    type="file"
                    className="form-control"
                    onChange={handleImageChange}
                    accept="image/*"
                  />
                  <small className="text-muted">{t('shopOwner.settings.maxSize')}</small>
                </div>

                {imagePreview && (
                  <div className="position-relative mb-3">
                    <img
                      src={imagePreview}
                      alt="Shop logo preview"
                      style={{
                        width: '100%',
                        maxHeight: '250px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '2px solid #e0e0e0'
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px'
                      }}
                      onClick={removeImage}
                    >
                      <i className="fas fa-times"></i> {t('shopOwner.settings.remove')}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <hr style={{ margin: '30px 0' }} />

            <div style={{ marginTop: '30px' }}>
              <button
                type="submit"
                className="btn btn-primary-shop"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> {t('shopOwner.settings.saving')}
                  </>
                ) : (
                  <>
                    <i className="fas fa-save"></i> {t('shopOwner.settings.saveSettings')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
