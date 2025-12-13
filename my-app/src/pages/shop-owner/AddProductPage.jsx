import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { addProduct, getProductById, updateProduct } from '../../api/shopOwner';
import categoryApi from '../../api/categoryApi';
import { getCommonAttributeKeys, translateAttributeName } from '../../utils/attributeTranslator';
import '../../components/shop-owner/ShopOwnerLayout.css';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function AddProductPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id: productId } = useParams();
    const isEditMode = Boolean(productId);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        originalPrice: '',
        discountPercent: '',
        categoryId: '',
        status: 'IN_STOCK',
        sizes: [
            {
                name: '',
                description: '',
                stock: '',
                priceModifier: ''
            }
        ],
        images: []
    });

    const [imagePreviews, setImagePreviews] = useState([]);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);

    // Dynamic Attributes
    const [attributes, setAttributes] = useState([{ key: '', value: '' }]);

    const addAttribute = () => {
        setAttributes([...attributes, { key: '', value: '' }]);
    };

    const removeAttribute = (index) => {
        const list = [...attributes];
        list.splice(index, 1);
        setAttributes(list);
    };

    const handleAttributeChange = (index, field, value) => {
        const list = [...attributes];
        list[index][field] = value;
        setAttributes(list);
    };

    // Get common attributes for dropdown
    const commonAttributes = useMemo(() => getCommonAttributeKeys(), []);
    const [initialLoading, setInitialLoading] = useState(false);

    const quillModules = useMemo(() => ({
        toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ color: [] }, { background: [] }],
            [{ align: [] }],
            ['link', 'image'],
            ['clean'],
        ],
    }), []);

    const quillFormats = useMemo(() => [
        'header',
        'bold', 'italic', 'underline', 'strike',
        'list', 'bullet',
        'color', 'background',
        'align',
        'link', 'image'
    ], []);

    // Load categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const data = await categoryApi.getAll();
                setCategories(data);
            } catch (error) {
                console.error('Error fetching categories:', error);
                alert(t('shopOwner.addProduct.failedToLoadCategories'));
            }
        };

        fetchCategories();
    }, [t]);

    // Load product in edit mode
    useEffect(() => {
        if (!isEditMode) return;
        const loadProduct = async () => {
            try {
                setInitialLoading(true);
                const data = await getProductById(productId);
                setFormData({
                    name: data.name || '',
                    description: data.description || '',
                    price: data.price != null ? String(data.price) : '',
                    originalPrice: data.originalPrice != null ? String(data.originalPrice) : '',
                    discountPercent: data.discountPercent != null ? String(data.discountPercent) : '',
                    categoryId: data.categoryId != null ? String(data.categoryId) : '',
                    status: (data.status || 'IN_STOCK').toUpperCase(),
                    sizes: Array.isArray(data.sizes) && data.sizes.length > 0 ? data.sizes.map(s => ({
                        name: s.name || '',
                        description: s.description || '',
                        stock: s.stock != null ? String(s.stock) : '',
                        priceModifier: s.priceModifier != null ? String(s.priceModifier) : ''
                    })) : [{ name: '', description: '', stock: '', priceModifier: '' }],
                    images: [],
                    attributes: data.attributes || {}
                });

                // Load attributes grid
                if (data.attributes) {
                    const attrArray = Object.entries(data.attributes).map(([key, value]) => ({ key, value }));
                    if (attrArray.length > 0) {
                        setAttributes(attrArray);
                    }
                }

                // Load existing images for preview
                const previews = [];
                const allImageIds = [];
                if (data.imageId) allImageIds.push(data.imageId);
                if (Array.isArray(data.imageIds)) {
                    data.imageIds.forEach(imgId => {
                        if (imgId && !allImageIds.includes(imgId)) {
                            allImageIds.push(imgId);
                        }
                    });
                }
                allImageIds.forEach(imgId => {
                    if (imgId) previews.push(`/v1/file-storage/get/${imgId}`);
                });
                setImagePreviews(previews);
            } catch (e) {
                console.error('Error loading product:', e);
                alert(t('shopOwner.addProduct.failedToLoadProduct'));
                navigate('/shop-owner/products');
            } finally {
                setInitialLoading(false);
            }
        };
        loadProduct();
    }, [isEditMode, productId, navigate]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
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

    const handleDescriptionChange = (value) => {
        setFormData(prev => ({
            ...prev,
            description: value
        }));
        if (errors.description) {
            setErrors(prev => ({
                ...prev,
                description: ''
            }));
        }
    };

    const handleSizeChange = (index, field, value) => {
        const updatedSizes = [...formData.sizes];
        updatedSizes[index][field] = value;
        setFormData(prev => ({
            ...prev,
            sizes: updatedSizes
        }));
    };

    const addSize = () => {
        setFormData(prev => ({
            ...prev,
            sizes: [
                ...prev.sizes,
                {
                    name: '',
                    description: '',
                    stock: '',
                    priceModifier: ''
                }
            ]
        }));
    };

    const removeSize = (index) => {
        if (formData.sizes.length > 1) {
            const updatedSizes = formData.sizes.filter((_, i) => i !== index);
            setFormData(prev => ({
                ...prev,
                sizes: updatedSizes
            }));
        }
    };

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);

        if (files.length + imagePreviews.length > 10) {
            alert(t('shopOwner.addProduct.maximumImages'));
            return;
        }

        files.forEach(file => {
            // Accept both images and videos
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImagePreviews(prev => [...prev, reader.result]);
                    setFormData(prev => ({
                        ...prev,
                        images: [...prev.images, file]
                    }));
                };
                reader.readAsDataURL(file);
            } else {
                alert(t('shopOwner.addProduct.fileNotImageOrVideo', { name: file.name }));
            }
        });
    };

    const removeImage = (index) => {
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    const calculateDiscount = () => {
        const price = parseFloat(formData.price) || 0;
        const originalPrice = parseFloat(formData.originalPrice) || 0;

        if (originalPrice > 0 && price < originalPrice) {
            const discount = ((originalPrice - price) / originalPrice) * 100;
            setFormData(prev => ({
                ...prev,
                discountPercent: discount.toFixed(2)
            }));
        }
    };

    React.useEffect(() => {
        if (formData.price && formData.originalPrice) {
            calculateDiscount();
        }
    }, [formData.price, formData.originalPrice]);

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = t('shopOwner.addProduct.productNameRequired');
        }

        if (!formData.description.trim()) {
            newErrors.description = t('shopOwner.addProduct.descriptionRequired');
        }

        if (!formData.price || parseFloat(formData.price) <= 0) {
            newErrors.price = t('shopOwner.addProduct.invalidPrice');
        }

        if (!formData.status) {
            newErrors.status = t('shopOwner.addProduct.selectStatus');
        }

        if (formData.sizes.some(size => !size.name || !size.stock)) {
            newErrors.sizes = t('shopOwner.addProduct.fillAllSizes');
        }

        if (!isEditMode) {
            if (imagePreviews.length === 0) {
                newErrors.images = t('shopOwner.addProduct.addAtLeastOnePhoto');
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            alert(t('shopOwner.addProduct.fillAllInformation'));
            return;
        }

        setLoading(true);

        try {
            const sizesData = formData.sizes.map(size => ({
                name: size.name,
                description: size.description || '',
                stock: parseInt(size.stock) || 0,
                priceModifier: parseFloat(size.priceModifier) || 0
            }));

            const attributesMap = {};
            attributes.forEach(attr => {
                if (attr.key && attr.value) {
                    attributesMap[attr.key] = attr.value;
                }
            });

            const productData = {
                id: isEditMode ? productId : undefined,
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                originalPrice: parseFloat(formData.originalPrice) || parseFloat(formData.price),
                discountPercent: parseFloat(formData.discountPercent) || 0,
                // Category is optional: send null/undefined if not selected
                categoryId: formData.categoryId || null,
                status: (formData.status || 'IN_STOCK').toUpperCase(),
                sizes: sizesData,
                attributes: attributesMap
            };

            if (isEditMode) {
                await updateProduct(productData, formData.images);
                alert(t('shopOwner.addProduct.productUpdated'));
            } else {
                await addProduct(productData, formData.images);
                alert(t('shopOwner.addProduct.productCreated'));
            }
            navigate('/shop-owner/products');
        } catch (error) {
            console.error('Error creating product:', error);
            alert((isEditMode ? t('shopOwner.addProduct.errorUpdating') : t('shopOwner.addProduct.errorCreating')) + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>{isEditMode ? t('shopOwner.addProduct.editTitle') : t('shopOwner.addProduct.title')}</h1>
                        <p className="text-muted">{isEditMode ? t('shopOwner.addProduct.editSubtitle') : t('shopOwner.addProduct.subtitle')}</p>
                    </div>
                    <Link to="/shop-owner/products" className="btn btn-secondary-shop">
                        <i className="fas fa-arrow-left"></i> {t('shopOwner.addProduct.back')}
                    </Link>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="row">
                    <div className="col-md-8">
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <div className="card-header">
                                <h5><i className="fas fa-info-circle"></i> {t('shopOwner.addProduct.basicInformation')}</h5>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <label className="form-label">{t('shopOwner.addProduct.productName')} <span style={{ color: 'red' }}>*</span></label>
                                    <input
                                        type="text"
                                        className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        placeholder={t('shopOwner.addProduct.productName')}
                                    />
                                    {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">{t('shopOwner.addProduct.status')} <span style={{ color: 'red' }}>*</span></label>
                                    <select
                                        className={`form-select ${errors.status ? 'is-invalid' : ''}`}
                                        name="status"
                                        value={formData.status}
                                        onChange={handleInputChange}
                                    >
                                        <option value="IN_STOCK">{t('shopOwner.allProducts.inStock')}</option>
                                        <option value="OUT_OF_STOCK">{t('shopOwner.allProducts.outOfStock')}</option>
                                    </select>
                                    {errors.status && <div className="invalid-feedback">{errors.status}</div>}
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">
                                        {t('shopOwner.addProduct.productDescription')} <span style={{ color: 'red' }}>*</span>
                                    </label>
                                    <div className={`${errors.description ? 'is-invalid' : ''}`}>
                                        <ReactQuill
                                            theme="snow"
                                            value={formData.description}
                                            onChange={handleDescriptionChange}
                                            modules={quillModules}
                                            formats={quillFormats}
                                            placeholder={t('shopOwner.addProduct.descriptionPlaceholder')}
                                            style={{ background: '#fff' }}
                                        />
                                    </div>
                                    <small className="text-muted d-block mt-2">
                                        {t('shopOwner.addProduct.descriptionHint')}
                                    </small>
                                    {errors.description && <div className="text-danger mt-1">{errors.description}</div>}
                                </div>

                                <div className="row">
                                    <div className="col-md-6">
                                        <div className="mb-3">
                                            <label className="form-label">{t('shopOwner.addProduct.price')} <span style={{ color: 'red' }}>*</span></label>
                                            <input
                                                type="number"
                                                className={`form-control ${errors.price ? 'is-invalid' : ''}`}
                                                name="price"
                                                value={formData.price}
                                                onChange={handleInputChange}
                                                placeholder="0"
                                                min="0"
                                                step="1000"
                                            />
                                            {errors.price && <div className="invalid-feedback">{errors.price}</div>}
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="mb-3">
                                            <label className="form-label">{t('shopOwner.addProduct.originalPrice')}</label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                name="originalPrice"
                                                value={formData.originalPrice}
                                                onChange={handleInputChange}
                                                placeholder="0"
                                                min="0"
                                                step="1000"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {formData.discountPercent && parseFloat(formData.discountPercent) > 0 && (
                                    <div className="alert alert-info">
                                        <i className="fas fa-percent"></i> {t('shopOwner.addProduct.discount')}: {parseFloat(formData.discountPercent).toFixed(1)}%
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sizes & Variants */}
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <div className="card-header">
                                <h5><i className="fas fa-ruler"></i> {t('shopOwner.addProduct.sizesVariants')}</h5>
                            </div>
                            <div className="card-body">
                                {formData.sizes.map((size, index) => (
                                    <div key={index} className="border rounded p-3 mb-3" style={{ background: '#f8f9fa' }}>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <strong>{t('shopOwner.addProduct.variant', { number: index + 1 })}</strong>
                                            {formData.sizes.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => removeSize(index)}
                                                >
                                                    <i className="fas fa-trash"></i> {t('shopOwner.addProduct.remove')}
                                                </button>
                                            )}
                                        </div>
                                        <div className="row">
                                            <div className="col-md-6">
                                                <div className="mb-3">
                                                    <label className="form-label">{t('shopOwner.addProduct.sizeName')} <span style={{ color: 'red' }}>*</span></label>
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        value={size.name}
                                                        onChange={(e) => handleSizeChange(index, 'name', e.target.value)}
                                                        placeholder={t('shopOwner.addProduct.sizeNamePlaceholder')}
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="mb-3">
                                                    <label className="form-label">{t('shopOwner.addProduct.description')}</label>
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        value={size.description}
                                                        onChange={(e) => handleSizeChange(index, 'description', e.target.value)}
                                                        placeholder={t('shopOwner.addProduct.descriptionPlaceholder2')}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="row">
                                            <div className="col-md-6">
                                                <div className="mb-3">
                                                    <label className="form-label">{t('shopOwner.addProduct.stock')} <span style={{ color: 'red' }}>*</span></label>
                                                    <input
                                                        type="number"
                                                        className="form-control"
                                                        value={size.stock}
                                                        onChange={(e) => handleSizeChange(index, 'stock', e.target.value)}
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                            <div className="col-md-6">
                                                <div className="mb-3">
                                                    <label className="form-label">{t('shopOwner.addProduct.priceModifier')}</label>
                                                    <input
                                                        type="number"
                                                        className="form-control"
                                                        value={size.priceModifier}
                                                        onChange={(e) => handleSizeChange(index, 'priceModifier', e.target.value)}
                                                        placeholder="0"
                                                        step="1000"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    className="btn btn-outline-primary"
                                    onClick={addSize}
                                >
                                    <i className="fas fa-plus"></i> {t('shopOwner.addProduct.addVariant')}
                                </button>

                                {errors.sizes && (
                                    <div className="text-danger mt-2">{errors.sizes}</div>
                                )}
                            </div>
                        </div>

                        {/* Flexible Attributes (Specifications) */}
                        <div className="card mb-3">
                            <div className="card-header">
                                <h5><i className="fas fa-list"></i> {t('shopOwner.addProduct.specifications')}</h5>
                            </div>
                            <div className="card-body">
                                <div className="alert alert-light border">
                                    <small className="text-muted">{t('shopOwner.addProduct.specificationsHint')}</small>
                                </div>
                                {attributes.map((attr, index) => {
                                    // Check if this attribute key is already used by other attributes
                                    const usedKeys = attributes.map(a => a.key).filter((k, i) => i !== index && k);
                                    const availableAttributes = commonAttributes.filter(key => !usedKeys.includes(key));
                                    
                                    // Check if current key is in common list or empty
                                    const isCustomAttribute = attr.key && !commonAttributes.includes(attr.key);
                                    
                                    return (
                                        <div key={index} className="row mb-2 align-items-center">
                                            <div className="col-md-5">
                                                {isCustomAttribute ? (
                                                    // Show text input for custom attribute
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm"
                                                        placeholder={t('shopOwner.addProduct.attributeName')}
                                                        value={attr.key}
                                                        onChange={(e) => handleAttributeChange(index, 'key', e.target.value)}
                                                    />
                                                ) : (
                                                    // Show dropdown for common attributes
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={attr.key || ''}
                                                        onChange={(e) => {
                                                            const selectedValue = e.target.value;
                                                            if (selectedValue === '__custom__') {
                                                                // Switch to text input for custom attribute
                                                                handleAttributeChange(index, 'key', '');
                                                            } else {
                                                                handleAttributeChange(index, 'key', selectedValue);
                                                            }
                                                        }}
                                                    >
                                                        <option value="">{t('shopOwner.attributes.selectAttribute')}</option>
                                                        {availableAttributes.map(key => (
                                                            <option key={key} value={key}>
                                                                {translateAttributeName(key, t)}
                                                            </option>
                                                        ))}
                                                        <option value="__custom__">--- {t('shopOwner.attributes.customAttribute')} ---</option>
                                                    </select>
                                                )}
                                                {isCustomAttribute && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-link p-0 mt-1"
                                                        onClick={() => handleAttributeChange(index, 'key', '')}
                                                        style={{ fontSize: '0.75rem' }}
                                                    >
                                                        <i className="fas fa-arrow-left me-1"></i>
                                                        {t('common.back', 'Back to list')}
                                                    </button>
                                                )}
                                            </div>
                                            <div className="col-md-6">
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm"
                                                    placeholder={t('shopOwner.addProduct.value')}
                                                    value={attr.value}
                                                    onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                                                />
                                            </div>
                                            <div className="col-md-1 text-end">
                                                {attributes.length > 1 && (
                                                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeAttribute(index)}>
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                <button type="button" className="btn btn-sm btn-outline-primary mt-2" onClick={addAttribute}>
                                    <i className="fas fa-plus"></i> {t('shopOwner.addProduct.addAttribute')}
                                </button>
                            </div>
                        </div>

                        {/* Images */}
                        <div className="card">
                            <div className="card-header">
                                <h5><i className="fas fa-images"></i> {t('shopOwner.addProduct.productImages')}</h5>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <label className="form-label">{t('shopOwner.addProduct.chooseImages')}{isEditMode ? '' : ' '}<span style={{ color: 'red' }}>*</span></label>
                                    <input
                                        type="file"
                                        className="form-control"
                                        onChange={handleImageChange}
                                        accept="image/*,video/*"
                                        multiple
                                    />
                                    <small className="text-muted">{t('shopOwner.addProduct.imagesHint')}</small>
                                </div>

                                {errors.images && (
                                    <div className="text-danger mb-3">{errors.images}</div>
                                )}

                                {imagePreviews.length > 0 && (
                                    <div className="row">
                                        {imagePreviews.map((preview, index) => {
                                            const isVideo = preview.includes('video') || formData.images[index]?.type?.startsWith('video/');
                                            return (
                                                <div key={index} className="col-md-3 mb-3">
                                                    <div className="position-relative">
                                                        {isVideo ? (
                                                            <video
                                                                src={preview}
                                                                style={{
                                                                    width: '100%',
                                                                    aspectRatio: '1 / 1',
                                                                    objectFit: 'cover',
                                                                    borderRadius: '8px'
                                                                }}
                                                                muted
                                                            />
                                                        ) : (
                                                            <img
                                                                src={preview}
                                                                alt={`Preview ${index + 1}`}
                                                                style={{
                                                                    width: '100%',
                                                                    aspectRatio: '1 / 1',
                                                                    objectFit: 'cover',
                                                                    borderRadius: '8px'
                                                                }}
                                                            />
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-danger"
                                                            style={{
                                                                position: 'absolute',
                                                                top: '5px',
                                                                right: '5px'
                                                            }}
                                                            onClick={() => removeImage(index)}
                                                        >
                                                            <i className="fas fa-times"></i>
                                                        </button>
                                                        {index === 0 && (
                                                            <span
                                                                className="badge bg-primary"
                                                                style={{
                                                                    position: 'absolute',
                                                                    bottom: '5px',
                                                                    left: '5px',
                                                                    fontSize: '0.7rem'
                                                                }}
                                                            >
                                {t('shopOwner.addProduct.main')}
                              </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="col-md-4">
                        <div className="card" style={{ position: 'sticky', top: '20px' }}>
                            <div className="card-header">
                                <h5><i className="fas fa-cog"></i> {t('shopOwner.addProduct.options')}</h5>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <label className="form-label">{t('shopOwner.addProduct.category')}</label>
                                    <select
                                        className="form-select"
                                        name="categoryId"
                                        value={formData.categoryId}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">{t('shopOwner.addProduct.noCategory')}</option>
                                        {categories.map(category => (
                                            <option key={category.id} value={category.id}>
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <hr />

                                <div className="d-grid gap-2">
                                    <button
                                        type="submit"
                                        className="btn btn-primary-shop"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin"></i> {t('shopOwner.addProduct.saving')}
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-save"></i> {isEditMode ? t('shopOwner.addProduct.updateProduct') : t('shopOwner.addProduct.saveProduct')}
                                            </>
                                        )}
                                    </button>
                                    <Link to="/shop-owner/products" className="btn btn-secondary-shop">
                                        <i className="fas fa-times"></i> {t('shopOwner.addProduct.cancel')}
                                    </Link>
                                </div>

                                <div className="mt-3">
                                    <small className="text-muted">
                                        <i className="fas fa-info-circle"></i> {t('shopOwner.addProduct.requiredFields')} <span style={{ color: 'red' }}>*</span> {t('shopOwner.addProduct.areRequired')}
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}