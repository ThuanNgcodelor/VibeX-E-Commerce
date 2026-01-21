import React from 'react';
import { Button, Card, Stack, Badge } from 'react-bootstrap';
import { decorationTemplates } from '../../../data/decorationTemplates';

const TemplateSelector = ({ onApply }) => {
    // Template names and descriptions in English
    const getTemplateName = (template) => {
        switch (template.id) {
            case 'template-banner-products':
                return "Banner + Products";
            case 'template-video-banner':
                return "Video + Banner";
            case 'template-full':
                return "Full Layout";
            default:
                return template.name || "Template";
        }
    };

    const getTemplateDesc = (template) => {
        switch (template.id) {
            case 'template-banner-products':
                return "A banner carousel followed by featured products";
            case 'template-video-banner':
                return "Video introduction with banner images";
            case 'template-full':
                return "Complete layout with all widget types";
            default:
                return template.description || "Template description";
        }
    };

    return (
        <Stack gap={3}>
            {decorationTemplates.map(template => (
                <Card key={template.id} className="border-light shadow-sm">
                    <Card.Body>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                            <h6 className="mb-0">{getTemplateName(template)}</h6>
                            <Badge bg="info" pill>{template.config.length} widgets</Badge>
                        </div>
                        <p className="text-muted small mb-3">
                            {getTemplateDesc(template)}
                        </p>
                        <Button
                            variant="outline-primary"
                            size="sm"
                            className="w-100"
                            onClick={() => onApply(template)}
                        >
                            Apply Template
                        </Button>
                    </Card.Body>
                </Card>
            ))}
        </Stack>
    );
};

export default TemplateSelector;
