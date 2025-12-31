import React from 'react';
import { Button, Card, Stack, Badge } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { decorationTemplates } from '../../../data/decorationTemplates';

const TemplateSelector = ({ onApply }) => {
    const { t } = useTranslation();

    return (
        <Stack gap={3}>
            {decorationTemplates.map(template => (
                <Card key={template.id} className="border-light shadow-sm">
                    <Card.Body>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                            <h6 className="mb-0">{t(template.nameKey)}</h6>
                            <Badge bg="info" pill>{template.config.length} widgets</Badge>
                        </div>
                        <p className="text-muted small mb-3">
                            {t(template.descKey)}
                        </p>
                        <Button
                            variant="outline-primary"
                            size="sm"
                            className="w-100"
                            onClick={() => onApply(template)}
                        >
                            {t('shopOwner.decoration.applyTemplate')}
                        </Button>
                    </Card.Body>
                </Card>
            ))}
        </Stack>
    );
};

export default TemplateSelector;
