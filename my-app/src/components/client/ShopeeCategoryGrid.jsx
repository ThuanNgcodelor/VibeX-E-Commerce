import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import categoryApi from '../../api/categoryApi';

export default function ShopeeCategoryGrid() {
    const { t } = useTranslation();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const data = await categoryApi.getAll();
            const transformedCategories = data.map((cat) => ({
                ...cat,
                link: `/shop?category=${cat.id}`
            }));

            setCategories(transformedCategories);
        } catch {
            setCategories([]);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ background: 'white', padding: '24px 0', marginTop: '8px' }}>
                <div className="container" style={{ maxWidth: '1200px', textAlign: 'center' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: 'white', padding: '24px 0', marginTop: '8px' }}>
            <div className="container" style={{ maxWidth: '1200px' }}>
                <h4 style={{
                    fontSize: '16px',
                    color: '#757575',
                    marginBottom: '16px',
                    textTransform: 'uppercase',
                    fontWeight: 500
                }}>
                    {t('home.categories')}
                </h4>
                <div className="row g-2">
                    {categories.length === 0 ? (
                        <div className="col-12 text-center text-muted">
                            {t('home.noCategories') || 'No categories available'}
                        </div>
                    ) : (
                        categories.map((cat) => (
                            <div key={cat.id} className="col-6 col-md-4 col-lg-2">
                                <Link
                                    to={cat.link}
                                    style={{
                                        textDecoration: 'none',
                                        display: 'block'
                                    }}
                                >
                                    <div
                                        style={{
                                            background: 'white',
                                            border: '1px solid #f0f0f0',
                                            borderRadius: '4px',
                                            padding: '16px 8px',
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            height: '100%'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#ee4d2d';
                                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(238,77,45,0.15)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#f0f0f0';
                                            e.currentTarget.style.boxShadow = 'none';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        {/* Hiển thị ảnh từ database */}
                                        <div style={{ marginBottom: '8px' }}>
                                            {cat.imageUrl ? (
                                                <img
                                                    src={cat.imageUrl}
                                                    alt={cat.name}
                                                    style={{
                                                        width: '48px',
                                                        height: '48px',
                                                        objectFit: 'cover',
                                                        borderRadius: '4px'
                                                    }}
                                                    onError={(e) => {
                                                        // Placeholder đơn giản khi ảnh lỗi
                                                        e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Crect width="48" height="48" fill="%23f5f5f5" rx="4"/%3E%3Ctext x="24" y="30" font-size="20" text-anchor="middle" fill="%23999"%3E📦%3C/text%3E%3C/svg%3E';
                                                    }}
                                                />
                                            ) : (
                                                // Placeholder khi không có ảnh
                                                <div style={{
                                                    width: '48px',
                                                    height: '48px',
                                                    background: '#f5f5f5',
                                                    borderRadius: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '24px'
                                                }}>
                                                    📦
                                                </div>
                                            )}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: '12px',
                                                color: '#333',
                                                lineHeight: '1.3'
                                            }}
                                        >
                                            {cat.name}
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}