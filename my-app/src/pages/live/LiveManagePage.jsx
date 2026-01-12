import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Hls from 'hls.js';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';
import {
    createLiveRoom,
    getMyLiveRooms,
    startLive,
    endLive,
    getLiveRoomDetails,
    getStreamUrl,
    addProductToLive,
    getLiveProducts,
    removeProductFromLive
} from '../../api/live';
import { getProducts, searchProducts } from '../../api/shopOwner';
import { fetchProductImageById } from '../../api/product';
import { getShopOwnerInfo } from '../../api/user';
import { LOCAL_BASE_URL } from '../../config/config';
import imgFallback from '../../assets/images/shop/6.png';
import { uploadImage } from '../../api/image';
import { getToken } from "../../api/auth.js";

export default function LiveManagePage() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const changeLanguage = () => {
        const newLang = i18n.language === 'en' ? 'vi' : 'en';
        i18n.changeLanguage(newLang);
    };
    const videoRef = useRef(null);
    const containerRef = useRef(null);

    const [step, setStep] = useState('list'); // list, create, streaming
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [newRoom, setNewRoom] = useState({
        title: '',
        description: '',
        thumbnailUrl: ''
    });
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);

    // Product selection states
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [showProductModal, setShowProductModal] = useState(false);
    const [shopProducts, setShopProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [productSearchKeyword, setProductSearchKeyword] = useState('');
    const [productPage, setProductPage] = useState(1);
    const [productTotalPages, setProductTotalPages] = useState(0);
    const [productImageUrls, setProductImageUrls] = useState({});
    const [productPrices, setProductPrices] = useState({}); // Map of productId -> livePrice
    const [productQuantities, setProductQuantities] = useState({}); // Map of productId -> quantityLimit
    const [liveProducts, setLiveProducts] = useState([]); // Products already added to live room
    const [addingProducts, setAddingProducts] = useState(false);

    // Chat and viewer states
    const [isMuted, setIsMuted] = useState(true); // Added state
    const [viewerCount, setViewerCount] = useState(0);
    const [likeCount, setLikeCount] = useState(0);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const stompClientRef = useRef(null);

    // Shop owner info for chat
    const [shopInfo, setShopInfo] = useState(null);
    const [reactions, setReactions] = useState([]); // Floating reactions


    useEffect(() => {
        fetchRooms();
        // Fetch shop owner info for chat
        getShopOwnerInfo().then(setShopInfo).catch(console.error);
    }, []);

    // Setup HLS when streaming
    useEffect(() => {
        if (step === 'streaming' && currentRoom?.streamKey && videoRef.current) {
            const streamUrl = getStreamUrl(currentRoom.streamKey);

            if (Hls.isSupported()) {
                const hls = new Hls({ liveDurationInfinity: true });
                hls.loadSource(streamUrl);
                hls.attachMedia(videoRef.current);
                return () => hls.destroy();
            }
        }
    }, [step, currentRoom]);

    // Setup WebSocket for chat when streaming
    useEffect(() => {
        if (step === 'streaming' && currentRoom?.id) {
            const token = getToken();
            const wsUrl = (LOCAL_BASE_URL || 'http://localhost:8080') + '/ws/live';

            const client = new Client({
                webSocketFactory: () => new SockJS(wsUrl),
                connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
                onConnect: () => {
                    console.log('Connected to live chat WebSocket');

                    // Subscribe to chat messages
                    client.subscribe(`/topic/live/${currentRoom.id}/chat`, (message) => {
                        const chat = JSON.parse(message.body);
                        setChatMessages(prev => [...prev, chat]);
                    });

                    // Subscribe to viewer count
                    client.subscribe(`/topic/live/${currentRoom.id}/viewers`, (message) => {
                        const data = JSON.parse(message.body);
                        setViewerCount(data.count || 0);
                    });

                    // Subscribe to reactions
                    client.subscribe(`/topic/live/${currentRoom.id}/reaction`, (message) => {
                        const reaction = JSON.parse(message.body);
                        if (reaction && reaction.type) {
                            handleAddReaction(reaction.type);
                        }
                    });

                    // Join room to increment viewer count
                    client.publish({
                        destination: `/app/live/${currentRoom.id}/join`,
                        body: JSON.stringify({})
                    });
                },
                onStompError: (frame) => {
                    console.error('STOMP error:', frame);
                }
            });

            client.activate();
            stompClientRef.current = client;

            return () => {
                if (client.connected) {
                    client.publish({
                        destination: `/app/live/${currentRoom.id}/leave`,
                        body: JSON.stringify({})
                    });
                }
                client.deactivate();
                setChatMessages([]);
                setViewerCount(0);
            };
        }
    }, [step, currentRoom?.id]);

    // Fetch Live Products when streaming
    useEffect(() => {
        if (step === 'streaming' && currentRoom?.id) {
            const loadLiveProducts = async () => {
                try {
                    const products = await getLiveProducts(currentRoom.id);
                    setLiveProducts(products || []);
                } catch (error) {
                    console.error("Failed to load live products", error);
                }
            };
            loadLiveProducts();
        }
    }, [step, currentRoom?.id]);

    // Handle Remove Product from Live
    const handleRemoveProduct = async (product) => {
        if (!window.confirm(`Bạn có chắc muốn gỡ sản phẩm "${product.productName}" khỏi livestream?`)) return;

        try {
            // Note: API expects productId (original ID), not liveProductId
            await removeProductFromLive(currentRoom.id, product.productId);
            setLiveProducts(prev => prev.filter(p => p.productId !== product.productId));
            alert("Đã gỡ sản phẩm thành công!");
        } catch (error) {
            console.error('Error removing product:', error);
            alert('Không thể gỡ sản phẩm');
        }
    };

    // Send chat message
    const sendChat = () => {
        if (!chatInput.trim() || !stompClientRef.current?.connected) return;

        stompClientRef.current.publish({
            destination: `/app/live/${currentRoom.id}/chat`,
            body: JSON.stringify({
                message: chatInput.trim(),
                username: shopInfo?.shopName || shopInfo?.ownerName || 'Shop',
                avatarUrl: shopInfo?.avatarUrl || null,
                isOwner: true // Shop owner is always owner
            })
        });
        setChatInput('');
    };

    // --- Reaction Logic ---
    const handleAddReaction = (type) => {
        const id = Date.now() + Math.random();
        // Random position
        const randomX = Math.floor(Math.random() * 80) + 10;

        const newReaction = { id, type, x: randomX };

        setReactions(prev => [...prev, newReaction]);

        // Remove after animation
        setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== id));
        }, 2000);
    };

    const REACTION_ICONS = {
        LIKE: '👍',
        HEART: '❤️',
        HAHA: '😂',
        WOW: '😮',
        SAD: '😢',
        ANGRY: '😡'
    };

    const fetchRooms = async () => {
        try {
            setLoading(true);
            const response = await getMyLiveRooms(0, 20);
            setRooms(response.content || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch shop products
    const fetchShopProducts = async (keyword = '', page = 1) => {
        try {
            setLoadingProducts(true);
            const response = keyword
                ? await searchProducts(keyword, page, 20)
                : await getProducts(page, 20);
            const products = response.content || [];
            setShopProducts(products);
            setProductTotalPages(response.totalPages || 0);
            setProductPage(page);

            // Load images for products
            const newImageUrls = {};
            await Promise.all(
                products.map(async (product) => {
                    try {
                        if (product.imageId) {
                            const res = await fetchProductImageById(product.imageId);
                            const contentType = res.headers?.['content-type'] || 'image/png';
                            const blob = new Blob([res.data], { type: contentType });
                            newImageUrls[product.id] = URL.createObjectURL(blob);
                        } else {
                            newImageUrls[product.id] = imgFallback;
                        }
                    } catch {
                        newImageUrls[product.id] = imgFallback;
                    }
                })
            );
            setProductImageUrls(prev => ({ ...prev, ...newImageUrls }));
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoadingProducts(false);
        }
    };

    // Open product modal
    const handleOpenProductModal = () => {
        setShowProductModal(true);
        fetchShopProducts();
    };

    // Toggle product selection
    const toggleProductSelection = (product) => {
        setSelectedProducts(prev => {
            const isSelected = prev.some(p => p.id === product.id);
            if (isSelected) {
                return prev.filter(p => p.id !== product.id);
            } else if (prev.length < 500) {
                return [...prev, product];
            }
            return prev;
        });
    };

    // Confirm product selection - call API to add products to live room
    const handleConfirmProducts = async () => {
        if (!currentRoom?.id || selectedProducts.length === 0) {
            setShowProductModal(false);
            return;
        }

        setAddingProducts(true);
        try {
            // Add each selected product to live room
            for (const product of selectedProducts) {
                const livePrice = productPrices[product.id] || product.price;
                const quantityLimit = productQuantities[product.id] || product.totalStock || null;
                await addProductToLive(currentRoom.id, {
                    productId: product.id,
                    livePrice: parseFloat(livePrice),
                    quantityLimit: quantityLimit ? parseInt(quantityLimit) : null,
                    displayOrder: 0
                });
            }

            // Fetch updated live products
            const updatedProducts = await getLiveProducts(currentRoom.id);
            setLiveProducts(updatedProducts || []);

            // Clear selection
            setSelectedProducts([]);
            setProductPrices({});
            setProductQuantities({});
            setShowProductModal(false);

            alert(`Đã thêm ${selectedProducts.length} sản phẩm vào live stream!`);
        } catch (error) {
            console.error('Error adding products:', error);
            alert('Lỗi khi thêm sản phẩm: ' + (error.message || 'Unknown error'));
        } finally {
            setAddingProducts(false);
        }
    };

    // Search products with debounce
    useEffect(() => {
        if (showProductModal) {
            const timer = setTimeout(() => {
                fetchShopProducts(productSearchKeyword, 1);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [productSearchKeyword, showProductModal]);

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        if (!newRoom.title.trim()) return;

        let roomData = { ...newRoom };

        if (thumbnailFile) {
            try {
                const imageId = await uploadImage(thumbnailFile);
                roomData.thumbnailUrl = `/v1/file-storage/get/${imageId}`;
            } catch (error) {
                console.error('Upload thumbnail error:', error);
                alert('Lỗi khi tải ảnh bìa: ' + (error.message || 'Unknown error'));
                return;
            }
        }

        try {
            const room = await createLiveRoom(roomData);
            setCurrentRoom(room);
            setStep('streaming');
        } catch {
            alert('Không thể tạo phòng live');
        }
    };

    const handleSelectRoom = async (room) => {
        try {
            const details = await getLiveRoomDetails(room.id);
            setCurrentRoom(details);
            setStep('streaming');
        } catch {
            alert('Không thể lấy thông tin phòng');
        }
    };

    const handleStartLive = async () => {
        try {
            const updated = await startLive(currentRoom.id);
            setCurrentRoom(updated);
        } catch {
            alert('Không thể bắt đầu live');
        }
    };

    const handleEndLive = async () => {
        if (!window.confirm('Bạn có chắc muốn kết thúc livestream?')) return;
        try {
            await endLive(currentRoom.id);
            setCurrentRoom(null);
            setStep('list');
            fetchRooms();
        } catch {
            alert('Không thể kết thúc live');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Đã copy!');
    };

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
            {/* Header */}
            <header style={{
                background: 'white',
                borderBottom: '1px solid #eee',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                        <span style={{ color: '#ee4d2d', fontWeight: 'bold', fontSize: '24px' }}>Shopee</span>
                        <span style={{ color: '#ee4d2d', fontSize: '18px' }}>Live</span>
                    </Link>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <Link to="/shop-owner" style={{
                        padding: '8px 16px',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        color: '#333',
                        textDecoration: 'none',
                        fontSize: '14px'
                    }}>
                        Kênh cho Người Sáng Tạo
                    </Link>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                    }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#ee4d2d',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '14px'
                        }}>
                            S
                        </div>
                        <span style={{ fontSize: '14px' }}>Shop của bạn</span>
                    </div>
                    <button
                        onClick={changeLanguage}
                        style={{
                            padding: '6px 12px',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            background: 'white',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: '#333'
                        }}
                    >
                        🌐 {i18n.language === 'en' ? 'VI' : 'EN'}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>

                {/* Step: List Rooms */}
                {
                    step === 'list' && (
                        <div style={{ background: 'white', borderRadius: '8px', padding: '30px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '30px'
                            }}>
                                <h1 style={{ fontSize: '24px', margin: 0 }}>{t('liveStream.title')}</h1>
                                <button
                                    onClick={() => setStep('create')}
                                    style={{
                                        background: '#ee4d2d',
                                        color: 'white',
                                        border: 'none',
                                        padding: '12px 24px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: '500'
                                    }}
                                >
                                    + {t('liveStream.createRoom')}
                                </button>
                            </div>

                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '60px' }}>Loading...</div>
                            ) : rooms.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>📺</div>
                                    <p>{t('liveStream.empty.message')}</p>
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #eee' }}>
                                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('liveStream.table.title')}</th>
                                            <th style={{ padding: '12px', textAlign: 'left' }}>{t('liveStream.table.status')}</th>
                                            <th style={{ padding: '12px', textAlign: 'center' }}>{t('liveStream.table.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rooms.map(room => (
                                            <tr key={room.id} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '12px' }}>{room.title}</td>
                                                <td style={{ padding: '12px' }}>
                                                    {room.status === 'LIVE' && <span style={{ color: '#ee4d2d' }}>{t('liveStream.status.live')}</span>}
                                                    {room.status === 'PENDING' && <span style={{ color: '#ffc107' }}>{t('liveStream.status.pending')}</span>}
                                                    {room.status === 'ENDED' && <span style={{ color: '#999' }}>{t('liveStream.status.ended')}</span>}
                                                </td>
                                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                                    {room.status !== 'ENDED' && (
                                                        <button
                                                            onClick={() => handleSelectRoom(room)}
                                                            style={{
                                                                background: '#ee4d2d',
                                                                color: 'white',
                                                                border: 'none',
                                                                padding: '8px 16px',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {t('liveStream.actions.start')}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )
                }

                {/* Step: Create Room */}
                {
                    step === 'create' && (
                        <div style={{ background: 'white', borderRadius: '8px', padding: '30px', maxWidth: '600px', margin: '0 auto' }}>
                            <h2 style={{ marginBottom: '30px' }}>{t('liveStream.createModal.title')}</h2>

                            <form onSubmit={handleCreateRoom}>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                        <span style={{ color: 'red' }}>*</span> {t('liveStream.createModal.roomTitle')}
                                    </label>
                                    <input
                                        type="text"
                                        value={newRoom.title}
                                        onChange={(e) => setNewRoom({ ...newRoom, title: e.target.value })}
                                        placeholder={t('liveStream.createModal.roomTitlePlaceholder')}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            fontSize: '14px'
                                        }}
                                        required
                                    />
                                    <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                                        {t('liveStream.createModal.titleLimit')}
                                    </div>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                        {t('liveStream.createModal.description')}
                                    </label>
                                    <textarea
                                        value={newRoom.description}
                                        onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                                        placeholder={t('liveStream.createModal.descriptionPlaceholder')}
                                        rows={4}
                                        style={{
                                            width: '100%',
                                            padding: '12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            fontSize: '14px',
                                            resize: 'vertical'
                                        }}
                                    />
                                    <div style={{ fontSize: '12px', color: '#999', marginTop: '4px', textAlign: 'right' }}>
                                        {newRoom.description.length}/200
                                    </div>
                                </div>

                                {/* Thumbnail Upload */}
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                                        {t('liveStream.createModal.thumbnail')}
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{
                                            width: '160px',
                                            height: '90px', // 16:9
                                            background: '#f5f5f5',
                                            border: '1px dashed #ddd',
                                            borderRadius: '4px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                            position: 'relative'
                                        }}>
                                            {thumbnailPreview ? (
                                                <img
                                                    src={thumbnailPreview}
                                                    alt="Preview"
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <span style={{ color: '#999', fontSize: '12px' }}>{t('liveStream.createModal.noImage')}</span>
                                            )}
                                        </div>
                                        <div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        setThumbnailFile(file);
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => setThumbnailPreview(reader.result);
                                                        reader.readAsDataURL(file);
                                                    }
                                                }}
                                                style={{ display: 'none' }}
                                                id="thumbnail-upload"
                                            />
                                            <label
                                                htmlFor="thumbnail-upload"
                                                style={{
                                                    background: 'white',
                                                    border: '1px solid #ddd',
                                                    padding: '8px 16px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    display: 'inline-block'
                                                }}
                                            >
                                                {t('liveStream.createModal.selectImage')}
                                            </label>
                                            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                                                {t('liveStream.createModal.imageNote')}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Product Selection Section */}
                                <div style={{ marginBottom: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                                    <label style={{ display: 'block', marginBottom: '12px', fontWeight: '500' }}>
                                        {t('liveStream.createModal.relatedProducts')}
                                    </label>

                                    {/* Selected Products Grid */}
                                    {selectedProducts.length > 0 && (
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '10px',
                                            marginBottom: '12px'
                                        }}>
                                            {selectedProducts.slice(0, 8).map(product => (
                                                <div key={product.id} style={{
                                                    width: '60px',
                                                    height: '60px',
                                                    borderRadius: '4px',
                                                    overflow: 'hidden',
                                                    position: 'relative',
                                                    border: '1px solid #ddd'
                                                }}>
                                                    <img
                                                        src={productImageUrls[product.id] || imgFallback}
                                                        onError={(e) => { e.currentTarget.src = imgFallback; }}
                                                        alt={product.name}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleProductSelection(product)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '-6px',
                                                            right: '-6px',
                                                            width: '18px',
                                                            height: '18px',
                                                            borderRadius: '50%',
                                                            background: '#333',
                                                            color: 'white',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '10px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >×</button>
                                                </div>
                                            ))}
                                            {selectedProducts.length > 8 && (
                                                <div style={{
                                                    width: '60px',
                                                    height: '60px',
                                                    borderRadius: '4px',
                                                    background: '#f5f5f5',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '13px',
                                                    color: '#666'
                                                }}>
                                                    +{selectedProducts.length - 8}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Add Product Button */}
                                    <button
                                        type="button"
                                        onClick={handleOpenProductModal}
                                        style={{
                                            background: 'white',
                                            border: '1px dashed #ee4d2d',
                                            borderRadius: '4px',
                                            padding: '12px 20px',
                                            color: '#ee4d2d',
                                            cursor: 'pointer',
                                            fontSize: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        + {t('liveStream.createModal.addProduct')} ({selectedProducts.length}/500)
                                    </button>
                                    <div style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>
                                        {t('liveStream.createModal.productSelectionNote')}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    <button
                                        type="button"
                                        onClick={() => setStep('list')}
                                        style={{
                                            padding: '12px 24px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            background: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('liveStream.createModal.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        style={{
                                            padding: '12px 24px',
                                            border: 'none',
                                            borderRadius: '4px',
                                            background: '#ee4d2d',
                                            color: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t('liveStream.createModal.continue')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )
                }

                {/* Step: Streaming Room */}
                {
                    step === 'streaming' && currentRoom && (
                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 280px', gap: '15px' }}>
                            {/* Left Sidebar - Tool Box */}
                            <div style={{ background: 'white', borderRadius: '8px', padding: '15px' }}>
                                <h4 style={{ fontSize: '12px', marginBottom: '15px', color: '#666', margin: '0 0 15px 0' }}>Tool Box</h4>
                                <div
                                    onClick={handleOpenProductModal}
                                    style={{
                                        textAlign: 'center',
                                        padding: '12px 8px',
                                        borderRadius: '8px',
                                        background: selectedProducts.length > 0 ? '#fff5f5' : '#f9f9f9',
                                        marginBottom: '10px',
                                        cursor: 'pointer',
                                        border: selectedProducts.length > 0 ? '1px solid #ee4d2d' : '1px solid transparent'
                                    }}
                                >
                                    <div style={{ fontSize: '28px', marginBottom: '4px' }}>�</div>
                                    <div style={{ fontSize: '11px', color: '#333' }}>Sản phẩm</div>
                                    {selectedProducts.length > 0 && (
                                        <div style={{
                                            fontSize: '10px',
                                            background: '#ee4d2d',
                                            color: 'white',
                                            borderRadius: '10px',
                                            padding: '2px 6px',
                                            display: 'inline-block',
                                            marginTop: '4px'
                                        }}>
                                            {selectedProducts.length}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Main Content */}
                            <div style={{ background: 'white', borderRadius: '8px', padding: '30px' }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '20px'
                                }}>
                                    <div>
                                        <h2 style={{ margin: 0 }}>{currentRoom.title}</h2>
                                        <p style={{ color: '#666', margin: '5px 0 0', fontSize: '14px' }}>
                                            {currentRoom.description || 'Không có mô tả'}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={() => { setCurrentRoom(null); setStep('list'); }}
                                            style={{
                                                padding: '10px 20px',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                background: 'white',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Trở lại
                                        </button>
                                        {currentRoom.status === 'PENDING' && (
                                            <button
                                                onClick={handleStartLive}
                                                style={{
                                                    padding: '10px 20px',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    background: '#ee4d2d',
                                                    color: 'white',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {t('liveStream.actions.start')}
                                            </button>
                                        )}
                                        {currentRoom.status === 'LIVE' && (
                                            <button
                                                onClick={handleEndLive}
                                                style={{
                                                    padding: '10px 20px',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    background: '#dc3545',
                                                    color: 'white',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {t('liveStream.actions.end')}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* OBS Instructions */}
                                <div style={{
                                    background: '#1a1a1a',
                                    borderRadius: '8px',
                                    padding: '30px',
                                    marginBottom: '20px'
                                }}>
                                    <h3 style={{ color: 'white', marginBottom: '25px', textAlign: 'center' }}>
                                        {t('liveStream.obs.title')}
                                    </h3>

                                    {/* Steps Diagram */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        gap: '30px',
                                        marginBottom: '30px'
                                    }}>
                                        <StepBox number={1} title={t('liveStream.obs.step1')} subtitle={t('liveStream.obs.step1sub')} color="#ee4d2d" />
                                        <Arrow />
                                        <StepBox number={2} title={t('liveStream.obs.step2')} subtitle={t('liveStream.obs.step2sub')} color="#ee4d2d" />
                                        <Arrow />
                                        <StepBox number={3} title={t('liveStream.obs.step3')} subtitle={t('liveStream.obs.step3sub')} color="#28a745" />
                                        <Arrow />
                                        <StepBox number={4} title={t('liveStream.obs.step4')} subtitle={t('liveStream.obs.step4sub')} color="#ee4d2d" />
                                    </div>

                                    {/* URL and Key */}
                                    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                                        <div style={{ marginBottom: '15px' }}>
                                            <label style={{ color: '#999', fontSize: '12px', display: 'block', marginBottom: '5px' }}>{t('liveStream.obs.url')}</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input
                                                    type="text"
                                                    value="rtmp://localhost:1935/live/"
                                                    readOnly
                                                    style={{
                                                        flex: 1,
                                                        padding: '10px 15px',
                                                        border: '1px solid #444',
                                                        borderRadius: '4px',
                                                        background: '#333',
                                                        color: 'white',
                                                        fontSize: '13px'
                                                    }}
                                                />
                                                <button
                                                    onClick={() => copyToClipboard('rtmp://localhost:1935/live/')}
                                                    style={{
                                                        padding: '10px 20px',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        background: '#ee4d2d',
                                                        color: 'white',
                                                        cursor: 'pointer',
                                                        fontSize: '13px'
                                                    }}
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ color: '#999', fontSize: '12px', display: 'block', marginBottom: '5px' }}>{t('liveStream.obs.key')}</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <input
                                                    type="text"
                                                    value={currentRoom.streamKey || t('liveStream.loading')}
                                                    readOnly
                                                    style={{
                                                        flex: 1,
                                                        padding: '10px 15px',
                                                        border: '1px solid #444',
                                                        borderRadius: '4px',
                                                        background: '#333',
                                                        color: 'white',
                                                        fontSize: '13px',
                                                        fontFamily: 'monospace'
                                                    }}
                                                />
                                                <button
                                                    onClick={() => copyToClipboard(currentRoom.streamKey)}
                                                    style={{
                                                        padding: '10px 20px',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        background: '#ee4d2d',
                                                        color: 'white',
                                                        cursor: 'pointer',
                                                        fontSize: '13px'
                                                    }}
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Active Products Management */}
                                    <div style={{
                                        background: '#fff',
                                        borderRadius: '8px',
                                        padding: '20px',
                                        marginTop: '20px',
                                        borderTop: '1px solid #eee'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                            <h3 style={{ margin: 0, fontSize: '18px' }}>{t('liveStream.obs.activeProducts')} ({liveProducts.length})</h3>
                                            <button
                                                onClick={handleOpenProductModal}
                                                style={{
                                                    background: '#ee4d2d', color: 'white', border: 'none',
                                                    padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px'
                                                }}
                                            >+ {t('liveStream.obs.add')}</button>
                                        </div>

                                        {liveProducts.length === 0 ? (
                                            <div style={{ color: '#999', textAlign: 'center', padding: '20px', background: '#f9f9f9', borderRadius: '4px' }}>
                                                {t('liveStream.obs.noActiveProducts')}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
                                                {liveProducts.map(p => (
                                                    <div key={p.id} style={{ border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden', background: 'white' }}>
                                                        <div style={{ display: 'flex', gap: '10px', padding: '10px' }}>
                                                            <img
                                                                src={p.productImageUrl || imgFallback}
                                                                alt=""
                                                                style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', background: '#eee' }}
                                                                onError={(e) => { e.target.src = imgFallback }}
                                                            />
                                                            <div style={{ overflow: 'hidden' }}>
                                                                <div style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {p.productName || t('liveStream.obs.updating')}
                                                                </div>
                                                                <div style={{ color: '#ee4d2d', fontWeight: 'bold', fontSize: '14px' }}>
                                                                    ₫{p.livePrice?.toLocaleString()}
                                                                </div>
                                                                {p.originalPrice > p.livePrice && (
                                                                    <div style={{ fontSize: '11px', color: '#999', textDecoration: 'line-through' }}>
                                                                        ₫{p.originalPrice?.toLocaleString()}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div style={{
                                                            background: '#f8f8f8', padding: '8px 10px',
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            borderTop: '1px solid #eee'
                                                        }}>
                                                            <span style={{ fontSize: '11px', color: '#666' }}>ID: {p.productId?.substring(0, 6)}...</span>
                                                            <button
                                                                onClick={() => handleRemoveProduct(p)}
                                                                style={{
                                                                    color: '#dc3545', background: 'none', border: 'none',
                                                                    cursor: 'pointer', fontSize: '12px', fontWeight: '600'
                                                                }}
                                                            >
                                                                {t('liveStream.obs.remove')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Video Preview */}
                                {currentRoom.status === 'LIVE' && (
                                    <div ref={containerRef} style={{
                                        background: '#000',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        aspectRatio: '16/9',
                                        position: 'relative'
                                    }}>
                                        {/* Floating Reactions Overlay */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '20px',
                                            right: '20px',
                                            width: '100px',
                                            height: '300px',
                                            pointerEvents: 'none',
                                            zIndex: 20,
                                            overflow: 'hidden'
                                        }}>
                                            {reactions.map(r => (
                                                <div
                                                    key={r.id}
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: '-20px',
                                                        left: `${r.x}%`,
                                                        fontSize: '24px',
                                                        animation: 'floatUp 2s ease-out forwards'
                                                    }}
                                                >
                                                    {REACTION_ICONS[r.type] || '❤️'}
                                                </div>
                                            ))}
                                        </div>
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            muted
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        />

                                        {/* Custom Controls */}
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                            padding: '10px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '5px'
                                        }}>
                                            {/* Red Live Progress Bar - Static */}
                                            <div style={{
                                                width: '100%',
                                                height: '4px',
                                                background: '#444',
                                                borderRadius: '2px',
                                                overflow: 'hidden',
                                                marginBottom: '5px'
                                            }}>
                                                <div style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    background: '#ee4d2d', // Red color
                                                    boxShadow: '0 0 10px #ee4d2d'
                                                }}></div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'white' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>


                                                    {/* Volume */}
                                                    <button
                                                        onClick={() => {
                                                            if (videoRef.current) {
                                                                videoRef.current.muted = !videoRef.current.muted;
                                                                setIsMuted(videoRef.current.muted);
                                                            }
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: '20px' }}
                                                    >
                                                        {isMuted ? '🔇' : '🔊'}
                                                    </button>

                                                    <div style={{
                                                        background: '#ee4d2d',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: 'bold',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <div style={{ width: '6px', height: '6px', background: 'white', borderRadius: '50%' }}></div>
                                                        LIVE
                                                    </div>
                                                </div>

                                                {/* Fullscreen */}
                                                <button
                                                    onClick={() => {
                                                        if (containerRef.current) {
                                                            if (!document.fullscreenElement) {
                                                                containerRef.current.requestFullscreen().catch(err => console.error(err));
                                                            } else {
                                                                document.exitFullscreen();
                                                            }
                                                        }
                                                    }}
                                                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0, fontSize: '16px' }}
                                                >
                                                    ⛶
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Sidebar - Chat */}
                            <div style={{ background: 'white', borderRadius: '8px', padding: '15px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <h4 style={{ fontSize: '14px', marginBottom: '15px', margin: '0 0 15px 0' }}>Bình luận</h4>

                                {/* Chat Messages */}
                                <div style={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    border: '1px solid #eee',
                                    borderRadius: '8px',
                                    padding: '10px',
                                    marginBottom: '15px',
                                    minHeight: '200px',
                                    maxHeight: '300px'
                                }}>
                                    {chatMessages.length === 0 ? (
                                        <div style={{ textAlign: 'center', color: '#999', padding: '40px 10px', fontSize: '13px' }}>
                                            <div style={{ fontSize: '36px', marginBottom: '8px' }}>💬</div>
                                            Không có bình luận nào
                                        </div>
                                    ) : (
                                        chatMessages.map((chat, idx) => (
                                            <div key={idx} style={{ marginBottom: '10px', fontSize: '13px' }}>
                                                <span style={{
                                                    fontWeight: '600',
                                                    color: chat.isOwner ? '#ee4d2d' : '#333'
                                                }}>
                                                    {chat.username || 'Khách'}
                                                </span>
                                                {chat.isOwner && (
                                                    <span style={{
                                                        background: '#ee4d2d',
                                                        color: 'white',
                                                        fontSize: '10px',
                                                        padding: '1px 6px',
                                                        borderRadius: '3px',
                                                        marginLeft: '6px',
                                                        fontWeight: '500'
                                                    }}>
                                                        CHỦ SHOP
                                                    </span>
                                                )}
                                                <span style={{ color: '#666', display: 'block', marginTop: '2px' }}>
                                                    {chat.message}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Stats Section */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '10px',
                                    marginBottom: '15px',
                                    padding: '12px',
                                    background: '#f9f9f9',
                                    borderRadius: '8px'
                                }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '20px', fontWeight: '600', color: '#333' }}>{viewerCount}</div>
                                        <div style={{ fontSize: '11px', color: '#999' }}>Người xem</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '20px', fontWeight: '600', color: '#333' }}>{likeCount}</div>
                                        <div style={{ fontSize: '11px', color: '#999' }}>Lượt thích</div>
                                    </div>
                                </div>

                                {/* Chat Input */}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && sendChat()}
                                        placeholder="Nhập bình luận..."
                                        style={{
                                            flex: 1,
                                            padding: '10px 12px',
                                            border: '1px solid #ddd',
                                            borderRadius: '20px',
                                            fontSize: '13px',
                                            outline: 'none'
                                        }}
                                    />
                                    <button
                                        onClick={sendChat}
                                        style={{
                                            padding: '10px 16px',
                                            background: '#ee4d2d',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '20px',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            fontWeight: '500'
                                        }}
                                    >
                                        Gửi
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </main >

            {/* Product Selection Modal */}
            {
                showProductModal && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div style={{
                            background: 'white',
                            borderRadius: '8px',
                            width: '800px',
                            maxWidth: '90vw',
                            maxHeight: '80vh',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            {/* Modal Header */}
                            <div style={{
                                padding: '16px 20px',
                                borderBottom: '1px solid #eee',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <h3 style={{ margin: 0, fontSize: '16px' }}>
                                    ☑️ Thêm sản phẩm liên quan
                                </h3>
                                <button
                                    onClick={() => setShowProductModal(false)}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '20px',
                                        cursor: 'pointer',
                                        color: '#666'
                                    }}
                                >×</button>
                            </div>

                            {/* Modal Body */}
                            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                                {/* Left Sidebar - Tabs */}
                                <div style={{
                                    width: '160px',
                                    borderRight: '1px solid #eee',
                                    padding: '10px 0'
                                }}>
                                    <div style={{
                                        padding: '10px 15px',
                                        background: '#fff1f0',
                                        color: '#ee4d2d',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }}>
                                        Shop của tôi
                                    </div>
                                </div>

                                {/* Right Content - Products */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    {/* Search */}
                                    <div style={{ padding: '15px' }}>
                                        <input
                                            type="text"
                                            placeholder="Tìm kiếm sản phẩm"
                                            value={productSearchKeyword}
                                            onChange={(e) => setProductSearchKeyword(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '10px 15px',
                                                border: '1px solid #ddd',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                        />
                                    </div>

                                    {/* Products Grid */}
                                    <div style={{
                                        flex: 1,
                                        overflow: 'auto',
                                        padding: '0 15px'
                                    }}>
                                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                                            Sản phẩm
                                        </div>
                                        {loadingProducts ? (
                                            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                                Đang tải...
                                            </div>
                                        ) : shopProducts.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                                Không có sản phẩm nào
                                            </div>
                                        ) : (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(5, 1fr)',
                                                gap: '12px'
                                            }}>
                                                {shopProducts.map(product => {
                                                    const isSelected = selectedProducts.some(p => p.id === product.id);
                                                    return (
                                                        <div
                                                            key={product.id}
                                                            onClick={() => toggleProductSelection(product)}
                                                            style={{
                                                                cursor: 'pointer',
                                                                border: isSelected ? '2px solid #ee4d2d' : '1px solid #eee',
                                                                borderRadius: '4px',
                                                                overflow: 'hidden',
                                                                position: 'relative'
                                                            }}
                                                        >
                                                            {/* Checkbox */}
                                                            <div style={{
                                                                position: 'absolute',
                                                                top: '5px',
                                                                left: '5px',
                                                                width: '18px',
                                                                height: '18px',
                                                                borderRadius: '3px',
                                                                background: isSelected ? '#ee4d2d' : 'white',
                                                                border: isSelected ? 'none' : '1px solid #ddd',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                color: 'white',
                                                                fontSize: '12px',
                                                                zIndex: 1
                                                            }}>
                                                                {isSelected && '✓'}
                                                            </div>
                                                            {/* Image */}
                                                            <div style={{
                                                                aspectRatio: '1',
                                                                background: '#f5f5f5'
                                                            }}>
                                                                <img
                                                                    src={productImageUrls[product.id] || imgFallback}
                                                                    onError={(e) => { e.currentTarget.src = imgFallback; }}
                                                                    alt={product.name}
                                                                    style={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'cover'
                                                                    }}
                                                                />
                                                            </div>
                                                            {/* Info */}
                                                            <div style={{ padding: '8px' }}>
                                                                <div style={{
                                                                    fontSize: '12px',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap',
                                                                    marginBottom: '4px'
                                                                }}>
                                                                    {product.name}
                                                                </div>
                                                                <div style={{
                                                                    fontSize: '12px',
                                                                    color: '#ee4d2d'
                                                                }}>
                                                                    ₫{product.price?.toLocaleString() || '0'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Selected Products with Price Input */}
                            {selectedProducts.length > 0 && (
                                <div style={{
                                    padding: '15px 20px',
                                    borderTop: '1px solid #eee',
                                    background: '#fafafa',
                                    maxHeight: '200px',
                                    overflow: 'auto'
                                }}>
                                    <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: '#333' }}>
                                        Sản phẩm đã chọn ({selectedProducts.length}) - Nhập giá Live:
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {selectedProducts.map(product => (
                                            <div key={product.id} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                background: 'white',
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid #eee'
                                            }}>
                                                <img
                                                    src={productImageUrls[product.id] || imgFallback}
                                                    alt={product.name}
                                                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }}
                                                />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {product.name}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#888' }}>
                                                        Giá gốc: ₫{product.price?.toLocaleString() || '0'} | Tồn kho: {product.totalStock || 0}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    {/* Live Price Input */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '11px', color: '#666', width: '70px' }}>Giá Live:</span>
                                                        <input
                                                            type="number"
                                                            value={productPrices[product.id] || product.price || ''}
                                                            onChange={(e) => setProductPrices(prev => ({
                                                                ...prev,
                                                                [product.id]: e.target.value
                                                            }))}
                                                            onClick={(e) => e.stopPropagation()}
                                                            placeholder="Nhập giá"
                                                            style={{
                                                                width: '110px',
                                                                padding: '4px 8px',
                                                                border: '1px solid #ddd',
                                                                borderRadius: '4px',
                                                                fontSize: '12px'
                                                            }}
                                                        />
                                                    </div>
                                                    {/* Quantity Input */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '11px', color: '#666', width: '70px' }}>Số lượng:</span>
                                                        <input
                                                            type="number"
                                                            value={productQuantities[product.id] || product.totalStock || ''}
                                                            onChange={(e) => setProductQuantities(prev => ({
                                                                ...prev,
                                                                [product.id]: e.target.value
                                                            }))}
                                                            onClick={(e) => e.stopPropagation()}
                                                            placeholder="Số lượng bán"
                                                            max={product.totalStock || 999}
                                                            style={{
                                                                width: '110px',
                                                                padding: '4px 8px',
                                                                border: '1px solid #ddd',
                                                                borderRadius: '4px',
                                                                fontSize: '12px'
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleProductSelection(product);
                                                    }}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#999',
                                                        cursor: 'pointer',
                                                        fontSize: '16px',
                                                        alignSelf: 'flex-start'
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div style={{
                                padding: '15px 20px',
                                borderTop: '1px solid #eee',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={shopProducts.length > 0 && shopProducts.every(p => selectedProducts.some(sp => sp.id === p.id))}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                // Select all current page products (up to 500 total)
                                                const newProducts = shopProducts.filter(p => !selectedProducts.some(sp => sp.id === p.id));
                                                const canAdd = 500 - selectedProducts.length;
                                                setSelectedProducts(prev => [...prev, ...newProducts.slice(0, canAdd)]);
                                            } else {
                                                // Deselect all current page products
                                                const currentIds = shopProducts.map(p => p.id);
                                                setSelectedProducts(prev => prev.filter(p => !currentIds.includes(p.id)));
                                            }
                                        }}
                                    />
                                    <span style={{ fontSize: '14px' }}>Chọn tất cả</span>
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <span style={{ color: '#ee4d2d', fontSize: '14px' }}>
                                        {selectedProducts.length}/500 Đã chọn
                                    </span>
                                    <button
                                        onClick={() => setShowProductModal(false)}
                                        style={{
                                            padding: '8px 20px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            background: 'white',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={handleConfirmProducts}
                                        disabled={addingProducts || selectedProducts.length === 0}
                                        style={{
                                            padding: '8px 20px',
                                            border: 'none',
                                            borderRadius: '4px',
                                            background: addingProducts || selectedProducts.length === 0 ? '#ccc' : '#ee4d2d',
                                            color: 'white',
                                            cursor: addingProducts || selectedProducts.length === 0 ? 'not-allowed' : 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        {addingProducts ? 'Đang thêm...' : `Thêm ${selectedProducts.length} sản phẩm`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            <style>{`
                @keyframes floatUp {
                    0% { transform: translateY(0) scale(1); opacity: 1; }
                    100% { transform: translateY(-200px) scale(1.5); opacity: 0; }
                }
            `}</style>
        </div >
    );
}

// Helper Components
function StepBox({ number, title, subtitle, color }) {
    return (
        <div style={{ textAlign: 'center', width: '100px' }}>
            <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '14px'
            }}>
                {number === 3 ? 'START' : 'COPY'}
            </div>
            <div style={{ color: 'white', fontSize: '11px', lineHeight: 1.4 }}>
                {number}. {title}<br />{subtitle}
            </div>
        </div>
    );
}

function Arrow() {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            color: '#666',
            fontSize: '20px'
        }}>
            →→→
        </div>
    );
}
