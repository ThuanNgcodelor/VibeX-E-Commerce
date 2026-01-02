import React, { useState } from 'react';
import { Modal, Button, Form, Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { generateShopDecoration } from '../../../api/shopAssistant';
import { toast } from 'react-hot-toast';

const AiDecorationModal = ({ show, onHide, onApply }) => {
    const { t } = useTranslation();
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;

        setLoading(true);
        try {
            const response = await generateShopDecoration(prompt);
            console.log("AI Response:", response);
            if (response && response.result) {
                try {
                    const config = JSON.parse(response.result); // Clean result if AI wraps it
                    onApply(config);
                    onHide();
                    toast.success(t('shopOwner.decoration.aiSuccess'));
                } catch (parseError) {
                    console.error("JSON Parse Error:", parseError, response.result);
                    toast.error(t('shopOwner.decoration.aiParseError'));
                }
            } else {
                toast.error(t('shopOwner.decoration.aiFailed'));
            }
        } catch (error) {
            console.error(error);
            toast.error(t('shopOwner.decoration.aiFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>
                    <i className="fas fa-magic text-warning me-2"></i>
                    {t('shopOwner.decoration.aiModalTitle') || "AI Magic Decorator"}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className="text-muted">
                    {t('shopOwner.decoration.aiModalDesc') || "Describe your dream shop style, and let AI build it for you in seconds!"}
                </p>
                <Form.Group className="mb-3">
                    <Form.Control
                        as="textarea"
                        rows={4}
                        placeholder={t('shopOwner.decoration.aiPlaceholder') || "E.g., A minimalist fashion boutique with pastel colors and a focus on summer dresses..."}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        disabled={loading}
                    />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide} disabled={loading}>
                    {t('cancel')}
                </Button>
                <Button variant="primary" onClick={handleGenerate} disabled={loading || !prompt.trim()}>
                    {loading ? (
                        <>
                            <Spinner as="span" animation="border" size="sm" className="me-2" />
                            {t('shopOwner.decoration.generating') || "Generating..."}
                        </>
                    ) : (
                        <>
                            <i className="fas fa-wand-magic-sparkles me-2"></i>
                            {t('shopOwner.decoration.generate') || "Generate Magic"}
                        </>
                    )}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default AiDecorationModal;
