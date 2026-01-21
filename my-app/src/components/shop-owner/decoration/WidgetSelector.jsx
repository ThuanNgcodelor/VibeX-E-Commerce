import React from 'react';
import { Button, Stack } from 'react-bootstrap';


const WidgetSelector = ({ onAdd }) => {
    const widgets = [
        { type: 'banner', label: 'Banner', icon: 'bi-images' },
        { type: 'video', label: 'Video', icon: 'bi-play-btn' },
        { type: 'products', label: 'Products', icon: 'bi-grid' }
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
