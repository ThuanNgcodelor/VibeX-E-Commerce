import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Tabs, Tab } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { getMyShopDecoration, saveShopDecoration } from '../../api/user';
import WidgetSelector from '../../components/shop-owner/decoration/WidgetSelector';
import TemplateSelector from '../../components/shop-owner/decoration/TemplateSelector';
import PreviewArea from '../../components/shop-owner/decoration/PreviewArea';
import { useTranslation } from 'react-i18next';
import Swal from 'sweetalert2';

const ShopDecorationPage = () => {
    const { t } = useTranslation();
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
                setDecorationConfig(JSON.parse(data.content));
            } else {
                setDecorationConfig([]);
            }
        } catch (error) {
            console.error('Error fetching decoration config:', error);
            // toast.error(t('failedToLoadDecoration'));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveShopDecoration(decorationConfig);
            toast.success(t('shopOwner.decoration.savedSuccess'));
        } catch (error) {
            console.error('Error saving decoration:', error);
            toast.error(t('shopOwner.decoration.saveFailed'));
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
        toast.success(t('shopOwner.decoration.widgetAdded'));
    };

    const applyTemplate = (template) => {
        Swal.fire({
            title: t('shopOwner.decoration.confirmApplyTemplate'),
            text: t('shopOwner.decoration.confirmApplyTemplateText'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: t('yes'),
            cancelButtonText: t('no')
        }).then((result) => {
            if (result.isConfirmed) {
                // Generate new IDs for all widgets to avoid conflicts
                const newConfig = template.config.map(widget => ({
                    ...widget,
                    id: Date.now() + Math.random() // Simple unique ID generation
                }));
                setDecorationConfig(newConfig);
                toast.success(t('shopOwner.decoration.templateApplied'));
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
            case 'products': return { productIds: [], title: t('shopOwner.decoration.defaultCollectionTitle') };
            default: return {};
        }
    };

    if (loading) return <div className="text-center p-5"><Spinner animation="border" /></div>;

    return (
        <Container fluid className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h3>{t('shopDecoration')}</h3>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                    {saving ? <Spinner as="span" animation="border" size="sm" /> : t('shopOwner.decoration.saveChanges')}
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
                                <Tab eventKey="widgets" title={t('shopOwner.decoration.widgetsTab')}>
                                </Tab>
                                <Tab eventKey="templates" title={t('shopOwner.decoration.templates')}>
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
                        <Card.Header>{t('shopOwner.decoration.previewAndEdit')}</Card.Header>
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
