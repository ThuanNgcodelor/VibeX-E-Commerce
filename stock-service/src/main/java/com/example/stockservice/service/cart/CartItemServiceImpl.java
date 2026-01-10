package com.example.stockservice.service.cart;

import com.example.stockservice.model.*;
import com.example.stockservice.repository.CartItemRepository;
import com.example.stockservice.repository.CartRepository;
import com.example.stockservice.repository.SizeRepository;
import com.example.stockservice.request.cart.AddCartItemRequest;
import com.example.stockservice.request.cart.AddLiveCartItemRequest;
import com.example.stockservice.request.cart.UpdateCartItemRequest;
import com.example.stockservice.service.product.ProductService;
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
    private final com.example.stockservice.service.flashsale.FlashSaleService flashSaleService;

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
        Double originalPrice = null;
        boolean isFlashSale = false;

        if (request.getSizeId() != null && !request.getSizeId().isEmpty()) {
            size = sizeRepository.findById(request.getSizeId())
                    .orElseThrow(() -> new RuntimeException("Size not found with id: " + request.getSizeId()));
            unitPrice = product.getPrice() + size.getPriceModifier();
        } else if (product.getSizes() != null && !product.getSizes().isEmpty()) {

        }

        // Check Flash Sale
        if (request.isFlashSale()) {
            FlashSaleProduct fsp = flashSaleService
                    .findActiveFlashSaleProduct(request.getProductId());
            if (fsp != null) {
                unitPrice = fsp.getSalePrice();
                originalPrice = fsp.getOriginalPrice();
                isFlashSale = true;

                boolean specificPriceFound = false;
                log.info("Checking Flash Sale sizes for product {}. Found {} sizes.", request.getProductId(),
                        fsp.getProductSizes() != null ? fsp.getProductSizes().size() : "null");

                if (size != null && fsp.getProductSizes() != null) {
                    for (FlashSaleProductSize fps : fsp.getProductSizes()) {
                        if (fps.getSizeId().equals(size.getId()) && fps.getFlashSalePrice() != null) {
                            unitPrice = fps.getFlashSalePrice();
                            specificPriceFound = true;
                            break;
                        }
                    }
                }

                if (!specificPriceFound && size != null) {
                    unitPrice += size.getPriceModifier();
                }

                // Validate Flash Sale Stock
                int currentFlashSaleSoldCount = fsp.getSoldCount();
                int limit = fsp.getFlashSaleStock();
                int remaining = limit - currentFlashSaleSoldCount;
                if (request.getQuantity() > remaining) {
                    throw new RuntimeException("FLASH_SALE_LIMIT_EXCEEDED: Only " + remaining + " items remaining.");
                }
            }
        }

        // Initialize availableStock
        int availableStock = 0;
        if (size != null) {
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

            if (isFlashSale) {
                cartItem.setUnitPrice(unitPrice);
                cartItem.setOriginalPrice(originalPrice);
                cartItem.setFlashSale(true);
            }
        } else {
            cartItem = CartItem.builder()
                    .cart(cart)
                    .product(product)
                    .size(size)
                    .quantity(0)
                    .unitPrice(unitPrice)
                    .originalPrice(originalPrice)
                    .isFlashSale(isFlashSale)
                    .build();
            newQuantity = request.getQuantity();
        }

        // Original code stock check:
        if (newQuantity > availableStock && availableStock > 0) {
        }

        // Check standard stock
        if (availableStock > 0 && newQuantity > availableStock) {
            throw new RuntimeException("INSUFFICIENT_STOCK:" + availableStock);
        }

        cartItem.setQuantity(newQuantity);
        cartItem.setTotalPrice(unitPrice * newQuantity);

        cartItem = cartItemRepository.save(cartItem);

        // Update cart total
        cart.updateTotalAmount();
        cartRepository.save(cart);

        log.info("Added item to cart: userId={}, productId={}, quantity={}, isFlashSale={}", userId,
                request.getProductId(), newQuantity, isFlashSale);
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
                    ? request.getLivePrice()
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

        log.info("Added live item to cart: userId={}, productId={}, liveRoomId={}, livePrice={}",
                userId, request.getProductId(), request.getLiveRoomId(), request.getLivePrice());
        return cartItem;
    }

    @Override
    @Transactional
    public CartItem updateCartItem(UpdateCartItemRequest request) {
        Cart cart = cartRepository.findByUserIdWithLock(request.getUserId())
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

        Cart cart = cartRepository.findByUserIdWithLock(userId)
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

        Cart cart = cartRepository.findByUserIdWithLock(userId)
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
        // 1. Try to find with LOCK (Serialize access for this user)
        Optional<Cart> lockedCart = cartRepository.findByUserIdWithLock(userId);
        if (lockedCart.isPresent()) {
            return lockedCart.get();
        }

        // 2. If not found, create new (Handle unique constraint race condition)
        try {
            Cart newCart = Cart.builder()
                    .userId(userId)
                    .totalAmount(0.0)
                    .build();
            return cartRepository.save(newCart);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // Race condition: Someone else created it. Lock and return.
            log.warn("Race condition creating cart for user {}, retrying with lock...", userId);
            return cartRepository.findByUserIdWithLock(userId)
                    .orElseThrow(() -> new RuntimeException("Cart creation failed after retry for user: " + userId));
        }
    }

    private Optional<CartItem> findCartItem(String cartId, String productId, String sizeId) {
        if (sizeId != null && !sizeId.isEmpty()) {
            return cartItemRepository.findByCart_IdAndProduct_IdAndSize_Id(cartId, productId, sizeId);
        } else {
            return cartItemRepository.findByCart_IdAndProduct_IdAndSizeIsNull(cartId, productId);
        }
    }
}