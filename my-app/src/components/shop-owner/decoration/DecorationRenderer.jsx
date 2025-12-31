import React from 'react';
import { Container, Image } from 'react-bootstrap';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { getImageUrl } from '../../../api/image';

const DecorationRenderer = ({ config }) => {
    if (!config || config.length === 0) return null;

    const renderWidget = (widget) => {
        switch (widget.type) {
            case 'banner':
                return <BannerRenderer data={widget.data} />;
            case 'video':
                return <VideoRenderer data={widget.data} />;
            case 'products':
                return <ProductsRenderer data={widget.data} />;
            default:
                return null;
        }
    };

    return (
        <div className="shop-decoration-renderer">
            {config.map((widget, index) => (
                <div key={widget.id || index} className="mb-4">
                    {renderWidget(widget)}
                </div>
            ))}
        </div>
    );
};

const BannerRenderer = ({ data }) => {
    const images = data.images || [];
    if (images.length === 0) return null;

    return (
        <Swiper
            modules={[Navigation, Pagination, Autoplay]}
            spaceBetween={0}
            slidesPerView={1}
            navigation
            pagination={{ clickable: true }}
            autoplay={{ delay: 3000 }}
            className="rounded overflow-hidden"
        >
            {images.map((img, idx) => (
                <SwiperSlide key={idx}>
                    <SwiperSlide key={idx}>
                        <Image src={getImageUrl(img.imageId) || img.url} className="w-100" style={{ objectFit: 'cover', maxHeight: '400px' }} />
                    </SwiperSlide>
                </SwiperSlide>
            ))}
        </Swiper>
    );
};

const VideoRenderer = ({ data }) => {
    if (!data.url) return null;
    const getEmbedUrl = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
            return `https://www.youtube.com/embed/${match[2]}`;
        }
        return url;
    };

    return (
        <div className="ratio ratio-16x9">
            <iframe src={getEmbedUrl(data.url)} title="Shop Video" allowFullScreen></iframe>
        </div>
    );
};

const ProductsRenderer = ({ data }) => {
    const [products, setProducts] = React.useState([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (data.productIds && data.productIds.length > 0) {
            fetchData(data.productIds);
        } else {
            setProducts([]);
        }
    }, [data.productIds]);

    const fetchData = async (ids) => {
        setLoading(true);
        try {
            const { fetchProductById } = await import('../../../api/product');
            const promises = ids.map(id => fetchProductById(id));
            const responses = await Promise.all(promises);
            // fetchProductById returns axios response, data is in res.data
            // Filter out failures or nulls if any
            const productsData = responses
                .map(res => res && res.data)
                .filter(item => item !== null && item !== undefined);

            setProducts(productsData);
        } catch (error) {
            console.error("Failed to load products for widget", error);
        } finally {
            setLoading(false);
        }
    };

    if (!data.productIds || data.productIds.length === 0) return null;

    return (
        <Container>
            {data.title && <h4 className="mb-4 text-center fw-bold">{data.title}</h4>}
            {loading ? (
                <div className="text-center py-5">Loading products...</div>
            ) : (
                <div className="row g-3">
                    {products.map(product => (
                        <div key={product.id} className="col-6 col-md-4 col-lg-3">
                            <a href={`/product/${product.id}`} className="text-decoration-none text-dark">
                                <div className="card h-100 shadow-sm border-0">
                                    <div style={{ position: 'relative', paddingBottom: '100%' }}>
                                        <img
                                            src={getImageUrl(product.imageId) || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22150%22%20height%3D%22150%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20150%20150%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_1%20text%20%7B%20fill%3A%23999%3Bfont-weight%3Anormal%3Bfont-family%3AHelvetica%2C%20monospace%3Bfont-size%3A10pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_1%22%3E%3Crect%20width%3D%22150%22%20height%3D%22150%22%20fill%3D%22%23eee%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%2258%22%20y%3D%2280%22%3EProduct%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E'}
                                            className="card-img-top position-absolute top-0 start-0 w-100 h-100"
                                            alt={product.name}
                                            style={{ objectFit: 'cover' }}
                                        />
                                        {product.discountPercent > 0 && (
                                            <div className="position-absolute top-0 end-0 bg-warning text-dark px-2 py-1 small fw-bold" style={{ fontSize: '12px' }}>
                                                -{product.discountPercent}%
                                            </div>
                                        )}
                                    </div>
                                    <div className="card-body p-2">
                                        <h6 className="card-title text-truncate mb-1">{product.name}</h6>
                                        <div className="d-flex align-items-baseline gap-2 flex-wrap">
                                            <div className="fw-bold text-primary">
                                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
                                            </div>
                                            {product.originalPrice > product.price && (
                                                <div className="text-muted text-decoration-line-through small" style={{ fontSize: '13px' }}>
                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.originalPrice)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </a>
                        </div>
                    ))}
                </div>
            )}
        </Container>
    );
};

export default DecorationRenderer;
