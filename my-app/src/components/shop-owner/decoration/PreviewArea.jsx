import React from 'react';
import { Stack } from 'react-bootstrap';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import BannerWidget from './widgets/BannerWidget';
import VideoWidget from './widgets/VideoWidget';
import ProductsWidget from './widgets/ProductsWidget';
import SortableWidget from './SortableWidget';

const PreviewArea = ({ widgets, onRemove, onUpdate, onReorder }) => {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            const oldIndex = widgets.findIndex((item) => item.id === active.id);
            const newIndex = widgets.findIndex((item) => item.id === over.id);

            // Call onReorder with the new array
            onReorder(arrayMove(widgets, oldIndex, newIndex));
        }
    };

    const renderWidgetContent = (widget) => {
        const props = {
            data: widget.data,
            onChange: (newData) => onUpdate(widget.id, newData)
        };

        switch (widget.type) {
            case 'banner': return <BannerWidget {...props} />;
            case 'video': return <VideoWidget {...props} />;
            case 'products': return <ProductsWidget {...props} />;
            default: return <div>Unknown Widget</div>;
        }
    };

    if (!widgets || !Array.isArray(widgets) || widgets.length === 0) {
        return <div className="text-center text-muted mt-5">Select a component to add</div>;
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={widgets.map(w => w.id)}
                strategy={verticalListSortingStrategy}
            >
                <Stack gap={0} className="p-3">
                    {widgets.map((widget, index) => (
                        <SortableWidget
                            key={widget.id}
                            widget={widget}
                            index={index}
                            total={widgets.length}
                            renderWidget={renderWidgetContent}
                            onRemove={onRemove}
                        />
                    ))}
                </Stack>
            </SortableContext>
        </DndContext>
    );
};

export default PreviewArea;
