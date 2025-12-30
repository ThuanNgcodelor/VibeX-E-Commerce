import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Spinner } from 'react-bootstrap';
import { toast } from 'react-hot-toast';
import { getMyShopDecoration, saveShopDecoration } from '../../api/user';
import WidgetSelector from '../../components/shop-owner/decoration/WidgetSelector';
import PreviewArea from '../../components/shop-owner/decoration/PreviewArea';
import { useTranslation } from 'react-i18next';

const ShopDecorationPage = () => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [decorationConfig, setDecorationConfig] = useState([]);

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
    };

    const removeWidget = (id) => {
        setDecorationConfig(decorationConfig.filter(w => w.id !== id));
    };

    const updateWidget = (id, newData) => {
        setDecorationConfig(decorationConfig.map(w =>
            w.id === id ? { ...w, data: newData } : w
        ));
    };

    const moveWidget = (id, direction) => {
        const index = decorationConfig.findIndex(w => w.id === id);
        if (index < 0) return;

        const newConfig = [...decorationConfig];
        if (direction === 'up' && index > 0) {
            [newConfig[index], newConfig[index - 1]] = [newConfig[index - 1], newConfig[index]];
        } else if (direction === 'down' && index < newConfig.length - 1) {
            [newConfig[index], newConfig[index + 1]] = [newConfig[index + 1], newConfig[index]];
        }
        setDecorationConfig(newConfig);
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
                        <Card.Header>{t('shopOwner.decoration.componentLibrary')}</Card.Header>
                        <Card.Body>
                            <WidgetSelector onAdd={addWidget} />
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
                                onMove={moveWidget}
                            />
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default ShopDecorationPage;
