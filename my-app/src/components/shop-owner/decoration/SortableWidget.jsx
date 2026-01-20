import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, Button } from 'react-bootstrap';

const SortableWidget = ({ widget, index, total, renderWidget, onRemove }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: widget.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        marginBottom: '1.5rem',
        position: 'relative',
        zIndex: isDragging ? 999 : 1
    };

    const getWidgetLabel = (type) => {
        switch (type) {
            case 'banner': return 'Banner';
            case 'video': return 'Video';
            case 'products': return 'Products';
            default: return 'Unknown Widget';
        }
    };

    return (
        <div ref={setNodeRef} style={style}>
            <Card className="border shadow-sm">
                <Card.Header className="bg-light d-flex justify-content-between align-items-center py-2 px-3">
                    <div className="d-flex align-items-center gap-3">
                        {/* Drag Handle */}
                        <div
                            className="cursor-grab d-flex align-items-center justify-content-center text-secondary hover-dark bg-white border rounded shadow-sm"
                            style={{ cursor: 'grab', width: '36px', height: '36px' }}
                            {...attributes}
                            {...listeners}
                            title="Move"
                        >
                            <i className="bi bi-grip-vertical fs-5"></i>
                        </div>

                        {/* Widget Title */}
                        <span className="fw-bold text-uppercase text-primary small d-flex align-items-center">
                            <i className="bi bi-layers me-2"></i>
                            {getWidgetLabel(widget.type)}
                        </span>
                    </div>

                    <Button
                        variant="outline-danger"
                        size="sm"
                        className="d-flex align-items-center justify-content-center"
                        style={{ width: '36px', height: '36px' }}
                        onClick={() => onRemove(widget.id)}
                        title="Delete"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <i className="bi bi-trash3-fill fs-5"></i>
                    </Button>
                </Card.Header>
                <Card.Body className="p-3 bg-white">
                    {renderWidget(widget)}
                </Card.Body>
            </Card>
        </div>
    );
};

export default SortableWidget;
