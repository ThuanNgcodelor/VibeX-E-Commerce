import React, { useEffect, useState } from "react";
import { getSuspiciousProducts } from "../../api/adminAnalyticsApi"; // Adjust path if needed
import { Table, Button, Container, Card, Alert, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

const SuspiciousActivityPage = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const data = await getSuspiciousProducts();
            setProducts(data);
            setError(null);
        } catch (err) {
            setError("Failed to fetch suspicious activity data.");
        } finally {
            setLoading(false);
        }
    };

    const handleWarnShop = (shopId) => {
        // Placeholder for warning logic (e.g., open modal, send notification API)
        alert(`Warning sent to shop owner: ${shopId}`);
    };

    const renderReasonBadge = (reason) => {
        if (!reason) return <span className="badge bg-secondary">Unknown</span>;
        if (reason.includes("Cancellation")) return <span className="badge bg-danger">Cancellation</span>;
        if (reason.includes("Brushing")) return <span className="badge bg-warning text-dark">Brushing (?)</span>;
        if (reason.includes("Price")) return <span className="badge bg-info text-dark">Price Manipulation</span>;
        return <span className="badge bg-secondary">{reason}</span>;
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
                                {products.length > 0 ? (
                                    products.map((item, index) => (
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
                                                <Button
                                                    variant="warning"
                                                    size="sm"
                                                    onClick={() => handleWarnShop(item.shopId)}
                                                >
                                                    <i className="bi bi-exclamation-triangle"></i> Warn Shop
                                                </Button>
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
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
};

export default SuspiciousActivityPage;
