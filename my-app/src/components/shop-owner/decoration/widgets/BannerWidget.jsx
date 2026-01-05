import React, { useState } from 'react';
import { Form, Button, Row, Col, Image, Spinner, Card } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { uploadImage, getImageUrl } from '../../../../api/image';

const BannerWidget = ({ data, onChange }) => {
    const { t } = useTranslation();
    const [uploadingIndex, setUploadingIndex] = useState(null);
    const images = data.images || [];

    const handleAddImage = () => {
        onChange({ ...data, images: [...images, { imageId: '' }] });
    };

    const handleSettingChange = (field, value) => {
        onChange({ ...data, [field]: value });
    };

    const handleRemoveImage = (index) => {
        const newImages = images.filter((_, i) => i !== index);
        onChange({ ...data, images: newImages });
    };

    const handleImageChange = (index, field, value) => {
        const newImages = [...images];
        newImages[index][field] = value;
        onChange({ ...data, images: newImages });
    };

    const handleFileUpload = async (index, e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingIndex(index);
        try {
            const imageId = await uploadImage(file);
            if (imageId) {
                handleImageChange(index, 'imageId', imageId);
                toast.success(t('shopOwner.decoration.savedSuccess'));
            }
        } catch (error) {
            console.error(error);
            toast.error(t('shopOwner.decoration.saveFailed'));
        } finally {
            setUploadingIndex(null);
            e.target.value = '';
        }
    };

    return (
        <div className="p-2">
            <h5 className="mb-1 fw-bold text-primary">
                <i className="bi bi-images me-2"></i>
                {t('shopOwner.decoration.widgets.bannerTitle')}
            </h5>
            <div className="text-muted small mb-3 fst-italic">
                {t('shopOwner.decoration.widgets.bannerSizeHint')}
            </div>


            <div className="card p-3 mb-3 bg-light">
                <Form.Group className="mb-3">
                    <Form.Label className="fw-bold small">{t('shopOwner.decoration.widgets.bannerHeight')} ({data.height || 400}px)</Form.Label>
                    <Form.Range
                        min={100}
                        max={1000}
                        step={10}
                        value={data.height || 400}
                        onChange={(e) => handleSettingChange('height', parseInt(e.target.value))}
                    />
                </Form.Group>
                <Form.Group>
                    <Form.Label className="fw-bold small">{t('shopOwner.decoration.widgets.imageFit')}</Form.Label>
                    <Form.Select
                        size="sm"
                        value={data.objectFit || 'cover'}
                        onChange={(e) => handleSettingChange('objectFit', e.target.value)}
                    >
                        <option value="cover">{t('shopOwner.decoration.widgets.fitCover')}</option>
                        <option value="contain">{t('shopOwner.decoration.widgets.fitContain')}</option>
                        <option value="fill">{t('shopOwner.decoration.widgets.fitFill')}</option>
                    </Form.Select>
                </Form.Group>
            </div>

            <div className="d-flex flex-column gap-3 mb-3">
                {images.map((img, index) => (
                    <Card key={index} className="border shadow-sm">
                        <Card.Header className="d-flex justify-content-between align-items-center bg-light py-2">
                            <span className="fw-bold text-secondary">
                                <i className="bi bi-image me-1"></i> Slide #{index + 1}
                            </span>
                            <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleRemoveImage(index)}
                                className="px-2 py-0"
                            >
                                <i className="bi bi-x-lg"></i>
                            </Button>
                        </Card.Header>
                        <Card.Body>
                            <Row className="g-3">
                                {/* Image Preview Section */}
                                <Col md={4} className="d-flex align-items-center justify-content-center">
                                    <div className="position-relative w-100" style={{ minHeight: '140px' }}>
                                        {img.imageId ? (
                                            <div className="border rounded overflow-hidden shadow-sm h-100">
                                                <Image
                                                    src={getImageUrl(img.imageId)}
                                                    fluid
                                                    style={{ width: '100%', height: '140px', objectFit: 'cover' }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="d-flex flex-column align-items-center justify-content-center h-100 border border-2 border-dashed rounded bg-light text-muted p-3">
                                                <i className="bi bi-image fs-1 mb-2 opacity-50"></i>
                                                <small>{t('shopOwner.decoration.widgets.noImage')}</small>
                                            </div>
                                        )}
                                    </div>
                                </Col>

                                {/* Inputs Section */}
                                <Col md={8}>
                                    <Form.Group className="mb-3">
                                        <div className="d-flex align-items-center">
                                            <div className="position-relative w-100">
                                                <input
                                                    type="file"
                                                    id={`file-upload-${index}`}
                                                    className="d-none"
                                                    accept="image/*"
                                                    onChange={(e) => handleFileUpload(index, e)}
                                                />
                                                <label
                                                    htmlFor={`file-upload-${index}`}
                                                    className={`btn btn-outline-primary w-100 d-flex align-items-center justify-content-center gap-2 ${uploadingIndex === index ? 'disabled' : ''}`}
                                                >
                                                    {uploadingIndex === index ? (
                                                        <Spinner animation="border" size="sm" />
                                                    ) : (
                                                        <><i className="bi bi-upload"></i> {t('shopOwner.decoration.widgets.imageUrl') || 'Select Image'}</>
                                                    )}
                                                </label>
                                            </div>
                                        </div>
                                    </Form.Group>

                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                ))}
            </div>

            <Button
                variant="outline-primary"
                className="w-100 border-2 border-dashed py-2 fw-bold text-uppercase"
                onClick={handleAddImage}
                style={{ letterSpacing: '0.5px' }}
            >
                <i className="bi bi-plus-circle me-2"></i> {t('shopOwner.decoration.widgets.addSlide')}
            </Button>
        </div>
    );
};

export default BannerWidget;
