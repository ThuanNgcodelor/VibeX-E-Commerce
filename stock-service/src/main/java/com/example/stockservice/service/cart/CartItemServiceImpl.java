package com.example.stockservice.service.cart;

import com.example.stockservice.model.Cart;
import com.example.stockservice.model.CartItem;
import com.example.stockservice.model.Product;
import com.example.stockservice.model.Size;
import com.example.stockservice.repository.CartItemRepository;
import com.example.stockservice.repository.CartRepository;
import com.example.stockservice.repository.SizeRepository;
import com.example.stockservice.request.cart.AddCartItemRequest;
import com.example.stockservice.request.cart.AddLiveCartItemRequest;
import com.example.stockservice.request.cart.UpdateCartItemRequest;
import com.example.stockservice.service.product.ProductService;
import com.example.stockservice.service.analytics.RedisAnalyticsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CartItemServiceImpl implements CartItemService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductService productService;
    private final SizeRepository sizeRepository;
    private final RedisAnalyticsService redisAnalyticsService;

    @Override
    @Transactional
    public CartItem addCartItem(AddCartItemRequest request, String userId) {
        Cart cart = getOrCreateCart(userId);
        Product product = productService.getProductById(request.getProductId());
        if (product == null) {
            throw new RuntimeException("Product not found with id: " + request.getProductId());
        }

        Size size = null;
        double unitPrice = product.getPrice();
        int availableStock = 0;

        if (request.getSizeId() != null && !request.getSizeId().isEmpty()) {
            size = sizeRepository.findById(request.getSizeId())
                    .orElseThrow(() -> new RuntimeException("Size not found with id: " + request.getSizeId()));
            unitPrice = product.getPrice() + size.getPriceModifier();
            availableStock = size.getStock();
        } else if (product.getSizes() != null && !product.getSizes().isEmpty()) {
            availableStock = product.getSizes().stream()
                    .mapToInt(Size::getStock)
                    .sum();
        }

        // Find existing cart item
        Optional<CartItem> existingItem = findCartItem(cart.getId(), request.getProductId(), request.getSizeId());

        CartItem cartItem;
        int newQuantity;

        if (existingItem.isPresent()) {
            cartItem = existingItem.get();
            newQuantity = cartItem.getQuantity() + request.getQuantity();
        } else {
            cartItem = CartItem.builder()
                    .cart(cart)
                    .product(product)
                    .size(size)
                    .quantity(0)
                    .unitPrice(unitPrice)
                    .build();
            newQuantity = request.getQuantity();
        }

        // Validate stock
        if (newQuantity > availableStock) {
            throw new RuntimeException("INSUFFICIENT_STOCK:" + availableStock);
        }

        cartItem.setQuantity(newQuantity);
        cartItem.setTotalPrice(unitPrice * newQuantity);

        cartItem = cartItemRepository.save(cartItem);

        // Update cart total
        cart.updateTotalAmount();
        cartRepository.save(cart);

        // Analytics
        redisAnalyticsService.incrementAddToCart(request.getProductId());

        log.info("Added item to cart: userId={}, productId={}, quantity={}", userId, request.getProductId(),
                newQuantity);
        return cartItem;
    }

    @Override
    @Transactional
    public CartItem addLiveCartItem(AddLiveCartItemRequest request, String userId) {
        Cart cart = getOrCreateCart(userId);
        Product product = productService.getProductById(request.getProductId());
        if (product == null) {
            throw new RuntimeException("Product not found with id: " + request.getProductId());
        }

        Size size = null;
        double finalLivePrice = request.getLivePrice() != null ? request.getLivePrice() : product.getPrice();

        if (request.getSizeId() != null && !request.getSizeId().isEmpty()) {
            size = sizeRepository.findById(request.getSizeId())
                    .orElseThrow(() -> new RuntimeException("Size not found with id: " + request.getSizeId()));
            finalLivePrice = request.getLivePrice() != null
                    ? request.getLivePrice() + size.getPriceModifier()
                    : product.getPrice() + size.getPriceModifier();
        }

        // For live items, we create a new item each time (different liveRoomId makes
        // them unique)
        CartItem cartItem = CartItem.builder()
                .cart(cart)
                .product(product)
                .size(size)
                .quantity(request.getQuantity())
                .unitPrice(finalLivePrice)
                .totalPrice(finalLivePrice * request.getQuantity())
                // Live commerce fields
                .liveRoomId(request.getLiveRoomId())
                .liveProductId(request.getLiveProductId())
                .livePrice(request.getLivePrice())
                .originalPrice(request.getOriginalPrice() != null ? request.getOriginalPrice() : product.getPrice())
                .isFromLive(true)
                .build();

        cartItem = cartItemRepository.save(cartItem);

        // Update cart total
        cart.updateTotalAmount();
        cartRepository.save(cart);

        // Analytics
        redisAnalyticsService.incrementAddToCart(request.getProductId());

        log.info("Added live item to cart: userId={}, productId={}, liveRoomId={}, livePrice={}",
                userId, request.getProductId(), request.getLiveRoomId(), request.getLivePrice());
        return cartItem;
    }

    @Override
    @Transactional
    public CartItem updateCartItem(UpdateCartItemRequest request) {
        Cart cart = cartRepository.findByUserId(request.getUserId())
                .orElseThrow(() -> new RuntimeException("Cart not found for user: " + request.getUserId()));

        Optional<CartItem> existingItem = findCartItem(cart.getId(), request.getProductId(), request.getSizeId());
        if (existingItem.isEmpty()) {
            throw new RuntimeException("Item not found in cart for product: " + request.getProductId());
        }

        CartItem cartItem = existingItem.get();

        // Validate stock
        int availableStock = 0;
        if (request.getSizeId() != null && !request.getSizeId().isEmpty()) {
            Size size = sizeRepository.findById(request.getSizeId()).orElse(null);
            if (size != null) {
                availableStock = size.getStock();
            }
        } else {
            Product product = productService.getProductById(request.getProductId());
            if (product != null && product.getSizes() != null && !product.getSizes().isEmpty()) {
                availableStock = product.getSizes().stream()
                        .mapToInt(Size::getStock)
                        .sum();
            }
        }

        if (request.getQuantity() > availableStock) {
            throw new RuntimeException("INSUFFICIENT_STOCK:" + availableStock);
        }

        cartItem.setQuantity(request.getQuantity());
        cartItem.setTotalPrice(cartItem.getUnitPrice() * request.getQuantity());

        cartItem = cartItemRepository.save(cartItem);

        // Update cart total
        cart.updateTotalAmount();
        cartRepository.save(cart);

        log.info("Updated cart item: userId={}, productId={}, newQuantity={}",
                request.getUserId(), request.getProductId(), request.getQuantity());
        return cartItem;
    }

    @Override
    @Transactional
    public void removeCartItem(String userId, String productId, String sizeId) {
        log.info("Removing cart item - userId: {}, productId: {}, sizeId: {}", userId, productId, sizeId);

        Cart cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Cart not found for user: " + userId));

        Optional<CartItem> existingItem = findCartItem(cart.getId(), productId, sizeId);
        if (existingItem.isEmpty()) {
            log.warn("Item not found in cart: productId={}, sizeId={}", productId, sizeId);
            throw new RuntimeException("Item not found in cart");
        }

        CartItem cartItem = existingItem.get();
        cart.removeItem(cartItem);
        cartItemRepository.delete(cartItem);
        cartRepository.save(cart);

        log.info("Successfully removed cart item for userId: {}", userId);
    }

    @Override
    @Transactional
    public void removeCartItemByCartItemId(String userId, String cartItemId) {
        log.info("Removing cart item by ID - userId: {}, cartItemId: {}", userId, cartItemId);

        Cart cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Cart not found for user: " + userId));

        CartItem cartItem = cartItemRepository.findById(cartItemId)
                .orElseThrow(() -> new RuntimeException("CartItem with ID " + cartItemId + " not found"));

        // Verify the item belongs to this user's cart
        if (!cartItem.getCart().getId().equals(cart.getId())) {
            throw new RuntimeException("CartItem does not belong to user's cart");
        }

        cart.removeItem(cartItem);
        cartItemRepository.delete(cartItem);
        cartRepository.save(cart);

        log.info("Successfully removed cart item: {}", cartItemId);
    }

    private Cart getOrCreateCart(String userId) {
        return cartRepository.findByUserId(userId)
                .orElseGet(() -> {
                    Cart newCart = Cart.builder()
                            .userId(userId)
                            .totalAmount(0.0)
                            .build();
                    return cartRepository.save(newCart);
                });
    }

    private Optional<CartItem> findCartItem(String cartId, String productId, String sizeId) {
        if (sizeId != null && !sizeId.isEmpty()) {
            return cartItemRepository.findByCart_IdAndProduct_IdAndSize_Id(cartId, productId, sizeId);
        } else {
            return cartItemRepository.findByCart_IdAndProduct_IdAndSizeIsNull(cartId, productId);
        }
    }
}