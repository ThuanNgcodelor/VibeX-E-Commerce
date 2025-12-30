import React from 'react';
import { Card, Button, Stack } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import BannerWidget from './widgets/BannerWidget';
import VideoWidget from './widgets/VideoWidget';
import ProductsWidget from './widgets/ProductsWidget';

const PreviewArea = ({ widgets, onRemove, onUpdate, onMove }) => {
    const { t } = useTranslation();

    const renderWidget = (widget) => {
        const props = {
            data: widget.data,
            onChange: (newData) => onUpdate(widget.id, newData)
        };

        switch (widget.type) {
            case 'banner': return <BannerWidget {...props} />;
            case 'video': return <VideoWidget {...props} />;
            case 'products': return <ProductsWidget {...props} />;
            default: return <div>{t('shopOwner.decoration.unknownWidget')}</div>;
        }
    };

    if (!widgets || widgets.length === 0) {
        return <div className="text-center text-muted mt-5">{t('shopOwner.decoration.selectComponent')}</div>;
    }

    return (
        <Stack gap={4} className="p-3">
            {widgets.map((widget, index) => (
                <div key={widget.id} className="position-relative">
                    {/* Widget Label Badge */}
                    <div className="position-absolute top-0 start-0 translate-middle-y ms-3 z-3">
                        <span className="badge bg-primary text-uppercase shadow-sm" style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                            <i className="bi bi-ui-checks me-1"></i>
                            {widget.type === 'banner' ? t('shopOwner.decoration.widgets.banner') :
                                widget.type === 'video' ? t('shopOwner.decoration.widgets.video') :
                                    widget.type === 'products' ? t('shopOwner.decoration.widgets.products') :
                                        t('shopOwner.decoration.unknownWidget')}
                        </span>
                    </div>

                    <Card className="border-0 shadow-sm overflow-hidden">
                        <div className="position-absolute top-0 end-0 p-2 z-3 d-flex gap-1">
                            <Button
                                variant="light"
                                size="sm"
                                className="shadow-sm border"
                                onClick={() => onMove(widget.id, 'up')}
                                disabled={index === 0}
                                title="Move Up"
                            >
                                <i className="bi bi-arrow-up text-secondary"></i>
                            </Button>
                            <Button
                                variant="light"
                                size="sm"
                                className="shadow-sm border"
                                onClick={() => onMove(widget.id, 'down')}
                                disabled={index === widgets.length - 1}
                                title="Move Down"
                            >
                                <i className="bi bi-arrow-down text-secondary"></i>
                            </Button>
                            <Button
                                variant="light"
                                size="sm"
                                className="shadow-sm border text-danger hover-danger"
                                onClick={() => onRemove(widget.id)}
                                title="Remove Component"
                            >
                                <i className="bi bi-trash"></i>
                            </Button>
                        </div>
                        <Card.Body className="pt-4 px-4 pb-4 bg-white border rounded">
                            {renderWidget(widget)}
                        </Card.Body>
                    </Card>
                </div>
            ))}
        </Stack>
    );
};

export default PreviewArea;
