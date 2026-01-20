import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, ListGroup, Image, Spinner, InputGroup } from 'react-bootstrap';
import { fetchProducts } from '../../../api/product';
import { getImageUrl } from '../../../api/image';

const ProductSelectorModal = ({ show, onHide, onSelect, initialSelectedIds = [] }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds));

    useEffect(() => {
        if (show) {
            loadProducts();
            setSelectedIds(new Set(initialSelectedIds));
        }
    }, [show]);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const res = await fetchProducts();
            const productList = Array.isArray(res) ? res : (res.data || []);
            setProducts(productList);
        } catch (error) {
            console.error("Failed to load products", error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleConfirm = () => {
        onSelect(Array.from(selectedIds));
        onHide();
    };

    const filteredProducts = products.filter(p =>
        p.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Modal show={show} onHide={onHide} size="lg" scrollable>
            <Modal.Header closeButton>
                <Modal.Title>Select Products</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <InputGroup className="mb-3">
                    <InputGroup.Text>
                        <i className="bi bi-search"></i>
                    </InputGroup.Text>
                    <Form.Control
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </InputGroup>

                {loading ? (
                    <div className="text-center py-4">
                        <Spinner animation="border" />
                    </div>
                ) : (
                    <ListGroup variant="flush">
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map(product => (
                                <ListGroup.Item
                                    key={product.id}
                                    action
                                    onClick={() => handleToggle(product.id)}
                                    className="d-flex align-items-center gap-3"
                                >
                                    <Form.Check
                                        type="checkbox"
                                        checked={selectedIds.has(product.id)}
                                        readOnly
                                        style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                                    />
                                    <Image
                                        src={getImageUrl(product.imageId) || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%2250%22%20height%3D%2250%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2050%2050%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_1%20text%20%7B%20fill%3A%23999%3Bfont-weight%3Anormal%3Bfont-family%3AHelvetica%2C%20monospace%3Bfont-size%3A10pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_1%22%3E%3Crect%20width%3D%2250%22%20height%3D%2250%22%20fill%3D%22%23eee%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%2212%22%20y%3D%2230%22%3EImg%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E'}
                                        rounded
                                        style={{ width: '50px', height: '50px', objectFit: 'cover', objectPosition: 'center' }}
                                    />
                                    <div className="flex-grow-1">
                                        <div className="fw-bold">{product.name || product.productName}</div>
                                        <small className="text-muted">ID: {product.id}</small>
                                        <div className="text-primary small">
                                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price || 0)}
                                        </div>
                                    </div>
                                </ListGroup.Item>
                            ))
                        ) : (
                            <div className="text-center text-muted py-4">
                                No products found
                            </div>
                        )}
                    </ListGroup>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={handleConfirm}>
                    Confirm ({selectedIds.size})
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ProductSelectorModal;
