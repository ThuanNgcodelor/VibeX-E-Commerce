import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col, Badge } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import ProductSelectorModal from '../ProductSelectorModal';
import { fetchProducts } from '../../../../api/product';

const ProductsWidget = ({ data, onChange }) => {
    const { t } = useTranslation();
    const [showModal, setShowModal] = useState(false);
    const [previewProducts, setPreviewProducts] = useState([]);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Initial load of product details for preview if IDs exist
    useEffect(() => {
        if (data.productIds && data.productIds.length > 0) {
            loadPreviewProducts(data.productIds);
        } else {
            setPreviewProducts([]);
        }
    }, [data.productIds]);

    const loadPreviewProducts = async (ids) => {
        setLoadingPreview(true);
        try {
            // Ideally we should have an API to fetch by list of IDs, 
            // but for now we might fetch all and filter, or fetch individually.
            // Assuming fetchProducts returns all shop products for now (simplest integration)
            const res = await fetchProducts();
            const allProducts = Array.isArray(res) ? res : (res.data || []);
            const validProducts = allProducts.filter(p => ids.includes(p.id));
            setPreviewProducts(validProducts);
        } catch (error) {
            console.error("Failed to load preview products", error);
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleSelectProducts = (selectedIds) => {
        onChange({ ...data, productIds: selectedIds });
    };

    const handleRemoveProduct = (id) => {
        const newIds = (data.productIds || []).filter(pid => pid !== id);
        onChange({ ...data, productIds: newIds });
    };

    return (
        <div className="p-2">
            <h5 className="mb-3 fw-bold text-primary">
                <i className="bi bi-grid-3x3-gap me-2"></i>
                {t('shopOwner.decoration.widgets.productListTitle')}
            </h5>

            <Form.Group className="mb-3">
                <Form.Label className="small fw-bold text-muted">{t('shopOwner.decoration.widgets.title')}</Form.Label>
                <Form.Control
                    type="text"
                    value={data.title || ''}
                    placeholder={t('shopOwner.decoration.defaultCollectionTitle')}
                    onChange={(e) => onChange({ ...data, title: e.target.value })}
                />
            </Form.Group>

            <div className="d-flex justify-content-between align-items-center mb-2">
                <Form.Label className="small fw-bold text-muted mb-0">
                    {t('shopOwner.decoration.widgets.productsSelected')} ({data.productIds?.length || 0})
                </Form.Label>
                <Button variant="outline-primary" size="sm" onClick={() => setShowModal(true)}>
                    <i className="bi bi-plus-lg me-1"></i> {t('shopOwner.decoration.widgets.selectProducts') || "Select Products"}
                </Button>
            </div>

            {/* Product Preview Grid */}
            <div className="bg-light p-3 rounded border" style={{ minHeight: '100px' }}>
                {data.productIds?.length > 0 ? (
                    <Row className="g-2">
                        {previewProducts.map(product => (
                            <Col xs={4} sm={3} key={product.id}>
                                <Card className="h-100 shadow-sm border-0 position-relative">
                                    <div
                                        className="position-absolute top-0 end-0 p-1"
                                        style={{ cursor: 'pointer', zIndex: 10 }}
                                        onClick={() => handleRemoveProduct(product.id)}
                                    >
                                        <Badge bg="danger" pill className="shadow-sm">
                                            <i className="bi bi-x"></i>
                                        </Badge>
                                    </div>
                                    <div style={{ paddingBottom: '100%', position: 'relative' }}>
                                        <Card.Img
                                            variant="top"
                                            src={product.imageId ? `http://localhost:8080/v1/file-storage/get/${product.imageId}` : 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22150%22%20height%3D%22150%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20150%20150%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_1%20text%20%7B%20fill%3A%23999%3Bfont-weight%3Anormal%3Bfont-family%3AHelvetica%2C%20monospace%3Bfont-size%3A10pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_1%22%3E%3Crect%20width%3D%22150%22%20height%3D%22150%22%20fill%3D%22%23eee%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%2258%22%20y%3D%2280%22%3EProduct%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E'}
                                            className="position-absolute top-0 start-0 w-100 h-100"
                                            style={{ objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div className="p-1 px-2 small text-truncate fw-bold">
                                        {product.name || product.productName}
                                    </div>
                                </Card>
                            </Col>
                        ))}
                        {loadingPreview && (
                            <div className="w-100 text-center py-2 text-muted">
                                Loading preview...
                            </div>
                        )}
                    </Row>
                ) : (
                    <div className="text-center text-muted py-4 d-flex flex-column align-items-center">
                        <i className="bi bi-basket fs-1 mb-2 opacity-50"></i>
                        <small>{t('shopOwner.decoration.widgets.noProductsSelected') || "No products selected"}</small>
                        <Button variant="link" size="sm" onClick={() => setShowModal(true)}>
                            {t('shopOwner.decoration.widgets.chooseNow') || "Choose now"}
                        </Button>
                    </div>
                )}
            </div>

            <ProductSelectorModal
                show={showModal}
                onHide={() => setShowModal(false)}
                onSelect={handleSelectProducts}
                initialSelectedIds={data.productIds || []}
            />
        </div>
    );
};

export default ProductsWidget;
