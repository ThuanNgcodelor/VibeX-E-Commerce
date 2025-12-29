package com.example.stockservice.service.cart;

import com.example.stockservice.model.Cart;

import java.util.List;

public interface CartService {
    Cart getCartByUserId(String userId);
    Cart initializeCart(String userId);
    void clearCart(String userId);
    Cart getUserCart(String userId, String cartId);
    Cart getCartById(String cartId);
    void clearCartByCartId(String cartId);
    void removeCartItemsAndUpdateCart(String userId, List<String> productIds);
    
    /**
     * Sync all cart items that reference the given product.
     * Updates unitPrice and totalPrice based on current product/size prices.
     * Called when shopowner updates product.
     */
    void syncCartItemsForProduct(String productId);
}

