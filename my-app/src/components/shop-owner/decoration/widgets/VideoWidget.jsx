import React from 'react';
import { Form } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const VideoWidget = ({ data, onChange }) => {
    const { t } = useTranslation();

    const handleChange = (e) => {
        onChange({ ...data, url: e.target.value });
    };

    const getEmbedUrl = (url) => {
        if (!url) return '';
        // Simple Youtube ID extraction
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
            return `https://www.youtube.com/embed/${match[2]}`;
        }
        return url; // fallback
    };

    return (
        <div>
            <h5>{t('shopOwner.decoration.widgets.videoTitle')}</h5>
            <Form.Group className="mb-3">
                <Form.Label>{t('shopOwner.decoration.widgets.youtubeUrl')}</Form.Label>
                <Form.Control
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={data.url || ''}
                    onChange={handleChange}
                />
            </Form.Group>
            {data.url && (
                <div className="ratio ratio-16x9 mt-2">
                    <iframe
                        src={getEmbedUrl(data.url)}
                        title="Video Preview"
                        allowFullScreen
                    ></iframe>
                </div>
            )}
        </div>
    );
};

export default VideoWidget;
