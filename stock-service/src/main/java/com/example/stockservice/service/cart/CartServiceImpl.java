package com.example.stockservice.service.cart;

import com.example.stockservice.enums.ProductStatus;
import com.example.stockservice.model.Cart;
import com.example.stockservice.model.CartItem;
import com.example.stockservice.model.FlashSaleProduct;
import com.example.stockservice.model.Product;
import com.example.stockservice.model.Size;
import com.example.stockservice.repository.CartItemRepository;
import com.example.stockservice.repository.CartRepository;
import com.example.stockservice.repository.SizeRepository;
import com.example.stockservice.service.flashsale.FlashSaleService;
import com.example.stockservice.service.product.ProductService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CartServiceImpl implements CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final ProductService productService;
    private final SizeRepository sizeRepository;
    private final FlashSaleService flashSaleService;

    @Override
    public Cart getCartByUserId(String userId) {
        Cart cart = cartRepository.findByUserId(userId).orElse(null);
        if (cart != null && cart.getItems() != null) {
            // Refresh cart items with current product/size availability
            refreshCartItems(cart);
        }
        return cart;
    }

    /**
     * Refresh cart items with current product/size availability and stock info.
     * Sets transient fields: productAvailable, sizeAvailable, availableStock,
     * priceChanged, oldPrice
     */
    private void refreshCartItems(Cart cart) {
        for (CartItem item : cart.getItems()) {
            // Default values
            item.setProductAvailable(true);
            item.setSizeAvailable(true);
            item.setAvailableStock(Integer.MAX_VALUE);
            item.setPriceChanged(false);
            item.setOldPrice(null);

            // Skip live items - they keep their locked price
            if (Boolean.TRUE.equals(item.getIsFromLive())) {
                continue;
            }

            try {
                Product product = item.getProduct();
                if (product == null) {
                    // Try to fetch fresh product data
                    product = productService.getProductById(item.getProduct().getId());
                }

                if (product == null) {
                    // Product was deleted
                    item.setProductAvailable(false);
                    item.setAvailableStock(0);
                    log.warn("Product {} no longer exists",
                            item.getProduct() != null ? item.getProduct().getId() : "unknown");
                    continue;
                }

                // Check product status (BANNED, SUSPENDED, OUT_OF_STOCK)
                if (product.getStatus() == ProductStatus.BANNED ||
                        product.getStatus() == ProductStatus.SUSPENDED ||
                        product.getStatus() == ProductStatus.OUT_OF_STOCK) {
                    item.setProductAvailable(false);
                    item.setAvailableStock(0);
                    log.info("Product {} is {}", product.getId(), product.getStatus());
                    continue;
                }

                item.setProductAvailable(true);
                double currentPrice = product.getPrice();
                int currentStock = 0;

                if (item.getSize() != null) {
                    // Has size - get size info
                    Size size = sizeRepository.findById(item.getSize().getId()).orElse(null);

                    if (size == null) {
                        // Size was deleted
                        item.setSizeAvailable(false);
                        item.setAvailableStock(0);
                        log.warn("Size {} no longer exists for product {}", item.getSize().getId(), product.getId());
                        continue;
                    }

                    item.setSizeAvailable(true);
                    currentPrice = product.getPrice() + size.getPriceModifier();
                    currentStock = size.getStock();
                } else {
                    // No size - calculate total stock from all sizes
                    if (product.getSizes() != null && !product.getSizes().isEmpty()) {
                        currentStock = product.getSizes().stream()
                                .mapToInt(Size::getStock)
                                .sum();
                    }
                    item.setSizeAvailable(true);
                }

                // Update available stock
                item.setAvailableStock(currentStock);

                // Check if price changed
                if (Math.abs(item.getUnitPrice() - currentPrice) > 0.01) {
                    item.setOldPrice(item.getUnitPrice());
                    item.setPriceChanged(true);
                    log.info("Price changed for product {}: {} -> {}",
                            product.getId(), item.getUnitPrice(), currentPrice);
                    // Note: We don't update the stored unitPrice here, just flag it
                    // The user can see the change and decide to update or remove
                } else {
                    item.setPriceChanged(false);
                    item.setOldPrice(null);
                }

            } catch (Exception e) {
                log.error("Error refreshing cart item for product {}: {}",
                        item.getProduct() != null ? item.getProduct().getId() : "unknown", e.getMessage());
                // Keep available=true on error to not block user
            }
        }
    }

    @Override
    @Transactional
    public Cart initializeCart(String userId) {
        // Check if cart already exists
        return cartRepository.findByUserId(userId)
                .orElseGet(() -> {
                    Cart newCart = Cart.builder()
                            .userId(userId)
                            .totalAmount(0.0)
                            .build();
                    return cartRepository.save(newCart);
                });
    }

    @Override
    @Transactional
    public void clearCart(String userId) {
        cartRepository.findByUserId(userId).ifPresent(cart -> {
            cartItemRepository.deleteAllByCart_Id(cart.getId());
            cart.getItems().clear();
            cart.setTotalAmount(0.0);
            cartRepository.save(cart);
        });
    }

    @Override
    public Cart getUserCart(String userId, String cartId) {
        Cart cart = cartRepository.findByIdAndUserId(cartId, userId)
                .orElseThrow(
                        () -> new RuntimeException("Cart not found for user: " + userId + " and cartId: " + cartId));
        if (cart.getItems() != null) {
            refreshCartItems(cart);
        }
        return cart;
    }

    @Override
    public Cart getCartById(String cartId) {
        Cart cart = cartRepository.findById(cartId)
                .orElseThrow(() -> new RuntimeException("Cart not found with id: " + cartId));
        if (cart.getItems() != null) {
            refreshCartItems(cart);
        }
        return cart;
    }

    @Override
    @Transactional
    public void clearCartByCartId(String cartId) {
        cartRepository.findById(cartId).ifPresent(cart -> {
            cartItemRepository.deleteAllByCart_Id(cartId);
            cart.getItems().clear();
            cart.setTotalAmount(0.0);
            cartRepository.save(cart);
        });
    }

    @Override
    @Transactional
    public void removeCartItemsAndUpdateCart(String userId, List<String> productIds) {
        Cart cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("Cart not found for user: " + userId));

        cartItemRepository.deleteByCart_IdAndProduct_IdIn(cart.getId(), productIds);

        // Refresh cart items and recalculate total
        cart.getItems().removeIf(item -> productIds.contains(item.getProduct().getId()));
        cart.updateTotalAmount();
        cartRepository.save(cart);

        log.info("Removed {} products from cart for user: {}", productIds.size(), userId);
    }

    @Override
    @Transactional
    public void syncCartItemsForProduct(String productId) {
        log.info("Proactive sync: Updating cart items for product {}", productId);

        Product product = productService.getProductById(productId);
        List<CartItem> affectedItems = cartItemRepository.findAllByProduct_Id(productId);

        if (affectedItems.isEmpty()) {
            log.info("No cart items found for product {}", productId);
            return;
        }

        for (CartItem item : affectedItems) {
            // Skip live items - they keep their locked price
            if (Boolean.TRUE.equals(item.getIsFromLive())) {
                continue;
            }

            if (product == null) {
                // Product was deleted - mark item but don't delete
                log.warn("Product {} was deleted, cart item {} will show as unavailable", productId, item.getId());
                continue;
            }

            // Check if product is still available
            if (product.getStatus() == ProductStatus.BANNED ||
                    product.getStatus() == ProductStatus.SUSPENDED ||
                    product.getStatus() == ProductStatus.OUT_OF_STOCK) {
                // Product unavailable - nothing to update, refreshCartItems will handle display
                log.info("Product {} is {}, cart item {} will show as unavailable",
                        productId, product.getStatus(), item.getId());
                continue;
            }

            // Calculate new price
            double newUnitPrice = product.getPrice();
            Double newOriginalPrice = null;
            boolean shouldBeFlashSale = false;

            // Check if Flash Sale is active for this product
            FlashSaleProduct fsProduct = flashSaleService.findActiveFlashSaleProduct(productId);
            if (fsProduct != null) {
                int remaining = fsProduct.getFlashSaleStock() - fsProduct.getSoldCount();
                if (remaining > 0) {
                    shouldBeFlashSale = true;
                    newUnitPrice = fsProduct.getSalePrice();
                    newOriginalPrice = fsProduct.getOriginalPrice();

                    // Check for size-specific Flash Sale price
                    if (item.getSize() != null && fsProduct.getProductSizes() != null) {
                        for (com.example.stockservice.model.FlashSaleProductSize fpSize : fsProduct.getProductSizes()) {
                            if (fpSize.getSizeId().equals(item.getSize().getId())
                                    && fpSize.getFlashSalePrice() != null) {
                                newUnitPrice = fpSize.getFlashSalePrice();
                                break;
                            }
                        }
                    }
                }
            }

            // If not Flash Sale, check regular size modifier
            if (!shouldBeFlashSale && item.getSize() != null) {
                Size size = sizeRepository.findById(item.getSize().getId()).orElse(null);
                if (size != null) {
                    newUnitPrice = product.getPrice() + size.getPriceModifier();
                }
            }

            // Update price and Flash Sale flag if changed
            boolean priceChanged = Math.abs(item.getUnitPrice() - newUnitPrice) > 0.01;
            boolean flashSaleChanged = !java.util.Objects.equals(item.isFlashSale(), shouldBeFlashSale);

            if (priceChanged || flashSaleChanged) {
                log.info("Updating cart item {} - price: {} -> {}, isFlashSale: {} -> {}",
                        item.getId(), item.getUnitPrice(), newUnitPrice, item.isFlashSale(), shouldBeFlashSale);
                item.setUnitPrice(newUnitPrice);
                item.setOriginalPrice(newOriginalPrice);
                item.setFlashSale(shouldBeFlashSale);
                item.setTotalPrice(newUnitPrice * item.getQuantity());
                cartItemRepository.save(item);

                // Recalculate cart total
                if (item.getCart() != null) {
                    item.getCart().updateTotalAmount();
                    cartRepository.save(item.getCart());
                }
            }
        }

        log.info("Proactive sync completed for product {}. Updated {} items.", productId, affectedItems.size());
    }
}