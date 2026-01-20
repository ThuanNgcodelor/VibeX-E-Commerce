import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Tabs, Tab } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { getMyShopDecoration, saveShopDecoration } from '../../api/user';
import WidgetSelector from '../../components/shop-owner/decoration/WidgetSelector';
import TemplateSelector from '../../components/shop-owner/decoration/TemplateSelector';
import PreviewArea from '../../components/shop-owner/decoration/PreviewArea';
import Swal from 'sweetalert2';

const ShopDecorationPage = () => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [decorationConfig, setDecorationConfig] = useState([]);
    const [activeTab, setActiveTab] = useState('widgets');

    useEffect(() => {
        fetchDecorationConfig();
    }, []);

    const fetchDecorationConfig = async () => {
        setLoading(true);
        try {
            const data = await getMyShopDecoration();
            if (data && data.content) {
                let parsed = JSON.parse(data.content);
                if (!Array.isArray(parsed) && parsed.widgets) {
                    parsed = parsed.widgets;
                }
                setDecorationConfig(Array.isArray(parsed) ? parsed : []);
            } else {
                setDecorationConfig([]);
            }
        } catch (error) {
            console.error('Error fetching decoration config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveShopDecoration(decorationConfig);
            toast.success('Decoration saved successfully!');
        } catch (error) {
            console.error('Error saving decoration:', error);
            toast.error('Failed to save decoration');
        } finally {
            setSaving(false);
        }
    };

    const addWidget = (type) => {
        const newWidget = {
            id: Date.now(),
            type,
            data: getDefaultDataForType(type)
        };
        setDecorationConfig([...decorationConfig, newWidget]);
        toast.success('Widget added successfully!');
    };

    const applyTemplate = (template) => {
        Swal.fire({
            title: 'Apply Template?',
            text: 'This will replace your current configuration. Continue?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.isConfirmed) {
                const newConfig = template.config.map(widget => ({
                    ...widget,
                    id: Date.now() + Math.random()
                }));
                setDecorationConfig(newConfig);
                toast.success('Template applied successfully!');
            }
        });
    };

    const removeWidget = (id) => {
        setDecorationConfig(decorationConfig.filter(w => w.id !== id));
    };

    const updateWidget = (id, newData) => {
        setDecorationConfig(decorationConfig.map(w =>
            w.id === id ? { ...w, data: newData } : w
        ));
    };

    const getDefaultDataForType = (type) => {
        switch (type) {
            case 'banner': return { images: [] };
            case 'video': return { url: '' };
            case 'products': return { productIds: [], title: 'Featured Products' };
            default: return {};
        }
    };

    if (loading) return <div className="text-center p-5"><Spinner animation="border" /></div>;

    return (
        <Container fluid className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h3>Shop Decoration</h3>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                    {saving ? <Spinner as="span" animation="border" size="sm" /> : 'Save Changes'}
                </Button>
            </div>
            <Row>
                <Col md={3}>
                    <Card className="h-100">
                        <Card.Header>
                            <Tabs
                                activeKey={activeTab}
                                onSelect={(k) => setActiveTab(k)}
                                className="mb-0 card-header-tabs"
                                justify
                            >
                                <Tab eventKey="widgets" title="Widgets">
                                </Tab>
                                <Tab eventKey="templates" title="Templates">
                                </Tab>
                            </Tabs>
                        </Card.Header>
                        <Card.Body>
                            {activeTab === 'widgets' ? (
                                <WidgetSelector onAdd={addWidget} />
                            ) : (
                                <TemplateSelector onApply={applyTemplate} />
                            )}
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={9}>
                    <Card className="h-100">
                        <Card.Header>Preview & Edit</Card.Header>
                        <Card.Body className="bg-light" style={{ minHeight: '500px', overflowY: 'auto' }}>
                            <PreviewArea
                                widgets={decorationConfig}
                                onRemove={removeWidget}
                                onUpdate={updateWidget}
                                onReorder={setDecorationConfig}
                            />
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default ShopDecorationPage;
