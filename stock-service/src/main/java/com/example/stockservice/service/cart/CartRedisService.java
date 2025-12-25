package com.example.stockservice.service.cart;


import com.example.stockservice.dto.RedisCartDto;
import com.example.stockservice.dto.RedisCartItemDto;
import com.example.stockservice.model.Product;
import com.example.stockservice.model.Size;
import com.example.stockservice.repository.SizeRepository;
import com.example.stockservice.service.product.ProductService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class CartRedisService {
    private final RedisTemplate<String, Object> redisTemplate;
    private final ProductService productService;
    private final SizeRepository sizeRepository;

    private static final String CART_KEY_PREFIX = "cart:user:";
    private static final long CART_TTL_MINUTES = 30;

    // Lấy giỏ hàng từ Redis, nếu không có thì tạo mới
    public RedisCartDto getOrCreateCart(String userId) {
        String key = CART_KEY_PREFIX + userId;
        RedisCartDto cart = (RedisCartDto) redisTemplate.opsForValue().get(key);
        if (cart == null) {
            cart = RedisCartDto.builder()
                    .cartId(UUID.randomUUID().toString())
                    .userId(userId)
                    .totalAmount(0.0)
                    .items(new HashMap<>())
                    .build();
            saveCart(userId, cart);
        }
        return cart;
    }

    // Lưu giỏ hàng vào Redis với TTL
    private void saveCart(String userId, RedisCartDto cart) {
        String key = CART_KEY_PREFIX + userId;
        redisTemplate.opsForValue().set(key, cart, CART_TTL_MINUTES, TimeUnit.MINUTES);
    }

    // Lấy giỏ hàng từ Redis theo userId
    public RedisCartDto getCartByUserId(String userId) {
        String key = CART_KEY_PREFIX + userId;
        return (RedisCartDto) redisTemplate.opsForValue().get(key);
    }

    /**
     * Lấy giỏ hàng và refresh data từ database (Refresh on View strategy)
     * - Cập nhật giá sản phẩm mới nhất
     * - Cập nhật số lượng tồn kho
     * - Đánh dấu nếu sản phẩm/size đã bị xóa
     */
    public RedisCartDto getCartWithRefresh(String userId) {
        RedisCartDto cart = getCartByUserId(userId);
        if (cart == null || cart.getItems() == null || cart.getItems().isEmpty()) {
            return cart;
        }

        boolean cartUpdated = false;

        for (RedisCartItemDto item : cart.getItems().values()) {
            // Default to available for legacy data or if checks fail
            if (item.getProductAvailable() == null) item.setProductAvailable(true);
            if (item.getSizeAvailable() == null) item.setSizeAvailable(true);
            if (item.getAvailableStock() == null) item.setAvailableStock(Integer.MAX_VALUE);

            // Skip live items - they keep their live price and availability (simplified for now)
            if (Boolean.TRUE.equals(item.getIsFromLive())) {
                continue;
            }

            try {
                Product product = productService.getProductById(item.getProductId());
                
                if (product == null) {
                    // Sản phẩm đã bị xóa
                    item.setProductAvailable(false);
                    item.setAvailableStock(0);
                    cartUpdated = true;
                    log.warn("Product {} no longer exists", item.getProductId());
                    continue;
                }

                // Check active status
                if (product.getStatus() == com.example.stockservice.enums.ProductStatus.BANNED || 
                    product.getStatus() == com.example.stockservice.enums.ProductStatus.SUSPENDED) {
                    item.setProductAvailable(false);
                    item.setAvailableStock(0);
                    cartUpdated = true;
                    log.warn("Product {} is {}", item.getProductId(), product.getStatus());
                    continue;
                }

                // Cập nhật thông tin sản phẩm mới nhất
                item.setProductName(product.getName());
                item.setImageId(product.getImageId());
                item.setProductAvailable(true);

                double currentPrice = product.getPrice();
                int currentStock = 0;

                if (item.getSizeId() != null && !item.getSizeId().isEmpty()) {
                    // Có size - lấy thông tin size
                    Size size = sizeRepository.findById(item.getSizeId()).orElse(null);
                    
                    if (size == null) {
                        // Size đã bị xóa
                        item.setSizeAvailable(false);
                        item.setAvailableStock(0);
                        cartUpdated = true;
                        log.warn("Size {} no longer exists for product {}", item.getSizeId(), item.getProductId());
                        continue;
                    }
                    
                    item.setSizeAvailable(true);
                    item.setSizeName(size.getName());
                    currentPrice = product.getPrice() + size.getPriceModifier();
                    currentStock = size.getStock();
                } else {
                    // Không có size - tính tổng stock của tất cả sizes
                    if (product.getSizes() != null && !product.getSizes().isEmpty()) {
                        currentStock = product.getSizes().stream()
                                .mapToInt(Size::getStock)
                                .sum();
                    }
                    item.setSizeAvailable(true);
                }

                // Cập nhật stock
                item.setAvailableStock(currentStock);

                // Kiểm tra giá có thay đổi không
                if (Math.abs(item.getUnitPrice() - currentPrice) > 0.01) {
                    item.setOldPrice(item.getUnitPrice());
                    item.setUnitPrice(currentPrice);
                    item.setPriceChanged(true);
                    item.setTotalPrice(currentPrice * item.getQuantity());
                    cartUpdated = true;
                    log.info("Price changed for product {}: {} -> {}", 
                            item.getProductId(), item.getOldPrice(), currentPrice);
                } else {
                    item.setPriceChanged(false);
                    item.setOldPrice(null);
                }

            } catch (Exception e) {
                log.error("Error refreshing cart item {}: {}", item.getProductId(), e.getMessage());
                // Giữ nguyên item nếu có lỗi, đảm bảo available=true (đã set ở trên) để không chặn user
            }
        }

        // Lưu lại cart nếu có thay đổi
        if (cartUpdated) {
            cart.calculateTotalAmount();
            saveCart(userId, cart);
        }

        return cart;
    }

    // Thêm product vào giỏ hàng
    public RedisCartItemDto addItemToCart(String userId, String productId, String sizeId, int quantity) {
        RedisCartDto cart = getOrCreateCart(userId); // Lấy giỏ hàng hoặc tạo mới nếu chưa có
        Product product = productService.getProductById(productId);
        if (product == null) throw new RuntimeException("Product not found");
        String itemKey = productId + (sizeId != null && !sizeId.isEmpty() ? ":" + sizeId : ""); // Tạo key duy nhất cho item dựa trên productId và sizeId

        // Calculate price with size modifier and get stock
        double unitPrice = product.getPrice();
        String sizeName = null;
        int availableStock = 0;
        if (sizeId != null && !sizeId.isEmpty()) {
            Size size = sizeRepository.findById(sizeId)
                    .orElseThrow(() -> new RuntimeException("Size not found with id: " + sizeId));
            unitPrice = product.getPrice() + size.getPriceModifier();
            sizeName = size.getName();
            availableStock = size.getStock();
        } else if (product.getSizes() != null && !product.getSizes().isEmpty()) {
            availableStock = product.getSizes().stream()
                    .mapToInt(Size::getStock)
                    .sum();
        }

        RedisCartItemDto cartItem = cart.getItems().getOrDefault(itemKey, null); // Kiểm tra item đã có trong giỏ hàng chưa
        int currentQuantity = cartItem != null ? cartItem.getQuantity() : 0;
        int newTotalQuantity = currentQuantity + quantity;

        // Validate stock
        if (newTotalQuantity > availableStock) {
            throw new RuntimeException("INSUFFICIENT_STOCK:" + availableStock);
        }

        if (cartItem != null) {
            cartItem.setQuantity(newTotalQuantity); // Cập nhật số lượng nếu đã có
        } else {
            cartItem = RedisCartItemDto.builder() // Tạo mới item nếu chưa có
                    .cartItemId(UUID.randomUUID().toString())
                    .productId(productId)
                    .sizeId(sizeId)
                    .sizeName(sizeName)
                    .quantity(quantity)
                    .unitPrice(unitPrice)
                    .productName(product.getName())
                    .imageId(product.getImageId())
                    .build();
        }

        cartItem.setTotalPrice(cartItem.getQuantity() * cartItem.getUnitPrice()); // Cập nhật tổng giá tiền của item
        cart.getItems().put(itemKey, cartItem); // Thêm hoặc cập nhật item trong giỏ hàng

        cart.calculateTotalAmount();
        saveCart(userId, cart); // Lưu giỏ hàng cập nhật vào Redis
        addProductToUserIndex(productId, userId);
        return cartItem;
    }

    /**
     * Thêm product từ Live Stream vào giỏ hàng với giá live
     * @param userId User ID
     * @param productId Product ID
     * @param sizeId Size ID (optional)
     * @param quantity Số lượng
     * @param liveRoomId ID phòng live
     * @param liveProductId ID trong bảng live_products
     * @param livePrice Giá live tại thời điểm thêm
     * @param originalPrice Giá gốc (để hiển thị)
     */
    public RedisCartItemDto addLiveItemToCart(
            String userId, 
            String productId, 
            String sizeId, 
            int quantity,
            String liveRoomId,
            String liveProductId,
            Double livePrice,
            Double originalPrice
    ) {
        RedisCartDto cart = getOrCreateCart(userId);
        Product product = productService.getProductById(productId);
        if (product == null) throw new RuntimeException("Product not found");
        
        // Key bao gồm liveRoomId để phân biệt với item mua bình thường
        String itemKey = productId + ":live:" + liveRoomId + (sizeId != null && !sizeId.isEmpty() ? ":" + sizeId : "");
        
        String sizeName = null;
        double finalLivePrice = livePrice != null ? livePrice : product.getPrice();
        
        if (sizeId != null && !sizeId.isEmpty()) {
            Size size = sizeRepository.findById(sizeId)
                    .orElseThrow(() -> new RuntimeException("Size not found with id: " + sizeId));
            finalLivePrice = livePrice != null ? livePrice + size.getPriceModifier() : product.getPrice() + size.getPriceModifier();
            sizeName = size.getName();
        }

        RedisCartItemDto cartItem = cart.getItems().getOrDefault(itemKey, null);
        if (cartItem != null) {
            cartItem.setQuantity(cartItem.getQuantity() + quantity);
        } else {
            cartItem = RedisCartItemDto.builder()
                    .cartItemId(UUID.randomUUID().toString())
                    .productId(productId)
                    .sizeId(sizeId)
                    .sizeName(sizeName)
                    .quantity(quantity)
                    .unitPrice(finalLivePrice)  // Dùng giá live
                    .productName(product.getName())
                    .imageId(product.getImageId())
                    // Live commerce fields
                    .liveRoomId(liveRoomId)
                    .liveProductId(liveProductId)
                    .livePrice(livePrice)
                    .originalPrice(originalPrice != null ? originalPrice : product.getPrice())
                    .isFromLive(true)
                    .build();
        }

        cartItem.setTotalPrice(cartItem.getQuantity() * cartItem.getUnitPrice());
        cart.getItems().put(itemKey, cartItem);

        cart.calculateTotalAmount();
        saveCart(userId, cart);
        
        // Live items might not need sync if price is fixed for session, but adding just in case or skip
        // For now, let's track them too so availability updates propagate
        addProductToUserIndex(productId, userId);
        
        log.info("Added live item to cart: userId={}, productId={}, liveRoomId={}, livePrice={}", 
                userId, productId, liveRoomId, livePrice);
        return cartItem;
    }

    // Cập nhật số lượng của một item trong giỏ hàng
    public RedisCartItemDto updateCartItem(String userId, String productId, String sizeId, int quantity) {
        RedisCartDto cart = getCartByUserId(userId); // Lấy giỏ hàng từ Redis
        if (cart == null) {
            throw new RuntimeException("Cart not found for user: " + userId);
        }

        String itemKey = productId + (sizeId != null && !sizeId.isEmpty() ? ":" + sizeId : "");
        RedisCartItemDto item = cart.getItems().get(itemKey);
        
        if (item == null && (sizeId == null || sizeId.isEmpty())) {
            item = cart.getItems().get(productId);
        }
        
        if (item == null) {
            throw new RuntimeException("Item not found in cart for key: " + itemKey);
        }

        // Validate stock before updating quantity
        int availableStock = 0;
        if (sizeId != null && !sizeId.isEmpty()) {
            Size size = sizeRepository.findById(sizeId).orElse(null);
            if (size != null) {
                availableStock = size.getStock();
            }
        } else {
            // If no size, check product's first size or product stock
            Product product = productService.getProductById(productId);
            if (product != null && product.getSizes() != null && !product.getSizes().isEmpty()) {
                availableStock = product.getSizes().stream()
                        .mapToInt(Size::getStock)
                        .sum();
            }
        }

        if (quantity > availableStock) {
            throw new RuntimeException("INSUFFICIENT_STOCK:" + availableStock);
        }

        item.setQuantity(quantity); // Cập nhật số lượng
        item.setTotalPrice(item.getUnitPrice() * quantity); // Cập nhật tổng giá tiền của item

        cart.calculateTotalAmount();
        saveCart(userId, cart);

        return item;
    }

    // Xóa một item khỏi giỏ hàng
    public void removeCartItem(String userId, String productId, String sizeId) {
        log.info("[REDIS] Starting removeCartItem - userId: {}, productId: {}, sizeId: {}", 
            userId, productId, sizeId);
        
        RedisCartDto cart = getCartByUserId(userId);
        if (cart == null) {
            log.error("[REDIS] Cart not found for userId: {}", userId);
            throw new RuntimeException("Cart not found for user: " + userId);
        }

        String itemKey = productId + (sizeId != null && !sizeId.isEmpty() ? ":" + sizeId : "");
        log.info("[REDIS] Generated itemKey: {}, Available keys in cart: {}", itemKey, cart.getItems().keySet());
        
        RedisCartItemDto removed = cart.getItems().remove(itemKey);
        if (removed == null) {
            log.warn("[REDIS] Item not found with key: {}, Available keys: {}", itemKey, cart.getItems().keySet());
        } else {
            log.info("[REDIS] Successfully removed item: {}, quantity: {}, totalPrice: {}", 
                itemKey, removed.getQuantity(), removed.getTotalPrice());
        }
        
        cart.calculateTotalAmount();
        log.info("[REDIS] Updated cart totalAmount: {}", cart.getTotalAmount());
        saveCart(userId, cart);
        
        if (removed != null) {
            // Only remove from index if user has no other items of this product (e.g. different size)
            // Ideally we check if cart has any other items with same productId
            boolean hasSameProduct = cart.getItems().values().stream()
                .anyMatch(i -> i.getProductId().equals(productId));
                
            if (!hasSameProduct) {
                removeProductFromUserIndex(productId, userId);
            }
        }
        
        log.info("[REDIS] Cart saved to Redis after removal");
    }
    
    // Xóa một item khỏi giỏ hàng theo cartItemId
    public void removeCartItemByCartItemId(String userId, String cartItemId) {
        RedisCartDto cart = getCartByUserId(userId);
        if (cart == null) {
            throw new RuntimeException("Cart not found for user: " + userId);
        }

        log.info("Removing cartItemId: {} from userId: {}", cartItemId, userId);
        log.info("Current cart items before removal: {}", cart.getItems().keySet());
        
        // Find and remove the item by cartItemId
        boolean removed = cart.getItems().entrySet().removeIf(entry -> 
            entry.getValue().getCartItemId().equals(cartItemId)
        );
        
        if (!removed) {
            log.warn("CartItem with ID {} not found in cart", cartItemId);
            throw new RuntimeException("CartItem with ID " + cartItemId + " not found");
        }
        
        log.info("Cart item removed successfully. Remaining items: {}", cart.getItems().keySet());
        
        cart.calculateTotalAmount();
        saveCart(userId, cart);
    }

    // Xóa tất cả items của nhiều sản phẩm khỏi giỏ hàng
    public void removeCartItems(String userId, List<String> productIds) {
        RedisCartDto cart = getCartByUserId(userId);
        if (cart == null) {
            throw new RuntimeException("Cart not found for user: " + userId);
        }

        for (String productId : productIds) {
            cart.getItems().entrySet().removeIf(entry -> entry.getValue().getProductId().equals(productId));
            // In batch remove, we can probably safely remove from index
            removeProductFromUserIndex(productId, userId);
        }
        cart.calculateTotalAmount();
        saveCart(userId, cart);
    }

    public void clearCart(String userId) {
        String key = CART_KEY_PREFIX + userId;
        redisTemplate.delete(key);
    }

    public void deleteCartByCartId(String cartId) {
        redisTemplate.delete(cartId);
    }
    
    // Reverse Index Key for Product -> Carts
    private String getProductCartKey(String productId) {
        return "product:cart_ids:" + productId;
    }
    
    // Refresh all carts that contain a specific product
    public void refreshCartsContainingProduct(String productId) {
        String productKey = getProductCartKey(productId);
        
        // Use sets member to find all userIds
        java.util.Set<Object> userIds = redisTemplate.opsForSet().members(productKey);
        
        if (userIds != null && !userIds.isEmpty()) {
            log.info("Refreshing carts for product {}. User count: {}", productId, userIds.size());
            for (Object userIdObj : userIds) {
                String userId = (String) userIdObj;
                try {
                    getCartWithRefresh(userId);
                } catch (Exception e) {
                    log.error("Failed to refresh cart for user {}", userId, e);
                }
            }
        }
    }
    
    private void addProductToUserIndex(String productId, String userId) {
        try {
            redisTemplate.opsForSet().add(getProductCartKey(productId), userId);
        } catch (Exception e) {
            log.error("Failed to add to index: productId={} userId={}", productId, userId, e);
        }
    }
    
    private void removeProductFromUserIndex(String productId, String userId) {
        try {
            redisTemplate.opsForSet().remove(getProductCartKey(productId), userId);
        } catch (Exception e) {
            log.error("Failed to remove from index: productId={} userId={}", productId, userId, e);
        }
    }
}