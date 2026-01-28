package com.example.notificationservice.service;

import com.example.notificationservice.client.StockServiceClient;
import com.example.notificationservice.client.UserServiceClient;
import com.example.notificationservice.dto.*;
import com.example.notificationservice.enums.LiveChatType;
import com.example.notificationservice.enums.LiveStatus;
import com.example.notificationservice.model.LiveChat;
import com.example.notificationservice.model.LiveProduct;
import com.example.notificationservice.model.LiveRoom;
import com.example.notificationservice.repository.LiveChatRepository;
import com.example.notificationservice.repository.LiveProductRepository;
import com.example.notificationservice.repository.LiveRoomRepository;
import com.example.notificationservice.request.AddLiveProductRequest;
import com.example.notificationservice.request.CreateLiveRoomRequest;
import com.example.notificationservice.request.LiveChatRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LiveService {

    private final LiveRoomRepository liveRoomRepository;
    private final LiveProductRepository liveProductRepository;
    private final LiveChatRepository liveChatRepository;
    private final StockServiceClient stockServiceClient;
    private final UserServiceClient userServiceClient;
    private final SimpMessagingTemplate messagingTemplate;

    private static final String HLS_BASE_URL = "/hls/";

    @org.springframework.beans.factory.annotation.Value("${app.file-storage.base-url}")
    private String fileStorageBaseUrl;

    // ==================== ROOM MANAGEMENT ====================

    @Transactional
    public LiveRoomDto createLiveRoom(String shopOwnerId, CreateLiveRoomRequest request) {
        // Check if already has active live room
        if (liveRoomRepository.hasActiveLiveRoom(shopOwnerId)) {
            throw new RuntimeException("Shop owner already has an active live room");
        }

        LiveRoom room = LiveRoom.builder()
                .shopOwnerId(shopOwnerId)
                .title(request.getTitle())
                .description(request.getDescription())
                .thumbnailUrl(request.getThumbnailUrl())
                .status(LiveStatus.PENDING)
                .build();

        room = liveRoomRepository.save(room);
        log.info("Created live room {} for shop {}", room.getId(), shopOwnerId);

        return mapToDto(room, true);
    }

    public LiveRoomDto getLiveRoom(String roomId) {
        LiveRoom room = liveRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Live room not found"));
        return mapToDto(room, false);
    }

    public LiveRoomDto getLiveRoomWithStreamKey(String roomId, String shopOwnerId) {
        LiveRoom room = liveRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Live room not found"));

        if (!room.getShopOwnerId().equals(shopOwnerId)) {
            throw new RuntimeException("Unauthorized to view stream key");
        }

        return mapToDto(room, true);
    }

    public Page<LiveRoomDto> getLiveRooms(Pageable pageable) {
        return liveRoomRepository.findByStatus(LiveStatus.LIVE, pageable)
                .map(room -> mapToDto(room, false));
    }

    public Page<LiveRoomDto> getMyLiveRooms(String shopOwnerId, Pageable pageable) {
        return liveRoomRepository.findByShopOwnerId(shopOwnerId, pageable)
                .map(room -> mapToDto(room, true));
    }

    @Transactional
    public LiveRoomDto startLive(String roomId, String shopOwnerId) {
        LiveRoom room = liveRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Live room not found"));

        if (!room.getShopOwnerId().equals(shopOwnerId)) {
            throw new RuntimeException("Unauthorized");
        }

        if (room.getStatus() == LiveStatus.LIVE) {
            throw new RuntimeException("Room is already live");
        }

        room.setStatus(LiveStatus.LIVE);
        room.setStartedAt(LocalDateTime.now());
        room = liveRoomRepository.save(room);

        log.info("Live room {} started by shop {}", roomId, shopOwnerId);

        // Broadcast status change
        broadcastRoomStatus(room);

        return mapToDto(room, true);
    }

    @Transactional
    public LiveRoomDto endLive(String roomId, String shopOwnerId) {
        LiveRoom room = liveRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Live room not found"));

        if (!room.getShopOwnerId().equals(shopOwnerId)) {
            throw new RuntimeException("Unauthorized");
        }

        room.setStatus(LiveStatus.ENDED);
        room.setEndedAt(LocalDateTime.now());
        room = liveRoomRepository.save(room);

        log.info("Live room {} ended by shop {}", roomId, shopOwnerId);

        // Broadcast status change
        broadcastRoomStatus(room);

        return mapToDto(room, true);
    }

    // RTMP Callbacks
    @Transactional
    public void handleStreamStart(String streamKey) {
        LiveRoom room = liveRoomRepository.findByStreamKey(streamKey)
                .orElseThrow(() -> new RuntimeException("Invalid stream key"));

        if (room.getStatus() != LiveStatus.LIVE) {
            room.setStatus(LiveStatus.LIVE);
            room.setStartedAt(LocalDateTime.now());
            liveRoomRepository.save(room);

            log.info("Stream started via OBS for room {}", room.getId());
            broadcastRoomStatus(room);
        }
    }

    @Transactional
    public void handleStreamEnd(String streamKey) {
        LiveRoom room = liveRoomRepository.findByStreamKey(streamKey)
                .orElseThrow(() -> new RuntimeException("Invalid stream key"));

        room.setStatus(LiveStatus.ENDED);
        room.setEndedAt(LocalDateTime.now());
        liveRoomRepository.save(room);

        log.info("Stream ended via OBS for room {}", room.getId());
        broadcastRoomStatus(room);
    }

    // ==================== PRODUCT MANAGEMENT ====================

    @Transactional
    public LiveProductDto addProduct(String roomId, String shopOwnerId, AddLiveProductRequest request) {
        LiveRoom room = liveRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Live room not found"));

        if (!room.getShopOwnerId().equals(shopOwnerId)) {
            throw new RuntimeException("Unauthorized");
        }

        // Check if product already exists
        LiveProduct existingProduct = liveProductRepository.findByLiveRoomIdAndProductId(roomId, request.getProductId())
                .orElse(null);

        // Fetch product info from stock-service
        ProductDto productInfo = null;
        try {
            var response = stockServiceClient.getProductById(request.getProductId());
            if (response.getStatusCode().is2xxSuccessful()) {
                productInfo = response.getBody();
            }
        } catch (Exception e) {
            log.warn("Could not fetch product info for {}: {}", request.getProductId(), e.getMessage());
        }

        if (productInfo == null) {
            productInfo = ProductDto.builder()
                    .id(request.getProductId())
                    .name("Product " + request.getProductId())
                    .price(0.0)
                    .build();
        }

        // Validate quantity limit
        if (request.getQuantityLimit() != null && request.getQuantityLimit() > 0) {
            // Note: productInfo.getTotalStock() may be null if product fetch failed
            // In that case, we allow any quantity (will be validated at checkout)
            Integer availableStock = productInfo.getTotalStock();
            if (availableStock != null && request.getQuantityLimit() > availableStock) {
                throw new RuntimeException("Số lượng muốn bán (" + request.getQuantityLimit() +
                        ") vượt quá tồn kho (" + availableStock + ")");
            }
        }

        LiveProduct product;
        if (existingProduct != null) {
            // Update existing product
            product = existingProduct;
            product.setProductName(productInfo.getName());
            // Convert imageId to full URL
            String imageUrl = null;
            if (productInfo.getImageId() != null) {
                if (productInfo.getImageId().startsWith("http")) {
                    imageUrl = productInfo.getImageId();
                } else {
                    imageUrl = fileStorageBaseUrl + productInfo.getImageId();
                }
            }
            product.setProductImageUrl(imageUrl);
            product.setOriginalPrice(productInfo.getPrice());
            product.setLivePrice(request.getLivePrice() != null ? request.getLivePrice() : productInfo.getPrice());
            product.setQuantityLimit(request.getQuantityLimit());
            product.setStockAvailable(request.getQuantityLimit());
            if (request.getDisplayOrder() != null) {
                product.setDisplayOrder(request.getDisplayOrder());
            }
            log.info("Updated existing product {} in live room {}", request.getProductId(), roomId);
        } else {
            // Create new product
            // Convert imageId to full URL
            String imageUrl = null;
            if (productInfo.getImageId() != null) {
                if (productInfo.getImageId().startsWith("http")) {
                    imageUrl = productInfo.getImageId();
                } else {
                    imageUrl = fileStorageBaseUrl + productInfo.getImageId();
                }
            }
            product = LiveProduct.builder()
                    .liveRoom(room)
                    .productId(request.getProductId())
                    .productName(productInfo.getName())
                    .productImageUrl(imageUrl)
                    .originalPrice(productInfo.getPrice())
                    .livePrice(request.getLivePrice() != null ? request.getLivePrice() : productInfo.getPrice())
                    .quantityLimit(request.getQuantityLimit())
                    .stockAvailable(request.getQuantityLimit())
                    .displayOrder(request.getDisplayOrder() != null ? request.getDisplayOrder() : 0)
                    .build();
            log.info("Added new product {} to live room {}", request.getProductId(), roomId);
        }

        // Calculate discount percent
        if (request.getLivePrice() != null && productInfo.getPrice() != null && productInfo.getPrice() > 0) {
            double discount = ((productInfo.getPrice() - request.getLivePrice()) / productInfo.getPrice()) * 100;
            product.setDiscountPercent(Math.max(0, discount));
        }

        product = liveProductRepository.save(product);

        // Broadcast product list update
        broadcastProductUpdate(roomId);

        return mapToDto(product);
    }

    @Transactional
    public LiveProductDto featureProduct(String roomId, String productId, String shopOwnerId) {
        LiveRoom room = liveRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Live room not found"));

        if (!room.getShopOwnerId().equals(shopOwnerId)) {
            throw new RuntimeException("Unauthorized");
        }

        // Clear all featured
        liveProductRepository.clearFeaturedInRoom(roomId);

        // Set new featured
        LiveProduct product = liveProductRepository.findByLiveRoomIdAndProductId(roomId, productId)
                .orElseThrow(() -> new RuntimeException("Product not found in this live room"));

        product.setIsFeatured(true);
        product = liveProductRepository.save(product);

        log.info("Featured product {} in live room {}", productId, roomId);

        // Broadcast product update
        broadcastProductUpdate(roomId);

        return mapToDto(product);
    }

    @Transactional
    public void removeProduct(String roomId, String productId, String shopOwnerId) {
        LiveRoom room = liveRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Live room not found"));

        if (!room.getShopOwnerId().equals(shopOwnerId)) {
            throw new RuntimeException("Unauthorized");
        }

        LiveProduct product = liveProductRepository.findByLiveRoomIdAndProductId(roomId, productId)
                .orElseThrow(() -> new RuntimeException("Product not found"));

        liveProductRepository.delete(product);
        log.info("Removed product {} from live room {}", productId, roomId);

        // Broadcast product update
        broadcastProductUpdate(roomId);
    }

    public List<LiveProductDto> getProducts(String roomId) {
        return liveProductRepository.findByLiveRoomIdOrderByDisplayOrderAsc(roomId)
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    // ==================== CHAT MANAGEMENT ====================

    @Transactional
    public LiveChatDto sendChat(String roomId, String userId, String username, String avatarUrl,
            LiveChatRequest request) {
        LiveRoom room = liveRoomRepository.findById(roomId)
                .orElseThrow(() -> new RuntimeException("Live room not found"));

        if (room.getStatus() != LiveStatus.LIVE) {
            throw new RuntimeException("Live room is not active");
        }

        LiveChat chat = LiveChat.builder()
                .liveRoomId(roomId)
                .userId(userId)
                .username(username)
                .avatarUrl(avatarUrl)
                .message(request.getMessage())
                .type(LiveChatType.CHAT)
                .build();

        chat = liveChatRepository.save(chat);

        LiveChatDto chatDto = mapToDto(chat);

        // Broadcast to room
        messagingTemplate.convertAndSend("/topic/live/" + roomId + "/chat", chatDto);

        return chatDto;
    }

    public List<LiveChatDto> getRecentChats(String roomId) {
        return liveChatRepository.findTop50ByLiveRoomIdOrderByCreatedAtDesc(roomId)
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    // ==================== VIEWER COUNT ====================

    @Transactional
    public void updateViewerCount(String roomId, int count) {
        liveRoomRepository.updateViewerCount(roomId, count);

        // Broadcast to room
        messagingTemplate.convertAndSend("/topic/live/" + roomId + "/viewers",
                java.util.Map.of("count", count));
    }

    // ==================== BROADCAST HELPERS ====================

    private void broadcastRoomStatus(LiveRoom room) {
        // Use HashMap instead of Map.of() because Map.of() doesn't allow null values
        java.util.Map<String, Object> statusMap = new java.util.HashMap<>();
        statusMap.put("status", room.getStatus().name());
        statusMap.put("startedAt", room.getStartedAt() != null ? room.getStartedAt().toString() : "");
        statusMap.put("endedAt", room.getEndedAt() != null ? room.getEndedAt().toString() : "");

        messagingTemplate.convertAndSend("/topic/live/" + room.getId() + "/status", statusMap);
    }

    private void broadcastProductUpdate(String roomId) {
        List<LiveProductDto> products = getProducts(roomId);
        messagingTemplate.convertAndSend("/topic/live/" + roomId + "/product", products);
    }

    public void broadcastOrderNotification(String roomId, String username, String productName) {
        LiveChatDto orderChat = LiveChatDto.builder()
                .liveRoomId(roomId)
                .type(LiveChatType.ORDER)
                .message(username + " vừa mua " + productName + "!")
                .createdAt(LocalDateTime.now())
                .id(java.util.UUID.randomUUID().toString())
                .build();

        messagingTemplate.convertAndSend("/topic/live/" + roomId + "/order", orderChat);
    }

    // ==================== MAPPERS ====================

    private LiveRoomDto mapToDto(LiveRoom room, boolean includeStreamKey) {
        // Fetch shop info
        String shopName = "Shop";
        String shopAvatarUrl = null;
        try {
            // Priority 1: Try to get Shop Info
            try {
                var shopResponse = userServiceClient.getShopOwnerByUserId(room.getShopOwnerId());
                if (shopResponse.getStatusCode().is2xxSuccessful() && shopResponse.getBody() != null) {
                    com.example.notificationservice.dto.ShopOwnerDto shop = shopResponse.getBody();
                    shopName = shop.getShopName();
                    shopAvatarUrl = shop.getImageUrl();
                }
            } catch (Exception ex) {
                // If not a shop owner or error, fall back to User info
                var response = userServiceClient.getUserById(room.getShopOwnerId());
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    UserDto user = response.getBody();
                    shopName = user.getFirstName() + " " + user.getLastName();
                    shopAvatarUrl = user.getProfileImage();
                }
            }
        } catch (Exception e) {
            // Second catch block for User fetch fail
            log.warn("Could not fetch user info for {}", room.getShopOwnerId());
        }

        List<LiveProductDto> products = room.getProducts() != null
                ? room.getProducts().stream().map(this::mapToDto).collect(Collectors.toList())
                : List.of();

        // String thumbnailUrl = room.getThumbnailUrl();
        // if (thumbnailUrl != null && thumbnailUrl.contains(fileStorageBaseUrl)) {
        //     thumbnailUrl = thumbnailUrl.replace(fileStorageBaseUrl, "");
        // }

        return LiveRoomDto.builder()
                .id(room.getId())
                .shopOwnerId(room.getShopOwnerId())
                .shopName(shopName)
                .shopAvatarUrl(shopAvatarUrl)
                .title(room.getTitle())
                .description(room.getDescription())
                .streamKey(includeStreamKey ? room.getStreamKey() : null)
                .streamUrl(HLS_BASE_URL + room.getStreamKey() + ".m3u8")
                .thumbnailUrl(room.getThumbnailUrl())
                .status(room.getStatus())
                .viewerCount(room.getViewerCount())
                .peakViewers(room.getPeakViewers())
                .totalOrders(room.getTotalOrders())
                .totalRevenue(room.getTotalRevenue())
                .startedAt(room.getStartedAt())
                .endedAt(room.getEndedAt())
                .createdAt(room.getCreatedAt())
                .products(products)
                .build();
    }

    private LiveProductDto mapToDto(LiveProduct product) {
        // Compute remaining quantity and out-of-stock status
        Integer soldCount = product.getSoldCount() != null ? product.getSoldCount() : 0;
        Integer quantityLimit = product.getQuantityLimit() != null ? product.getQuantityLimit() : 0;
        Integer remainingQuantity = quantityLimit - soldCount;
        Boolean isOutOfStock = remainingQuantity <= 0;

        String imageUrl = product.getProductImageUrl();
        // if (imageUrl != null && imageUrl.contains(fileStorageBaseUrl)) {
        //     imageUrl = imageUrl.replace(fileStorageBaseUrl, "");
        // }

        return LiveProductDto.builder()
                .id(product.getId())
                .liveRoomId(product.getLiveRoom().getId())
                .productId(product.getProductId())
                .productName(product.getProductName())
                .productImageUrl(imageUrl)
                .originalPrice(product.getOriginalPrice())
                .livePrice(product.getLivePrice())
                .discountPercent(product.getDiscountPercent())
                .quantityLimit(product.getQuantityLimit())
                .stockAvailable(product.getStockAvailable())
                .soldCount(soldCount)
                .isFeatured(product.getIsFeatured())
                .displayOrder(product.getDisplayOrder())
                .createdAt(product.getCreatedAt())
                // Computed fields
                .remainingQuantity(remainingQuantity)
                .isOutOfStock(isOutOfStock)
                .build();
    }

    private LiveChatDto mapToDto(LiveChat chat) {
        return LiveChatDto.builder()
                .id(chat.getId())
                .liveRoomId(chat.getLiveRoomId())
                .userId(chat.getUserId())
                .username(chat.getUsername())
                .avatarUrl(chat.getAvatarUrl())
                .message(chat.getMessage())
                .type(chat.getType())
                .isPinned(chat.getIsPinned())
                .productId(chat.getProductId())
                .productName(chat.getProductName())
                .createdAt(chat.getCreatedAt())
                .build();
    }
}
