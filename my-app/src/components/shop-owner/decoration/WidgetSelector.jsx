import React from 'react';
import { Button, Stack } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const WidgetSelector = ({ onAdd }) => {
    const { t } = useTranslation();

    const widgets = [
        { type: 'banner', label: t('shopOwner.decoration.widgets.banner'), icon: 'bi-images' },
        { type: 'video', label: t('shopOwner.decoration.widgets.video'), icon: 'bi-play-btn' },
        { type: 'products', label: t('shopOwner.decoration.widgets.products'), icon: 'bi-grid' }
    ];

    return (
        <Stack gap={3}>
            {widgets.map(w => (
                <Button
                    key={w.type}
                    variant="outline-secondary"
                    className="text-start d-flex align-items-center gap-2"
                    onClick={() => onAdd(w.type)}
                >
                    <i className={`bi ${w.icon} fs-4`}></i>
                    <span>{w.label}</span>
                </Button>
            ))}
        </Stack>
    );
};

export default WidgetSelector;
