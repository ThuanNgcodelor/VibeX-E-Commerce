import React, { useEffect, useState } from "react";
import { getSuspiciousProducts, warnShop } from "../../api/adminAnalyticsApi"; // Adjust path if needed
import { Table, Button, Container, Card, Alert, Spinner, Modal, Row, Col, Badge, ListGroup } from "react-bootstrap";
import Swal from 'sweetalert2';
import { Link, useNavigate } from "react-router-dom";

const SuspiciousActivityPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const navigate = useNavigate();

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10); // Standard items per page

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getSuspiciousProducts();
            setProducts(data);
            setError(null);
            setCurrentPage(1); // Reset to first page on new data
        } catch (err) {
            setError("Failed to fetch suspicious activity data.");
        } finally {
            setLoading(false);
        }
    };

    const handleWarnShop = async (shopId) => {
        const result = await Swal.fire({
            title: 'Warn this shop?',
            text: "Are you sure you want to send a warning notification to this shop?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ffc107',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, warn them!',
            cancelButtonText: 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                await warnShop(shopId);
                Swal.fire(
                    'Sent!',
                    'Warning notification has been sent to the shop owner.',
                    'success'
                );
            } catch (err) {
                Swal.fire(
                    'Error!',
                    'Failed to send warning notification.',
                    'error'
                );
            }
        }
    };

    const handleViewDetails = (activity) => {
        setSelectedActivity(activity);
        setShowModal(true);
    };

    const handleVisitShop = (shopName) => {
        // Navigate to shop management with search query
        navigate(`/admin/shop-owners?search=${encodeURIComponent(shopName)}`);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedActivity(null);
    };

    const renderReasonBadge = (reason) => {
        if (!reason) return <span className="badge bg-secondary">Unknown</span>;
        if (reason.includes("Cancellation")) return <span className="badge bg-danger">Cancellation</span>;
        if (reason.includes("Brushing")) return <span className="badge bg-warning text-dark">Brushing (?)</span>;
        if (reason.includes("Price")) return <span className="badge bg-info text-dark">Price Manipulation</span>;
        return <span className="badge bg-secondary">{reason}</span>;
    };

    // Calculate Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentProducts = products.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(products.length / itemsPerPage);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    return (
        <Container fluid className="p-4">
            <h2 className="mb-4">Suspicious Activity Monitoring</h2>
            <p className="text-muted">
                Monitoring suspicious behaviors: High Cancellation Rate, Order Fraud (Brushing), and Price Manipulation.
            </p>

            {error && <Alert variant="danger">{error}</Alert>}

            <Card className="shadow-sm">
                <Card.Body>
                    {loading ? (
                        <div className="text-center p-4">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-2">Analyzing data...</p>
                        </div>
                    ) : (
                        <>
                            <Table striped bordered hover responsive>
                                <thead className="bg-light">
                                    <tr>
                                        <th>Product Data</th>
                                        <th>Reason</th>
                                        <th>Shop Owner</th>
                                        <th className="text-center">Total Orders</th>
                                        <th className="text-center">Cancelled</th>
                                        <th className="text-center">Rate (%)</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentProducts.length > 0 ? (
                                        currentProducts.map((item, index) => (
                                            <tr key={index}>
                                                <td>
                                                    <strong>{item.productName}</strong>
                                                    <br />
                                                    <small className="text-muted">ID: {item.productId}</small>
                                                </td>
                                                <td>
                                                    {renderReasonBadge(item.reason)}
                                                </td>
                                                <td>
                                                    {item.shopName || "Unknown"}
                                                    <br />
                                                    <small className="text-muted">ID: {item.shopId}</small>
                                                </td>
                                                <td className="text-center">{item.totalOrders}</td>
                                                <td className="text-center text-danger">{item.cancelledOrders}</td>
                                                <td className="text-center fw-bold">
                                                    {item.cancellationRate > 0 ? (
                                                        <span className={item.cancellationRate > 90 ? "text-danger" : "text-warning"}>
                                                            {item.cancellationRate.toFixed(2)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted">-</span>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    <div className="d-flex justify-content-center gap-2">
                                                        <Button
                                                            variant="info"
                                                            size="sm"
                                                            title="View Details"
                                                            onClick={() => handleViewDetails(item)}
                                                            className="text-white"
                                                        >
                                                            <i className="bi bi-eye"></i>
                                                        </Button>
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            title="Visit Shop Admin"
                                                            onClick={() => handleVisitShop(item.shopName || "")}
                                                        >
                                                            <i className="bi bi-shop"></i>
                                                        </Button>
                                                        <Button
                                                            variant="warning"
                                                            size="sm"
                                                            title="Warn Shop"
                                                            onClick={() => handleWarnShop(item.shopId)}
                                                        >
                                                            <i className="bi bi-exclamation-triangle"></i>
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="7" className="text-center p-4">
                                                <i className="bi bi-check-circle text-success fs-2"></i>
                                                <p className="mt-2 mb-0">No suspicious activity detected in the last 3 days.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </Table>

                            {/* Pagination Controls */}
                            {products.length > itemsPerPage && (
                                <div className="d-flex justify-content-end mt-3">
                                    <nav>
                                        <ul className="pagination">
                                            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => handlePageChange(currentPage - 1)}>
                                                    Previous
                                                </button>
                                            </li>
                                            {[...Array(totalPages)].map((_, i) => (
                                                <li key={i + 1} className={`page-item ${currentPage === i + 1 ? 'active' : ''}`}>
                                                    <button className="page-link" onClick={() => handlePageChange(i + 1)}>
                                                        {i + 1}
                                                    </button>
                                                </li>
                                            ))}
                                            <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                                <button className="page-link" onClick={() => handlePageChange(currentPage + 1)}>
                                                    Next
                                                </button>
                                            </li>
                                        </ul>
                                    </nav>
                                </div>
                            )}
                        </>
                    )}
                </Card.Body>
            </Card>

            {/* Details Modal */}
            <Modal show={showModal} onHide={handleCloseModal} size="lg" centered>
                <Modal.Header closeButton className="bg-light">
                    <Modal.Title>
                        <i className="bi bi-shield-exclamation text-danger me-2"></i>
                        Suspicious Activity Details
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedActivity && (
                        <div className="p-2">
                            <Row className="mb-4">
                                <Col md={6}>
                                    <h6 className="text-secondary mb-3">Product Information</h6>
                                    <ListGroup variant="flush">
                                        <ListGroup.Item><strong>Product Name:</strong> {selectedActivity.productName}</ListGroup.Item>
                                        <ListGroup.Item><strong>Product ID:</strong> {selectedActivity.productId}</ListGroup.Item>
                                        <ListGroup.Item><strong>Category:</strong> {selectedActivity.category || 'N/A'}</ListGroup.Item>
                                    </ListGroup>
                                </Col>
                                <Col md={6}>
                                    <h6 className="text-secondary mb-3">Shop Information</h6>
                                    <ListGroup variant="flush">
                                        <ListGroup.Item><strong>Shop Name:</strong> {selectedActivity.shopName}</ListGroup.Item>
                                        <ListGroup.Item><strong>Shop ID:</strong> {selectedActivity.shopId}</ListGroup.Item>
                                        <ListGroup.Item>
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                className="mt-1"
                                                onClick={() => {
                                                    handleCloseModal();
                                                    handleVisitShop(selectedActivity.shopName);
                                                }}
                                            >
                                                Go to Shop Management
                                            </Button>
                                        </ListGroup.Item>
                                    </ListGroup>
                                </Col>
                            </Row>

                            <hr />

                            <Row>
                                <Col>
                                    <h6 className="text-secondary mb-3">Detected Issue</h6>
                                    <Alert variant="warning" className="d-flex align-items-center">
                                        <i className="bi bi-exclamation-circle fs-4 me-3"></i>
                                        <div>
                                            <h6 className="alert-heading mb-1">Reason: {selectedActivity.reason}</h6>
                                            <p className="mb-0 small">
                                                This product has been flagged due to unusual activity patterns found in our analysis.
                                            </p>
                                        </div>
                                    </Alert>

                                    <h6 className="text-secondary mt-4 mb-3">Statistics</h6>
                                    <Row className="text-center g-3">
                                        <Col xs={4}>
                                            <div className="border rounded p-3 bg-light">
                                                <div className="text-muted small">Total Orders</div>
                                                <div className="fs-4 fw-bold">{selectedActivity.totalOrders}</div>
                                            </div>
                                        </Col>
                                        <Col xs={4}>
                                            <div className="border rounded p-3 bg-white border-danger">
                                                <div className="text-danger small">Cancelled</div>
                                                <div className="fs-4 fw-bold text-danger">{selectedActivity.cancelledOrders}</div>
                                            </div>
                                        </Col>
                                        <Col xs={4}>
                                            <div className="border rounded p-3 bg-light">
                                                <div className="text-muted small">Cancellation Rate</div>
                                                <div className={`fs-4 fw-bold ${selectedActivity.cancellationRate > 50 ? 'text-danger' : 'text-warning'}`}>
                                                    {selectedActivity.cancellationRate ? selectedActivity.cancellationRate.toFixed(2) : 0}%
                                                </div>
                                            </div>
                                        </Col>
                                    </Row>
                                </Col>
                            </Row>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>
                        Close
                    </Button>
                    {selectedActivity && (
                        <Button
                            variant="warning"
                            onClick={() => {
                                handleCloseModal();
                                handleWarnShop(selectedActivity.shopId);
                            }}
                        >
                            <i className="bi bi-exclamation-triangle me-1"></i> Warn Shop
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>
        </Container>
    );
};

export default SuspiciousActivityPage;
